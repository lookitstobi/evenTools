# pegelTool – verbindliche UI-Bereinigung

- **Beschlussdatum:** 18.11.2026
- **Status:** Verbindliche Nutzerentscheidung für die nächste UI-Überarbeitung
- **Grundlage:** `Layout.pdf` (8 Seiten), `Manuelle Eingaben prüfen.txt` und explizite Entscheidung im Projektchat
- **Umfang:** 105 Elemente **behalten**, 28 Elemente **streichen**
- **Geltung:** Oberfläche / Bedienablauf; kein stillschweigender Eingriff in Rohdaten, interne Rechenlogik oder normative Evidenz
- **Implementierung:** In diesem Beschluss **nicht** vorgenommen

## Bindende Umsetzungsregeln

1. **Einseitige Bedienoberfläche statt Schritt-Navigation.** Die fünf Navigationsreiter und Zurück-/Weiter-Schaltflächen entfallen. Die beibehaltenen Abschnitte bleiben in sinnvoller Reihenfolge auf einer Seite erreichbar.
2. **Entfernte Felder dürfen nicht aus Altcode, Presets, Validierungsregeln, Projekt-Restore oder Export-Vorlagen unbeabsichtigt wieder auftauchen.** UI, Datenmodell, Formularvalidierung, gespeicherte Projekte und PDF-Vorschau bei der Implementierung konsistent aufeinander abstimmen.
3. **Ein gemeinsames Eingabefeld „Maßgeblicher Immissionsort“** ersetzt die separaten Eingaben für LAeq und LCpeak. Fachlich eventuell unterschiedliche relevante Orte dürfen im internen Modell nicht ohne Nachweis gleichgesetzt werden; bei erforderlichem gesondertem Nachweis Warnung/„Nicht beurteilbar“ statt erfundener Werte.
4. **Zwei Checkboxen „Funktionsprüfung vor der Messung durchgeführt“ und „Funktionsprüfung nach der Messung durchgeführt“** ersetzen die vier Felder für Zeitpunkt und Anzeigenwert. Die bloße Bestätigung ersetzt keine anderweitig rechtlich/normativ erforderliche Messdokumentation. Bis Originalnorm-Abgleich ggf. als unzureichender Nachweis kennzeichnen.
5. **„Lauteste Position (Altfeld)“ bleibt ausdrücklich erhalten.** Dies ist eine neue explizite Entscheidung, obwohl der frühere Arbeitsstand das Feld als Altlast ansah.
6. **PA-Bestätigungsfelder und zusätzliche Ja/Nein-Frage zu Abweichungen entfernen.** Das beibehaltene Freitextfeld für tatsächlich vorhandene Abweichungen bleibt bestehen; kein zusätzlicher Pflichtdialog.
7. **k1/k2 bleiben als aus dem XL3-Log stammende Werte sichtbar und intern nachvollziehbar.** Nur die separaten Ermittlung-Freitexte und der erläuternde UI-Hinweis entfallen; keine Doppelkorrektur. Etwaige fehlende normative Herkunftsnachweise dürfen nicht als erbracht gelten.
8. **Globale Prioritätenliste und globaler Hinweis zum offenen DIN-Abgleich entfallen aus der Übersicht.** Fachliche Prüfungen, Import-/Datenqualitätswarnungen und die beibehaltene Liste fehlender Protokollangaben bleiben an geeigneter Stelle verfügbar. Keine pauschale Freigabe oder irreführende Statusanzeige.
9. **Messdaten und PDF-Inhalte müssen konsistent bleiben.** Entscheidungen „streichen“ beziehen sich zunächst auf sichtbare UI-Elemente; ein fachlich erforderlicher Nachweis darf nur nach Prüfung der Originalnorm und ausdrücklicher Fachentscheidung aus dem Bericht entfernt werden.
10. **Keine DIN-Konformitätsbehauptung** ohne Abgleich der Originalnorm DIN 15905-5:2022-07.

## Einzelentscheidungen

Legende: **BEHALTEN** = Element bleibt in der Oberfläche; **STREICHEN** = Element wird entfernt bzw. durch die oben ausdrücklich beschriebene Alternative ersetzt.

### 1. Kopfbereich & Navigation

- **BEHALTEN:** Seitentitel „Schallpegelmessung – DIN 15905-5“
- **BEHALTEN:** Farbiger Gesamtstatus-Punkt
- **BEHALTEN:** Button „Log importieren“
- **BEHALTEN:** Button „PDF exportieren“
- **BEHALTEN:** Button „Letzte Sitzung laden“
- **BEHALTEN:** Menü „Erweitert“
- **BEHALTEN:** Projekt speichern als HTML
- **BEHALTEN:** Projekt speichern als JSON
- **BEHALTEN:** Projektdatei laden
- **BEHALTEN:** Statusanzeige „Log“
- **BEHALTEN:** Statusanzeige „Summary“
- **STREICHEN:** Navigation „Veranstaltung“
- **STREICHEN:** Navigation „Messaufbau“
- **STREICHEN:** Navigation „Messwerte“
- **STREICHEN:** Navigation „Prüfung“
- **STREICHEN:** Navigation „Abschluss“
- **STREICHEN:** Zurück-/Weiter-Navigation zwischen Schritten

### 2. Gesamtstatus & Log-Kurzinfo

- **BEHALTEN:** Beurteilungsstatus (Nicht beurteilbar / eingehalten / überschritten)
- **BEHALTEN:** Kompakte Karte „Aus dem XL3-Log übernommen“
- **BEHALTEN:** Messbeginn in der Kurzinfo
- **BEHALTEN:** Messende in der Kurzinfo
- **BEHALTEN:** Korrekturwert k1 in der Kurzinfo
- **BEHALTEN:** Korrekturwert k2 in der Kurzinfo
- **STREICHEN:** Hinweis zum noch offenen DIN-Normenabgleich
- **STREICHEN:** Liste der priorisierten Prüfhinweise
- **STREICHEN:** Messgerätetyp in der Kurzinfo
- **STREICHEN:** Geräteseriennummer in der Kurzinfo
- **STREICHEN:** Mikrofontyp und Seriennummer in der Kurzinfo
- **STREICHEN:** Logintervall in der Kurzinfo

### 3. Veranstaltung

- **BEHALTEN:** Veranstaltungsname
- **BEHALTEN:** Datum der Messung (automatisch aus Log)
- **BEHALTEN:** Location-Auswahl (AKS / Pavillon / eigene Angabe)
- **BEHALTEN:** Veranstaltungsadresse
- **BEHALTEN:** Umgebungsbedingungen
- **BEHALTEN:** Organisator / Veranstalter mit Anschrift
- **BEHALTEN:** Veranstaltungsbeschreibung
- **STREICHEN:** Veranstaltungsort manuell geprüft?
- **STREICHEN:** Veranstaltungsbeginn
- **STREICHEN:** Veranstaltungsende

### 4. Messpersonal & Messpositionen

- **BEHALTEN:** Messung durchgeführt von (Person / Firma)
- **BEHALTEN:** Tatsächliche Messposition
- **BEHALTEN:** Lauteste Position (Altfeld)
- **BEHALTEN:** Art des Messorts (direkt / Ersatzmessort)
- **BEHALTEN:** Zuständiger FOH-Techniker
- **STREICHEN:** Separates Feld „Immissionsort für LAeq“
- **STREICHEN:** Separates Feld „Immissionsort für LCpeak“

### 5. Kalibrator & Funktionsprüfung

- **BEHALTEN:** Kalibrator – Modell / Hersteller
- **BEHALTEN:** Kalibrator – Seriennummer
- **BEHALTEN:** Erklärungstext zur Geräte-/Mikrofonkalibrierung
- **STREICHEN:** Funktionsprüfung vorher – Zeitpunkt
- **STREICHEN:** Funktionsprüfung vorher – angezeigter dB-Wert
- **STREICHEN:** Funktionsprüfung nachher – Zeitpunkt
- **STREICHEN:** Funktionsprüfung nachher – angezeigter dB-Wert

### 6. PA-Auswahl Alfried-Krupp-Saal

- **BEHALTEN:** Interaktive Saalgrafik mit Bühne und Publikum
- **BEHALTEN:** Farblegende der Saalgrafik
- **BEHALTEN:** Zusätzliche Liste mit Lautsprechergruppen
- **BEHALTEN:** Main PA links (12 × Kara II)
- **BEHALTEN:** Main PA rechts (12 × Kara II)
- **BEHALTEN:** Center-Cluster (8 × Kara II)
- **BEHALTEN:** Sidefill links
- **BEHALTEN:** Sidefill rechts
- **BEHALTEN:** Sidefill links – Varianten-Dropdown
- **BEHALTEN:** Sidefill rechts – Varianten-Dropdown
- **BEHALTEN:** Frontfill 1 + 9
- **BEHALTEN:** Frontfill 2 + 8
- **BEHALTEN:** Frontfill 3 + 7
- **BEHALTEN:** Frontfill 4 + 6
- **BEHALTEN:** Frontfill 5
- **BEHALTEN:** Sonstiges / zusätzliche Lautsprecher
- **BEHALTEN:** Aufstellung / Anordnung der Beschallungsanlage
- **BEHALTEN:** Abweichungen / besondere Ereignisse / Begründung
- **BEHALTEN:** Button „Auswahl zurücksetzen“
- **STREICHEN:** Bestätigung: tatsächlicher PA-Aufbau geprüft
- **STREICHEN:** Frage: Wurden Messbedingungen oder Abweichungen dokumentiert?
- **STREICHEN:** Bestätigung übernommener Altprojekt-Angaben
- **STREICHEN:** Button „+ Komponente“ (manuelle Lautsprecherzeile)

### 7. PA-Auswahl Nationalbank-Pavillon

- **BEHALTEN:** Eigene interaktive Saalgrafik
- **BEHALTEN:** Lautsprechergruppen als Auswahlliste
- **BEHALTEN:** Main PA links
- **BEHALTEN:** Main PA rechts
- **BEHALTEN:** Center (1 × A10 Wide)
- **BEHALTEN:** Frontfill 1 + 7
- **BEHALTEN:** Frontfill 3 + 5
- **BEHALTEN:** Frontfill 2
- **BEHALTEN:** Frontfill 4
- **BEHALTEN:** Frontfill 6

### 8. Ersatzmessort & Korrekturen

- **BEHALTEN:** Eigener Abschnitt „Ersatzmessort und Korrekturbestimmung“
- **BEHALTEN:** Beschreibung des Ersatzmessorts
- **STREICHEN:** Freitext zur Bestimmung / Herkunft von k1
- **STREICHEN:** Freitext zur Bestimmung / Herkunft von k2
- **STREICHEN:** Erklärung zur Vermeidung doppelter k1/k2-Korrekturen

### 9. Messwerte, Tabellen & Diagramme

- **BEHALTEN:** Tabelle „30-Minuten-Auswertung“
- **BEHALTEN:** Tabellenspalte: Zeitraum
- **BEHALTEN:** Tabellenspalte: Messdatenabdeckung
- **BEHALTEN:** Tabellenspalte: LAeq 30 min
- **BEHALTEN:** Tabellenspalte: LCpeak
- **BEHALTEN:** Tabellenspalte: Datenlage
- **BEHALTEN:** Hinweis zu Blockanzahl und vollständigen Zeitblöcken
- **BEHALTEN:** Hinweise zu unvollständigen Blöcken
- **BEHALTEN:** Tabelle „Messwertübersicht“
- **BEHALTEN:** Tabellenspalte: Gemessen
- **BEHALTEN:** Tabellenspalte: Überschreitungsdauer
- **BEHALTEN:** Tabellenspalte: Grenzwert
- **BEHALTEN:** Tabellenspalte: Status
- **BEHALTEN:** Ergebniszeilen LAeq und LCpeak
- **BEHALTEN:** Aufklappbereich „Diagramme und vollständige Logdaten“
- **BEHALTEN:** Diagramm: gleitender LAeq über die Messzeit
- **BEHALTEN:** Diagramm: LCpeak über die Messzeit
- **BEHALTEN:** Grenzwertlinien in den Diagrammen
- **BEHALTEN:** Statistik zur Anzahl der dargestellten Messpunkte

### 10. Automatisch übernommene XL3-Daten

- **BEHALTEN:** Start der Messung
- **BEHALTEN:** Ende der Messung
- **BEHALTEN:** Messgerät – Modell
- **BEHALTEN:** Messgerät – Seriennummer
- **BEHALTEN:** Firmwareversion
- **BEHALTEN:** Logintervall
- **BEHALTEN:** Mikrofon – Typ / Seriennummer
- **BEHALTEN:** Mikrofonkalibrierung – Datum / Uhrzeit
- **BEHALTEN:** Mikrofonsensitivität
- **BEHALTEN:** kset date
- **BEHALTEN:** Korrekturwert k1
- **BEHALTEN:** Korrekturwert k2
- **BEHALTEN:** Aufklappbereich „Parser / Debug“

### 11. Prüfung, Protokoll & Abschluss

- **BEHALTEN:** Abschnitt „Messprotokoll – Angaben & Nachweise“
- **BEHALTEN:** Status „Protokollangaben vollständig / unvollständig“
- **BEHALTEN:** Zähler fehlender Eingaben und Messnachweise
- **BEHALTEN:** Auflistung der fehlenden Protokollangaben
- **BEHALTEN:** Aufklappbare PDF-Berichtsvorschau
- **BEHALTEN:** Berichtsort
- **BEHALTEN:** Berichtsdatum
- **BEHALTEN:** Name / Protokollverfasser
- **BEHALTEN:** Unterschriftsplatzhalter
- **BEHALTEN:** PDF-Export im Abschlussschritt

## Abnahmecheck für die nächste UI-Umsetzung

- [ ] Alle 28 Streichungen in sichtbarer Oberfläche, Validierung und Wiederherstellung berücksichtigt
- [ ] Alle 105 Beibehaltungen weiterhin funktionsfähig (auch AKS/Pavillon-Grafik)
- [ ] Gemeinsamer Immissionsort sowie zwei Funktionsprüfungs-Checkboxen eingefügt
- [ ] Kein verwaister Pflichtfeldstatus für entfernte Controls
- [ ] Korrekturwerte und Kalibrier-/Messnachweis fachlich weiterhin überprüfbar, fehlende Belege nicht fälschlich positiv bewertet
- [ ] Speichern (HTML/JSON), Laden, letzte Sitzung, PDF, Import, Tabellen, Diagramme getestet
- [ ] Keine neue mehrstufige Navigation eingeführt
- [ ] PDF-Vorschau und PDF-Bericht verwenden dieselben Daten
- [ ] Browser-End-to-End-Test der bereinigten Oberfläche dokumentiert

**Änderungsregel:** Nachträgliche Wiederaufnahme eines explizit gestrichenen Elements nur nach neuer, expliziter Nutzerentscheidung oder begründeter normativer Fachprüfung; dann Änderungsvermerk in diesem Beschluss anlegen.
