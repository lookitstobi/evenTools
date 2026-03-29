# TODO: WYSIWYG-Renovierung PDF-Editor + PDF-Renderer

Ziel: Der visuelle Stand im Editor soll mit der final gerenderten PDF-Ausgabe übereinstimmen (WYSIWYG-nahe), bei gleichzeitigem Re-Enable des PDF-Tools.

## Kontext
- Problem: Elemente sind in finalen PDFs "off" (Position, Umbruch, Baseline, Font-Metriken).
- Ist-Stand:
  - Editor arbeitet bereits JSON-basiert (payload_json in DB).
  - Vorschau nutzt bereits den Server-Renderer.
  - pdf_template_builder ist aktuell deaktiviert.
- Randbedingungen:
  - Keine externen CDN-Abhängigkeiten.
  - CSP/Firewall-Regeln müssen bestehen bleiben.
  - Backward-Compatibility für bestehende Templates sicherstellen.

## Scope
### In Scope
- Reaktivierung pdf_template_builder
- Vereinheitlichung von Assets (Fonts/Bilder) zwischen Editor und Renderer
- Präzisierung Text-Layout (Wrap, Baseline, Line-Height, Alignment)
- JSON-first Workflow inkl. optionalem Import/Export
- Verifikation mit reproduzierbaren Golden-Master-Fällen

### Out of Scope
- Komplettaustausch der PDF-Engine
- Externe SaaS/PDF-Services

---

## Phase 0: Vorbereitung
### Task 0.1 - Baseline dokumentieren
- Sammle Screenshots: Editor-Stage vs. aktuelle PDF-Renderings für 3 repräsentative Vorlagen.
- Lege Messkriterien fest:
  - Positionsabweichung <= 0.5 mm
  - Textumbruch identisch
  - Alignment identisch

**Done wenn**
- Baseline-Dokument liegt vor und ist von Team/Owner akzeptiert.

### Task 0.2 - Testdaten festziehen
- Definiere feste Testdaten je Tool (insb. nti_tool) mit:
  - langen Strings
  - Umlauten/Sonderzeichen
  - numerischen Feldern
  - Bild-Elementen

**Done wenn**
- Golden-Master-Testpayloads vorhanden sind und reproduzierbar verwendet werden.

---

## Phase 1: Tool-Reaktivierung
### Task 1.1 - Guard entfernen
- Datei: /workspaces/toolsapp/tool.php
- Entferne/entschärfe den Block, der pdf_template_builder mit HTTP 503 sperrt.

### Task 1.2 - Dashboard aktivieren
- Datei: /workspaces/toolsapp/index.php
- Setze pdf_template_builder auf aktiv (nicht disabled).
- Deaktivierungs-Hinweis entfernen/anpassen.

### Task 1.3 - Zugriffspfad prüfen
- Sicherstellen:
  - Editor-UI nur für berechtigte User (Admin-Fluss wie bisher)
  - Runtime-Render bleibt per Tool-Zugriff abgesichert

**Done wenn**
- Editor ist wieder aufrufbar (200 OK) und End-to-End (load/save/preview) funktioniert.

---

## Phase 2: Single Source of Truth für Layout
### Task 2.1 - Payload-Schema erweitern (abwärtskompatibel)
- Datei: /workspaces/toolsapp/app/pdf_template_lib.php
- Ergänze pro Element (mit Defaults):
  - line_height_factor (float)
  - baseline_offset_mm (float)
  - overflow_mode (enum)
  - max_lines (int)
  - font_family_id (string)

### Task 2.2 - Normalisierung/Validierung anpassen
- normalize + validate um neue Felder erweitern.
- Harte Grenzen setzen (Ranges, erlaubte Werte).
- Alte Templates ohne neue Felder weiterhin renderbar halten.

### Task 2.3 - Versionierung dokumentieren
- schema_version sauber führen; Migrationslogik für bestehende payloads definieren.

**Done wenn**
- create/save/get/render mit alten und neuen Templates ohne Bruch funktioniert.

---

## Phase 3: Gemeinsame Assets (Fonts/Bilder)
### Task 3.1 - Lokale Font-Strategie festlegen
- Keine externen Fonts.
- Einheitliche Font-Familie für Editor + PDF-Renderer definieren.
- Assets lokal ins Projekt legen.

### Task 3.2 - Editor auf die Ziel-Fonts umstellen
- Dateien:
  - /workspaces/toolsapp/app/tools/pdf_template_builder/style.css
  - /workspaces/toolsapp/app/tools/pdf_template_builder/index.html
- @font-face lokal einbinden.
- Stage-Font explizit auf die Ziel-Familie setzen.

### Task 3.3 - Renderer auf dieselben Font-Metriken bringen
- Datei: /workspaces/toolsapp/app/pdf_template_lib.php
- Font-Mapping nicht nur Helvetica/Helvetica-Bold heuristisch.
- Ziel: konsistente Width-Metriken mit Editor.

### Task 3.4 - Asset-Resolver härten
- Lokale Pfade + sichere data:-Quellen erlauben.
- Keine Pfad-Traversal-Lücken.

**Done wenn**
- Editor und PDF zeigen dieselbe Zieltypografie ohne sichtbare Fallback-Divergenz.

---

## Phase 4: Renderer-Präzision (Hauptarbeit)
### Task 4.1 - Text-Wrapping von Heuristik auf Metriken
- Datei: /workspaces/toolsapp/app/pdf_template_lib.php
- Ersetze char-count-Heuristik durch metrische Breitenberechnung.
- Caching einbauen, um Performance stabil zu halten.

### Task 4.2 - Baseline und Line-Height vereinheitlichen
- Gleiches Modell in:
  - /workspaces/toolsapp/app/tools/pdf_template_builder/app.js
  - /workspaces/toolsapp/app/pdf_template_lib.php
- baseline_offset_mm + line_height_factor identisch anwenden.

### Task 4.3 - Alignment/Box-Layout exakt angleichen
- left/center/right konsistent berechnen.
- max_lines + overflow_mode im Editor und Renderer identisch.

### Task 4.4 - Sonderzeichen robust behandeln
- UTF-8/Transliteration-Verhalten prüfen.
- Umbruchstabilität bei Umlauten/Sonderzeichen sichern.

**Done wenn**
- In Golden-Master-Fällen sind Position/Umbruch/Alignment innerhalb Toleranz.

---

## Phase 5: JSON-first UX und Portabilität
### Task 5.1 - Visuelle Bearbeitung vollständig JSON-geführt
- Datei: /workspaces/toolsapp/app/tools/pdf_template_builder/app.js
- Alle neuen Felder editierbar im Property-Panel.
- Speicherung bleibt payload_json + Revisionen.

### Task 5.2 - JSON Import/Export ergänzen
- Editor kann Layout als JSON-Datei exportieren/importieren.
- Validierung beim Import mit klaren Fehlermeldungen.

### Task 5.3 - Binding-Robustheit
- Bei tool_key-Wechsel ungültige Bindings sicher bereinigen.
- Mapping-Hinweise in UI anzeigen.

**Done wenn**
- Vorlage kann visuell erstellt, als JSON exportiert, importiert und identisch gerendert werden.

---

## Phase 6: WYSIWYG-Verifikation & QA
### Task 6.1 - Golden-Master-Suite
- Definiere 5-8 Referenzvorlagen:
  - Fließtext lang
  - Tabellenähnliche Blöcke
  - Multi-Line + center/right
  - Bilder mit unterschiedlichen Aspekten
  - Umlaute/Sonderzeichen

### Task 6.2 - Vergleichsmodus (optional, empfohlen)
- Editor: Stage vs. gerenderte Preview im Overlay/Side-by-Side.
- Sichtbare Delta-Kontrolle für QA.

### Task 6.3 - Security/Firewall Regression
- Datei: /workspaces/toolsapp/scripts/firewall_guard.php
- Sicherstellen, dass neue Assets/Markup kompatibel sind.

### Task 6.4 - End-to-End Runtime-Test
- nti_tool -> render_tool -> finales PDF mit echten Bindings.

**Done wenn**
- Alle Referenzfälle bestehen, keine kritischen CSP/Firewall-Verstöße, Runtime-PDF korrekt.

---

## Rollout-Strategie (empfohlen)
### Schritt A - Schneller Nutzen
- Reaktivierung + Basisschema + erste Präzisionskorrekturen.
- Ziel: Tool wieder nutzbar, deutliche Qualitätssteigerung.

### Schritt B - Präzisionsfinish
- Metriken/Fonts finalisieren, JSON Import/Export, Vergleichsmodus.
- Ziel: WYSIWYG-naher Produktionsstandard.

---

## Abhängigkeiten
- Phase 1 blockiert alle folgenden Phasen.
- Phase 2 muss vor Phase 4 abgeschlossen sein.
- Phase 3 und 4 können teilweise parallel laufen, Integration erst nach gemeinsamen Font-/Metrik-Entscheid.
- Phase 6 läuft inkrementell, finaler Gate vor Rollout.

---

## Akzeptanzkriterien (Endzustand)
1. pdf_template_builder ist wieder aktiv und stabil nutzbar.
2. Editor und finaler PDF-Render nutzen dieselben Layout-Regeln und Assets.
3. JSON ist das kanonische Layoutformat; visuelles Editieren + Persistenz + Revision funktioniert.
4. Golden-Master-Fälle sind innerhalb definierter Toleranzen.
5. nti_tool rendert produktive PDFs korrekt über render_tool.
6. Firewall-/CSP-Regeln bleiben vollständig erfüllt.

---

## Relevante Dateien
- /workspaces/toolsapp/tool.php
- /workspaces/toolsapp/index.php
- /workspaces/toolsapp/app/tools/pdf_template_builder/index.html
- /workspaces/toolsapp/app/tools/pdf_template_builder/app.js
- /workspaces/toolsapp/app/tools/pdf_template_builder/style.css
- /workspaces/toolsapp/pdf_template_api.php
- /workspaces/toolsapp/app/pdf_template_lib.php
- /workspaces/toolsapp/toolserve.php
- /workspaces/toolsapp/scripts/firewall_guard.php

---

## Handoff-Hinweise für den nächsten Agenten
- Starte mit Phase 1 (Reaktivierung), danach sofort Smoke-Test (open/load/save/preview).
- Führe Änderungen in kleinen, testbaren Inkrementen aus (nicht Big-Bang).
- Nach jeder Phase: Regression-Check auf Runtime-Render nti_tool.
- Vor Merge zwingend Security/Firewall/CSP prüfen.
