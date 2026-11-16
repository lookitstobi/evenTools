# pegelTool – Normenmatrix, Phase 0 / Fachfrage 1

**Stand:** 2026-11-16 · **Status:** fachlicher Arbeitsstand – **NICHT normativ freigegeben**  
**Geltungsbereich dieser Teilmatrix:** Ausschließlich **Bildung und zeitliche Zuordnung der 30-Minuten-Beurteilungszeiträume**, einschließlich Randzeiten, Messbeginn/-ende und Zeitlücken. Die Punkte 2–7 des Projektleitfadens sind ausdrücklich ausgeschlossen.  
**Zielnorm:** DIN 15905-5:2022-07; die zugehörigen Normstellen werden als **Prüfstellen**, nicht als bereits verifizierte Belege verwendet.

## 1. Quellen- und Prüfstatus

| Kürzel | Quelle und Ausgabe | Reichweite / Bewertung |
|---|---|---|
| S1 | [DIN Media, DIN 15905-5:2022-07](https://www.dinmedia.de/de/norm/din-15905-5/352773526) | **Primärquelle, Metadaten:** Ausgabe und Gültigkeitsstatus; Abschnittsinhalte nicht frei einsehbar. |
| S2 | [Vorschau der Originalnorm (Deckblatt, Inhaltsverzeichnis und Vorwort)](https://img.antpedia.com/standard/files/pdfs_ora/20230613-DIN/DIN/15-19/DIN%2015905-5%202022-7.pdf) | **Originaldokument, nur Vorschau**; bestätigt die Existenz/Nummerierung von § 4.1, § 5.1, § 5.5 und § 5.6, **nicht deren Regeltext**. Verfügbarkeit nicht als autorisierte Vollfassung gleichsetzen. |
| S3 | [Bayerisches Landesamt für Umwelt, Schallpegelüberwachung bei mobilen elektroakustischen Beschallungsanlagen (2010)](https://www.hamburg.de/resource/blob/88326/dd826297c0352a4c782f6902dfb42ad2/schallpegelueberwachung-mobile-anlagen-data.pdf) | **Historische Sekundärquelle zur DIN-Ausgabe 2007:** feste Halbstunden, Messung vor Veranstaltungsbeginn, 30 Minuten ohne Unterbrechung. Keine Bestätigung des Wortlauts 2022. |
| S4 | [dBmess 2023, Anleitung VV5/VV6](https://dbmess.de/downloads/dBmess%202023%20VV6.pdf), insbesondere Abschnitte 1.3, 2.3, 2.5–2.6 | **Herstellerinformation mit ausdrücklichem Bezug auf Ausgabe 2022-07**. Unterscheidet Halbstunden-Messsekunden (max. 1800), Leq über tatsächliche Messdauer und Leq30. Keine autoritative Normauslegung. |
| S5 | [NTi Audio, XL2-Bedienungsanleitung, Synchronmessung](https://www.pewa.de/DATENBLATT/DBL_NTI_NTI-XL2_BEDIENUNGSANLEITUNG_DEUTSCH.PDF) | **Historische Gerätereferenz**: bei synchronisiertem Start kann der erste Zyklus verkürzt sein; Beispiel 07:50–08:00, danach feste 30-Minuten-Zyklen. **Geräteverhalten ≠ Normerlaubnis.** |
| S6 | [NTi Audio, XL3 User Manual](https://www.nti-audio.com/wp-content/uploads/download-manager-files/XL3-User-Manual-A4.pdf), Abschnitt „Gliding Leq level“ | **Aktuelle Geräteinformation:** Ein gleitender Leq ist zeitlich anders definiert als ein an Uhrzeiten gebundener Block. |
| P1 | Projektdatei `DIN Messwerte Protokoll.txt` | Bisherige Arbeitsannahme: Uhrzeit-blöcke zur vollen/halben Stunde. **Kein Primärbeleg.** |
| P2 | `pegelTool_Modernisierung_Arbeitsplan.md`, v1.0 vom 16.11.2026 | **Verbindlicher Projektauftrag**, insbesondere „keine falsche Freigabe“, unveränderte Rohdaten, dokumentierte Datenfehler, keine Normbehauptung ohne Originaltext. |

**Befund zur Originalnorm:** Die zugängliche Vorschau zeigt die Gliederung, endet jedoch vor dem Inhalt von § 4.1/5.1. Eine autorisierte vollständige Ausgabe 2022-07 lag bei der Bearbeitung nicht vor. **Daher kann keine der unten stehenden inhaltlichen DIN-Anforderungen als „bestätigt“ bewertet werden.** Der Quellenstand schließt keine fachliche Spezifikation aus, blockiert aber die normative Freigabe.

## 2. Statuskonvention

- **`bestätigt`**: Für einen *normativen* Eintrag ausschließlich nach Prüfung der vollständigen Originalnorm 2022-07; für eine ausdrücklich als **Projektregel** markierte Zeile ist der Leitfaden ausreichend. In dieser Fassung ist **keine inhaltliche DIN-Regel bestätigt**.
- **`offen`**: Normregel, Anwendung oder Ausnahme nicht anhand des Originaltexts abschließend verifiziert; **P0-Sperre**, falls für Bewertung benötigt.
- **`nicht anwendbar`**: Kein eigenständiger DIN-Nachweisgegenstand (z. B. technische Qualitätskontrolle). Die technische Regel kann dennoch verbindlich aus P2 folgen.

**Prioritäten:** `P0` = erforderlich vor normativer Freigabe; `P1` = ergänzende Nachvollziehbarkeit.  
**Umsetzungsorte:** `Blockgenerator`, `Import/Zeitleiste`, `Qualitätsprüfung`, `Report`; nur **Schnittstellen-/Implementierungsvorgaben**, **kein Codeauftrag** in diesem Arbeitspaket.

## 3. Normative Anforderungsmatrix – Punkt 1

| ID | Normabschnitt (Prüfstelle) | Präzise zu prüfende Aussage / Arbeitsannahme | Geltungsbedingung | Prio | Umsetzungsort | Testfall | Status | Basis |
|---|---|---|---|---|---|---|---|---|
| ZEIT-001 | § 4.1; § 5.1 | Maßgebliche Beurteilungszeiträume haben 30 Minuten (= 1800 s). | LAeq-30-min-Beurteilung | P0 | Blockgenerator | T01, T03 | **offen** | S3, S4, P1 |
| ZEIT-002 | § 4.1; § 5.1 | Zeitfenster liegen an festen Uhrzeitgrenzen `hh:00` und `hh:30`, nicht frei ab Messstart. | Alle normativen 30-min-Blöcke | P0 | Blockgenerator | T01–T04 | **offen** | S3–S5, P1 |
| ZEIT-003 | § 4.1; § 5.1 | Die normative Blockserie ist disjunkt; ein gleitendes LAeq_g30 ersetzt sie nicht. | Vorhandene gleitende Daten | P0 | Blockgenerator | T13 | **offen** | S3, S6, P2 |
| ZEIT-004 | § 4.1; § 5.1 | Exakt zu bestimmen: welche Uhrzeit bei **Veranstaltungsbeginn != Messbeginn** den ersten relevanten Block festlegt. | Abweichende Beginnzeiten | P0 | Zeitmodell | T03, T05 | **offen** | S3, S4 |
| ZEIT-005 | § 4.1; § 5.1 | Normative Behandlung des ersten **angebrochenen** Halbstundenfensters ist zu klären; ein gekürzter Gerätemesszyklus ist nicht automatisch ein gültiger 30-min-Beurteilungswert. | Messung beginnt innerhalb des Blockes | P0 | Qualitätsprüfung | T03, T04 | **offen** | S4, S5 |
| ZEIT-006 | § 4.1; § 5.1 | Normative Behandlung des letzten angebrochenen Fensters und der Daten nach Veranstaltungsende ist zu klären. | Veranstaltung endet zwischen Uhrzeitgrenzen | P0 | Zeitmodell, Report | T05, T06 | **offen** | S3, S4 |
| ZEIT-007 | § 4.1; § 5.1 | Zu klären: Ist ein `Leq30` bei `gemessene Sekunden < 1800` normativ zulässig, und wenn ja, unter welchen Voraussetzungen und mit welchem Nenner? **`Leq_ist` und `Leq30` dürfen nicht gleichgesetzt werden.** | Partielle Blöcke, auch Randblöcke | P0 | Rechenengine, Report | T04, T07, T08 | **offen / kritisch** | S4 |
| ZEIT-008 | § 4.1; § 5.1 | Behandlung von **echten Datenlücken**, Geräte-Pause oder Messausfall (einschließlich möglicher Grenz-/Toleranzwerte) ist anhand des Originaltexts zu prüfen. | Fehlende Messdaten in relevanter Zeit | P0 | Qualitätsprüfung | T07–T10 | **offen / kritisch** | S3, S4, P2 |
| ZEIT-009 | § 4.1; § 5.1 | Zu klären: Ob und wie **leise, aber gültig aufgezeichnete** Vor-/Nachlaufzeiten im jeweiligen Block berücksichtigt werden. Sie sind von *nicht vorhandenen* Daten zu unterscheiden. | Changeover, Programmstart/-ende, leise Phasen | P0 | Zeitmodell, Qualitätsprüfung | T05, T09 | **offen** | S3, S4 |
| ZEIT-010 | § 4.1; § 5.1 | Zeitfenster müssen über Datumswechsel hinweg fortlaufend zugeordnet werden; formale Uhrzeit-/Kalendertag-Regel anhand der Norm prüfen. | Veranstaltung über Mitternacht | P0 | Blockgenerator | T11 | **offen** | S4, P2 |
| ZEIT-011 | § 4.1; § 5.1, ggf. § 5.6 | Nachweispflicht zu **Beginn/Ende jedes Beurteilungsfensters** und zur tatsächlichen Datenabdeckung anhand Originaltext feststellen. | Export/Beurteilungsbericht | P0 | Report | T01, T07, T12 | **offen** | P1, S4 |
| ZEIT-012 | § 4.1; § 5.1 | Zu klären: Bei grenzüberschreitenden Messintervallen ist die zeitliche Überlappung bestimmbar, aber die **exakte Energieverteilung** ohne Subintervallinformation nicht zwingend rekonstruierbar. Eine stillschweigende lineare Aufteilung ist unzulässig. | Loggingintervall nicht uhrzeitsynchron | P0 | Blockgenerator, Rechenengine | T12, T14 | **offen** | P2 (Phase 3) |

**Zusammenfassung der Normprüfung:** `12 offen`, `0 bestätigt` (Norminhalt). Die Zuordnung zu §§ 4.1/5.1/5.6 basiert auf deren **offiziell sichtbaren Überschriften**, nicht auf deren nicht einsehbarem Wortlaut. Kein automatisches „DIN-konform“ zulässig.

## 4. Gesonderte technische Sicherheitsregeln aus dem Projektleitfaden

Die folgenden Regeln sind **keine zusätzlich behaupteten DIN-Pflichten**, sondern verbindliche Arbeits- und Qualitätssicherungsentscheidungen aus P2. Sie sind unabhängig von der noch offenen Normauslegung sinnvoll.

| ID | Normabschnitt | Konkrete Projektregel | Bedingung | Prio | Umsetzungsort | Testfall | Status | Basis |
|---|---|---|---|---|---|---|---|---|
| TECH-001 | nicht anwendbar | Jede importierte Messung bewahrt Rohzeitstempel, Originalreihenfolge und ursprüngliche Pegelwerte. | Immer | P0 | Import/Zeitleiste | T15 | **nicht anwendbar (DIN)**; P2 bestätigt | P2 |
| TECH-002 | nicht anwendbar | Für deterministische Zuordnung werden Halbintervalle `[Beginn, Ende)` verwendet. **Kein Zeitanteil** darf doppelt gezählt werden; ein grenzüberschreitendes Sample kann jedoch zwei Blöcke berühren. Die Energiezuordnung bleibt bei unzureichender Zeitauflösung ungeklärt. | Überlappende Blockgrenzen | P0 | Blockgenerator | T01, T12 | **nicht anwendbar (DIN)**; technische Festlegung | P2 |
| TECH-003 | nicht anwendbar | `Erwartete Zeit` (1800 s), `nachgewiesen gültige Messzeit` und `unbekannte/ungültige Zeit` separat erfassen. Nicht aufgezeichnete Zeit **nie stillschweigend als 0 dB oder Stille werten**. | Jede Datenlücke | P0 | Qualitätsprüfung | T07–T10 | **nicht anwendbar (DIN)**; P2 bestätigt | P2 |
| TECH-004 | nicht anwendbar | Jeder unaufgelöste Zeitfehler, jede ungeklärte Randzeit oder fehlende Messabdeckung verhindert eine positive Normbewertung des betroffenen Falls. | Datenqualitätsmangel | P0 | Bewertung, Report | T03, T07–T10 | **nicht anwendbar (DIN)**; P2 bestätigt | P2 |
| TECH-005 | nicht anwendbar | Doppelte/überlappende Intervalle, Zeitrücksprünge und Uhren-/Zeitzonenprobleme ausdrücklich melden statt automatisch reparieren. | Defekte Zeitleiste | P0 | Import/Zeitleiste | T15–T18 | **nicht anwendbar (DIN)**; P2 bestätigt | P2 |
| TECH-006 | nicht anwendbar | Zeitpunkt des Logs eindeutig als **Intervallanfang, Intervallende oder Momentanmarke** klassifizieren; ohne Nachweis keine Umdeutung. | Import unklarer Dateiversion | P0 | Import/Zeitleiste | T14 | **nicht anwendbar (DIN)**; P2 bestätigt | P2 |
| TECH-007 | nicht anwendbar | `LAeq_g30` ist ein **gleitendes** 30-min-Fenster; kein Ersatz für aus festen Abschnitten ermitteltes LAeq30. | XL3-Daten enthalten gliding Leq | P0 | Datenmodell | T13 | **nicht anwendbar (DIN)**; P2 bestätigt | S6, P2 |
| TECH-008 | nicht anwendbar | Datumswechsel und doppelt vorkommende Lokalzeiten (Sommer-/Winterzeit) müssen ohne Blockkollision oder rückwärts laufende physikalische Zeit verarbeitet werden; unklare Zeitzonen blockieren automatische Freigabe. | Uhrzeitumstellung/Datumswechsel | P0 | Zeitmodell | T11, T18 | **nicht anwendbar (DIN)**; technische Festlegung | P2 |

## 5. Zeitbezogene Berichtsfelder (nur aus Punkt 1 abgeleitet)

**Wichtig:** Dies ist **nicht** die endgültige normative Pflichtfeldliste nach § 5.6. Deren vollständige Prüfung gehört zu einem anderen Arbeitspaket. Hier werden ausschließlich die von der Zeitblocklogik benötigten Informationen spezifiziert.

| Feld | Verwendung | Vorläufige Projektklassifizierung | DIN-Pflichtstatus |
|---|---|---|---|
| Veranstaltungsbeginn / -ende | Relevante Fenster und Randzeiten erkennen | bedingt erforderlich (für Zeitzuordnung) | **offen** |
| Messbeginn / -ende | Gültigkeits- und Datenabdeckungsnachweis | erforderlich (technischer Prüfdatensatz) | **offen** |
| Blockbeginn / -ende mit Datum | Jeder Zeitblock eindeutig | erforderlich (technischer Prüfdatensatz) | **offen** |
| Gültige Messdauer in Sekunden | Nachweis, ob 1800 s vorliegen | erforderlich (technischer Prüfdatensatz) | **offen** |
| Unbekannte/ungültige Zeit, Lücken | Unvollständigkeit transparent machen | bedingt erforderlich | **offen** |
| Anzeige `Leq_ist` vs. `Leq30` + Berechnungsbasis | Fehlinterpretation verhindern | bedingt erforderlich (bei Abweichung) | **offen** |
| Zeitzone/UTC-Offset und Zeitauflösung | Mehrdeutige Uhrzeit vermeiden | bedingt erforderlich | **offen** |
| Warnhinweise, Zeitstatus, Datenherkunft | Keine unbelegte Freigabe | erforderlich (Projektregel) | **offen** |

## 6. Entscheidungs- und Freigabesperren

### Bereits belastbar als **technische** Vorgabe

1. Eine Block-Zeitleiste in 30-Minuten-Slots anlegen ist als **provisorische Implementierungshypothese** gut begründbar; die Normfreigabe für § 4.1/5.1 fehlt weiterhin.
2. Jedes Sample einem eindeutig datierten Zeitraum zuordnen; Zeitdubletten, Datenlücken, Fehlstellungen des Geräts und mehrfach verwendete Messdaten offenlegen.
3. **Keine** automatische Bestätigung von Grenzwerteinhaltung bei fehlender Zeitabdeckung, und **keine** Gleichsetzung von 30-Minuten-Gleitwerten und festen Halbstunden-Ergebnissen.
4. Die 2022-bezogene dBmess-Anleitung beschreibt Leq über die tatsächlich vorhandenen Sekunden und Leq30 als unterschiedliche Ausgaben. Ob letzterer für **teilweise unbeobachtete Zeit** normativ verwendbar ist, bleibt im Originaltext zu klären.

### P0-Blocker für fachliche Freigabe

- **B01:** § 4.1/5.1 der autorisierten **DIN 15905-5:2022-07** beschaffen und die Regel zu Uhrzeitgrenzen, Anfang/Ende und vollständiger/teilweiser 30-min-Messdauer direkt prüfen.
- **B02:** Normative Regel zu **weniger als 1800 s vorhandenen Messwerten**, insbesondere Unterschied von zeitlich begrenzter Veranstaltung und technischem Messausfall, klären.
- **B03:** Verfahren für Datenausfälle und Zeitlücken sowie die Konsequenz für die Beurteilbarkeit aus Originalnorm oder dokumentierter fachlicher Entscheidung ableiten. Fehlender DIN-Satz darf nicht als DIN-Regel erfunden werden.
- **B04:** § 5.6 auf die aus Punkt 1 relevanten Zeitangaben prüfen; vollständige Protokollfeldmatrix bleibt außerhalb dieses Arbeitsabschnitts.

**Abnahmeurteil für Fachfrage 1:** **NICHT freigegeben**; recherchiert und testbar spezifiziert, aber der vom Leitfaden vorgeschriebene Originalnormen-Abgleich ist für die inhaltlichen Regeln offen.