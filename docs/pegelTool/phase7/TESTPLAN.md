# pegelTool – Phase 7: Testplan und Freigabekriterien

**Stand:** 16.11.2026  
**Basis:** Phase-6-Branch `feat/pegeltool-phase6-workflow-20261116` (PR #8)  
**Testbranch:** `test/pegeltool-phase7-release-20261116` (PR #9, Draft)  
**Normenstatus:** **NICHT FREIGEGEBEN** – Originalfassung DIN 15905-5:2022-07 noch nicht abschließend abgeglichen.

## 1. Testziel und Testgrenzen

Wir prüfen getrennt (a) technische Rechen-/Parserkorrektheit, (b) Datenherkunft und Vollständigkeit,
(c) browserbasierte Arbeitsabläufe, (d) die technische PDF-Erzeugung und (e) die manuelle Fachabnahme.
Ein grüner CI-Lauf ist **kein** normativer Nachweis.

Die vorläufigen Vergleichswerte 99 dB(A) und 135 dB(C) sind technische Testgrenzen aus
der Projektarbeitsgrundlage. Die Anwendung darf ohne bestätigte Normenmatrix **keinen**
positiven oder negativen *normativen* Status ausweisen.

## 2. Automatisierte Tests

### Bestehende Regressionen

| Testsuite | Schwerpunkt |
| --- | --- |
| `tests/pegelTool/regression/legacy.test.cjs` | ursprüngliche Parser-/UI-Baseline und Regressionen |
| `tests/pegelTool/phase2/import.test.cjs` | XL3-Header, Metriken, Qualität, Summary, Zeitstempel |
| `tests/pegelTool/phase3/evaluation.test.cjs` | Zeitgewichtung, Zeitfenster, Korrekturen, Teilabdeckung |
| `tests/pegelTool/phase4/protocol.test.cjs` | Formulare, Belege, Herkunft, Altprojekt-Migration |
| `tests/pegelTool/phase5/report.test.cjs` | einheitliche Berichtsdaten, HTML, PDF-Generator |
| `tests/pegelTool/phase6/workflow.test.cjs` | Navigation, Statusfreigaben, Warnungspriorität |

### Phase 7

- `tests/pegelTool/phase7/fixtures/technical-reference.json` – 18 synthetische Referenzfälle
  mit **fest hinterlegten** Erwartungswerten (keine Messgeräte-Originaldaten).
- `tests/pegelTool/phase7/release.test.cjs` – Referenzvergleich, k1/k2-Einmaligkeit,
  Kalibrier-/Zeitnachweise, Geräte-Summary-Abgleich, LAeq_g5-Abgrenzung,
  Import → Berechnung → Protokoll → JSON → Bericht → PDF sowie Archivlog.
- `tests/pegelTool/phase7/browser.test.cjs` – echtes headless Chromium;
  minimaler statischer Testserver bildet ausschließlich die `toolserve.php`-Dateirouten nach.
  Er testet keinen PHP-Login und keine produktive CSP.
- GitHub Actions führt Modultests und Browser-E2E getrennt aus; PDF und Bildschirmaufnahmen
  werden als Review-Artefakte gesammelt. PDF-Erzeugung, Metadaten und Poppler-Rendering
  belegen die technische Lesbarkeit, ersetzen **keine** Sichtprüfung des Layouts.

### Rechenreferenzen unabhängig von Produktionscode

| Szenario | Sollwert |
| --- | --- |
| 900 s @ 90 dB + 900 s @ 100 dB | 97,40362689494245 dB |
| 600 s @ 90 dB + 1200 s @ 96 dB | 94,7529063443759 dB |
| Konstant 98,999 / 99 / 99,001 dB | Vergleich unter/gleich/über 99, ohne DIN-Urteil |
| LCpeak 134,999 / 135 / 135,001 dB(C) | Vergleich unter/gleich/über 135, ohne DIN-Urteil |
| Fehlende 120 s in 30 min | Abdeckung 1680 s, kein 30-min-Ergebnis |
| Intervall über Halbstundengrenze | Datenkonflikt, keine ungesicherte Pegelzuteilung |
| Mitternacht 23:30–00:30 | Zwei getrennte Blöcke mit korrektem Folgedatum |

## 3. Szenarien aus dem Arbeitsplan – Nachweiszuordnung

| Nr. | Szenario | Nachweis |
| ---: | --- | --- |
| 1 | LAeq unter/auf/über 99 | Fixtures L99_* |
| 2 | LCpeak unter/auf/über 135 | Fixtures P135_* |
| 3 | Energetische Mittelung mit Intervallen | ENERGY_* und Phase-3-R01/R02 |
| 4 | Volle, angebrochene, fehlende Blöcke | FIRST_PARTIAL, MISSING_120S, FULL_GAP_FULL |
| 5 | halbe/volle Stunde, Mitternacht | TWO_FULL_BLOCKS, MIDNIGHT, Phase 3 |
| 6 | Lücken, Dubletten, ungültige Zeit | DUPLICATE_OVERLAP, CROSSING_BOUNDARY, INVALID_TIME, Importregression |
| 7 | Korrekturen und Herkunft | Phase-7-Korrekturtests + Phase-3-Tests |
| 8 | Kalibrierung/Protokolldaten | Phase 4 + fehlender Nachweis in Phase 7 |
| 9 | XL3-Summaries | Phase 2 + Phase 7 Mismatch-Szenario |
| 10 | Import, Export, Speicher-/Wiederaufnahme | Phase-7-Browser-E2E (JSON und HTML), Report/PDF-Integration |
| 11 | LAeq_g5 über 99 ohne eigene DIN-Verletzung | Phase 3 + Phase 7 g5 |
| 12 | 120-Minuten-Sonderregel | **gesperrt** bis Normenfreigabe; API darf sie nicht anbieten |

**Wichtig:** Ein vorhandener automatisierter Test ist nicht automatisch ein bestandener
Fachnachweis. Jeder Test muss in CI nach dem letzten Änderungssatz erfolgreich sein.

## 4. Manuelle Abnahme in realer Umgebung (noch offen)

Für die Abnahme sind folgende Schritte mit dem aktuellen PR-Stand durchzuführen:

1. Browser am echten angemeldeten Tool-Zugang öffnen (Desktop-Chromium/Firefox oder Edge);
   Console und Network auf Fehler prüfen. Original-XL3-Log mit dokumentierter Herkunft importieren.
2. Zeitstempel/Intervallende, Gerätedaten, Summaries, Rohdatenzeilen und alle Zeitblöcke
   gegen originale XL3-Ausgabe und unabhängig gerechnete Referenzen vergleichen.
3. Veranstaltungs-/Messstellenangaben und Kalibrierwerte vollständig eintragen;
   k1/k2 samt Messortbestimmung explizit belegen; Unklarheiten müssen sichtbar bleiben.
4. JSON und HTML exportieren, Browser neu öffnen, jeweils laden; Formularwerte,
   Messzeilen, Korrekturherkunft, Warnungen und Zeitblockergebnisse vergleichen.
5. Erneut PDF exportieren; Bildschirm-Bericht und PDF **wertgleich** vergleichen.
   PDF in Browser und einem externen PDF-Viewer öffnen. A4-Seiten, Tabellen,
   Seitenumbrüche, Sonderzeichen, Vollständigkeit aller Blöcke, unlesbare Überlagerungen,
   Warnhinweise, Dateiname sowie fehlende Unterschrift prüfen.
6. Datensatz mit 8.441 Zeilen und einen längeren, zulässig großen Log wiederholen.
   Lokale Wiederherstellung inklusive Speicherlimit-Fallback prüfen.
7. Mobile Ansicht (ca. 390 px), Tastaturnavigation, lange Fehlermeldungen, Charts nach
   Schrittwechsel sowie Seitenscrollen prüfen.
8. Abgewiesenen Log importieren: ursprüngliche Messung muss unverändert bleiben.
9. Ein bisheriges Projekt in Schema v1 öffnen; Herkunft bleibt ungeprüft und erzeugt
   keinen positiven Status. Erst mit Original-Log gelten Importdaten als nachvollziehbar.
10. Browser-CSP, authentifizierten `toolserve.php` und reale Produktivumgebung prüfen
    (durch lokalen Headless-Testserver ausdrücklich **nicht** abgedeckt).

Pro Prüfung dokumentieren: Tester, Datum, Browser/Viewer/Version, Messdatensatz oder
anonymisierter Referenz-Hash, Soll/Ist, Screenshot/PDF und Abweichung mit Ticket.

## 5. Release-Gates

- **P0-NORM:** Originalnorm und Abschnitts-/Protokollmatrix fachlich bestätigt;
  normrelevante Regeln und Zeitstempel-Semantik belegt. **Offen.**
- **P0-TECH:** Alle 7 Modultestsuiten grün; keine P0-Fehler und keine stillen positiven
  Statusentscheidungen.
- **P0-E2E:** Chromium-E2E grün; authentifizierter Browserworkflow manuell geprüft.
- **P0-PDF:** PDF-Bytes und Render erfolgreich; externer Viewer, Seitenlayout,
  Sollwertgleichheit und Unterschrift manuell geprüft.
- **P0-REVIEW:** Stacked-PR-Kette in richtiger Reihenfolge fachlich reviewed;
  keine offenen Freigabesperren, Version/Changelog bestätigt.

Erst wenn **alle** Gates erfüllt sind, darf ein Release freigegeben werden.
Bis dahin bleibt das pegelTool im Status **Entwicklungsstand / keine DIN-Konformitätsbescheinigung**.

## 6. Testausführung

```bash
node --test tests/pegelTool/regression/legacy.test.cjs
node --test tests/pegelTool/phase2/import.test.cjs
node --test tests/pegelTool/phase3/evaluation.test.cjs
node --test tests/pegelTool/phase4/protocol.test.cjs
node --test tests/pegelTool/phase5/report.test.cjs
node --test tests/pegelTool/phase6/workflow.test.cjs
node --test tests/pegelTool/phase7/release.test.cjs

# Chromium zusätzlich (Playwright und Browser installiert):
node --test tests/pegelTool/phase7/browser.test.cjs
```
