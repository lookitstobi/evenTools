# DGUV CSV Print Agent (MVP)

Der Agent läuft lokal auf dem PC mit Brother-Software und verarbeitet Druckjobs aus `dguv_api.php`.

## 1) Server konfigurieren

In der Laufzeitumgebung des Portals eine Agent-Token Variable setzen:

```bash
export DGUV_AGENT_TOKEN='BITTE_STARKES_TOKEN_SETZEN'
```

Danach PHP/Container neu starten, damit `app/config.php` den Wert übernimmt.

## 2) Agent starten

```bash
php dguv_print_agent.php \
  --api="https://DEIN-HOST/dguv_api.php" \
  --token="BITTE_STARKES_TOKEN_SETZEN" \
  --csv="/pfad/zur/brother_input.csv" \
  --agent-name="brother-pc-1" \
  --open-cmd='"C:/Program Files/Brother/P-touch Editor/P-touch Editor.exe" {csv}' \
  --print-cmd='"C:/Program Files/Brother/P-touch Editor/P-touch Editor.exe" /print {csv}'
```

Hinweise:
- Wenn die Brother-Software keine CLI-Flags unterstützt, `--open-cmd` konfigurieren und den Druck manuell in der Anwendung starten.
- `--once` verarbeitet nur einen Poll-Zyklus (gut zum Testen).
- Ohne `--print-cmd` nutzt `print_now` automatisch `--open-cmd`.

## 3) Workflow im Tool

1. In `dguv_v3` Datensätze auswählen oder filtern.
2. Modus wählen: `Nur Software öffnen` oder `Direkt drucken`.
3. Druckjob erzeugen.
4. Agent schreibt CSV und startet den konfigurierten Befehl.

## Sicherheit

- Token nicht im Repo speichern.
- Agent nur in vertrauenswürdigem Netzwerk betreiben.
- Befehle in `--open-cmd`/`--print-cmd` nur aus administrativ gepflegter Konfiguration beziehen.
