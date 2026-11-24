# pegelTool – Umsetzungsspezifikation: vollständige Messwertübersicht

**Beschluss / Priorität:** 18.11.2026; konkretisiert [PROJEKTGRUNDSATZ_MESSWERTE_2026-11-18.md](./PROJEKTGRUNDSATZ_MESSWERTE_2026-11-18.md).  
**Status:** Implementierungsauftrag, **noch nicht implementiert**.  
**Ziel:** Nach XL3-Import zuverlässige Pegel-/Grenzwertübersicht einschließlich Randblöcken und tatsächlicher Überschreitungen; Protokoll- und Normnachweise daneben, nicht als Berechnungssperre.

## 1. Verbindliche Ergebnisse und Anzeige

| Fall | Messwerte | Technische Vergleichsaussage | Kennzeichnung |
| --- | --- | --- | --- |
| Voller, sauberer 30-Minuten-Block | Energetischer LAeq,30min + höchster LCpeak | LAeq gegen 99 dB(A), LCpeak gegen 135 dB(C) | „Vollständig“ |
| Angebrochener Start-/Endblock | LAeq über **tatsächlich gültige Messdauer** + höchster **erfasster** LCpeak | Teilzeit-LAeq **nicht** als LAeq,30min freigeben; gemessenen LCpeak trotzdem gegen 135 dB(C) vergleichen | „Teilzeit (mm:ss / 30:00)“ |
| Innenliegende Datenlücke | Teilbefunde aus tatsächlich validen Intervallen, keine Stille ergänzen | Keine „vollständige 30-Minuten-Einhaltung“ behaupten; vorhandene **eindeutige LCpeak-Überschreitung** anzeigen | „Messlücke“ mit Dauer/Lage |
| Zeit-/Korrekturkonflikt | Vertrauenswürdige Werte isoliert anzeigen, unzuordenbare Werte markieren | Nur dort „nicht bestimmbar“, wo Messwert selbst unverlässlich ist | Konkrete Fehlerursache |
| Dokumentations-/Normnachweis offen | Berechnete, verlässliche Werte **weiterhin anzeigen** | Technischer Status bleibt sichtbar; Protokollstatus separat | Kein globales „Nicht beurteilbar“ nur wegen Formularen |

**Terminologie:** Im Überblick „LAeq,30min“ ausschließlich für vollständige, valide 1.800 s. Für Teilzeit „LAeq über gemessene Zeit (z. B. 27:48)“. LCpeak ist ein beobachtetes Maximum, kein über 30 Minuten gemittelter Wert. Ein Beurteilungsurteil für einen ganzen nicht gemessenen Zeitraum wird nicht behauptet.

## 2. Rechenengine: präzise Aufgaben

**Ort:** `app/tools/pegelTool/evaluation/engine.js`, insbesondere `buildBlocks()`, `evaluateModel()`, `measuredStatus()`.

1. **Fenster beibehalten:** Lokalzeitlich fixiert an `hh:00`/`hh:30`, Dauer 1.800 s. Bereits implementierte `coveredSeconds`, `validLaeqSeconds`, `validPeakSeconds`, `unknownSeconds` und Konflikterkennung weiterverwenden.
2. **LAeq:**
   - Für jede Blockmenge gültiger, nicht überlappender Messintervalle energie- und zeitgewichtet rechnen:  
     `LAeq = 10 * log10(sum(durationSeconds * 10^(LAeq_interval/10)) / sum(durationSeconds))`.
   - `laeq30Db` **nur** bei voller, eindeutig abgedeckter und für LAeq gültiger 1.800-s-Messung setzen.
   - Neues explizites Feld `laeqPartialDb` (oder gleichwertig dokumentierter Modellname) bei kürzerer, gültiger erfasster Zeit setzen; `laeqObservedDb` darf als intern bereits vorhandene Berechnung wiederverwendet werden. Bei inneren Lücken den tatsächlichen Nenner und die Lücke eindeutig zeigen. Fehlende Intervalle niemals als 0 dB behandeln.
   - `comparisonLAeq` nur aus `laeq30Db`, nicht aus Teilzeit- oder gleitendem `LAeq_g30`; auf 99,00 dB exakt Grenzwert **nicht überschritten** (`>`, nicht `>=`).
3. **LCpeak:**
   - Erfasste `LCPKmax_dt+k2`-Intervallmaxima zum Maximum bestimmen; *auch Rand- und Teilzeitblöcke* dürfen `lcpeakObservedDb` und einen technischen Vergleich bekommen, wenn Werte und Zuordnung verlässlich sind.
   - `lcpeakMaxDb` (bestehender vollständiger Blockwert) semantisch nicht heimlich umdefinieren; ergänzenden `lcpeakObservedDb` für Teilblöcke anzeigen und einen **globalen Maximalwert aus allen validen Messintervallen** bereitstellen (etwa `overall.lcpeakObservedMaxDb`), getrennt von dem Maximalwert nur vollständiger Blöcke.
   - Zähle für `LCPKmax_dt+k2 > 135` eindeutige **Logintervalle** und ihre Zeitpositionen / Quellzeilen. Ein Logintervall mit hoher Spitze ist kein Messbeleg dafür, dass der Pegel eine volle Sekunde oberhalb 135 dB lag. Bei mehrfachen Datenzeilen für dasselbe Intervall keine Ereignisse doppelt zählen. Bei unsicherer zeitlicher Zuordnung keine erfundene genaue Sekunde ausgeben.
   - Exakt 135,00 dB gilt nicht als Überschreitung.
4. **Status nicht global sperren:** `measuredStatus()` und `overall` dürfen nicht aufgrund irgendeiner Warnung, eines Randblocks oder eines fehlenden Formularfelds alle *sonst validen* Vergleichsergebnisse zu `not-assessable` machen. Pro Messgröße/Block die Aussage `above` / `at-or-below` / `unknown` erhalten. Dabei gilt: Eine nachgewiesene Überschreitung in einem validen Messabschnitt bleibt **Überschreitung**, selbst wenn an anderer Stelle Lücken existieren; umgekehrt ist eine vollständige Einhaltung der *gesamten Veranstaltung* bei Messlücken nicht belegbar.
5. **Korrekturen und Herkunft:** Vorhandene Parser-Provenienz respektieren; `k1`/`k2` nicht ein zweites Mal addieren. Bestehende DST-/Zeitstempel- und Überlappungswarnungen nicht aushebeln. Falls zeitlich überlappende oder grenzüberschreitende Intervallmaxima nicht blockgenau zuzuordnen sind: konkret kennzeichnen, statt sie künstlich einem Block zuzuschreiben.

## 3. Überschreitungen: Zählweise und Zeitbezug

### LAeq

- Jede gültige **volle** Halbstunde mit `LAeq,30min > 99` ist ein *betroffener Beurteilungsblock*.
- Zeige Anzahl und Zeiträume, z. B. `1 von 4 vollständigen Blöcken (21:00–21:30)`.
- In der bestehenden Spalte **„Überschreitungsdauer“** (laut UI-Beschluss beibehalten) für LAeq die Anzahl betroffener 30-Minuten-Blöcke transparent ausgeben; allenfalls `1 Block × 30 min`, niemals die angeblich exakte Dauer eines momentanen Pegels über 99 dB.
- Teilzeit-LAeq nicht in die Zahl gültiger LAeq,30min-Überschreitungen einrechnen; eine auffällige Teilzeitmessung darf als **zusätzlicher Hinweis** erscheinen.

### LCpeak

- Anzahl und Zeitstempel von eindeutigen Logintervallen mit `LCpeak > 135`; optional zusammenhängende Intervallfolgen gruppieren, dann ausdrücklich **„Folgen betroffener Logintervalle“** nennen.
- In „Überschreitungsdauer“ `n Logintervalle à [Intervalllänge]` oder `n betroffene Logintervalle` zeigen, **nicht** `n Sekunden realer Spitzenschall über 135 dB`.
- Spitzen aus Randblöcken und gültigen Teilen unvollständiger Blöcke gehören ausdrücklich in die globale LCpeak-Suche.

## 4. Anzeige, Gesamtstatus und PDF

**Orte:** `app/tools/pegelTool/index.html` (`renderPhase3Evaluation()`, `calculateAndRender()`), `ui/workflow.js`, `protocol/protocol.js`, `report/report.js`, `report/pdf.js`.

- **30-Minuten-Tabelle:** Fünf vorhandene Spalten beibehalten; bei Randblöcken LAeq-Teilzeitwert und erfassten LCpeak anzeigen, Zelle „Datenlage“ = `Teilzeit: 27:48 / 30:00`. Innenliegende Lücken als `Messlücke` unterscheiden. Nicht pauschal `—` für vorhandene valide Teilwerte.
- **Messwertübersicht:** Gemessener Maximalwert; Vergleichswert; tatsächliches Ergebnis; Zahl/Zeiträume betroffener Blöcke bzw. Zahl/Zeitstempel betroffener LCpeak-Logintervalle. Entferne hartkodierte `'—'` für die Überschreitungszählung und hartkodiertes `Nicht beurteilbar` für gültige Messvergleiche.
- **Technischer Gesamtstatus:** Entsprechend den verfügbaren Messdaten `Überschreitung festgestellt`, `Keine Überschreitung in auswertbaren Daten festgestellt` oder `Keine belastbaren Messdaten`. Bei Lücken **zusätzlicher Hinweis** `Messzeit nicht lückenlos`; nicht aus einem Teilbefund „gesamte Veranstaltung eingehalten“ ableiten.
- **Protokollstatus:** Fehlende Angaben, Kalibrator-/Messortnachweise, noch offener Normtext-Abgleich separat von Grenzwertübersicht. Sie dürfen technischen Zahlen und PDF-Export **nicht pauschal blockieren**; bei fehlerhaften Wertzuordnungen sind konkrete Qualitätswarnungen weiterhin erforderlich.
- **PDF:** Gleiche Datenbasis wie UI; Blockwerte, Kennzeichnung Teilzeit/Messlücke, LAeq-Blocküberschreitungen, LCpeak-Logintervalle und Datenlage spiegeln. Keine falsche DIN-Konformitätsbescheinigung.
- **UI-Abgleich:** Verbindlichen Beschluss `UI_BEREINIGUNG_BESCHLUSS_2026-11-18.md` beachten; die Spalte „Überschreitungsdauer“ bleibt vorhanden, wird aber fachlich korrekt gefüllt.

## 5. Prüffälle und Abnahme (automatisiert + Browser + PDF)

Mindesttestmatrix mit unabhängigen Berechnungserwartungen:

1. **2 volle Blöcke unter Grenzwert:** 1.800 s/Block, LAeq 87,24 und 83,84 dB, LCpeak 119,10 und 117,70 dB → beide Vergleiche `at-or-below`, jeweils 0 betroffene vollständige LAeq-Blöcke und 0 LCpeak-Logintervalle über 135; technischer Teilstatus nicht durch andere Formularfelder gesperrt.
2. **Randblöcke:** 1.668 s und 1.250 s mit validen Daten → beide mit LAeq über tatsächliche Zeit und LCpeak sichtbar, `laeq30Db=null`, korrekte Teilzeitkennzeichnung. Nicht in LAeq,30min-Maximum oder Zahl überschrittener voller Blöcke mischen.
3. **Grenzwertgleichheit:** 99,00 dB LAeq im Vollblock bzw. 135,00 dB LCpeak → nicht `above`; 99,01 bzw. 135,01 → `above`.
4. **Energetik:** 900 s bei 80 dB + 900 s bei 90 dB → `LAeq=87,4036… dB` (nicht arithmetisch 85 dB); `k1` nur einmal.
5. **LCpeak ausschließlich im Randblock:** z. B. 136 dB im ersten 1-s-Logintervall eines 20-min-Blocks → globale **Überschreitung festgestellt**, 1 betroffener Intervallstempel; nicht vom vollständigen-Block-Filter verschlucken.
6. **Interne 20-s-Messlücke:** Abdeckung 1.780/1.800 s → keine vollständige LAeq,30min-Einhaltungsbehauptung, vorhandene Teilwerte sichtbar und warnend markiert; verlässliche LCpeak-Ereignisse werden nicht unterdrückt.
7. **Unsicherer Zeitstempel / doppeltes Intervall / grenzüberschreitendes Intervall:** Keine doppelt gezählten Logsekunden; unzuordenbare Werte/Zeiten explizit markiert; andere valide Zeitfenster weiterhin verwendbar.
8. **Korrektur:** Logspalte bereits mit `+k1`/`+k2` → keine erneute Addition. Fehlende/ungültige Korrektur nicht stillschweigend als 0 behandeln.
9. **Unvollständiges Formular / nicht abgeschlossener Normabgleich:** Technische LAeq-/LCpeak-Auswertung und Export bleiben vorhanden, Dokumentation getrennt als unvollständig.
10. **End-to-End:** Realen XL3-Import + Beispieldatensatz, Bildschirmtabelle, JSON/HTML-Wiederherstellung und PDF-Inhalte vergleichen; Werte, Status, Lücken und Zeitbereiche müssen gleich sein.

**Definition of Done:** Alle zehn Fälle laufen reproduzierbar; Browser und PDF zeigen denselben fachlichen Status; keine pauschalen `Nicht beurteilbar` trotz zuverlässiger Messwerte; keine erfundenen Messzeiten oder rechtsverbindlichen DIN-Aussagen. Codeänderungen und Tests erfolgen in einem separaten Implementierungs-PR, **nicht** durch dieses Dokument.

## 6. Umsetzungsvorschlag in Reihenfolge

1. **Engine / Datenmodell:** `laeqPartialDb`, Teilzeit-/Lückenkennzeichnung, vollständiger LCpeak-Gesamtwert, Ereignisintervalle und unabhängige Status pro Messgröße implementieren.
2. **UI:** Bestehende Tabellen auf neue Felder umstellen; feste `—`/`Nicht beurteilbar`-Platzhalter beseitigen; Gesamtstatus und Dokumentationsstatus getrennt.
3. **Report/PDF:** Kanonisches Datenmodell konsistent erweitern, korrektes Wording und Teilzeit-/LCpeak-Ergebnis übernehmen.
4. **Tests & Freigabe:** Rechen-/Regressions- und Browser-/PDF-Tests samt echten XL3-Daten durchführen. Ergebniswerte stichprobenartig gegen Original-XL3-Report kontrollieren; Unterschiede dokumentieren.

**Vorrangregel:** Falls alte Aufgaben, Codekommentare oder CI-Gates wegen unbestätigter Normdetails generell „nicht beurteilbar“ erzwingen, sind sie gemäß neuer Projektleitlinie zu ändern; konkrete technische Unsicherheiten weiterhin offen benennen.
