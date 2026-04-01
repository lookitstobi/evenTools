#!/bin/bash
# Synchronisiert die Nutzerdatenbank (users.sqlite) zwischen
# dem Strato-Produktivserver und dem lokalen Codespace-Preview.
#
# Usage:
#   ./sync_users.sh pull   — Server → Lokal  (Nutzer vom Server holen)
#   ./sync_users.sh push   — Lokal → Server  (Lokale Änderungen auf Server übertragen)

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env.local nicht gefunden!"
  exit 1
fi

# Variablen sicher aus .env.local lesen (verhindert Shell-Expansion von Sonderzeichen wie $)
# und liefert bei fehlendem Key eine leere Zeichenkette (wichtig wegen set -e).
_env_get() {
  grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- || true
}
STRATO_HOST="$(_env_get STRATO_HOST)"
STRATO_USER="$(_env_get STRATO_USER)"
STRATO_PASS="$(_env_get STRATO_PASS)"
STRATO_PATH="$(_env_get STRATO_PATH)"
APP_DATA_DIR_LOCAL="$(_env_get APP_DATA_DIR)"

# Lokalen DB-Pfad aus app/config.php ermitteln, damit APP_DATA_DIR/Fallback-Logik konsistent ist.
resolve_local_db_path() {
  if [ -n "$APP_DATA_DIR_LOCAL" ]; then
    APP_DATA_DIR="$APP_DATA_DIR_LOCAL" php -r '$c=require "app/config.php"; echo $c["db_path"];' 2>/dev/null
    return
  fi

  php -r '$c=require "app/config.php"; echo $c["db_path"];' 2>/dev/null
}

LOCAL_DB="$(cd "$SCRIPT_DIR" && resolve_local_db_path)"
if [ -z "$LOCAL_DB" ]; then
  LOCAL_DB="$SCRIPT_DIR/app/users.sqlite"
fi

LOCAL_DB_DIR="$(dirname "$LOCAL_DB")"
mkdir -p "$LOCAL_DB_DIR"

# Remote-Pfad: SFTP-Root ist direkt das App-Verzeichnis (data/ liegt direkt darunter)
REMOTE_DB="/data/users.sqlite"

# Farben
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

sftp_download() {
  local remote="$1"
  local local_target="$2"
  lftp -u "$STRATO_USER,$STRATO_PASS" "sftp://$STRATO_HOST" <<EOF
set net:timeout 60
set net:max-retries 3
set sftp:auto-confirm yes
set ssl:verify-certificate no
set xfer:clobber yes
get "$remote" -o "$local_target"
bye
EOF
}

sftp_upload() {
  local local_src="$1"
  local remote_dir="$2"
  lftp -u "$STRATO_USER,$STRATO_PASS" "sftp://$STRATO_HOST" <<EOF
set net:timeout 60
set net:max-retries 3
set sftp:auto-confirm yes
set ssl:verify-certificate no
put "$local_src" -o "$remote_dir"
bye
EOF
}

CMD="${1:-}"

case "$CMD" in
  pull)
    echo -e "${YELLOW}⬇  Lade users.sqlite vom Server...${NC}"
    echo -e "   Lokales Ziel: $LOCAL_DB"
    BACKUP="$LOCAL_DB.bak_$(date +%Y%m%d_%H%M%S)"
    if [ -f "$LOCAL_DB" ]; then
      cp "$LOCAL_DB" "$BACKUP"
      echo -e "   Backup angelegt: $BACKUP"
    fi
    sftp_download "$REMOTE_DB" "$LOCAL_DB"
    echo -e "${GREEN}✅ users.sqlite erfolgreich vom Server geladen.${NC}"
    ;;

  push)
    echo -e "${YELLOW}⬆  Lade users.sqlite auf den Server...${NC}"
    echo -e "   Lokale Quelle: $LOCAL_DB"
    if [ ! -f "$LOCAL_DB" ]; then
      echo -e "${RED}❌ Lokale DB nicht gefunden: $LOCAL_DB${NC}"
      exit 1
    fi
    sftp_upload "$LOCAL_DB" "$REMOTE_DB"
    echo -e "${GREEN}✅ users.sqlite erfolgreich auf den Server hochgeladen.${NC}"
    ;;

  *)
    echo "Usage: $0 pull|push"
    echo ""
    echo "  pull  — Server → Lokal  (Nutzer vom Server holen)"
    echo "  push  — Lokal → Server  (Lokale Änderungen auf Server übertragen)"
    exit 1
    ;;
esac
