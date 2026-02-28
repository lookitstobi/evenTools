<?php
declare(strict_types=1);

function dguv_db(): PDO {
  static $db = null;
  if ($db instanceof PDO) {
    return $db;
  }

  $config = require __DIR__ . '/config.php';
  $path = (string)($config['dguv_db_path'] ?? (__DIR__ . '/dguv.sqlite'));

  $db = new PDO('sqlite:' . $path);
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $db->exec('PRAGMA foreign_keys = ON;');

  dguv_init_schema($db);

  return $db;
}

function dguv_init_schema(PDO $db): void {
  $db->exec('CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY,
    asset_uid TEXT NOT NULL UNIQUE,
    asset_name TEXT NOT NULL,
    location TEXT NOT NULL,
    device_type TEXT NOT NULL,
    manufacturer TEXT NOT NULL DEFAULT "",
    model TEXT NOT NULL DEFAULT "",
    serial_number TEXT NOT NULL DEFAULT "",
    notes TEXT NOT NULL DEFAULT "",
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  )');

  dguv_add_column_if_missing($db, 'assets', 'customer', 'TEXT NOT NULL DEFAULT ""');
  dguv_add_column_if_missing($db, 'assets', 'site', 'TEXT NOT NULL DEFAULT ""');
  dguv_add_column_if_missing($db, 'assets', 'department', 'TEXT NOT NULL DEFAULT ""');
  dguv_add_column_if_missing($db, 'assets', 'autotest_code', 'TEXT NOT NULL DEFAULT ""');

  $db->exec('CREATE TABLE IF NOT EXISTS inspections (
    id INTEGER PRIMARY KEY,
    asset_id INTEGER NOT NULL,
    inspection_date TEXT NOT NULL,
    next_due_date TEXT,
    result_status TEXT NOT NULL,
    measured_values_json TEXT NOT NULL DEFAULT "{}",
    defects_text TEXT NOT NULL DEFAULT "",
    inspector_name TEXT NOT NULL DEFAULT "",
    source_type TEXT NOT NULL DEFAULT "manual",
    source_ref TEXT NOT NULL DEFAULT "",
    expires_at TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY(asset_id) REFERENCES assets(id)
  )');

  $db->exec('CREATE TABLE IF NOT EXISTS import_runs (
    id INTEGER PRIMARY KEY,
    source_name TEXT NOT NULL,
    source_hash TEXT NOT NULL,
    source_format TEXT NOT NULL,
    imported_count INTEGER NOT NULL DEFAULT 0,
    warning_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    raw_payload TEXT NOT NULL DEFAULT "",
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )');

  $db->exec('CREATE TABLE IF NOT EXISTS import_staging (
    id INTEGER PRIMARY KEY,
    import_run_id INTEGER,
    source_name TEXT NOT NULL DEFAULT "",
    source_format TEXT NOT NULL DEFAULT "",
    detected_asset_uid TEXT NOT NULL DEFAULT "",
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL,
    matched_asset_id INTEGER,
    resolution_note TEXT NOT NULL DEFAULT "",
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    resolved_at TEXT,
    FOREIGN KEY(import_run_id) REFERENCES import_runs(id),
    FOREIGN KEY(matched_asset_id) REFERENCES assets(id)
  )');

  $db->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS print_profiles (
  id INTEGER PRIMARY KEY,
  profile_name TEXT NOT NULL UNIQUE,
  delimiter TEXT NOT NULL DEFAULT ';',
  enclosure TEXT NOT NULL DEFAULT '"',
  linebreak TEXT NOT NULL DEFAULT '\n',
  mapping_json TEXT NOT NULL,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
SQL
  );

  $db->exec('CREATE TABLE IF NOT EXISTS print_jobs (
    id INTEGER PRIMARY KEY,
    job_mode TEXT NOT NULL,
    print_profile_id INTEGER,
    filter_text TEXT NOT NULL DEFAULT "",
    selected_ids_json TEXT NOT NULL,
    csv_payload TEXT NOT NULL,
    status TEXT NOT NULL,
    requested_by INTEGER NOT NULL,
    requested_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    error_text TEXT NOT NULL DEFAULT "",
    agent_name TEXT NOT NULL DEFAULT "",
    agent_meta_json TEXT NOT NULL DEFAULT "{}",
    FOREIGN KEY(print_profile_id) REFERENCES print_profiles(id)
  )');

  $db->exec('CREATE TABLE IF NOT EXISTS device_jobs (
    id INTEGER PRIMARY KEY,
    job_type TEXT NOT NULL,
    transport_mode TEXT NOT NULL DEFAULT "agent",
    source_format TEXT NOT NULL DEFAULT "json",
    selected_ids_json TEXT NOT NULL DEFAULT "[]",
    filter_text TEXT NOT NULL DEFAULT "",
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL,
    requested_by INTEGER NOT NULL,
    requested_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    error_text TEXT NOT NULL DEFAULT "",
    agent_name TEXT NOT NULL DEFAULT "",
    agent_meta_json TEXT NOT NULL DEFAULT "{}"
  )');

  $db->exec('CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY,
    actor_user_id INTEGER,
    actor_username TEXT NOT NULL DEFAULT "",
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    meta_json TEXT NOT NULL DEFAULT "{}",
    created_at TEXT NOT NULL
  )');

  $db->exec('CREATE INDEX IF NOT EXISTS idx_assets_uid ON assets(asset_uid)');
  $db->exec('CREATE INDEX IF NOT EXISTS idx_assets_customer ON assets(customer)');
  $db->exec('CREATE INDEX IF NOT EXISTS idx_assets_site ON assets(site)');
  $db->exec('CREATE INDEX IF NOT EXISTS idx_assets_department ON assets(department)');
  $db->exec('CREATE INDEX IF NOT EXISTS idx_assets_autotest_code ON assets(autotest_code)');
  $db->exec('CREATE INDEX IF NOT EXISTS idx_inspections_asset ON inspections(asset_id)');
  $db->exec('CREATE INDEX IF NOT EXISTS idx_inspections_expires ON inspections(expires_at)');
  $db->exec('CREATE INDEX IF NOT EXISTS idx_import_staging_status ON import_staging(status)');
  $db->exec('CREATE INDEX IF NOT EXISTS idx_import_staging_uid ON import_staging(detected_asset_uid)');
  $db->exec('CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status)');
  $db->exec('CREATE INDEX IF NOT EXISTS idx_device_jobs_status ON device_jobs(status)');
  $db->exec('CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at)');
}

function dguv_add_column_if_missing(PDO $db, string $table, string $column, string $definition): void {
  $stmt = $db->query('PRAGMA table_info(' . $table . ')');
  $columns = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
  foreach ($columns as $col) {
    if (($col['name'] ?? '') === $column) {
      return;
    }
  }

  $db->exec('ALTER TABLE ' . $table . ' ADD COLUMN ' . $column . ' ' . $definition);
}

function dguv_iso_now(): string {
  return gmdate('c');
}

function dguv_require_tool_access(): void {
  require_login();
  $allowed = $_SESSION['tools'] ?? [];
  if (!is_array($allowed) || !in_array('dguv_v3', $allowed, true)) {
    http_response_code(403);
    echo '403';
    exit;
  }
}

function dguv_json_decode_array(string $value, array $fallback = []): array {
  if ($value === '') {
    return $fallback;
  }
  try {
    $decoded = json_decode($value, true, 512, JSON_THROW_ON_ERROR);
    return is_array($decoded) ? $decoded : $fallback;
  } catch (Throwable $e) {
    return $fallback;
  }
}

function dguv_audit(PDO $db, string $action, string $entityType, string $entityId, array $meta = []): void {
  $stmt = $db->prepare('INSERT INTO audit_log (actor_user_id, actor_username, action, entity_type, entity_id, meta_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([
    (int)($_SESSION['uid'] ?? 0),
    (string)($_SESSION['username'] ?? ''),
    $action,
    $entityType,
    $entityId,
    json_encode($meta, JSON_THROW_ON_ERROR),
    dguv_iso_now(),
  ]);
}

function dguv_retention_expires_at(?string $inspectionDate = null): string {
  $base = $inspectionDate && preg_match('/^\d{4}-\d{2}-\d{2}$/', $inspectionDate)
    ? strtotime($inspectionDate . ' 00:00:00 UTC')
    : time();
  if ($base === false) {
    $base = time();
  }
  return gmdate('c', strtotime('+5 years', $base));
}
