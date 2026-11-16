# pegelTool – Phase 1: Legacy-Regressionstests

**Zweck:** Verhalten des pegelTools am Baseline-Commit `629ea5a75261894b8c741a4cdd5cb69d20f7efde` einfrieren. Diese Tests sind **keine Normkonformitätsprüfung**.

## Ausführen

Voraussetzung: Node.js 18+ (nur eingebaute Module, keine npm-Installation).

```bash
node --test tests/pegelTool/regression/legacy.test.cjs
```

Der Test-Harness lädt den **unveränderten Inline-JavaScript-Code** der bestehenden `index.html` in einen minimalen, isolierten DOM-Testkontext. Funktionen werden nicht in einer zweiten Implementierung nachgebaut. Syntax oder Abgrenzung des Inline-Scripts können eine explizite Anpassung des Harness erfordern.

- `fixtures/`: vollständig synthetische XL3-ähnliche Dateien ohne echte Gerätedaten oder personenbezogene Daten.
- `expected/legacy-baseline.json`: dokumentiertes Ist-Verhalten, **nicht** die zukünftige normative Soll-Logik.
- Ein Test liest das bereits vorhandene archivierte Messlog aus dem Repository **nur lesend**. Es wird nicht kopiert oder veröffentlicht.
- Tests für die tatsächliche PDF-Erzeugung im Browser/Server (inkl. DB/Template, Download, Rendering) sind **noch nicht automatisiert**. Die statischen Tests beweisen nur das Vorhandensein von Integrationspunkten.
- Der bewusst fehlerhafte `summary-layout-mismatch`-Test ist ein konstruiertes Negativbeispiel; er behauptet nicht, dass das reale XL3 genau dieses abweichende Layout liefert.

Wichtig: Ein späterer Fix darf diese **Legacy-Snapshots** bewusst verändern. Dazu werden neue fachlich bestätigte Soll-Tests ergänzt und Unterschiede dokumentiert, statt die alte fehlerhafte Bewertung stillschweigend als richtig zu behandeln.
