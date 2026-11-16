# Phase 4 – Protokollangaben und Nachweise (vorläufig)

Stand: 16.11.2026. **Kein Nachweis einer DIN-Konformität.** Der vollständige Originaltext DIN 15905-5:2022-07 und insbesondere der relevante Protokollabschnitt sind nicht autorisiert abgeglichen. Alle Kategorien „Pflicht“, „bedingt“ und „optional“ sind **vorläufige technische Projektanforderungen**; keine verbindliche Wiedergabe der Norm.

## Änderungen

- Das eigenständige CommonJS-/Browser-Modul `app/tools/pegelTool/protocol/protocol.js` liefert `FIELD_RULES`, `validate(data)` und `buildRecord(data)` für Phase 5.
- Das Formular zeigt pro Feld *Pflicht* / *bedingt* / *optional* sowie fehlende Werte, Nachweise und gesperrten Gesamtstatus. „Vollständig geprüft“ wird **niemals** automatisch erzeugt.
- Messperson, Veranstalter, Adresse, getrennte LAeq-/LCpeak-Immissionsorte, Messorttyp, ggf. Ersatzmessort, k1/k2-Ermittlungsbeschreibung und Abweichungsbegründung sind dokumentierbar.
- Kalibrator (Typ und S/N) sowie Funktionsprüfungen vor und nach der Messung (Zeitpunkt, dB-Anzeige) werden getrennt vom XL3-Mikrofon-Kalibrierungsmetadatum dokumentiert.
- PA-Typen/Stückzahlen und Aufstellungsbeschreibung sind separat erfasst. Orts- und PA-Presets erfordern eine **aktive Bestätigung** und sind kein Nachweis. Für einen unbekannten Ort wird keine Lautsprecheranlage erfunden.
- Vorgefertigte Namen/Anschriften, Kalibrator-Seriennummer, Umgebungswerte und Protokolldatum wurden entfernt. Alte Daten bleiben lesbar und werden bis zur aktiven Überprüfung als `legacy-unverified` geführt.
- `protocolMeta.origins` wird mit der Projektdatei gespeichert; `getProtocolReportData()` erzeugt einen gemeinsamen versionierten Berichtsdatenbestand mit Import-/Messwert-Herkunft und Phase-3-Zeitblöcken. PDF bleibt bis Phase 5 gesperrt.
- Formularfelder für die **Ermittlung** von k1/k2 ändern nicht die normativen Rechenwerte der Engine; die Geräte-/Spaltenherkunft bleibt getrennt. Keine stillschweigende Doppelkorrektur.

## Abnahmesperren

1. Originalnorm und bestätigte Protokollpflichten aus Phase 0 fehlen. Eine abschließende Feldklassifizierung ist daher nicht freigegeben.
2. Unbekannte XL3-Zeitstempel-Semantik/Zeitzone, unvollständige Zeitblöcke und ungeprüfte Gerätedaten verhindern einen Messnachweis.
3. Die Kalibrierungstoleranzen sind normativ nicht verifiziert; selbst dokumentierte Vor-/Nachwerte erhalten keinen automatisch positiven technischen Kalibrierstatus.
4. Ein Signaturplatzhalter ersetzt keine tatsächliche Unterschrift.
5. Browser-E2E, Export/Bericht-Layout und echte PDF-Prüfung stehen in Phase 5/7 aus. Beibehaltung der Sperre aus Phase 3.

## Tests

`node --test tests/pegelTool/phase4/protocol.test.cjs`

Enthält Pflicht-/bedingt-/optional-Szenarien, Altprojektbestätigung, realistische PA, Korrekturen, Kalibrier-Dezimalwerte, Datenlücken, Beurteilungsquelle und statische Integrationsprüfung.
