#!/bin/bash
# Deploy-Skript für Strato via SFTP
# Liest Credentials aus .env.local
# Usage: ./deploy.sh [optional: specific-file.php]

# Lade Credentials
if [ ! -f "$(dirname "$0")/.env.local" ]; then
  echo "❌ .env.local nicht gefunden!"
  exit 1
fi

set -a
source "$(dirname "$0")/.env.local"
set +a

# Farben für Output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Überprüfe ob lftp installiert ist
if ! command -v lftp &> /dev/null; then
  echo -e "${RED}❌ lftp nicht installiert. Installiere mit: apt-get install lftp${NC}"
  exit 1
fi

if [ -n "$1" ]; then
  # Deploy nur eine bestimmte Datei
  FILE="$1"
  LOCAL_PATH="$(dirname "$0")/$FILE"
  
  if [ ! -f "$LOCAL_PATH" ]; then
    echo -e "${RED}❌ Datei nicht gefunden: $LOCAL_PATH${NC}"
    exit 1
  fi
  
  echo -e "${YELLOW}📤 Uploading $FILE to $STRATO_HOST${NC}"
  
  lftp -u "$STRATO_USER,$STRATO_PASS" "$STRATO_HOST" <<EOF
set cmd:fail-exit yes
set net:timeout 60
set net:max-retries 5
set net:reconnect-interval-base 10
set net:reconnect-interval-multiplier 1
set sftp:auto-confirm yes
set ssl:verify-certificate no
put -O "$STRATO_PATH" "$LOCAL_PATH"
bye
EOF
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Erfolgreich hochgeladen: $FILE${NC}"
  else
    echo -e "${RED}❌ Upload fehlgeschlagen${NC}"
    exit 1
  fi
else
  # Deploy nur Code-Dateien (non-destructive)
  echo -e "${YELLOW}📦 Starte Code-Deployment (non-destructive)...${NC}"

  LFTP_SCRIPT=$(mktemp)
  LOCAL_DIR="$(dirname "$0")"
  cat > "$LFTP_SCRIPT" <<LFTP_EOF
set cmd:fail-exit yes
set net:timeout 60
set net:max-retries 5
set net:reconnect-interval-base 10
set net:reconnect-interval-multiplier 1
set sftp:auto-confirm yes
set ssl:verify-certificate no

# Root PHP-Dateien
put -O "$STRATO_PATH" "$LOCAL_DIR/_bootstrap.php"
put -O "$STRATO_PATH" "$LOCAL_DIR/admin_edit.php"
put -O "$STRATO_PATH" "$LOCAL_DIR/admin_users.php"
put -O "$STRATO_PATH" "$LOCAL_DIR/cuesheet_api.php"
put -O "$STRATO_PATH" "$LOCAL_DIR/dguv_api.php"
put -O "$STRATO_PATH" "$LOCAL_DIR/dguv_print_agent.php"
put -O "$STRATO_PATH" "$LOCAL_DIR/index.php"
put -O "$STRATO_PATH" "$LOCAL_DIR/login.php"
put -O "$STRATO_PATH" "$LOCAL_DIR/logout.php"
put -O "$STRATO_PATH" "$LOCAL_DIR/tool.php"
put -O "$STRATO_PATH" "$LOCAL_DIR/toolserve.php"

# App/Assets rekursiv, ohne Runtime-Daten
mirror -R --verbose --exclude=.git --exclude=.env* --exclude=.vscode --exclude=node_modules --exclude-glob=*.log --exclude=.htrouter.php --exclude-glob=*.sqlite "$LOCAL_DIR/app" "$STRATO_PATH/app"
mirror -R --verbose --exclude=.git --exclude=.env* --exclude=.vscode --exclude=node_modules --exclude-glob=*.log "$LOCAL_DIR/assets" "$STRATO_PATH/assets"

# Migrationsskript explizit
put -O "$STRATO_PATH/app" "$LOCAL_DIR/app/migrate.php"

bye
LFTP_EOF
  
  lftp -u "$STRATO_USER,$STRATO_PASS" "$STRATO_HOST" < "$LFTP_SCRIPT"
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Deployment abgeschlossen!${NC}"
  else
    echo -e "${RED}❌ Deployment fehlgeschlagen${NC}"
    exit 1
  fi
  
  rm "$LFTP_SCRIPT"
fi
