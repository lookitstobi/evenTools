# pegelTool – verbindlicher Projektgrundsatz: Messwerte zuerst

**Beschlossen:** 18.11.2026  
**Priorität:** Verbindliche Nutzerentscheidung. Diese Vorgabe **ersetzt entgegenstehende Vorgaben** aus dem bisherigen Arbeitsplan (v1.0, insbesondere pauschale DIN-/Normfreigabe-Sperren).  
**Geltung:** pegelTool in `app/tools/pegelTool/`, Anzeige, Auswertung, Status, PDF und Folgedokumentation.

## Ziel des Produkts

Das pegelTool ist in erster Linie eine **schnell erfassbare, technisch korrekte Übersicht der gemessenen Schallpegel**. Es soll auf einen Blick zeigen, ob und wo die auswertbaren Messdaten die hinterlegten Vergleichswerte überschreiten. Es ist **kein DIN-Beweisinstrument und keine rechtliche Konformitätszertifizierung**. Die originalen NTi-XL3-Logdateien werden zusätzlich separat aufbewahrt und ermöglichen eine spätere Detailprüfung; deren Archivierung ist kein Ersatz für korrekte Softwareberechnung.

## Verbindliche Arbeitsregeln für alle folgenden Chats und Änderungen

1. **Funktionierende Berechnungen haben Vorrang.** LAeq und LCpeak aus geeigneten XL3-Daten tatsächlich bestimmen, plausibilisieren, vergleichen und anzeigen. Offene Detailfragen zum vollständigen Originaltext der DIN 15905-5:2022-07 dürfen diese grundlegenden Funktionen **nicht pauschal blockieren**.
2. **Grenzwertübersicht statt Dauerwarnung.** Vergleichswerte: LAeq über feste vollständige 30-Minuten-Fenster gegen **99 dB(A)**; C-bewertete Spitzen gegen **135 dB(C)**. Technische Grenzwertfeststellungen sind möglich, ohne dass jede formale DIN-Nachweisfrage erledigt sein muss. Keinen fest kodierten Status „Nicht beurteilbar“ ausgeben, wenn belastbare numerische Vergleiche möglich sind.
3. **Gemessene Teilzeiten nicht wegwerfen.** Angebrochene erste/letzte Halbstundenfenster ebenso anzeigen: tatsächliche Abdeckung, **LAeq über die erfasste Teilzeit** und höchster **LCpeak in der erfassten Teilzeit**. Einen Teilzeit-LAeq **nicht als vollständigen LAeq,30min** darstellen.
4. **Nur tatsächlich beobachtete Zeit beurteilen.** Fehlende Intervalle nicht als Stille oder unbedenklich behandeln. Ein auswertbarer Block darf technisch positiv bewertet werden, auch wenn andere Blöcke fehlen; die **gesamte Veranstaltung** darf deshalb nicht ungeprüft als lückenlos unbedenklich gelten.
5. **Messwertstatus und Dokumentationsstatus trennen.** (A) technisch: Vergleich unterschritten/überschritten/nicht bestimmbar, mit Messzeitbezug. (B) organisatorisch bzw. normativ: fehlende Messort-, Korrektur-, Kalibrierungs-, Protokoll- oder Normnachweise als eigene Hinweise. Mangel (B) darf eine bereits belastbare technische Aussage (A) **nicht unterdrücken**.
6. **Überschreitungen korrekt beschreiben.** LAeq: welche und wie viele **30-Minuten-Blöcke** überschritten wurden; nicht eine erfundene sekundengenaue Dauer „über 99 dB“. LCpeak: Anzahl und Zeitpunkte/1-s-Logintervalle über 135 dB(C); deren gezählte Intervalle sind **nicht** die echte physikalische Impulsdauer.
7. **Import-/Korrekturqualität erhalten.** LAeq energetisch und zeitgewichtet berechnen; LCpeak als Maximum auswerten; k1/k2 nicht doppelt anwenden. Fehler, Lücken und unklare Werte transparent anzeigen, ohne brauchbare Werte anderer Intervalle zu verwerfen.
8. **PDF und Oberfläche müssen die gleichen technischen Ergebnisse zeigen.** Eine sofort lesbare Grenzwertübersicht priorisieren. Begleitende Hinweise zur Dokumentation dezent und konkret halten; keine globale DIN-Originaltext-Warnung anstelle einer Messwertauswertung.
9. **Keine falschen Konformitätsversprechen.** Das Tool behauptet ohne gesicherte Grundlage weder vollständige DIN-Konformität noch rechtssicheren Nachweis; es muss dazu aber **nicht funktionsunfähig** sein. Die DIN ist fachlicher Bezugspunkt, nicht der globale Freigabeschalter der Anwendung.
10. **Vorhandene UI-Beschlüsse bleiben bestehen.** Insbesondere die Einseitenansicht und gezielte Bereinigung aus dem UI-Beschluss vom 18.11.2026 gelten weiter, soweit sie diesem neueren Auswertungsgrundsatz nicht entgegenstehen.

## Abnahmekriterien

- Ein importierter XL3-Datensatz zeigt für vollständige 30-Minuten-Blöcke die Werte **und** einen echten technischen Grenzwertvergleich statt pauschalem „Nicht beurteilbar“.
- Randblöcke mit z. B. 28 oder 20 Minuten erscheinen mit tatsächlichem Teilzeit-LAeq, gemessenem LCpeak und expliziter „Teilzeit“-Kennzeichnung.
- Übersicht nennt betroffene LAeq-Blöcke und LCpeak-Ereignisintervalle, ohne unzulässige Exaktheit der „Überschreitungsdauer“ zu suggerieren.
- Messlücken blockieren keine sicheren Teilbefunde, ergeben aber keine Gesamtaussage über ungemessene Zeit.
- PDF, Bildschirm und Referenztests stimmen überein.
- Reine Norm- oder Protokollvollständigkeitsfragen deaktivieren weder Rechenengine noch Grenzwertstatus noch Export einer technischen Messwertübersicht.

**Kurzregel für künftige Bearbeitungen:** *Zuerst korrekte Messwerte und klare Grenzwertübersicht; Nachweise und offene DIN-Details separat. Nicht mehr alles pauschal auf „Nicht beurteilbar“ setzen.*
