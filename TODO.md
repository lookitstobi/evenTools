# Projekt-Todos

## Login schlägt auf Produktion fehl – offene Diagnose/Fixes

Folgende Ursachen kommen in Frage (höchste Wahrscheinlichkeit zuerst):

- [ ] **A · Zwei parallele users.sqlite** — `app/users.sqlite` (Codespace/lokal) vs. `data/users.sqlite` (Server über `SetEnv APP_DATA_DIR`). Anlegende Nutzer im Codespace landen NIE auf der Server-DB. Diagnose auf SSH: `php -r '$c=require "app/config.php"; echo $c["db_path"].PHP_EOL;'` und dann Userliste abfragen.

- [ ] **B · Migration wurde nie auf dem Server ausgeführt** — `deploy.yml` lädt nur Code hoch. `php app/migrate.php` muss auf dem Server manuell mit gesetztem `APP_DATA_DIR` ausgeführt werden. Wenn nicht geschehen, ist `data/users.sqlite` leer oder existiert gar nicht.

- [ ] **C · `SetEnv` funktioniert auf Strato nicht** — Bei CGI/FastCGI/PHP-FPM ist `mod_env` oft nicht aktiv → `getenv('APP_DATA_DIR')` gibt immer leer zurück. Folge: DB-Pfad wird von `config.php` anders aufgelöst als erwartet. Prüfen mit `php -r 'echo getenv("APP_DATA_DIR").PHP_EOL;'` direkt auf dem Server (via Web, nicht CLI).

- [ ] **D · `data/`-Verzeichnis fehlt oder hat keine Schreibrechte** — `_bootstrap.php` versucht `mkdir(0775)`, aber wenn der Web-Prozess das nicht darf, schlägt `new PDO('sqlite:...')` still fehl. Prüfen: `ls -lah /home/www/HTML_Tools/toolsapp/data/`.

- [ ] **E · Session-Cookie `secure`-Flag** — `_bootstrap.php` setzt `secure` nur wenn `$_SERVER['HTTPS']` gesetzt ist. Auf Strato werden HTTPS-Requests oft über einen Reverse Proxy terminiert, der `$_SERVER['HTTPS']` nicht weitergibt → Cookie wird mit `secure=false` gesetzt und bei HTTPS-Verbindungen vom Browser nicht mitgeschickt (oder umgekehrt). Fix: `X-Forwarded-Proto`-Header auswerten.

- [ ] **F · Neues `login.php` + `config.php` noch nicht auf Server deployed** — Die Fixes aus dieser Session (Legacy-Hash-Fallback, neue DB-Pfad-Logik) wurden lokal gemacht. Erst nach Deploy + ggf. Migration wirken sie auf Produktion.

- [ ] **G · Nutzer auf Produktion nie angelegt** — Wenn `data/users.sqlite` frisch ist und kein Admin über das Live-`admin_users.php` je einen Nutzer angelegt hat, sind schlicht keine User in der Produktiv-DB.

- [ ] **H · PHP-Version unterscheidet sich** — Unterschiedliche `PASSWORD_DEFAULT`-Algorithmen (bcrypt vs. argon2) können dazu führen, dass `password_verify` scheitert, wenn der Hash auf einer anderen PHP-Version erzeugt wurde. Prüfen: `php -r 'echo PHP_VERSION.PHP_EOL;'` auf Server und im Codespace vergleichen.

### Diagnose-Kommandos (auf dem Server via SSH)
```bash
# Welche DB wird tatsächlich verwendet?
cd /home/www/HTML_Tools/toolsapp
APP_DATA_DIR=/home/www/HTML_Tools/toolsapp/data php -r '$c=require "app/config.php"; echo "db_path=".$c["db_path"].PHP_EOL;'

# Existieren Nutzer in der Server-DB?
APP_DATA_DIR=/home/www/HTML_Tools/toolsapp/data php -r '$c=require "app/config.php"; $db=new PDO("sqlite:".$c["db_path"]); foreach($db->query("SELECT id,username,LENGTH(passhash) as hl FROM users ORDER BY id") as $r){echo $r["id"]." ".$r["username"]." hash_len=".$r["hl"].PHP_EOL;}'

# data/-Verzeichnis und Rechte prüfen
ls -lah /home/www/HTML_Tools/toolsapp/data/

# SetEnv testen (als Web-Request über debug_login_test.php aufrufen und db_path prüfen)
```

## Patchmatrix - Naechste Schritte

- [x] X-Beschriftung ist nicht mehr geclippt, wird aber abgeschnitten: Darstellung fixen.
- [x] Beschriftungen wirken noch transparent (beim Scrollen scheint Matrix in der X-Beschriftungszeile durch): Hintergrund/Layering fixen.
- [x] Groesse von Spalten/Zeilen passt nicht zur Schriftgroesse und zum Patch-Indikator: Zellgroesse als Schriftgroesse + Safe-Zone definieren und Patch-Indikator so anpassen, dass er die gesamte Zelle ausfuellt.

## Seiten-Layout: Reparaturen und Anpassungen

- [ ] Containergrenzen: Matrix-Container endet nicht sauber am unteren Rand, Scrolling-Container müssen besser definiert werden
- [ ] Matrix durch X-Beschriftung teilweise sichtbar: X-Achsen-Label clippen nicht korrekt, Matrix scheint darunter durch
- [ ] Abstände der Panels: Inkonsistente Abstände/Padding in Verwaltungs-View (Manage) und Matrix-View, müssen standardisiert werden
