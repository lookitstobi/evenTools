# pegelTool – Phase 7: Fachabnahme und Release-Entscheid

**Datum:** 16.11.2026  
**PR:** #9, `test/pegeltool-phase7-release-20261116` auf Phase 6 / PR #8  
**Produktstand:** `0.5.0-dev` im Berichtsmodul (kein veröffentlichter Release-Tag)  
**Fachfreigabe:** **NICHT ERTEILT – RELEASE GESPERRT**

## 1. Abnahmeprotokoll

| Gate | Nachweis | Status |
| --- | --- | --- |
| Ausgangsstand Phase 6 | 90 automatisierte Tests im letzten Phase-6-Lauf erfolgreich | Bestand bekannt |
| Phase 7 technische Referenz | 18 gespeicherte Referenzfälle; zusätzlich Herkunfts-/Pipeline-Tests | **Bestanden: 28/28 Phase-7-Tests** (GitHub Actions #43896067894) |
| Regressionen Phase 1–6 | Ausgangsstand 90 Tests | **Bestanden: 90/90** (GitHub Actions #43896067894) |
| Echter Browserablauf | Headless Chromium: Import, Rejected-Import-Erhalt, JSON/HTML, Reload, PDF, Mobile | **Bestanden** (GitHub Actions #43896067894); produktiver Login weiterhin manuell |
| PDF-Technik | PDF-Bytes, Poppler-Rendering, Desktop/Mobil-Screenshots | **Bestanden**; vierseitiges synthetisches PDF gerendert und visuell auf Lesbarkeit geprüft; externer Viewer und realer Bericht noch offen |
| Messgerätereferenz | Vergleiche mit verifizierten NTi-XL3-Ausgaben inkl. Zeitstempel-Semantik | **Offen – fachlicher P0-Blocker** |
| Normenbezug | Originalnorm DIN 15905-5:2022-07, Normenmatrix, insbesondere 30-min-Logik und Protokollpflichten | **Offen – fachlicher P0-Blocker** |
| Abnahme in authentifizierter Umgebung | Anmeldung, reale CSP, Browser-/Mobilzugriff, große Messdatei und Wiederaufnahme | **Offen** |
| Visuelle PDF-Freigabe | PDF in Browser und unabhängigem Viewer, Layout-/Tabellenprüfung, Inhalt gegen UI | **Offen** |
| Fachreview und Integration | PR #2 Phase 0, PR #3–9 in korrekter Reihenfolge prüfen/integrieren | **Offen** |

**Entscheidung:** Keinerlei DIN-Konformitätsfreigabe, kein Merge nach `main`,
kein Release-Tag. Dieser Stand ist ausschließlich ein **technischer Abnahmekandidat**.

## 2. Bereits während Phase 7 identifizierter Fehler

**F7-001 – Fehlender Gesamtstatus bei `buildBlocks([])` und Zeitbereich > 10.000 Blöcke.**
Der technische Rückgabewert hatte `normativeStatus: 'not-assessable'` auf oberster Ebene,
im `overall`-Objekt aber keinen Eintrag. Die Phase-7-Referenz für einen ungültigen
Zeitabschnitt hat diese inkonsistente Datenstruktur offengelegt. Beide No-Data-Pfade
setzen jetzt explizit `overall.normativeStatus: 'not-assessable'`.
Es wurde kein Grenzwert und keine Rechenregel verändert.

**Regression:** `tests/pegelTool/phase7/release.test.cjs` –
Szenario `INVALID_TIME`. Erwartung: leere Blöcke, `no-data`,
durchgehend `not-assessable`.

### F7-002 – Anzeige bei abgewiesenem Folgeimport

Die erste Chromium-Sichtprüfung zeigte eine irreführende Kopfzeilenanzeige
`Log: Import abgelehnt`, obwohl der vorherige Datensatz erhalten blieb und
weiterhin als Grundlage des vorläufigen Berichts diente.
Der Branch zeigt jetzt explizit `Log: vorherige Messung geladen (neuer Import abgewiesen)`.
Der End-to-End-Test prüft sowohl die unveränderten Rohdaten als auch den Chiptext.
Dies ist eine Status-/UI-Korrektur, **keine** Änderung an Messwerten oder Normregeln.

### Technische Sichtkontrolle des Testexports

Artefakt: `pegeltool-phase7-browser-review` aus
[Actions #43896067894](https://github.com/lookitstobi/evenTools/actions/runs/43896067894).
Das PDF enthält vier A4-Seiten. Alle vier wurden mit Poppler gerendert und
hier auf Lesbarkeit, sichtbare Blocktabelle, Warnungen, Seitennummern und
Unterschriftsplatzhalter geprüft; keine erkennbare Textabschneidung im
**synthetischen** Testfall. Das ist **keine** Fachabnahme eines echten XL3-Protokolls
und ersetzt nicht die Prüfung im externen PDF-Viewer.

## 3. Fachliche Prüfsperren

1. Der Originalnormtext liegt für die vollständige Normenmatrix bisher nicht vor.
   Zeitfenster-Ausrichtung, Randzeiten, Ersatzmessorte und 120-Minuten-Sonderregel
   bleiben fachlich unbestätigt.
2. Der XL3-Import wertet Zeitstempel nur auf Basis einer explizit gewählten
   Start-/Ende-Annahme aus. Diese Annahme ist mit dem Messgerät zu verifizieren.
3. Korrekturherkunft und Kalibrierangaben dürfen nicht bloß aus plausiblen
   Zahlen abgeleitet werden. Es braucht reale Nachweise und deren Protokollierung.
4. Die technische Browserprüfung stellt ausschließlich den pegelTool-Dateiserver
   lokal nach; sie prüft nicht den authentifizierten PHP-Zugang.
5. Maschinelles Rendern beweist nicht, dass Text, Tabellen und Warnungen im
   PDF fachlich vollständig und visuell korrekt angeordnet sind.
6. Andere Entwicklungsphasen liegen weiterhin als gestapelte Draft-PRs vor;
   ein erfolgreicher Test dieses Branches ersetzt keine Freigabe der Basiskette.

## 4. Manuelle Prüfprotokollvorlage

| Angabe | Eintrag |
| --- | --- |
| Prüfer / Funktion | **offen** |
| Datum / Umgebung | **offen** |
| Verwendete XL3-Logdatei und Prüfsumme | **offen** |
| XL3-Firmware / Messgeräteprotokoll / Zeitstempel-Anker | **offen** |
| Browser / Betriebssystem / Viewport | **offen** |
| PDF-Viewer 1 / 2 | **offen** |
| PDF/UI-Wertgleichheit sämtlicher 30-min-Blöcke | **offen** |
| JSON-/HTML-/Recovery-Speichervergleich | **offen** |
| Korrektur- und Kalibriernachweise | **offen** |
| P0-Abweichungen mit Issue-Referenzen | **offen** |
| Fachliche Entscheidung / Freigabeunterschrift | **offen** |

Keine dieser Zeilen darf vor einer tatsächlichen Prüfung auf „bestanden“ gesetzt werden.

## 5. Release-Gate

**Freigabe ausschließlich möglich, wenn:**

- Alle P0-Tests und technischen Referenzen erfolgreich sind.
- Die Originalnorm fachlich geprüft, Normenmatrix freigegeben und ggf. abweichende
  Berechnungs-/Protokollregeln implementiert und neu getestet wurden.
- Die manuelle Browser-/PDF-/XL3-Fachabnahme dokumentiert bestanden ist.
- Keine P0-Fehler offen sind und die vollständige PR-Kette geprüft ist.
- Release-Version, CHANGELOG und Build/Tag eindeutig feststehen.

**Aktuelle Entscheidung: BLOCKIERT / DRAFT.**
