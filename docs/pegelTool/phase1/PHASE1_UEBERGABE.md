# pegelTool – Phase 1: Übergabe und Abnahme

**Branch:** `audit/pegeltool-phase1-20261116`  
**Baseline:** `main` @ `629ea5a75261894b8c741a4cdd5cb69d20f7efde`  
**Auftrag:** Bestand aufnehmen und absichern; Anwendung und `main` nicht verändern.

## Gelieferte Artefakte

- `BESTANDSAUFNAHME.md`: Code-/Modul-/Funktions-/Formular-/Speicher-/PDF-/API-Inventar und Datenflüsse.
- `LEGACY_VERGLEICH.md`: beobachtete Parser-Altwerte, UI-Status-Verhalten und ausdrücklich **offene** Browser/PDF-Abnahme.
- `FEHLERLISTE.md`: priorisierte technische Befunde (PT-001 ff.), mit Quellenstellen und Phase-2–7-Zuordnung.
- `tests/pegelTool/fixtures/`: acht komplett synthetische XL3-artige Testszenarien (Valid, fehlender G30, Duplikate/Lücke, Mitternacht, Summary-Layout, ungültiges Intervall, falsches Format, fehlende Werte).
- `tests/pegelTool/expected/legacy-baseline.json`: versionierte **Legacy-Sollausgaben**, keine DIN-Beurteilung.
- `tests/pegelTool/regression/legacy.test.cjs`: Node-Regressionen per VM mit tatsächlichem Inline-JavaScript; inklusive lesendem Test auf bereits bestehendem Archiv-XL3-Log, Zustands- und statischen PDF-Integrationsprüfungen.
- `tests/pegelTool/README.md`: Reproduktion und Grenzen.

## Teststatus / Nachweise

- **Tatsächlich ausgeführt (isolierte Funktionen):** Archiv-XL3-Import (8441 Samples, `LAeq_total=77.4`, `LCpeak_max=114.7`, G30 fehlt), synthetische Varianten inkl. abweichendem Summary-Schema, Lücke/Duplikat, ungültigem Intervall, fehlendem G30 und Mitternacht.
- **Testcode erfolgreich ausgeführt:** GitHub-Actions-Workflow `pegelTool legacy regression (Phase 1)` lief auf Commit `f9a8762` mit Ergebnis `success` (Run #43870449169). Das Testskript enthält 14 Node-Testfälle. Dieser Nachweis umfasst ausdrücklich **keine Browser-/PDF-End-to-End-Tests**.
- **Nicht durchgeführt:** Vollständige Browserausführung, Import/Download/Recovery als reale Dateiinteraktion, live geschützte PDF-Vorlage, PDF-Bytes visuell vergleichen, geräteübergreifende / fachliche DIN-Abnahme. Dafür wäre eine gesicherte Testinstanz mit aktiver PDF-Vorlage/Session und geeigneter Referenz nötig.
- **Vertraulichkeit:** bestehendes Archivlog lediglich gelesen, nicht in neue Fixtures kopiert; synthetische Namen/Seriennummern. Vorhandene PDF-Preview-Dateien nicht übernommen.
- **Produktionscode:** Keine Änderungen. Alle dokumentierten P0-Fehler bleiben bewusst offen.

## Abnahmetor / Status

| Kriterium | Status |
|---|---|
| Inventar, Baseline-SHA, technische Abhängigkeiten | dokumentiert |
| Synthetische reproduzierbare Importfixtures | angelegt |
| Regressions-Harness für Import/Kernlogik/State | **CI erfolgreich**, Lauf #43870449169 |
| Vollständige Kern-Workflows vor/nach Änderungen | **teilweise**: Browser/PDF-Workflows offen |
| Legacy-Vergleich, priorisierte Fehlerliste | dokumentiert |
| Normative Freigabe | **gesperrt** (Phase 0: vollständiger Normtext fehlt) |
| Änderungen an main | keine |

**Phase 1 ist dokumentarisch umgesetzt, aber das strenge Abnahmekriterium „jeder Kernworkflow vor/nach Änderungen nachstellbar“ ist ohne Browser-/PDF-E2E noch nicht vollständig erfüllt.** Daher bleibt PR bewusst **Draft**. Vor Phase 2 sollte der Regressionstest erfolgreich im CI gelaufen sein. Die fehlenden Browser-/PDF-Vergleichstests sind als offener Prüfschritt für den nächsten Testdurchlauf explizit einzufordern.

## Nächste Übergabe / Priorität

1. CI beim finalen PR-Commit erneut kontrollieren; im ersten Lauf erfolgreich, der automatische Regressionstest bleibt Pflicht.
2. Mit isolierter Test-Deployment-Instanz jeweils einen anonymisierten Messfall durch Import → Speichern → Reload → PDF (Vorlagen- und Legacy-Pfad) führen; PDF-Werte und Screenshots dokumentieren. Keine echten Veranstaltungsdaten in Repo kopieren.
3. Phase-0-Normenmatrix zur Originalausgabe DIN 15905-5:2022-07 weiter fachlich prüfen; bis dahin keine nicht belegte DIN-Konformitätsaussage.
4. Phase 2 erst darauf aufbauend mit separatem PR für Parser/Datenmodell (fachliche Testfälle ergänzen), nicht mit ungeprüftem Rewrite.
