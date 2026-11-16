# pegelTool – Phase 6: Oberfläche und Bedienablauf

**Stand:** 16.11.2026  
**Branch:** `feat/pegeltool-phase6-workflow-20261116`  
**Basis:** Phase 5 (`feat/pegeltool-phase5-report-pdf-20261116`, PR #7).  
**Art:** UI-/Ablaufänderung ohne neue Mess- oder DIN-Rechenregel.

## Ziel und Umsetzung

Die bisherige parallele Zwei-Spalten-Ansicht wird zur Laufzeit in sechs explizite Schritte überführt:

1. **Import:** XL3-Log importieren; vorhandenes JSON-/HTML-Projekt oder Browser-Sitzung öffnen.
2. **Datenprüfung:** technische Import- und Warnhinweise sowie vorhandene XL3-Geräte-/Messdaten.
3. **Messaufbau / Korrekturen:** Veranstaltungsangaben, Messpositionen, Kalibrierprüfung, PA-Anordnung, k1/k2-Herkunft.
4. **Bewertung:** feste Halbstundenblöcke; zusätzliche gleitende Anzeigegrößen und Diagramme eindeutig als informativ.
5. **Protokoll:** Vollständigkeitsprüfung, erforderliche Angaben, Unterschriftsplatzhalter und gemeinsamer Berichtsvorschau-Inhalt.
6. **Export:** derselbe Phase-5-PDF-Pfad; JSON- und HTML-Projektspeicherung.

Alle ursprünglichen Formular-IDs, Event-Handler, Berechnungs-/Importmodule, Berichtswege und gespeicherten Datenformate bleiben unverändert. Der Controller (`ui/workflow.js`) verschiebt lediglich bereits vorhandene DOM-Sektionen nach dem Laden in die passende Reihenfolge. Fehlt das neue Skript oder eine erwartete Sektion, bleibt die alte DOM-Struktur als Fallback bestehen (allerdings mit vereinfachtem einspaltigem Layout).

## Statusmodell und Freigabesicherheit

- **Noch nicht geprüft:** Kein verwertbarer importierter Datensatz vorhanden.
- **Nicht beurteilbar:** Datensatz vorhanden, aber fachliche Normfreigabe und/oder erforderliche Nachweise fehlen.
- **Grenzwert eingehalten / Grenzwert überschritten:** Nur für eine *zukünftige* explizit freigegebene Fachbewertung vorgesehen. Der UI-Controller verlangt gleichzeitig `record.normReview === 'verified'`, `review.reportFullyChecked === true`, vollständige Dokumentation und vollständige Nachweise. Eine reine numerische Pegelprüfung kann diese Statuszustände niemals freischalten.

Im aktuellen Projektstand bleibt der importierte Fall durch die offene Phase-0-Normenprüfung **nicht beurteilbar**. Die UI verleiht ausdrücklich keine DIN-Freigabe.

Oben werden zuerst kritische Importfehler, dann Mess-/Rechen-Nachweise, danach Detailhinweise und Formularlücken angezeigt. Es gibt pro Arbeitsschritt zusätzliche Fortschrittstexte, die **nicht** als Prüfbestätigung formuliert werden. Die Original-DIN-Freigabesperre ist permanent sichtbar.

## Bedienung

- Sechs native Buttons in einer horizontalen Navigation, via Tastatur bedienbar; aktueller Schritt mit `aria-current="step"`.
- Zurück-/Weiter-Aktionen ohne Datenverlust und ohne erzwungene Freigabe von Schritten.
- Status- und Warnbereich als Live-Region für Änderungen während der Eingabe.
- Responsives Layout mit horizontal scrollbareren Schritten auf schmalen Displays; ursprüngliche Formular-Grids fallen dort auf eine Spalte zurück.
- Diagramme werden beim Öffnen des Bewertungsschritts neu vermessen, da sie sonst in einer zunächst ausgeblendeten Sektion zu schmal gerendert werden könnten.
- Erfolgreicher Import bzw. Wiederherstellung bringt die Nutzerin/den Nutzer zur Datenprüfung. Fehlende Werte, alte Projekte und Korrekturherkunft bleiben als offene Punkte sichtbar.

## Testumfang

`tests/pegelTool/phase6/workflow.test.cjs` prüft unter anderem:

- Reihenfolge und Existenz der sechs Schritte;
- gesperrte positive und negative Normbeurteilung ohne Normfreigabe;
- Priorität der Prüfhinweise und Erkennung offener Blöcke/Nachweise;
- DOM-Verschiebung der elf bestehenden Abschnitte, Navigation und aktive Schrittmarkierung;
- Unverändertheit des fachlichen Messdatenobjekts nach UI-Aktionen;
- Vorhandensein der alten Import-, Speicher-, Wiederherstellungs- und Exportaktionen.

Der Workflow läuft zusätzlich zu sämtlichen Phase-1- bis Phase-5-Tests in GitHub Actions.

## Offene Abnahme

- **Phase 0:** Originalausgabe DIN 15905-5:2022-07 einschließlich Protokollpflichten normativ gegenprüfen.
- **Browser-E2E:** XL3-Import → Prüfung → Eingaben → Bewertung → Protokoll → PDF; JSON/HTML speichern und wieder laden.
- **Darstellung:** Desktop, Mobilgerät, Tastaturnavigation, lange Warnungen, große XL3-Datensätze sowie Chart-Resize manuell prüfen.
- **PDF:** Visuelle Gegenprüfung im Browser und externem Viewer (aus Phase 5).
- **Regressionsabnahme:** Frühere Projektdateien inklusive nur teilweiser lokaler Wiederherstellung.

**Freigabestatus:** Technische Implementierung für Review. Keine normativ belastbare Konformitätsbescheinigung; PR bleibt Draft, `main` bleibt unverändert.
