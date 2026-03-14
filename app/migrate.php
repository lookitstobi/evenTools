<?php
declare(strict_types=1);

require dirname(__DIR__) . '/_bootstrap.php';
require __DIR__ . '/cuesheet_lib.php';
require __DIR__ . '/dguv_lib.php';
require __DIR__ . '/pdf_template_lib.php';

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

function migrate_pdf_template_db(): void {
  // Schema wird durch pdf_template_db() via pdf_template_init_schema() automatisch angelegt.
  pdf_template_db();
}

/**
 * Stellt sicher, dass alle Admin-User den pdf_template_builder in ihrer
 * Tools-Liste haben, damit sie nach dem ersten Deploy sofort Zugriff erhalten.
 */
function migrate_grant_builder_to_admins(array $config): void {
  $db = new PDO('sqlite:' . (string)$config['db_path']);
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  $stmt = $db->query('SELECT id, tools FROM users WHERE is_admin = 1');
  $admins = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];

  foreach ($admins as $admin) {
    try {
      $tools = json_decode((string)($admin['tools'] ?? '[]'), true, 512, JSON_THROW_ON_ERROR);
    } catch (Throwable) {
      $tools = [];
    }
    if (!is_array($tools)) {
      $tools = [];
    }
    if (!in_array('pdf_template_builder', $tools, true)) {
      $tools[] = 'pdf_template_builder';
      $upd = $db->prepare('UPDATE users SET tools = ? WHERE id = ?');
      $upd->execute([json_encode(array_values($tools), JSON_THROW_ON_ERROR), (int)$admin['id']]);
    }
  }
}

try {
  migrate_users_db($config);
  migrate_cuesheet_db();
  migrate_dguv_db();
  migrate_pdf_template_db();
  migrate_grant_builder_to_admins($config);

  echo "OK: Migration abgeschlossen.\n";
  exit(0);
} catch (Throwable $e) {
  fwrite(STDERR, 'Migration fehlgeschlagen: ' . $e->getMessage() . "\n");
  exit(1);
}
