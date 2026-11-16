# Phase 3 – Berechnungsengine (technischer Zwischenstand)

**Stand:** 16.11.2026. **Freigabe:** NICHT normativ freigegeben. Die Originalnorm DIN 15905-5:2022-07 und der vollständige Abgleich mit Phase 0 fehlen weiterhin.

## Architektur und Schnittstellen

Die DOM- und PDF-freie Datei app/tools/pegelTool/evaluation/engine.js (CommonJS / Browser-Global PegelToolEvaluation) enthält zwei Schnittstellen:

- buildBlocks(intervals): Messintervalle mit startMs, endMs, laeqDb, lcpeakDb, sourceLine; reine, deterministische Berechnung auf Grundlage eindeutig definierter Zeitabschnitte.
- evaluateModel(importModel, options): Adapter auf das Phase-2-Modell; benötigt die explizite Zeitstempel-Annahme timestampAnchor = start oder end. Ohne die Angabe werden keine Zeitblöcke berechnet.

Die Oberfläche verwendet die **als unbestätigt gekennzeichnete** Annahme timestampAnchor = end und timestampAnchorEvidence = assumed. Der tatsächliche Zeitstempelbezug des XL3-Logs muss noch herstellerseitig oder anhand eines Messnachweises geprüft werden.

## Fachliche Entscheidungen

1. Vorläufige, uhrzeitsynchrone 1800-s-Fenster zur vollen und halben Stunde: Arbeitshypothese, nicht anhand der Originalnorm 2022 bestätigt.
2. LAeq wird energie- und zeitgewichtet aus LAeq_dt-Intervallen berechnet. Die Formel berücksichtigt die Dauer jeder gültigen Messung. Nur vollständig belegte, widerspruchsfreie Blöcke erhalten einen rechnerischen LAeq30-Wert.
3. Bei Teilabdeckung: laeqObservedDb nur über tatsächlich gemessene Zeit; laeq30Db = null. Keine fiktive Stille oder Null-Energie-Ergänzung.
4. LAeq_g30 und LAeq_g5 sind gleitende Diagnosewerte und werden nicht als unabhängige 30-Minuten-Intervallwerte gemittelt. Ein hoher LAeq_g5 ist keine eigene Normverletzung.
5. LCpeak wird als Maximum tatsächlicher Peakwerte berechnet, nicht arithmetisch oder energetisch gemittelt. Für einen nicht vollständig belegten Zeitraum bleibt der maßgebliche Blockwert gesperrt.
6. Messlücken, fehlende Metriken, überlappende Zeitstempel und über Blockgrenzen reichende Messintervalle werden getrennt gekennzeichnet. Grenzüberschreitende Intervalle werden für die Zeitabdeckung aufgeteilt, ihre unbekannte Energie- und Peakverteilung jedoch nicht geschätzt.
7. Korrekturwerte k1 und k2 werden nicht doppelt angewendet: Bei laut Originalspalte bereits angewendeter Korrektur bleibt der Gerätewert unverändert. Ein unkorrigierter Wert erhält nur bei bekanntem Korrekturwert eine einmalige softwareseitige Addition. Fehlt Korrekturwert oder Anwendungshinweis, bleibt der korrigierte Rechenwert unbestimmt.
8. Unbelegte Kalibrierung, nicht bestimmte maßgebliche Immissionsorte und fehlende Korrekturermittlung bleiben sichtbar und verhindern eine DIN-Freigabe.
9. Ein mathematischer Vergleich mit 99 dB(A) und 135 dB(C) ist ausdrücklich kein normativer Prüfstatus. normativeStatus lautet im gesamten Phase-3-Entwurf not-assessable.
10. Die 120-Minuten-Alternative wird nicht implementiert, solange Phase 0 keine Normfreigabe liefert.

Das interne Zeitformat localEpochMs ist ein künstliches lokales Vergleichsformat, **keine UTC-Zeitachse**. Sommerzeitumstellungen ohne Offset bleiben potenziell mehrdeutig und werden daher nicht normativ akzeptiert.

## Oberfläche und Legacy-Kompatibilität

- Eine neue Halbstunden-Tabelle zeigt Messzeit, Sekundenabdeckung, rechnerischen Pegel, Peak und Datenqualität. Rechenstand wird beim Import und beim Wiederherstellen neu erzeugt. Das vorhandene Importmodell erhält timeBlocks; Rohdaten bleiben unverändert.
- Alte Projekte ohne belegte Herkunft können keine grüne Gesamtampel mehr erhalten. Das historische LAeq_g5 wird ausschließlich informativ angezeigt.
- Die Diagramme bleiben ergänzend, insbesondere LAeq_g30 ist ausdrücklich als gleitender Verlauf markiert.
- **Temporäre Schutzmaßnahme:** Beide bisherigen PDF-Wege werden im UI deaktiviert, weil ihr Inhalt derzeit noch auf fachlich nicht abgesicherten Legacy-Auswertungen basiert. Die Generatoren selbst bleiben für die Ersetzung in Phase 5 vorhanden. Projekt speichern und wieder laden bleibt möglich.

## Automatisierte Prüfung

Ausführen: node --test tests/pegelTool/phase3/evaluation.test.cjs

Behandelt werden mathematische Referenzen R01–R03, feste Fenster, Randblöcke, Lücken, ungültige Zeiten, Überlappungen, Mitternacht, grenzüberschreitende Intervalle, Grenzwertgleichheit, Peakmaximum, Korrekturanwendung, kein Gleitwert-Ersatz, DST-Warnungen und das bereits archivierte XL3-Log. CI führt auch die Tests aus Phase 1 und 2 aus.

## Offene Freigabetore

- Originalnormabgleich, einschließlich der 12 offenen Zeitfragen aus Phase 0, vollständiger Normenmatrix, Kalibrierung, Messort-Korrekturen, Peak- und Protokollpflichten.
- Beleg des XL3-Zeitstempelbezugs und eindeutiger Zeitachse bei Sommer-/Winterzeit.
- Veranstaltungszeit vs. Messzeit, zulässige Randblöcke/Datenausfälle und 120-Minuten-Sonderregel.
- Unabhängige Fachprüfung der Referenzwerte sowie praktische Browser- und PDF-End-to-End-Tests.
- Reaktivierung der Protokollausgabe erst nach Umsetzung des gemeinsamen Berichtsdatenbestands in Phase 5.

**Fazit:** Technisch implementiert und automatisierbar prüfbar; fachliche Phase-3-Abnahme weiterhin gesperrt.
