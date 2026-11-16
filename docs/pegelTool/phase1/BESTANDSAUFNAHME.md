# pegelTool – Phase 1: Bestandsaufnahme

**Datum:** 2026-11-16  
**Repository:** `lookitstobi/evenTools`  
**Referenz:** `main` @ `629ea5a75261894b8c741a4cdd5cb69d20f7efde` (Index-Blob `d73f9b776a7c411c9b5a368ffedf1719bed26f45`)  
**Gegenstand:** dokumentarische Erfassung des Ist-Zustands; keine DIN-Freigabe, kein Umbau von Messlogik oder PDF.  
**Prüfmethoden:** Repo-Datei- und Quelltextanalyse, Ausführung der Original-Parserfunktionen gegen anonymisierte/synthetische Beispiele und das vorhandene Archivlog in einem minimalen DOM-Stubs-Kontext. Reale Browser-/Server-/PDF-End-to-End-Tests sind ausdrücklich offen.

## 1. Umfang und Architektur

- `app/tools/pegelTool/index.html`: **2.792 Zeilen**, ca. **103 kB**, integrierter HTML/CSS/JavaScript-Monolith. UI, Parse, Daten, Diagramme, Status, Persistenz und zwei PDF-Wege gemeinsam.
- Ergänzende Tooldateien: `pdf_loading.html`, `pdf_loading.css`, `vendor/chart.umd.min.js`, `vendor/jspdf.umd.min.js`, `vendor/pdf-lib.min.js`. Externe Skripte via `/toolserve.php?name=pegelTool&file=vendor/...`. Kein JS-Modulsystem, keine NPM-Projektdatei oder eigene pegelTool-Tests im Baseline-Baum gefunden.
- Abhängige Serverdateien: `toolserve.php`, `pdf_template_api.php`, `pdf_preview_api.php`, `app/pdf_template_lib.php`. Zusätzlich `assets/Logos/pegelTools.png`, `/assets/app.css` und PDF-Builder-Tools. Templateverwaltung verwendet eine SQLite-Konfiguration; ein lokaler Client allein beweist keine Server-PDF-Funktion.
- Bereits vorhanden: generisches PDF-Golden-Master-Preflight `scripts/pdf_golden_master_check.php` mit `docs/pdf_template_golden_master_cases.json` (prüft Voraussetzungen; ersetzt keine pegelTool-Inhalts-/Visual-Regression).
- Keine Dateien der produktiven Anwendung werden in Phase 1 geändert. Direkte Releases auf `main` unterbleiben.

## 2. Inventar – Laufwege und Funktionsanker (Baseline-Zeilennummern)

| Bereich | Einstieg/Code | Bestehende Daten und Verhalten |
|---|---|---|
| XL3-Import | `fileInput` ~2708–2776; `parseHeaderAndMeta` 1024; `locateTimeSeriesBlock` 1112; `parseBroadbandTimeSeries` 1170; `parseBroadbandSummary` 1226 | `.txt`, max. 8 MiB, via FileReader; Parsing mit globalen `header`, `samples`, `summary`, `parsedColumns`; Trennung Header/Zeitreihe/Summary nur per Funktionen, nicht Typmodell |
| Header-/Korrekturen | `makeEmptyHeader` 422; `setUsedColumns` 984 | Device/Mic/Intervall/Start/Ende/`k1`/`k2`, Spaltenzuordnung durch Namen `...+k1`/`...+k2`; keine separate Korrekturnachweiskette |
| Zeitreihe | `parseBroadbandTimeSeries` 1170; `calculateManualLAeqG5` 996 | pro Sample `date,time,LAeq_dt,LAeq_g30,LAeq_g5,LCpk,LAFmax`; `LAeq_g5` wird nach Parsing überschrieben |
| Summary | `makeEmptySummary` 432; `parseBroadbandSummary` 1226 | `source,laeq_total,laeq_g30,laeq_g5,lcpeak_max,lafmax_dt`; verwendet Spaltenindex der Zeitreihe statt separaten Summary-Header |
| Anzeige und Bewertung | `calculateAndRender` 1579; `addRow` 1365; `updateComplianceStatus` 1438 | drei Zeilen LAeq_g30, LAeq_g5, LCpeak; Grenzwertampel aus gezählten `status-bad`-Zellen, nicht aus Datenqualitätslage |
| Diagramme | `downsampleForDisplay` 1286; `mkChart` 1480; `renderCharts` 1566 | Chart.js, Downsampling auf ~900 Werte mit Peak-Erhalt; keine normativen Blockdaten |
| Formular/Presets | HTML ~220–345; `FORM_FIELD_IDS` 362; `PA_PRESETS` 406; `applyLocationPreset` 1665 | Veranstaltung, Personal, Messstellen, PA, Kalibrator; feste Defaultangaben, visuelle Pflichtfeldmarkierung |
| Speicherung | `buildStateObject` 502; `normalizeState` 522; `saveStateFile` 809; `applySavedState` 632; `recoverLastSession` 666 | Schema 1; `.nti.json` mit Original-Logtext, Samples, Charts, Form und PA; Auto-Recovery via `localStorage` `pegelTool_recovery_v1`, kompakter Fallback nur mit Formulardaten |
| HTML-Export | `exportHTML` 2622; `parseStateFromText` 865 | eingebetteter JSON-Zustand in HTML-Quelle, nicht nur statischer Bericht |
| PDF-Vorlage | `generateTemplatePDF` 1769; `generatePDF` 2618 | templatebasierter PDF-Ladevorgang über `pdf_template_api.php`, pdf-lib und jsPDF für Zusatzdiagramme; Legacy-Fallback |
| Legacy-PDF | `generateLegacyPDF` 2210; `openPdfPreview` 754 | PDF mit jsPDF, Logo, Reportfeldern, Ergebnisse/Charts; Preview-API mit Sitzungszugriff/CSRF; herunterladbarer Fallback |
| API | `pdf_template_api.php`, `pdf_preview_api.php`, `toolserve.php` | Zugriffs- und Sessionvoraussetzungen; Vorlagen aus DB, PDF-Vorschau temporär/serverseitig. Statischer Check, kein produktiver Aufruf durchgeführt |

## 3. Datenmodell und Herkunft

Der Zustand ist ein frei strukturiertes Objekt (Schema-Version **1**) mit `header`, `samples`, `chartSamples`, `summary`, `form`, `paItems`, `logText`, `logFileName` und `logLoaded`. Es fehlen explizite Typen und Qualitätsstatus für Messzeitlücken, Kalibrierung vor/nach, Zuordnung zu maßgeblichem/Ersatzmessort, Korrekturen und Zeitblöcke. `summary` und `samples` werden ohne eindeutige Herkunftsprüfung bei Auswertungen gemischt.

Die Originalspalte `LAeq_g5` wird auch bei Vorhandensein durch einen über die Anzahl von Samples berechneten neuen Wert überschrieben (996–1021); das ist für spätere Datenherkunft kritisch. `parseIntervalSeconds` fällt bei unlesbaren Angaben auf 1 s zurück (935–950). Fehlende Zeitreihenwerte werden entfernt; Duplikate und Abstände werden ohne zeitliche Validierung beibehalten.

## 4. Browser-/Server-Abhängigkeiten und Sicherheit

- `localStorage`: begrenztes Kontingent; bei Fehler wird nur ein partieller Recovery-Stand gespeichert (594–621), Hinweis vorhanden. Protokolldaten und Original-Log liegen im gespeicherten Projekt im Klartext.
- `FileReader`: Import `.txt` bis 8 MiB; Zustand `.json,.nti,.html,.htm`; tatsächlicher Projektname wird als `.nti.json` erzeugt.
- PDF-Vorschau benötigt Browser-Popup-Verhalten und serverseitige CSRF-/Session-Prüfung; Template benötigt eine aktive DB-Zuordnung. Ein Offline-HTML-Export garantiert deshalb **keine** vollständige Offline-PDF-Funktion.
- Formulare enthalten fest voreingestellte Angaben zu Veranstalter/PA/Kalibrator; vor realem Protokoll muss jeder Wert überprüft werden.
- Die in `app/tmp_pdf_previews/` vorhandenen PDF-Dateien werden weder als verifizierte Golden Masters verwendet noch in Testfixtures kopiert (Herkunft/Vertraulichkeit ungeprüft).

## 5. Bekannter Ist-Stand / Risikoschnittstellen

P0-Punkte in `FEHLERLISTE.md`: falsche eigenständige `LAeq_g5`-Grenzwertentscheidung; grüne Ampel trotz fehlender Prüfbedingungen; mögliche falsch zugeordnete Summary-Spalten; fehlende Zeitblock-/Lückenvalidierung; Nullwert-PDF-Formatierung; mangelnde Korrektur-/Kalibrierherkunft. Die Normenmatrix von Phase 0 bleibt fachlich offen und ist **nicht** als bestätigte Anforderung implementierbar.

## 6. Grenzen der Bestandsaufnahme

Die Quelltext- und Parserprüfung ist durchgeführt. Die vollständigen Browser-Workflows für Importformular/Charts/Projektdatei/HTML und reale PDF-Ausgaben über produktive PHP-/SQLite-Konfiguration konnten in der Toolumgebung nicht Ende-zu-Ende ausgeführt werden. Die Testsuite erfasst diese Punkte als **manuelle Abnahmefälle** und statische Verträge, nicht als bestandene PDF- oder UI-Tests. Diese Grenze darf im PR nicht als abgeschlossene Fachabnahme umetikettiert werden.
