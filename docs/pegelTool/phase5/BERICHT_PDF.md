# pegelTool – Phase 5: Messprotokoll und PDF-Ausgabe

Stand: 16.11.2026 · Branch: feat/pegeltool-phase5-report-pdf-20261116
Status: **technische Implementierung / Review; keine normative Freigabe**

## Architektur und Entscheidung

Der bisherige Template-PDF-Generator und der Legacy-jsPDF-Generator wurden aus dem ausführbaren Anwendungscode entfernt. **Ein Exportpfad** erzeugt mit der lokalen jsPDF-Version den Bericht, ohne Backend-Template oder eigene Neuberechnung. Die bisherige Template-API bleibt unverändert, wird aber vom pegelTool nicht mehr zur Berichtserzeugung verwendet.

Datenfluss:

1. **PegelToolProtocol.buildRecord()** (Phase 4) liefert den gemeinsamen Berichtsdatenbestand: Formular, Eingabeherkunft, Gerätestammdaten, Kalibrierung, Messstellen, Korrekturen, Phase-3-Zeitblöcke.
2. **PegelToolReport.build()** (report/report.js) stellt die Daten deterministisch für die Darstellung zusammen. Keine neue Messwertberechnung.
3. **PegelToolReport.renderHtml()** erstellt die Bildschirmvorschau aus denselben Daten; alle Eingaben werden escaped.
4. **PegelToolReportPdf.create()** (report/pdf.js) erstellt mit jsPDF ein paginiertes A4-Dokument aus denselben Abschnitten, Zeitblöcken und Hinweisen.
5. PDF-Download und Vorschau verwenden denselben lokalen Blob, ohne die private Messdatei an einen Vorschau-Server zu schicken.

Das Phase-4-Berichtsmodell transportiert zusätzlich Anzahl der Rohsamples, Importqualität sowie Qualität und Annahmen der Phase-3-Auswertung. Die Projektdatei-Version bleibt unverändert.

## Berichtsinhalte

- Veranstaltung, Veranstalter, Adresse, Messperson und Veranstaltungszeit
- Messverfahren, XL3-Quelldatei, Messzeit, Zeitbasis, Messgerät, Firmware und Mikrofon
- Tatsächlicher Messort, getrennte LAeq-/LCpeak-Immissionsorte und Ersatzmessort
- PA-Komponenten, Anordnung, Abweichungen und manuelle Bestätigungen
- k1/k2 mit Wert, Korrekturstatus, Ermittlung und Originalspalte
- Kalibrator und Funktionsprüfung vor/nach Messung mit Zeitpunkt und Anzeigewert
- Alle technisch berechneten Halbstundenblöcke mit Abdeckung, LAeq, LCpeak, Datenqualität und **Rohdatenzeilen-Referenzen**
- Formularfehler, technische Nachweislücken, Parser-/Bewertungswarnungen, Blockkonflikte
- Berichtsverfasser, Ort/Datum und klar bezeichnetes **leeres** Unterschriftsfeld

Fehlende Messwerte erscheinen als **„Nicht ermittelt“**, niemals als automatisch angenommene 0,0 dB oder OK. Technisch vollständige Blöcke stellen keinen DIN-Nachweis dar. Diagramme und gleitende Pegelanzeigen sind ausdrücklich informativ.

## Versionen und Freigabesperren

- Entwicklungsstand: **pegelTool 0.5.0-dev**, keine veröffentlichte Normfreigabe.
- Normbezug: **DIN 15905-5:2022-07**; der relevante Originalnormtext und der verbindliche Pflichtfeldkatalog sind weiterhin nicht abschließend geprüft.
- Bewertung: **„Nicht beurteilbar“**. Auch unvollständige Berichte dürfen als ausdrücklich unvollständiger technischer Bericht exportiert werden, wenn ein XL3-Import und eine Phase-3-Auswertung vorliegen.
- Kein Export bei fehlendem Importmodell oder Berechnungsmodul.
- Zeitstempel-Anker, Zeitzone und Korrekturherkunft werden dokumentiert, nicht stillschweigend geheilt.
- Unterschriftsplatzhalter ist **keine geleistete Unterschrift**.

## Automatisierte Tests

Aufruf: node --test tests/pegelTool/phase5/report.test.cjs

Geprüft werden Blockwerte, Null-vs.-0, Datenherkunft und Rohdatenzeilen, Warnungen, HTML-Escaping, Reproduzierbarkeit, inhaltliche Wertegleichheit von Bildschirm/PDF, PDF-Seitenumbrüche, Seitennummern, fehlende Mutationen und ein echter Mehrseitenexport über die lokal eingebundene jsPDF-Distribution.

Der CI-Workflow führt Phase 1 bis 5 aus. Die alten statischen PDF-Vertragstests von Phase 1/3 wurden nur für die bewusst abgelösten Generatoren angepasst. Normative Berechnungsregeln wurden nicht geändert.

## Offene Abnahme

1. **Phase 0:** Originalnorm und vollständige Protokollpflichten fachlich verifizieren.
2. **Browser-E2E:** Reales XL3-Log, Änderungen, Vorschau/PDF-Gleichheit, PDF-Download und Speicherung/Wiederaufnahme prüfen.
3. **Sichtkontrolle:** PDF in gängigen Viewern mit langen Texten, Sonderzeichen, Tabellen über mehrere Seiten, A4-Druck und Fußzeilen überprüfen.
4. **Herkunftsfreigabe:** Offene messtechnische Nachweise der Phasen 2–4 bleiben bestehen.

Nach erfolgreichem CI kann Phase 5 als **technisch implementiert und automatisiert getestet** dokumentiert werden; die fachliche Abnahme ist noch offen. Pull Request als **Draft** belassen, **main** nicht verändern.
