# pegelTool – Regressionstests (Phase 1 bis 7)

**Zweck:** Ursprüngliches pegelTool-Verhalten am Baseline-Commit `629ea5a75261894b8c741a4cdd5cb69d20f7efde` erfassen und alle Änderungen der Phasen 2–7 technisch überprüfen. **Keine Normkonformitätsprüfung.**

## Ausführen

Voraussetzung für die sieben Node-Testsuiten: Node.js 22+ (nur eingebaute Module und mitgelieferte Projektdateien). Der Chromium-End-to-End-Test benötigt zusätzlich Playwright und Chromium.

```bash
node --test tests/pegelTool/regression/legacy.test.cjs
node --test tests/pegelTool/phase2/import.test.cjs
node --test tests/pegelTool/phase3/evaluation.test.cjs
node --test tests/pegelTool/phase4/protocol.test.cjs
node --test tests/pegelTool/phase5/report.test.cjs
node --test tests/pegelTool/phase6/workflow.test.cjs
node --test tests/pegelTool/phase7/release.test.cjs
```

Der Test-Harness lädt den **unveränderten Inline-JavaScript-Code** der bestehenden `index.html` in einen minimalen, isolierten DOM-Testkontext. Funktionen werden nicht in einer zweiten Implementierung nachgebaut. Syntax oder Abgrenzung des Inline-Scripts können eine explizite Anpassung des Harness erfordern.

- `fixtures/`: vollständig synthetische XL3-ähnliche Dateien ohne echte Gerätedaten oder personenbezogene Daten.
- `expected/legacy-baseline.json`: dokumentiertes Ist-Verhalten, **nicht** die zukünftige normative Soll-Logik.
- Ein Test liest das bereits vorhandene archivierte Messlog aus dem Repository **nur lesend**. Es wird nicht kopiert oder veröffentlicht.
- Phase 5 testet jsPDF-Bytes; Phase 7 ergänzt einen echten Chromium-Ablauf mit Import, JSON/HTML, Wiederaufnahme und PDF-Download sowie Poppler-Rendering in GitHub Actions. Der Testserver bildet lediglich die Dateirouten von `toolserve.php` nach und ersetzt **keine** Prüfung von Anmeldung, produktiver CSP und externer PDF-Sichtkontrolle.
- Phase 7: 18 maschinenlesbare Referenzfälle in `phase7/fixtures/technical-reference.json`; ausführlicher Testplan in `docs/pegelTool/phase7/TESTPLAN.md`, Freigabeprotokoll in `FACHABNAHME.md`.
- Der bewusst fehlerhafte `summary-layout-mismatch`-Test ist ein konstruiertes Negativbeispiel; er behauptet nicht, dass das reale XL3 genau dieses abweichende Layout liefert.

Wichtig: Ein späterer Fix darf diese **Legacy-Snapshots** bewusst verändern. Dazu werden neue fachlich bestätigte Soll-Tests ergänzt und Unterschiede dokumentiert, statt die alte fehlerhafte Bewertung stillschweigend als richtig zu behandeln.
