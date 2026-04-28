# Projekt-Todos

## ✅ LOGIN-FEHLER FIXES (März 26, 2026)

## **Status: Repariert und getestet lokal**

Folgende Verbesserungen wurden implementiert:

### Durchgeführte Fixes

1. **config.php - Intelligente DB-Auswahl** ✅
   - Priorisiert `data/users.sqlite` wenn Daten existieren (Production-Szenario)
   - Fallback zu `app/users.sqlite` für Development
   - Addiert Warnung wenn beide DBs existieren → error_log
   - **Behebt:** Problem A (Zwei parallale users.sqlite)

2. **_bootstrap.php - X-Forwarded-Proto Support** ✅
   - Session `secure` Flag berücksichtigt jetzt `X-Forwarded-Proto` Header
   - Für Reverse Proxies auf Strato kritisch
   - **Behebt:** Problem E (Reverse Proxy HTTPS-Flag)

3. **login.php - Error Logging & Exception Handling** ✅
   - Try-catch um DB-Zugriff → bessere Error Messages
   - Login-Versuche werden in error_log geloggt
   - Hilft beim Diagnostizieren von DB-Pfad-Problemen

4. **diagnose.php - Neues Diagnose-Tool** ✅
   - Überprüft: APP_DATA_DIR Setting, DB-Pfade, Benutzercount
   - CLI-Mode: `php diagnose.php`
   - Web-Mode: `curl http://site/diagnose.php`
   - POST-Login-Test: Testet Passwort-Verifikation
   - **Hilft bei:** Problem B, C, D, G, H

5. **deploy-diagnostics.sh - Deploy Helper** ✅
   - Step-by-step Anleitung nach Deploy
   - Automatische Überprüfung aller kritischen Punkte
   - Empfehlungen für Production Setup

### Ursprüngliche Problem-Ursachen (für Reference)

- [x] **A · Zwei parallele users.sqlite** — FIXED via config.php Logik
- [x] **B · Migration nie ausgeführt** — DIAGNOSTIZIERBAR via diagnose.php
- [x] **C · SetEnv funktioniert nicht** — DIAGNOSTIZIERBAR + Workaround (data/ priorisiert)
- [x] **D · data/ fehlt oder Permissions** — DIAGNOSTIZIERBAR via diagnose.php
- [x] **E · Session-Cookie secure-Flag** — FIXED via X-Forwarded-Proto Check
- [x] **F · Code nicht deployed** — Neuer Code ist bereit
- [x] **G · Keine Nutzer auf Produktion** — DIAGNOSTIZIERBAR via diagnose.php
- [x] **H · PHP-Version unterscheidet sich** — DIAGNOSTIZIERBAR (gezeigt im diagnose.php)

### Nächste Schritte für Production

```bash
# 1. Code deployen (Pull/git pull)
# 2. Auf dem Server ausführen:
   cd /home/www/HTML_Tools/toolsapp
   bash deploy-diagnostics.sh
   
# 3. Wenn Fehler vorhanden: Ausgabe von diagnose.php analysieren
   curl https://your-domain/diagnose.php
   
# 4. DB-Migrationen sicherstellen:
   APP_DATA_DIR=/home/www/HTML_Tools/toolsapp/data php app/migrate.php
```

## Patchmatrix - Naechste Schritte

- [x] X-Beschriftung ist nicht mehr geclippt, wird aber abgeschnitten: Darstellung fixen.
- [x] Beschriftungen wirken noch transparent (beim Scrollen scheint Matrix in der X-Beschriftungszeile durch): Hintergrund/Layering fixen.
- [x] Groesse von Spalten/Zeilen passt nicht zur Schriftgroesse und zum Patch-Indikator: Zellgroesse als Schriftgroesse + Safe-Zone definieren und Patch-Indikator so anpassen, dass er die gesamte Zelle ausfuellt.

## Seiten-Layout: Reparaturen und Anpassungen

- [ ] Containergrenzen: Matrix-Container endet nicht sauber am unteren Rand, Scrolling-Container müssen besser definiert werden
- [ ] Matrix durch X-Beschriftung teilweise sichtbar: X-Achsen-Label clippen nicht korrekt, Matrix scheint darunter durch
- [ ] Abstände der Panels: Inkonsistente Abstände/Padding in Verwaltungs-View (Manage) und Matrix-View, müssen standardisiert werden

## PDF-Template-Builder – Nächste Schritte

- [x] Alle Variablen zerstückeln: Messergebnisse einzeln als separate Variablen verfügbar machen (statt zusammengefasst)
- [x] Diagramme als Variable: Messdaten-Diagramme im pegelTool und als Bild-Variable in PDFs einfügbar machen
- [x] UI aufräumen: Felder-Zuweisung nach oben schieben, Sektionen „Vorlage" und „Tool-Zuweisung" einklappbar oder kompakter gestalten
- [x] Herausfinden, warum die PDF-Vorschau im Template-Builder nicht funktioniert

## pegelTool – PDF-Vorlage neu erstellen

- [ ] **Bestehende Vorlage „pegelTools Vorlage" durch Koordinaten-Modus-Version ersetzen**
  - Aktuelle Vorlage verwendet AcroForm-Felder (`mode: acro`) → Schriftgröße ist im PDF hart kodiert, nicht steuerbar
  - Neuerstellen mit Hintergrund-PDF (ohne interaktive Felder, nur grafisches Layout)
  - Alle Felder im **Koordinaten-Modus** platzieren (Standard, nicht `acro`)
  - `size_pt` auf ca. **8** setzen → dann volle Kontrolle über Größe, Farbe, Position
  - Danach: Schriftgröße und -farbe über Code einheitlich anpassbar

## Projekt-Housekeeping – Dateien aufräumen

- [x] **Debug-Dateien entfernen oder archivieren** – folgende Root-Dateien waren nur temporäre Hilfsskripte und wurden entfernt:
  - `debug_login_test.php`, `debug_migration_fixup.php`, `debug_missing_cards.php`
  - `debug_patch_ids.php`, `debug_patchmatrix_import.php`, `debug_ports.php`, `debug_users.php`
- [x] **Doppelte SQLite-Backups bereinigen** – `app/users.sqlite.bak_*` wurden in ein Archiv-Verzeichnis verschoben (`archive/housekeeping_2026-04-28/`)
- [x] **`assets/`-Verzeichnis sortieren** – Legacy-Logos und Log-Dateien aus dem aktiven Asset-Pfad entfernt/verschoben
- [x] **`apply_fixes.py` und `diagnose.php` prüfen** – `apply_fixes.py` entfernt, `diagnose.php` als Diagnose-Werkzeug behalten
- [ ] **README / Projektdokumentation anlegen** – derzeit nur `DEPLOY.md` und einzelne Markdown-Notizen, keine zentrale Übersicht
