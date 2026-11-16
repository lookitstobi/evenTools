# pegelTool – Phase 1: Priorisierte Fehler- und Risikoliste

**Statuslegende:** `reproduziert` = funktional am bestehenden Parser/Status in isolierter JS-Ausführung nachgestellt; `Quelltextbefund` = statisch nachweisbarer Defekt/Risiko, volle E2E-Wirkung nicht geprüft; `offen` = Prüfbedarf. Priorität: P0 release-blockierend, P1 Betriebs-/Workflowproblem, P2 Komfort.

| ID | Prio | Status | Befund / reproduzierbarer Anhaltspunkt | Erwartung / Phase |
|---|---|---|---|---|
| PT-001 | **P0** | reproduziert | `calculateAndRender` 1595–1597 gibt `LAeq_g5` gegen 99 dB als eigenständiges `NICHT OK` aus; Test 98/100/120 (G30/G5/Peak) löst Fehlerzeile aus. | Nur bestätigte normative Kriterien bewerten; informative Werte trennen. Phase 3/6 |
| PT-002 | **P0** | reproduziert | `updateComplianceStatus` 1438–1453: `logLoaded=true`, keine negativen Tabellenzeilen → grüne Ampel, auch mit fehlenden Daten. | `Nicht beurteilbar` bzw. Qualitätsstatus. Phase 3/6 |
| PT-003 | **P0** | reproduziert (synthetisch) | `parseBroadbandSummary` 1246–1254 übernimmt Spaltenpositionen aus der Zeitreihe. In abweichender Summary-Anordnung liest es für `LCpeak` **101** statt des angegebenen Peak **132**. | Summary unabhängig strukturiert einlesen; unbekanntes Layout kennzeichnen. Phase 2 |
| PT-004 | **P0** | reproduziert (Parser) | `duplicates-and-gap`: doppelte Zeit und Sprung werden ohne Datenqualitätsfehler übernommen. `countExceedDuration` 1359–1362 multipliziert nur Anzahl mit nominellem Log-Intervall. | Zeitstempel-/Abdeckungsanalyse und Unsicherheitsstatus. Phase 2/3 |
| PT-005 | **P0** | Quelltextbefund | Im Template-PDF `formatLevel(null)` und `complianceStatus(null)` (1813–1823) interpretieren `null` durch `Number(null)` als **0**; `laeqG30Val` kann `null` sein (1838ff). | Fehlwerte `—` / `Nicht beurteilbar`, niemals `OK`. Phase 5, abgesichert Phase 2/3 |
| PT-006 | **P0** | Quelltextbefund | Zeitreihen/`LAeq_g30`-Maxima und Gesamt-Summary ersetzen keine belegten vollständigen, festen Beurteilungsblöcke; es gibt keine Blocktabelle oder Datenabdeckungsprüfung. | Normenmatrix-abhängige Blockbildung und Bewertung. Phase 3/5, fachliche Freigabe Phase 0 |
| PT-007 | **P0** | Quelltextbefund | `k1`/`k2` erfasst, aber Herkunft bereits geräteseitig korrigierter Spalten, Messort, Kalibrierung und Anwendungsnachweis nicht als explizite Fachobjekte modelliert. | Korrektur nicht doppelt anwenden; Nachweiskette. Phase 2/4 |
| PT-008 | **P0** | reproduziert | `invalid-interval` wird durch `parseIntervalSeconds` 935–950 still zu 1 s. | Ungültiges Intervall kennzeichnen und Bewertung sperren. Phase 2 |
| PT-009 | **P1** | reproduziert | `calculateManualLAeqG5` 996–1021 überschreibt eingelesenes `LAeq_g5` auch wenn vorhanden; außerdem über Sample-Anzahl statt reale Zeitabdeckung. | Originalwert erhalten; abgeleitete Werte separat und nachvollziehbar. Phase 2/3 |
| PT-010 | **P1** | Quelltextbefund | Formular enthält Vorgabewerte für Kalibrator-/Organisatorangaben (Zeilen 290–304) und presetabhängige PA-Angaben. | Nicht ungeprüft als reale Nachweise übernehmen. Phase 4 |
| PT-011 | **P1** | Quelltextbefund | `normalizeState` 522ff akzeptiert Schema-Versionen ohne explizite Versionsprüfung; beim Recovery kann ein partieller Zustand ohne Samples als vollständiges Wiederherstellen erscheinen. | Versionierte Migration und sichtbare `partial`-Kennzeichnung. Phase 2/6 |
| PT-012 | **P1** | offen | Browser-/Server-E2E (Template-DB, PDF-Rendering, Popup, Auth-/CSRF-Session) nicht in isolierter Ausführung nachweisbar; zwei PDF-Wege können abweichen. | Reale PDF- und UI-Abnahme, Regression. Phase 5/7 |
| PT-013 | **P1** | Quelltextbefund | Bei Normprüfung wird informativer `LAeq_total` / `LAeq_g5` im PDF ebenfalls `OK/NEGATIV` gegen 99 gesetzt (1858ff), nicht nur `LAeq_g30`. | Ergebnisgrößen und Grenzwertstatus fachlich trennen. Phase 3/5 |
| PT-014 | **P2** | Quelltextbefund | Deutlich gekoppelte 2.792-Zeilen-Einzeldatei erschwert parserunabhängige Tests und sichere Migration. | Modultrennung mit Regressionen statt Komplettrewrite. Phase 2/6 |

## Reihenfolge

1. **Phase 2:** PT-003, PT-004, PT-007, PT-008, PT-009, PT-011; Parser/Datenmodell herkunftstreu.
2. **Phase 3:** PT-001, PT-002, PT-004, PT-006, PT-013; normative Entscheidungslogik nur mit bestätigter Normenmatrix.
3. **Phase 4/5:** PT-005, PT-007, PT-010, PT-012, PT-013; Nachweise und PDF-Output.
4. **Phase 6/7:** PT-002, PT-011, PT-012, PT-014; UX/End-to-End/Regression.

**Keine der P0-Feststellungen wurde in Phase 1 behoben.** Die Fehlerliste ist die gezielte Übergabe; Legacy-Ausgaben dürfen nicht als normative Erwartungswerte gelten.
