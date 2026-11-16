# pegelTool – Phase 1: Legacy-Vergleichsausgabe

**Baseline:** `main` @ `629ea5a75261894b8c741a4cdd5cb69d20f7efde`  
**Methodik:** Original-Parserfunktionen aus `index.html` mit DOM-Stubs ausgeführt, **nicht** unabhängige normkonforme Rechenengine. Werte in `tests/pegelTool/expected/legacy-baseline.json` sind erwartete **Altausgaben**; synthetische Fixtures sind deutlich kürzer als 30 min und für normative Beurteilung ungeeignet.

## Ausgeführte Parser-Referenzen

| Fall | Beobachtetes Legacy-Verhalten | Interpretation |
|---|---|---|
| Archivierter XL3-Log `archive/housekeeping_2026-04-28/2025-03-14_SLM_001_Log.txt` | **8441** Samples, `logIntervalSec=1`, `k1=-11.0`, `k2=-10.2`, `laeq_total=77.4`, `lcpeak_max=114.7`, `laeq_g30=null` | Das Archiv enthält eine `LAeq_dt+k1`-, aber keine `LAeq_g30`-Spalte. Rohdatei wird **nicht** dupliziert. Die Summary-Angaben sind Geräteaussagen, keine unabhängige Verifikation |
| `valid-with-summary` | 4 Samples, `LAeq_dt[0]=90`, Summary `LAeq_g30=100` und `LCpeak=136`, Korrekturen `-3.0/+2.0` | Basiskompatibilität mit erwarteter Spaltenreihenfolge; keine vollständige Halb-Stunden-Messung |
| `summary-layout-mismatch` | 2 Samples; Summary `LCpeak=101`, obwohl im bewusst abweichenden Summary-Aufbau als Peak **132** in Spalte 3 steht | Fehler reproduziert: Summary-Auswertung nutzt Zeitreihen-Index. Der synthetische Fall ist ein Negativtest, kein Beweis für tatsächliche XL3-Exportvariante |
| `missing-g30` | 1 Sample; `LAeq_g30=null`, Parser liefert `ok:true` | Fehlende Bewertungsreihe nicht als Importfehler erkannt |
| `duplicates-and-gap` | 3 Samples inkl. zweier gleicher Zeitstempel und Sprung auf 20:01 | Keine Datenqualitätswarnung durch Parser |
| `over-midnight` | Daten über 23:59:59 / 00:00:00 werden als Strings übernommen | Zeitumstellung/Mitternacht noch nicht validiert; reine Datenübernahme |
| `invalid-interval` | Unlesbares Intervall fällt auf 1 s zurück | Stiller Fallback |
| `invalid-not-xl3` / `only-missing-values` | Erster Fall `ok:false`; zweiter Fall `ok:true`, aber 0 Samples | Import wird später bei leerer Zeitreihe abgelehnt |

## Reproduzierter Anzeigen-Status als Legacy-Verhalten

- `addRow('LAeq_g30',98,99)`, `addRow('LAeq_g5',100,99)`, `addRow('LCpeak',120,135)`: eine `status-bad`-Zeile nur wegen G5. Fachlich problematisch; nicht als künftiges Soll übernehmen.
- `updateComplianceStatus()` setzt bei `logLoaded=true` und **0** Zeilen `status-ok`, weil nur vorhandene `status-bad`-Elemente gezählt werden. Das Verhalten beweist eine unzureichende Qualitätskopplung des Status.
- PDF-Template-`formatLevel` und `complianceStatus` wandeln mit `Number(value)` um; `Number(null)===0`. Somit kann fehlender `LAeq_g30` als `0.0 dB(A)` mit `OK` im PDF-Variablenmapping erscheinen. Das ist anhand der Codeausführung von JavaScript und des Source-Mappings nachvollziehbar; vollständiger PDF-Druck noch nicht geprüft.

## Speichern/Wiederherstellen

Die Legacy-Suite enthält logische Tests für Zustandsschema 1, JSON-Parsing, eingebettetes HTML-State-Parsing und Feldrückgabe. **Kein browserübergreifender Datei-Download-/Upload-End-to-End-Test** ausgeführt. Noch zu prüfen: FileReader, localStorage-Quota, Laden `.nti.json`, Wiederherstellen von Charts/PA, Vorlagen-PDF und Legacy-PDF als visuellem Golden Master.

## Manuelle Referenzfälle / noch offen

1. Browser (Desktop und schmaler Viewport): XL3-Import → Felder und Chart → beide Ergebniszeilen → Warnhinweise, Dateigrößenbegrenzung und fehlende Spalten.
2. Formfelder/PA-Preset ändern → `.nti.json` exportieren → Browser neu laden → Datei importieren → vergleichbare Werte/Formulare/PA/Diagramme.
3. HTML exportieren → Datei lokal öffnen → prüfen, ob Zustand wiederherstellbar ist; Netz- und Vorlagenabhängigkeiten separat dokumentieren.
4. Server mit Zugriff auf aktive PDF-Vorlage: PDF exportieren; Seitigkeit, Inhaltswerte, Unterschriftsbereich, G5-Anzeige, fehlende Werte, Warnungen und Korrekturen prüfen.
5. Ohne aktive Vorlage oder bei Fehler: Legacy-Fallback und direkte Legacy-PDF-Funktion; PDF-Ausgabe gegen Bildschirmwerte prüfen. **Vorlagen und DB-Zustand müssen zum Teststand erfasst werden.**
6. PDF aus echten Messdaten nicht als normative Freigabe behandeln. Phase-0-Originalnormabgleich ist weiterhin gesperrt.

### Qualitätskennzeichnung

Parser-Vergleich: **ausgeführt**. Node-Regressionssuite: **GitHub Actions erfolgreich** (Run #43870449169, Node 22, Commit `f9a8762`; 14 Testfälle im Testskript). Browser-Workflow: **nicht ausgeführt**. PDF-Bytes/Visual: **nicht ausgeführt**. DIN-Abnahme: **nicht freigegeben**.
