# Deploy-Runbook (daten-sicher)

Dieses Projekt deployt **Code und Laufzeitdaten getrennt**.

## Grundprinzip

- **Code** wird nach `STRATO_PATH` deployed.
- **Laufzeitdaten** (SQLite) liegen persistent unter `APP_DATA_DIR` (außerhalb Release-Baum).
- Deploy löscht nur innerhalb definierter Code-Pfade.
- Vor Deploy können Runtime-DBs serverseitig gesichert werden.

## Erforderliche Secrets (GitHub Actions)

- `STRATO_HOST`
- `STRATO_USER`
- `STRATO_PASS`
- `STRATO_PATH` (Code-Zielpfad)
- `STRATO_DATA_PATH` (persistenter Datenpfad, z. B. `/home/.../toolsapp_data`)
- `STRATO_BACKUP_PATH` (optional, Standard: `${STRATO_DATA_PATH}/backups`)
- `DEPLOY_BACKUP_ENABLED` (`1` oder `0`)
- `DEPLOY_STRICT_DATA_PATH` (`1` oder `0`, empfohlen: `1`)

## Erforderliche Server-Umgebung

- PHP muss `APP_DATA_DIR` auf den persistenten Datenpfad zeigen.
- Beispiel: `APP_DATA_DIR=/home/.../toolsapp_data`

Dann verwendet die App diese Dateien:

- `${APP_DATA_DIR}/users.sqlite`
- `${APP_DATA_DIR}/cuesheet.sqlite`
- `${APP_DATA_DIR}/dguv.sqlite`

## Deploy-Ablauf

1. Push nach `main` triggert GitHub Action.
2. `deploy.py` verbindet sich via SFTP.
3. Optionales Backup der SQLite-Dateien in `STRATO_BACKUP_PATH/deploy_<timestamp>/`.
4. Code-Deploy nach `STRATO_PATH` (nur erlaubte Pfade).
5. Delete nur in deployten Code-Pfaden.
6. Migration auf Server ausführen:

```bash
php app/migrate.php
```

## Wichtige Hinweise

- `deploy.sh` ist auf non-destructive code-only Deploy umgestellt.
- `.vscode/sftp.json` hat `uploadOnSave=false` und excludet `*.sqlite`.
- Für Produktion sollte nur die GitHub Action verwendet werden.
- In GitHub Actions bricht `deploy.py` ohne `STRATO_DATA_PATH` standardmäßig ab (`DEPLOY_STRICT_DATA_PATH=1`).

## Was du jetzt aktiv tun musst

1. Auf dem Server einen persistenten Datenordner anlegen (falls noch nicht vorhanden), z. B. `/home/.../toolsapp_data`.
2. In der Server-/PHP-Umgebung `APP_DATA_DIR` auf genau diesen Ordner setzen.
3. In GitHub Secrets setzen:
   - `STRATO_DATA_PATH` = derselbe persistente Ordner
   - optional `STRATO_BACKUP_PATH`
   - optional `DEPLOY_BACKUP_ENABLED=1`
   - optional `DEPLOY_STRICT_DATA_PATH=1`
4. Ein Deploy auslösen (Push auf `main`).
5. Auf dem Server im Deploy-Verzeichnis einmal ausführen: `php app/migrate.php`.
6. Funktionstest: In der App Benutzer anlegen/ändern, erneut deployen, prüfen ob Daten unverändert bleiben.
