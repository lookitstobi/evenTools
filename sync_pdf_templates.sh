#!/bin/bash
# Synchronisiert die PDF-Template-Datenbank bidirektional zwischen
# Produktion (Strato) und lokalem Codespace.
#
# Modi:
#   auto   -> entscheidet per Inhalt/Stand, welche Seite neuer ist
#   pull   -> Produktion -> Lokal erzwingen
#   push   -> Lokal -> Produktion erzwingen
#   status -> nur vergleichen, nichts schreiben

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.local"
BACKUP_DIR="$SCRIPT_DIR/.sync-backups/pdf_templates"
mkdir -p "$BACKUP_DIR"

QUIET=0
MODE="${1:-auto}"
if [[ "${2:-}" == "--quiet" || "${1:-}" == "--quiet" ]]; then
  QUIET=1
  if [[ "${1:-}" == "--quiet" ]]; then
    MODE="${2:-auto}"
  fi
fi

log() {
  if [[ "$QUIET" -eq 0 ]]; then
    echo "$@"
  fi
}

err() {
  echo "$@" >&2
}

if [[ ! -f "$ENV_FILE" ]]; then
  err "❌ .env.local nicht gefunden."
  exit 1
fi

_env_get() {
  grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- || true
}

STRATO_HOST="$(_env_get STRATO_HOST)"
STRATO_USER="$(_env_get STRATO_USER)"
STRATO_PASS="$(_env_get STRATO_PASS)"
APP_DATA_DIR_LOCAL="$(_env_get APP_DATA_DIR)"
STRATO_DATA_PATH="$(_env_get STRATO_DATA_PATH)"

if [[ -z "$STRATO_DATA_PATH" ]]; then
  STRATO_DATA_PATH="data"
fi

if [[ -z "$STRATO_HOST" || -z "$STRATO_USER" || -z "$STRATO_PASS" ]]; then
  err "❌ STRATO_HOST/STRATO_USER/STRATO_PASS fehlen in .env.local."
  exit 1
fi

if ! command -v lftp >/dev/null 2>&1; then
  err "❌ lftp nicht installiert."
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  err "❌ sqlite3 nicht installiert."
  exit 1
fi

resolve_local_pdf_db_path() {
  if [[ -n "$APP_DATA_DIR_LOCAL" ]]; then
    APP_DATA_DIR="$APP_DATA_DIR_LOCAL" php -r '$c=require "app/config.php"; echo $c["pdf_template_db_path"];' 2>/dev/null
    return
  fi
  php -r '$c=require "app/config.php"; echo $c["pdf_template_db_path"];' 2>/dev/null
}

LOCAL_DB="$(cd "$SCRIPT_DIR" && resolve_local_pdf_db_path)"
if [[ -z "$LOCAL_DB" ]]; then
  LOCAL_DB="$SCRIPT_DIR/app/pdf_templates.sqlite"
fi
mkdir -p "$(dirname "$LOCAL_DB")"

REMOTE_DB="/${STRATO_DATA_PATH#/}/pdf_templates.sqlite"

run_lftp() {
  local script="$1"
  lftp -u "$STRATO_USER,$STRATO_PASS" "sftp://$STRATO_HOST" <<EOF
set cmd:fail-exit yes
set net:timeout 60
set net:max-retries 3
set sftp:auto-confirm yes
set ssl:verify-certificate no
$script
bye
EOF
}

remote_exists() {
  if run_lftp "cls \"$REMOTE_DB\"" >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

download_remote() {
  local target="$1"
  run_lftp "set xfer:clobber yes
get \"$REMOTE_DB\" -o \"$target\"" >/dev/null
}

upload_remote() {
  local source="$1"
  run_lftp "put \"$source\" -o \"$REMOTE_DB\"" >/dev/null
}

hash_file() {
  local path="$1"
  sha256sum "$path" | awk '{print $1}'
}

iso_max_ts() {
  local path="$1"
  sqlite3 "$path" "
    SELECT COALESCE(MAX(ts), '')
    FROM (
      SELECT COALESCE(MAX(updated_at), '') AS ts FROM pdf_uploaded_templates
      UNION ALL
      SELECT COALESCE(MAX(assigned_at), '') AS ts FROM pdf_tool_assignments
    );
  " 2>/dev/null || true
}

template_count() {
  local path="$1"
  sqlite3 "$path" "SELECT COUNT(*) FROM pdf_uploaded_templates;" 2>/dev/null || echo "0"
}

assignment_count() {
  local path="$1"
  sqlite3 "$path" "SELECT COUNT(*) FROM pdf_tool_assignments;" 2>/dev/null || echo "0"
}

summarize_db() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    echo "missing|0|0|missing|0"
    return
  fi

  local ts cnt assign hash size
  ts="$(iso_max_ts "$path")"
  cnt="$(template_count "$path")"
  assign="$(assignment_count "$path")"
  hash="$(hash_file "$path")"
  size="$(stat -c %s "$path" 2>/dev/null || echo 0)"

  echo "${ts}|${cnt}|${assign}|${hash}|${size}"
}

compare_semantic_newer() {
  local lts="$1"
  local rts="$2"
  local lcnt="$3"
  local rcnt="$4"
  local lassign="$5"
  local rassign="$6"

  if [[ "$lts" > "$rts" ]]; then
    echo "local"
    return
  fi
  if [[ "$rts" > "$lts" ]]; then
    echo "remote"
    return
  fi

  if (( lcnt > rcnt )); then
    echo "local"
    return
  fi
  if (( rcnt > lcnt )); then
    echo "remote"
    return
  fi

  if (( lassign > rassign )); then
    echo "local"
    return
  fi
  if (( rassign > lassign )); then
    echo "remote"
    return
  fi

  echo "equal"
}

backup_file() {
  local source="$1"
  local prefix="$2"
  if [[ -f "$source" ]]; then
    local stamp
    stamp="$(date +%Y%m%d_%H%M%S)"
    cp "$source" "$BACKUP_DIR/${prefix}_${stamp}.sqlite"
    log "Backup: $BACKUP_DIR/${prefix}_${stamp}.sqlite"
  fi
}

pull_remote_to_local() {
  local remote_tmp="$1"
  if [[ ! -f "$remote_tmp" ]]; then
    err "❌ Kein Remote-Download verfügbar."
    exit 1
  fi
  backup_file "$LOCAL_DB" "local_before_pull"
  cp "$remote_tmp" "$LOCAL_DB"
  log "✅ Pull: Produktion -> Lokal abgeschlossen."
}

push_local_to_remote() {
  local remote_tmp="$1"
  if [[ ! -f "$LOCAL_DB" ]]; then
    err "❌ Lokale DB fehlt: $LOCAL_DB"
    exit 1
  fi
  backup_file "$LOCAL_DB" "local_before_push"
  backup_file "$remote_tmp" "remote_before_push"
  upload_remote "$LOCAL_DB"
  log "✅ Push: Lokal -> Produktion abgeschlossen."
}

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
REMOTE_TMP="$TMP_DIR/remote_pdf_templates.sqlite"

LOCAL_SUMMARY="$(summarize_db "$LOCAL_DB")"
IFS='|' read -r L_TS L_CNT L_ASSIGN L_HASH L_SIZE <<< "$LOCAL_SUMMARY"

REMOTE_AVAILABLE=0
if remote_exists; then
  REMOTE_AVAILABLE=1
  download_remote "$REMOTE_TMP"
fi

if [[ "$REMOTE_AVAILABLE" -eq 1 ]]; then
  REMOTE_SUMMARY="$(summarize_db "$REMOTE_TMP")"
else
  REMOTE_SUMMARY="missing|0|0|missing|0"
fi
IFS='|' read -r R_TS R_CNT R_ASSIGN R_HASH R_SIZE <<< "$REMOTE_SUMMARY"

log "Lokal : ts=${L_TS:-n/a}, templates=$L_CNT, assignments=$L_ASSIGN, size=$L_SIZE"
log "Remote: ts=${R_TS:-n/a}, templates=$R_CNT, assignments=$R_ASSIGN, size=$R_SIZE"

case "$MODE" in
  status)
    if [[ "$L_HASH" == "$R_HASH" ]]; then
      log "✅ Status: identisch"
    else
      log "⚠️ Status: unterschiedlich"
    fi
    ;;

  pull)
    if [[ "$REMOTE_AVAILABLE" -eq 0 ]]; then
      err "❌ Remote-DB nicht gefunden: $REMOTE_DB"
      exit 1
    fi
    pull_remote_to_local "$REMOTE_TMP"
    ;;

  push)
    if [[ ! -f "$LOCAL_DB" ]]; then
      err "❌ Lokale DB nicht gefunden: $LOCAL_DB"
      exit 1
    fi
    push_local_to_remote "$REMOTE_TMP"
    ;;

  auto)
    if [[ "$REMOTE_AVAILABLE" -eq 0 && ! -f "$LOCAL_DB" ]]; then
      err "❌ Weder lokale noch remote PDF-Template-DB vorhanden."
      exit 1
    fi

    if [[ "$REMOTE_AVAILABLE" -eq 1 && ! -f "$LOCAL_DB" ]]; then
      pull_remote_to_local "$REMOTE_TMP"
      exit 0
    fi

    if [[ "$REMOTE_AVAILABLE" -eq 0 && -f "$LOCAL_DB" ]]; then
      push_local_to_remote "$REMOTE_TMP"
      exit 0
    fi

    if [[ "$L_HASH" == "$R_HASH" ]]; then
      log "✅ Auto-Sync: bereits identisch"
      exit 0
    fi

    winner="$(compare_semantic_newer "$L_TS" "$R_TS" "$L_CNT" "$R_CNT" "$L_ASSIGN" "$R_ASSIGN")"

    if [[ "$winner" == "local" ]]; then
      log "ℹ️ Auto-Sync entscheidet: lokal ist neuer -> push"
      push_local_to_remote "$REMOTE_TMP"
    elif [[ "$winner" == "remote" ]]; then
      log "ℹ️ Auto-Sync entscheidet: remote ist neuer -> pull"
      pull_remote_to_local "$REMOTE_TMP"
    else
      # Gleichstand bei Zeit-/Mengensignalen: sichere Voreinstellung ist remote.
      log "⚠️ Auto-Sync Gleichstand: nehme remote als Quelle"
      pull_remote_to_local "$REMOTE_TMP"
    fi
    ;;

  *)
    err "Usage: $0 [auto|pull|push|status] [--quiet]"
    exit 1
    ;;
esac
