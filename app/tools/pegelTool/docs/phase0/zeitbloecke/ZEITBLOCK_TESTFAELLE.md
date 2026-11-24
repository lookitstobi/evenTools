# pegelTool – Zeitblock-Testfälle (Phase 0, Fachfrage 1)

**Stand:** 2026-11-16 · **Zweck:** überprüfbare Eingaben/Erwartungen für die zeitliche Zuordnung von 30-Minuten-Beurteilungsblöcken.  
**Geltungsgrenze:** Keine normative Freigabe. Bei allen Beispielen mit Randzeiten, fehlenden Daten oder Datenfehlern ist ein positives DIN-Urteil **gesperrt**, bis die Originalnormenfrage geklärt ist. Andere Normfragen (z. B. 120-Minuten-Alternative, Messortkorrekturen, Kalibrierung) sind ausgeschlossen.

## A. Testformat und vorläufige Konventionen

1. Datensätze beschreiben **gültige Messintervalle** `[von, bis)`; Endpunkt gehört **nicht** zum Intervall. Diese Konvention ist technisch festgelegt, nicht aus DIN 15905-5 zitiert.
2. Uhrzeiten sind **lokal Europe/Berlin**, sofern nicht zusätzlich ein UTC-Offset notiert ist. Jede Zeitspanne ist als Datum + Uhrzeit zu betrachten. Bei Zeitumstellung ist ein UTC-Offset notwendig.
3. **B** = hypothetischer fester 30-min-Uhrzeitblock (z. B. `20:00–20:30`), **Abdeckung** = beobachtete gültige Zeit innerhalb dieses Blocks. 1800 s = vollständig. Mit Messwerten außerhalb des Blocks darf Abdeckung nicht künstlich aufgefüllt werden.
4. `Zeitstatus`: `vollständig` (1800/1800 s), `teilweise` (0 < t < 1800), `keine Daten`, `Zeitkonflikt`. Das sind **Datenqualitätsstatus**, keine DIN-Urteile.
5. **Normstatus:** Bei vollständigen, widerspruchsfreien Zeilen `noch nicht normativ geprüft`; bei unaufgeklärter Teilabdeckung oder Zeitfehler `Nicht beurteilbar` **nach Projekt-Sicherheitsregel**, nicht als angeblich zitierter Wortlaut der DIN.
6. Beispiel-Leq-Werte dienen nur zur **mathematischen Prüfung**. Ihre normative Verwendung bei Teilmessungen bleibt offen (ZEIT-007).

## B. Kernfälle

| ID | Eingabe (Datum 2026-11-16, falls nicht anders angegeben) | Erwartete zeitliche Zuordnung / Datenqualität | Normative Folge im aktuellen Projektstand | Bezug |
|---|---|---|---|---|
| T01 | Messintervalle decken `20:00–21:00` lückenlos ab | **B1** `20:00–20:30`: 1800/1800 s; **B2** `20:30–21:00`: 1800/1800 s; disjunkt | Bewertungsentscheidung erst nach Normbeleg | ZEIT-001–003, TECH-002 |
| T02 | Lückenlose Intervalle `20:30–21:30` | **B1** `20:30–21:00` und **B2** `21:00–21:30`, je 1800 s; kein Block `20:30–21:30` | Kein gleitendes 60-min-Kriterium in diesem Arbeitspaket | ZEIT-002 |
| T03 | Messstart `20:07`, lückenlose Messung bis `21:00` | **B1** `20:00–20:30`: 1380/1800 s; **B2** `20:30–21:00`: 1800/1800 s | B1 `Nicht beurteilbar` (Interims-Schutzregel); keine erfundene Stille `20:00–20:07` | ZEIT-004–005, TECH-003–004 |
| T04 | Messstart `07:50`, Messende `08:30` | **B1** `07:30–08:00`: 600/1800 s; **B2** `08:00–08:30`: 1800/1800 s. Das aus einem XL2-Modus bekannte erste 10-min-Geräteintervall ist kein 30-min-Vollblock | B1 `Nicht beurteilbar`; Normakzeptanz des Sonderfalls offen | ZEIT-005, ZEIT-007 |
| T05 | Veranstaltung `20:07–21:12`; Messung `20:00–21:30` vollständig | **B1** `20:00–20:30`, **B2** `20:30–21:00`, **B3** `21:00–21:30`: alle 1800/1800 s *Messabdeckung*. Veranstaltungszeiten separat aufbewahren | Welche Vor-/Nachlaufzeiten normativ einfließen dürfen, bleibt **offen** | ZEIT-004, ZEIT-006, ZEIT-009 |
| T06 | Veranstaltung `20:00–21:12`; Messung endet `21:12` | **B1** `20:00–20:30`: 1800 s; **B2** `20:30–21:00`: 1800 s; **B3** `21:00–21:30`: 720 s | B3 `Nicht beurteilbar` nach Projektregel, bis Umgang mit Randblock bestätigt | ZEIT-006–007 |
| T07 | `20:00–20:10` + `20:12–20:30`; in `20:10–20:12` fehlen Daten | **B1** 1680/1800 s, **Lücke** 120 s mit genauer Lage | `Nicht beurteilbar`, kein Lautstärkewert für Lücke eingesetzt | ZEIT-007–008, TECH-003–004 |
| T08 | `20:00–20:15` mit 100 dB(A), `20:15–20:30` fehlt | **B1** 900/1800 s; rechnerisch vorhandene Zeit: Leq=**100,00 dB(A)**; bei *hypothetischer* Null-Energie-Auffüllung: **96,99 dB(A)** | `Nicht beurteilbar`; **96,99 dB(A) darf nicht als gültig ausgegeben werden** | ZEIT-007–008, TECH-003 |
| T09 | `20:00–20:10` 90 dB(A), `20:10–20:20` 90 dB(A), `20:20–20:30` 90 dB(A) – alle Abschnitte tatsächlich aufgezeichnet, auch wenn die PA zwischendurch aus ist | **B1** 1800/1800 s; Beobachtung und PA-/Publikumsbetrieb getrennt erfassen | Kein Datenmangel; ob außerprogrammliche Zeiten berücksichtigungsfähig sind, offen | ZEIT-009, TECH-003 |
| T10 | Logger wurde `20:10–20:12` pausiert und schreibt dort `invalid` statt gültigem Pegel | **B1** 1680 gültige Sekunden, 120 s ungültig; raw `invalid` bleibt erhalten | `Nicht beurteilbar`; Pause ist keine nachgewiesene leise Phase | ZEIT-008, TECH-001/003 |
| T11 | `2026-11-16 23:45` bis `2026-11-17 00:45`, lückenlos | **B1** 23:30–00:00 = 900 s; **B2** 00:00–00:30 = 1800 s; **B3** 00:30–01:00 = 900 s; jeweiliges Datum eindeutig | B1/B3 `Nicht beurteilbar` interimistisch, B2 zeitlich vollständig | ZEIT-010, TECH-008 |
| T12 | Sample `[20:29:58,20:30:02)` 90 dB(A) mit nachgewiesener Intervallsemantik | **B1** und **B2** überlappen das Sample jeweils für 2 s; **nicht** jeweils 4 s. Wie sich dessen gemittelte **Energie** auf die Hälften verteilt, ist bei nur einem 4-s-Leq **nicht exakt bekannt**; keine unbewiesene Gleichverteilung annehmen | Zeitgrenze sicher, exakte Blockpegel ohne feinere Messdaten `Nicht beurteilbar` | ZEIT-011–012, TECH-002 |
| T13 | XL3-Protokoll enthält ausschließlich `LAeq_g30` zum Zeitpunkt 20:30, keine verwertbaren Kurzzeitintervalle | `LAeq_g30` als gleitenden Wert klassifizieren; **keine** automatisch generierte feste Halbstunden-Blockbewertung | Fester 30-min-Normwert `Nicht beurteilbar` | ZEIT-003, TECH-007 |
| T14 | Logzeitstempel `20:30:00` ist dokumentierter **Intervall-Endpunkt** für ein 1-s-Leq | Sample gehört zu `[20:29:59,20:30:00)`, also zum vorherigen Block; bei unklarer End-/Start-Semantik `Zeitkonflikt` | Bei unklarer Zeitsemantik `Nicht beurteilbar` | ZEIT-012, TECH-006 |
| T15 | Datensätze für `[20:00:00,20:00:01)` doppelt, identischer Wert; Rest vollständig | Rohdubletten erhalten; 1 s muss **höchstens einmal** in die Abdeckung eingehen; Warnung `Dubletten` | Keine stillschweigende Datenreparatur; Prüfhinweis bzw. manuelle Verifikation | TECH-001, TECH-005 |
| T16 | Datensätze für `[20:00:00,20:00:01)` doppelt, unterschiedliche Pegel | `Zeitkonflikt`, widersprüchlicher Pegel für dieselbe Zeit; keine automatische Wahl des höheren/niedrigeren Werts | `Nicht beurteilbar` | TECH-005 |
| T17 | Zeitfolge `20:00:01`, `20:00:02`, **`19:59:59`**, `20:00:03` ohne erklärten Reset | Zeitrücksprung dokumentieren; Chronologie nicht allein aus Zeilenreihenfolge und ohne Warnung reparieren | `Nicht beurteilbar`, soweit die Zuordnung betroffen ist | TECH-005 |
| T18 | Sommerzeitende: `2026-10-25T02:30:00+02:00` und `2026-10-25T02:30:00+01:00` | Gleiche **Lokalzeit**, aber **verschiedene physikalische Zeitpunkte** (eine Stunde auseinander); intern nicht verschmelzen. Bei fehlendem Offset `Zeitkonflikt` | Ohne eindeutigen Zeitbezug `Nicht beurteilbar` | TECH-008 |

## C. Mathematische Referenzfälle (ohne normative Teilmessungsfreigabe)

Dies sind **Rechenkontrollen** für die spätere Zeitgewichtung, keine zusätzlichen Normanforderungen.

### R01 – Zwei gleich lange, unterschiedliche Pegel
- Eingabe: `[20:00,20:15)` = 90,0 dB(A), `[20:15,20:30)` = 100,0 dB(A); beide gültig.
- Referenz: `10 × log10((900×10^(90/10) + 900×10^(100/10)) / 1800) = 97,4036 dB(A)`.
- Erwartung: Zeitabdeckung 1800/1800 s; **kein arithmetischer Mittelwert von 95,0 dB(A)**.

### R02 – Unterschiedlich lange Intervalle
- Eingabe: `[20:00,20:10)` = 90,0 dB(A), `[20:10,20:30)` = 96,0 dB(A); beide gültig.
- Referenz: `10 × log10((600×10^(90/10) + 1200×10^(96/10)) / 1800) = 94,7529 dB(A)`.
- Erwartung: Zeitabdeckung 1800/1800 s, korrekte zeitlich-energetische Gewichtung.

### R03 – Fehlende zweite Blockhälfte **darf nicht als Null-Energie gelten**
- Eingabe: `[20:00,20:15)` = 100,0 dB(A), danach Messausfall bis `20:30`.
- Mathematische Werte bei **verschiedenen Annahmen**: beobachteter Leq = 100,0 dB(A), künstliche Division der *einzigen bekannten Energie* durch 1800 s = 96,9897 dB(A).
- Erwartung: Der zweite Wert ist **keine gesicherte Messung der fehlenden Zeit**. Zeitabdeckung 900/1800 s, Warnhinweis, `Nicht beurteilbar` gemäß Projektregel. Keine normative Leq30-Freigabe ohne Originalnormbeleg.

## D. Abnahmekriterien für diese Testfallsammlung

- [x] Alle zeitlichen Kernfälle aus Punkt 1 haben eine testbare Eingabe und ein erwartetes Zeit-/Qualitätsresultat.
- [x] Fehlen von Daten wird nicht mit aufgezeichneter Stille gleichgesetzt.
- [x] Testfälle trennen Zeitblockzuordnung von der noch ungeklärten normativen Zulässigkeit.
- [x] Randfälle für Messbeginn/Ende, über Mitternacht, unklare Zeitstempel, Dubletten, Zeitumstellung und Gleitwerte enthalten.
- [ ] Originalnorm 2022-07 abgeglichen; normativ definitive Ergebnisse/Bewertung für Randblöcke und Lücken hinterlegt (**blockiert**).
- [ ] Automatisierte Testimplementierung (**ausdrücklich spätere Entwicklungsphase**, nicht Teil dieses Arbeitsabschnitts).

## E. Quellen

Siehe Quellenverzeichnis `NORMENMATRIX.md`, insbesondere S3 (historische Halbstundenregel), S4 (dBmess 2023: Messsekunden, Leq vs. Leq30), S5 (XL2-Kurzstart), S6 (XL3-Gleitwert), P2 (Sicherheitsregeln).