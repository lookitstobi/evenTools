# DGUV Device Agent (MVP)

Der Device-Agent ist die lokale Bridge zwischen `dguv_api.php` und dem Prüfgerät-Workflow.

## Start

```bash
php dguv_device_agent.php \
  --api="https://DEIN-HOST/dguv_api.php" \
  --token="BITTE_STARKES_TOKEN_SETZEN" \
  --export-json="/pfad/device_export.json" \
  --agent-name="device-bridge-1" \
  --export-cmd='dein-bridge-tool --input {json}'
```

Optional:

- `--once` nur ein Poll-Zyklus
- `--interval=3` Polling-Intervall in Sekunden
- `--import-json=/pfad/device_import.json` für Rückimport vom Prüfgerät

## Export-Flow

1. Im Tool `Ausgewählte an Prüfgerät` oder `Gefilterte an Prüfgerät` auslösen.
2. Agent claimt den nächsten `device_job`.
3. Agent schreibt den Job als JSON nach `--export-json`.
4. Optional startet `--export-cmd` den lokalen Bridge-Transfer zum Prüfgerät.

## Import-Flow

1. Prüfgerät-Daten als JSON-Datei in `--import-json` bereitstellen.
2. Agent sendet Datensätze an `agent_push_import`.
3. API ordnet anhand `asset_uid` zu oder legt Einträge ins Zwischenlager.

## Sicherheit

- Token nur über Runtime-Umgebung setzen.
- Agent nur in vertrauenswürdigem Netz betreiben.
- `--export-cmd` nur administrativ gepflegt konfigurieren.
