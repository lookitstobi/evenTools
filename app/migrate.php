<?php
declare(strict_types=1);

require dirname(__DIR__) . '/_bootstrap.php';
require __DIR__ . '/cuesheet_lib.php';
require __DIR__ . '/dguv_lib.php';

/**
 * Explizite DB-Migrationen für Deploys.
 *
 * Aufruf:
 *   php app/migrate.php
 */

function migrate_users_db(array $config): void {
  $db = new PDO('sqlite:' . (string)$config['db_path']);
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $db->exec('PRAGMA foreign_keys = ON;');

  $db->exec('CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    passhash TEXT NOT NULL,
    tools TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0
  )');
}

function migrate_cuesheet_db(): void {
  $db = cuesheet_db();
  cuesheet_init_schema($db);
}

function migrate_dguv_db(): void {
  $db = dguv_db();
  dguv_init_schema($db);
}

try {
  migrate_users_db($config);
  migrate_cuesheet_db();
  migrate_dguv_db();

  echo "OK: Migration abgeschlossen.\n";
  exit(0);
} catch (Throwable $e) {
  fwrite(STDERR, 'Migration fehlgeschlagen: ' . $e->getMessage() . "\n");
  exit(1);
}
