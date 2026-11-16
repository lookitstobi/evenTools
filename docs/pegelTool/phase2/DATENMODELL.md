# Phase 2 – XL3-Importmodell und Datengüte

**Status:** Implementierungsvorschlag (Draft), keine normative DIN-Freigabe. Stand: 2026-11-16.

## Architektur
- Browser lädt `app/tools/pegelTool/import/nti-xl3.js` via `toolserve.php` vor dem Inline-Skript. Das DOM-freie Modul kann direkt mit Node getestet werden.
- `PegelToolImport.parse(text, {fileName})` liefert `{ok, model, warnings, errors}`. `toLegacy(model)` hält die bestehenden Anzeige-/Diagramm-/PDF-Schnittstellen bis Phase 3–5 benutzbar.
- Alter Parser bleibt nur für die Phase-1-Vergleichstests erhalten und ist nicht mehr der aktive Datei-Import.
- Ein abgelehnter Import verändert das vorherige Messprojekt nicht. Qualitätswarnungen zeigen die Einschränkung des Importdatensatzes an.
- Zustandsschema **2** hält das Importmodell zusätzlich zum Legacyzustand. Zustandsschema 1 kann eingelesen werden, aber ohne eine behauptete, nicht vorhandene Messwertherkunft. Künftige unbekannte Schemaversionen werden zurückgewiesen.
- `timeBlocks` ist für Phase 3 reserviert: Keine Normenbewertung, bis die fachliche Freigabe aus Phase 0 vorliegt.

## Datenmodell (Importmodell `schemaVersion: 1`)
| Objekt | Inhalt |
|---|---|
| `source` | Dateiname, Zeitbasis, Speicherherkunft |
| `event` | leeres Veranstaltungsobjekt für spätere Formular-Zuordnung |
| `measurement` | Start/Ende, Intervalltext, validierte Sekunden, Zeitzonenangabe |
| `instrument` | Gerät, Seriennummer, Firmware, Mikrofon-/Kalibriermetadaten |
| `places` | Mess- und maßgebliche Publikumsorte, noch unbelegt |
| `calibration` | Prüfergebnisse vor/nach Messung noch nicht dokumentiert; MicCal ersetzt sie nicht |
| `corrections` | Werte und Quellen für k1/k2; bereits angewendet: yes/no/mixed/unknown; Ermittlung noch offen |
| `columns` | exakte Originalspalten, Positionen und vorliegende Korrekturkennzeichnung |
| `samples` | Originalreihenfolge, Quellzeile, lokale Uhrzeit und alle gelesenen Metriken einschließlich geräteseitigem LAeq_g5 |
| `summary` | eigenständiger Block, separate Spaltenzuordnung, Feldherkunft oder ungesicherte Rohzellen |
| `quality` | usable/restricted/rejected, strukturierte Hinweise und Fehler |
| `timeBlocks` | vorerst leer, für Phase 3 vorgesehen |

`localEpochMs` dient ausschließlich zur Ordnung von Ortszeitstempeln; er ist **kein** UTC-Zeitstempel. Die Interpretation von Sommerzeitwechseln bleibt offen.

## Entscheidungen und verbleibende Risiken
1. Ungültige Intervalle und vollständig fehlende Pegelwerte führen zur Ablehnung, nicht zu stillen Ersatzwerten.
2. Dubletten, rückläufige Zeiten, Intervallsprünge und Messlücken erhalten klare Warnungen und die ursprünglichen Zeilennummern.
3. Ungültige Pegelzellen bleiben `null` und werden nicht als 0 dB oder Stille interpretiert.
4. Das geräteseitige `LAeq_g5` bleibt unverändert. Softwareseitige 5-Sekunden-Werte werden nicht über importierte Messwerte geschrieben.
5. Bei `+k1` oder `+k2` wird die geräteseitige Anwendung festgehalten. **Keinerlei zweite Korrektur** wird bei Import angewendet.
6. Summaries ohne **eigenständig belegten** Spaltenkopf werden nur als Rohzellen übernommen und als `SUMMARY_LAYOUT_UNVERIFIED` gekennzeichnet. Es werden keine Zuordnungen durch Wiederverwendung der Zeitreihenspalten erfunden. Auch beim realen XL3-Archivlog wird das Summary vorerst nicht numerisch übernommen.
7. Alte UI-/PDF-Ausgaben können noch fachlich fehlerhafte Beurteilungen enthalten. Für Phase-2-Imports wird deshalb die globale Statusanzeige nicht grün; die Bildschirm-/PDF-Bewertungsengine ist erst ab Phase 3–5 zu erneuern. Ein PDF ist derzeit kein DIN-Konformitätsnachweis.
8. Das zusätzliche gespeicherte Importmodell verdoppelt teilweise Zeitreihendaten im Projektzustand; langfristige Speicheroptimierung und vollständige Browser-Speicher-/PDF-E2E-Tests stehen noch aus.

## Tests
- `node --test tests/pegelTool/phase2/import.test.cjs`
- `node --test tests/pegelTool/regression/legacy.test.cjs`
- Szenarien: anderer Spaltenaufbau, Zeilenprovenienz, Dezimalformate, valide/ungültige Intervalle, Kalibrier-/Korrekturkennzeichnungen, Zeitlücken, Duplikate, Mitternacht, Summary ohne/mit eigenem Header, Archivlog sowie Legacy-Schema.

**Offen:** Browser-Import, Speicher-/Recovery-Grenzen, beide PDF-End-to-End-Wege, mehr reale Summary-Layouts, Winter-/Sommerzeitwechsel und Originalnorm-Freigabe.