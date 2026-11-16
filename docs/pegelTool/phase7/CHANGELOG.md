# pegelTool – Änderungsstand Phase 7

## Unveröffentlicht – Phase 7 (16.11.2026)

**Basis:** Phase-6-Draft-PR #8. **Phase-7-Draft-PR #9**, kein Release und keine Integration nach `main`.

### Tests / Qualitätssicherung
- 18 maschinenlesbare synthetische Referenzfälle (99-dB- und 135-dB-Ränder,
  zeitgewichtete energetische Mittelung, Mitternacht, unvollständige Blöcke,
  Lücken, doppelte Messabschnitte und Grenzübertritte).
- Modulübergreifende Tests für Geräte-Summaries, Korrekturherkunft,
  k1/k2-Einmaligkeit, fehlende Kalibrier-/Zeitnachweise, LAeq_g5-Abgrenzung,
  Projekt-JSON-Roundtrip, Bericht und PDF-Bytes.
- Browser-End-to-End-Test mit Chromium und synthetischem XL3-Log:
  Import, abgelehnter Import ohne Datenverlust, UI-Navigation,
  JSON-/HTML-Export und -Wiederaufnahme, PDF-Export sowie mobiler Viewport.
- GitHub-Actions-Job zur automatisierten PDF-Renderprobe mit Poppler
  und Aufbewahrung von PDF + Desktop-/Mobilaufnahmen zur manuellen Prüfung.
- `docs/pegelTool/phase7/TESTPLAN.md` und
  `docs/pegelTool/phase7/FACHABNAHME.md` als nachvollziehbare
  Abnahmedokumentation und Release-Sperren.

### Korrektur
- **F7-001:** Auch bei leerem oder unzulässig großem Zeitbereich trägt
  `evaluation.overall.normativeStatus` jetzt ausdrücklich
  `not-assessable`. Dies beseitigt einen uneinheitlichen Statuspfad,
  **ohne** die Berechnungs- oder Grenzwertregeln zu ändern.

- **F7-002:** Nach einem abgewiesenen Folgeimport zeigt die Kopfzeile jetzt
  ausdrücklich an, dass die vorherige Messung noch geladen ist. Der
  Browser-End-to-End-Test sichert die Anzeige und unveränderten Samples ab.

### Testnachweis

- [GitHub Actions #43896067894](https://github.com/lookitstobi/evenTools/actions/runs/43896067894):
  90/90 ältere Modultests und 28/28 Phase-7-Tests sowie Chromium-E2E und
  vierseitiges PDF-/Poppler-Rendering erfolgreich.
- Sichtprüfung aller vier Test-PDF-Seiten (synthetisch): keine erkennbare
  Textabschneidung, Seitenzahlen, Warnungen und Status lesbar.
- Reale Messgeräte-, authentifizierte Browser- und Normenfachabnahme bleiben
  ausdrücklich offen.

### Unverändert / gesperrt
- 120-Minuten-Sonderregel nicht implementiert.
- Keine Normfreigabe vor Abgleich mit dem Originaltext
  DIN 15905-5:2022-07.
- Keine „Grenzwert eingehalten“-Bescheinigung aus unvollständigen oder
  unbewiesenen Datensätzen.
- Kein Release-Tag, kein Merge nach `main`.
- Berichtsversionsnummer weiterhin `0.5.0-dev`,
  bis die fachliche Release-Freigabe erfolgt.
