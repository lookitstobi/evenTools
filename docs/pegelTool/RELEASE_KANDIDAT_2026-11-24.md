# pegelTool 2.0.0 – Release-Kandidat (24.11.2026)

Basis: freigegebener UI-Zielstand der Pages-Preview `775ebde6cebc3a9bb3b86207ee847c159db00205` (PR #30); Produktionsbasis `6681a82c0b08172bc4907e8976501eca6b2e16be`. Die Vorschau- und Produktionshistorien werden zusammengeführt; nur pegelTool-Code, zugehörige Tests, CI und Projektbeschlüsse werden übernommen. Strato-Deployment, PHP-Routing, Zugriffskontrollen und das separate PDFTool bleiben unverändert. Preview-Deployment bleibt auf seinem eigenen Branch.

## Änderungen
- Einseitige Oberfläche, kompakte PA-Auswahl, Messwertstatus und Teilzeitblöcke, XL3-kset-Date.
- Zweitseitiges PDF-Layout v3, Signaturfeld, optional eingebettetes vollständiges Projekt mit Wiederimport, aktuelle Header-Icons und Checkboxen.
- Clientseitiger PDF-Download und Blob-Vorschau ohne Server-PDF-API; lokale jsPDF/pdf-lib-Abhängigkeiten bleiben erhalten.
- Berichtsversion 2.0.0; bestehendes Projektformat (Schema 2) unverändert.
- Projektbeschlüsse aus #2, #16, #19 erhalten. #11, #13, #14, #15 und #22 sind ältere Entwürfe, die nicht separat in den Anwendungscode gemergt werden sollen.

## Freigabe
- [ ] CI auf dem Integrationscommit erfolgreich (Node, Chromium, PDF-Rendering, Firewall).
- [ ] Produktivnaher Test: PHP/CSP, Logimport, PDF-Export mit und ohne Projekt, PDF-Wiederimport; Vergleich mit Preview.
- [x] Betreiber bestätigt Merge nach main (24.11.2026); Strato-Deployment wird automatisch ausgelöst.
- [ ] Produktiv-Smoke-Test nach Deployment; bei Fehlern gezielter Revert des Release-Merges.

Technische Grenzwertübersicht ist keine DIN-Konformitätsbescheinigung. Offene Normdetails werden gemäß Projektleitlinie getrennt behandelt.
