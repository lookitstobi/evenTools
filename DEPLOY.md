# Deploy-Runbook (daten-sicher)

Dieses Projekt deployt **Code und Laufzeitdaten getrennt**, damit Benutzer-/Tooldaten bei Deploys erhalten bleiben.

## Zielbild

- **Code** wird nach `STRATO_PATH` deployed.
- **Laufzeitdaten** (`*.sqlite`) liegen unter `APP_DATA_DIR`.
- Deploy löscht nur innerhalb definierter **Code-Pfade**, niemals Runtime-Daten.
- Vor Deploy wird optional ein Backup der Laufzeitdaten erstellt.

## Aktuelles Produktiv-Setup (Strato)

Serverpfade:

- App-Root: `/home/www/HTML_Tools/toolsapp`
- Runtime-Daten: `/home/www/HTML_Tools/toolsapp/data`
- Runtime-Backups: `/home/www/HTML_Tools/toolsapp/data/backups`

In `.htaccess` ist gesetzt:

```apache
SetEnv APP_DATA_DIR /home/www/HTML_Tools/toolsapp/data
```

## GitHub-Secrets (soll)

- `STRATO_HOST`
- `STRATO_USER`
- `STRATO_PASS`
- `STRATO_PATH=.`
- `STRATO_DATA_PATH=data`
- `STRATO_BACKUP_PATH=data/backups`
- `DEPLOY_BACKUP_ENABLED=1`
- `DEPLOY_STRICT_DATA_PATH=1`

Hinweis: Werte in GitHub Secrets **ohne Anführungszeichen** eintragen.

## Erstinbetriebnahme / Neuaufbau

1. SSH auf den Server.
2. In App-Root wechseln: `cd /home/www/HTML_Tools/toolsapp`.
3. Datenordner erstellen: `mkdir -p data/backups`.
4. Schreibtest: `touch data/.write_test && rm data/.write_test`.
5. Migration mit explizitem Datenpfad:
6. Vendor-Bibliotheken für pegelTool herunterladen:

```bash
php download_vendor.php
```

Dieses Skript lädt Chart.js, jsPDF und pdf-lib lokal in `app/tools/pegelTool/vendor/` herunter.
Ohne diese Dateien ist die PDF-Export-Funktion im pegelTool nicht verfügbar.

```bash
APP_DATA_DIR=/home/www/HTML_Tools/toolsapp/data php app/migrate.php
```

1. Prüfen, ob DB-Dateien da sind:

```bash
ls -lah /home/www/HTML_Tools/toolsapp/data/*.sqlite
```

## Standard-Deployablauf

1. Push nach `main`.
2. Firewall-Guard muss grün sein (`.github/workflows/firewall-guard.yml`).
3. GitHub Action führt `deploy.py` aus.
4. Backup-Rhythmus:
   - Standard: maximal ein Backup alle 6 Stunden (`DEPLOY_BACKUP_INTERVAL_SECONDS=21600`).
   - Wenn seit dem letzten Deploy-Backup mehr als 6 Stunden vergangen sind, wird beim nächsten Deploy automatisch ein Backup erstellt.
   - Override: Wenn die **erste Zeile** der Commit-Message mit `#BACKUP` beginnt, wird Backup immer erzwungen.
5. Optionales Backup nach `data/backups/deploy_<timestamp>/`.
6. Code-Sync nach `STRATO_PATH`.
7. Optional bei Schemaänderungen: Migration ausführen.

## Verifikation nach Deploy (Smoke Test)

Im SSH-Terminal:

```bash
cd /home/www/HTML_Tools/toolsapp
php -r '$c=require "app/config.php"; echo "db=".$c["db_path"].PHP_EOL;'
php -r '$c=require "app/config.php"; $db=new PDO("sqlite:".$c["db_path"]); foreach($db->query("SELECT username FROM users ORDER BY id DESC LIMIT 5") as $r){echo $r["username"].PHP_EOL;}'
```

Im Browser:

1. Test-User anlegen.
2. Deploy auslösen.
3. Test-User muss weiterhin vorhanden sein.

## Wichtige Betriebsregeln

- Produktion nur über GitHub Action deployen.
- `deploy.sh` nur für Ausnahmefälle/gezielte manuelle Uploads.
- VS Code SFTP `uploadOnSave` bleibt aus.
- Runtime-DB-Dateien nie ins Repo committen (`*.sqlite` ist ignoriert).
- Für CLI-Kommandos gilt `.htaccess`-`SetEnv` nicht zuverlässig; bei Bedarf `APP_DATA_DIR=...` explizit voranstellen.

## Preview-Sync der Nutzer (Live -> Codespace)

- Wenn ein Nutzer auf der Live-Seite neu angelegt wurde und in der Preview fehlt, zuerst synchronisieren:

```bash
cd /workspaces/toolsapp
./sync_users.sh pull
```

- Das Skript ermittelt den lokalen Zielpfad über `app/config.php` (inklusive `APP_DATA_DIR`-Logik) und legt vor dem Überschreiben automatisch ein Backup an.

## Häufige Fehlerbilder und Lösung

### 1) Doppelte Ordnerstruktur (`.../toolsapp/HTML_Tools/toolsapp`)

Ursache: `STRATO_PATH` falsch gesetzt (z. B. `HTML_Tools/toolsapp` statt `.`).

Lösung:

- Secret auf `STRATO_PATH=.` setzen.
- Erneut deployen.
- Altstruktur nach Backup entfernen.

### 2) `unrecognized token: "\\"` bei Migration

Ursache: alter Stand von `dguv_lib.php`.

Lösung:

- Neu deployen (enthält SQL-Fix).
- Migration erneut ausführen.

### 3) `Read-only file system` beim Backup außerhalb App-Root

Ursache: übergeordneter Pfad nicht beschreibbar.

Lösung:

- Backups unter `data/backups` im App-Root ablegen.

### 4) `Could not open input file: app/migrate.php`

Ursache: alter Codepfad oder falsches Arbeitsverzeichnis.

Lösung:

- In `/home/www/HTML_Tools/toolsapp` wechseln.
- Prüfen: `ls -lah app/migrate.php`.

## Cleanup Altstruktur (einmalig)

1. Backup der verschachtelten Altstruktur:

```bash
cd /home/www/HTML_Tools/toolsapp
mkdir -p data/backups
tar -czf data/backups/nested_toolsapp_backup_$(date +%F_%H%M%S).tar.gz HTML_Tools/toolsapp
```

1. Entfernen:

```bash
rm -rf /home/www/HTML_Tools/toolsapp/HTML_Tools
```

1. Prüfen:

```bash
find /home/www/HTML_Tools/toolsapp -maxdepth 4 -type d -path "*/HTML_Tools/toolsapp"
```

Erwartung: nur noch `/home/www/HTML_Tools/toolsapp`.

## Recovery / Rollback (Daten)

Wenn ein Runtime-Problem auftritt:

1. Aktuelle DBs sichern:

```bash
cd /home/www/HTML_Tools/toolsapp
mkdir -p data/backups/manual_$(date +%F_%H%M%S)
cp -a data/*.sqlite data/backups/manual_$(date +%F_%H%M%S)/
```

1. Gewünschtes Backup zurückkopieren:

```bash
cp -a data/backups/<backup-ordner>/*.sqlite data/
```

1. App testen (Login + Benutzerliste + Toolzugriff).
