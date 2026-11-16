# Fachliche Übergabe – Phase 0, Punkt 1: Zeitblöcke

**Stand 16.11.2026 · Ergebnis: recherchiert, spezifiziert und testfallbasiert dokumentiert; **normativ NICHT freigegeben**.**

## Was sich nach Quellenlage belastbar sagen lässt

- Die **DIN 15905-5:2022-07** ist die aktuelle Ausgabe. Das sichtbare Inhaltsverzeichnis nennt als relevante Prüfabschnitte **§ 4.1 (Beurteilungspegel), § 5.1 (Messung und Auswertung – Allgemeines), § 5.5 (Kenngrößen während der Veranstaltung), § 5.6 (Messprotokoll)**. Der Normenwortlaut dieser Abschnitte war öffentlich nicht vollständig zugänglich.
- Das zeitliche Konzept von **festen 30-Minuten-Abschnitten zur vollen und halben Stunde** ist durch historische Landesamtsunterlagen und aktuelle Fach-/Herstellerangaben gut gestützt. Es ist **noch keine gegen den Originaltext der Ausgabe 2022 geprüfte Pflichtregel**.
- Der nach Ausgabe 2022-07 arbeitende Hersteller **dBmess 2023** weist je Halbstundenblock sowohl **vorhandene gültige Sekunden (max. 1800 s)** als auch zwei verschiedene Leq-Kennzahlen aus: einen Mittelwert über die tatsächlich gemessene Dauer und einen als **Leq30** bezeichneten 30-Minuten-Wert. Dieser Unterschied ist für unvollständige Messungen entscheidend.
- Ein **synchronisierter Gerätezyklus** kann verkürzt beginnen (XL2-Beispiel 07:50–08:00); aus dem Geräteverhalten allein folgt keine DIN-Freigabe für einen unvollständigen Beurteilungsblock.
- **Gleitende 30-Minuten-Anzeigen** sind nicht mit absoluten Uhrzeitblöcken identisch. Geräte-`LAeq_g30` nicht pauschal als fester Halbstunden-Normwert klassifizieren.

## Entscheidende offene Frage

**Was verlangt/erlaubt die Originalnorm 2022 bei einem Halbstundenblock mit weniger als 1800 Sekunden gültiger Daten?**

Dabei sind drei Fälle ausdrücklich auseinanderzuhalten:

1. **Veranstaltung läuft erst später an**: Messung `20:00–20:30` vollständig, Veranstaltung erst ab `20:07`; keine Messlücke, aber ungeklärte normative Berücksichtigung des Vorlaufs.
2. **Messung beginnt verspätet**: Keine Messwerte von `20:00–20:07`; nur 1380 s bis `20:30` verfügbar; die unbekannte Zeit darf nicht als leise geschätzt werden.
3. **Technische Unterbrechung**: `20:10–20:12` fehlt innerhalb der laufenden Beschallung; der 30-Minuten-Block hat eine Qualitätslücke und darf nicht automatisch als unproblematisch erscheinen.

Das Herstellerkonzept `Leq30` und ein womöglich rechnerisch kleinerer Wert bei fehlender Zeit **beweisen nicht**, dass eine ausfallbedingt unvollständige Aufnahme normativ genügt. Diese Differenz ist eine **P0-Freigabesperre**.

## Vorläufiges technisches Zielverhalten (kein behaupteter Normwortlaut)

1. Eindeutig datierte, hypothetische Zeitblöcke `[hh:00,hh:30)` und `[hh:30,hh+1:00)` generieren, jeweils **1800 s** Sollzeit.
2. Den tatsächlichen Messbeginn, das Messende und den Veranstaltungszeitraum **separat** speichern.
3. Aus zeitlich definierten Rohintervallen je Block **gültige Sekunden**, **fehlende Sekunden**, **ungültige Sekunden** und **Überlappungen** erfassen.
4. Datenlücken, Uhrzeitkonflikte und Randblöcke transparent ausgeben; nicht stillschweigend Nullen oder fiktive Ruhepegel ergänzen.
5. Keine positive Normbewertung bei ungeklärter Zeitqualität (`Nicht beurteilbar` als Schutzstatus aus dem Projektleitfaden).
6. Gleitwerte und feste Blöcke unterscheiden; jede Berechnung muss ihre Eingangsgröße und Zeitbezugsbasis angeben.
7. Alle 18 Block-/Qualitäts-Testfälle und drei Referenzrechnungen aus `ZEITBLOCK_TESTFAELLE.md` für spätere Tests verwenden.

**Nicht Bestandteil der Übergabe:** Normative Festlegung der 120-Minuten-Alternative, LCpeak-Auswertung, Korrekturwerte, Kalibrierung und allgemeine Protokollpflichten; keine Codeänderung und kein Eingriff in `main`.

## Noch notwendige Freigabeschritte

- Vollständige autorisierte **DIN 15905-5:2022-07** beiziehen und § 4.1, § 5.1 sowie die zeitbezogenen Aspekte in § 5.5/5.6 anhand des Wortlauts prüfen.
- Insbesondere Anfang/Ende einer Veranstaltung, 30-min-Bezug von Teilblöcken, Unterscheidung *Vor-/Nachlauf vs. Messausfall* und zulässige Datenlücken verbindlich entscheiden.
- Alle betreffenden `ZEIT-*`-Zeilen der Matrix mit Abschnittsverweis, zulässiger Behandlung und eindeutiger Test-Erwartung aktualisieren. **Erst danach** Zeitlogik zur normativen Implementierung freigeben.

## Ergebnisartefakte

- `NORMENMATRIX.md` – 12 normativ offene Zeitregeln, 8 getrennte technische Projektregeln, Prüfstellen, Quellen und Freigabesperren.
- `ZEITBLOCK_TESTFAELLE.md` – 18 reproduzierbare Szenarien, 3 Rechenreferenzen und Abnahmekriterien.
- Dieses Dokument – kompakte technische/fachliche Übergabe ohne Behauptung einer DIN-Freigabe.