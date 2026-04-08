<?php
declare(strict_types=1);

function pdf_template_db(): PDO {
  static $db = null;
  if ($db instanceof PDO) {
    return $db;
  }

  $config = require __DIR__ . '/config.php';
  $path = (string)($config['pdf_template_db_path'] ?? (__DIR__ . '/pdf_templates.sqlite'));

  $db = new PDO('sqlite:' . $path);
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $db->exec('PRAGMA foreign_keys = ON;');
  $db->exec('PRAGMA journal_mode = WAL;');

  pdf_template_init_schema($db);

  return $db;
}

function pdf_template_init_schema(PDO $db): void {
  // Alte WYSIWYG-Tabellen bleiben erhalten (werden nicht mehr genutzt, aber auch nicht gelöscht).
  $db->exec('CREATE TABLE IF NOT EXISTS pdf_templates (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    tool_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT "draft",
    payload_json TEXT NOT NULL,
    owner_user_id INTEGER NOT NULL,
    owner_username TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by_user_id INTEGER NOT NULL,
    updated_by_username TEXT NOT NULL,
    deleted_at TEXT
  )');

  $db->exec('CREATE TABLE IF NOT EXISTS pdf_template_revisions (
    id INTEGER PRIMARY KEY,
    template_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    title TEXT NOT NULL,
    tool_key TEXT NOT NULL,
    status TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by_user_id INTEGER NOT NULL,
    updated_by_username TEXT NOT NULL,
    FOREIGN KEY(template_id) REFERENCES pdf_templates(id)
  )');

  // Neue Tabellen für PDF-Hintergrund-System.
  $db->exec('CREATE TABLE IF NOT EXISTS pdf_uploaded_templates (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    pdf_data BLOB NOT NULL,
    fields_json TEXT NOT NULL DEFAULT "[]",
    owner_user_id INTEGER NOT NULL,
    owner_username TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )');

  // Migration: detected_acro_fields_json-Spalte nachträglich hinzufügen (idempotent).
  try {
    $db->exec('ALTER TABLE pdf_uploaded_templates ADD COLUMN detected_acro_fields_json TEXT NOT NULL DEFAULT "[]"');
  } catch (Throwable) {
    // Spalte existiert bereits – ignorieren.
  }

  $db->exec('CREATE TABLE IF NOT EXISTS pdf_tool_assignments (
    tool_key TEXT PRIMARY KEY,
    template_id INTEGER NOT NULL,
    assigned_at TEXT NOT NULL,
    assigned_by TEXT NOT NULL
  )');
}

function pdf_template_iso_now(): string {
  return gmdate('c');
}

function pdf_template_require_admin_tool_access(): void {
  require_admin();
}

function pdf_template_require_tool_access(string $toolKey): void {
  require_login();
  if (!empty($_SESSION['is_admin'])) {
    return;
  }

  $allowed = $_SESSION['tools'] ?? [];
  if (!is_array($allowed) || !in_array($toolKey, $allowed, true)) {
    http_response_code(403);
    echo '403';
    exit;
  }
}

function pdf_template_current_uid(): int {
  return (int)($_SESSION['uid'] ?? 0);
}

function pdf_template_current_username(): string {
  return (string)($_SESSION['username'] ?? '');
}

function pdf_template_allowed_tool_keys(): array {
  static $cache = null;
  if (is_array($cache)) {
    return $cache;
  }

  $preferred = ['pegelTool', 'dguv_v3', 'cuesheet', 'patchmatrix'];
  $excluded = ['pdf_template_builder', 'dev_todo'];

  $keys = [];
  foreach ($preferred as $key) {
    $keys[$key] = true;
  }

  $config = require __DIR__ . '/config.php';
  $toolsDir = (string)($config['tools_dir'] ?? '');
  $toolsBase = realpath($toolsDir);
  if ($toolsBase !== false) {
    foreach (glob($toolsBase . '/*', GLOB_ONLYDIR) ?: [] as $dir) {
      $name = basename($dir);
      if ($name === '' || in_array($name, $excluded, true)) {
        continue;
      }
      if (!preg_match('/^[a-zA-Z0-9_-]+$/', $name)) {
        continue;
      }
      $keys[$name] = true;
    }
  }

  $ordered = [];
  foreach ($preferred as $key) {
    if (!empty($keys[$key])) {
      $ordered[] = $key;
      unset($keys[$key]);
    }
  }

  $extra = array_keys($keys);
  sort($extra, SORT_STRING);
  $cache = array_merge($ordered, $extra);
  return $cache;
}

function pdf_template_field_catalog(): array {
  return [
    'pegelTool' => [
      // Projekt
      ['key' => 'project_name',         'label' => 'Projektname',          'group' => 'Projekt',    'example' => 'Classic Night Philharmonie'],
      ['key' => 'location',             'label' => 'Location',             'group' => 'Projekt',    'example' => 'Philharmonie Essen, Alfried-Krupp-Saal'],
      ['key' => 'environment',          'label' => 'Umgebung',             'group' => 'Projekt',    'example' => 'Innenraum, vollbesetzt'],
      ['key' => 'description',          'label' => 'Beschreibung',         'group' => 'Projekt',    'example' => 'Orchesterkonzert mit Verstärkung, ca. 2800 Besucher'],
      // Messung
      ['key' => 'measurement_date',     'label' => 'Messdatum',            'group' => 'Messung',    'example' => '2025-03-14'],
      ['key' => 'start_measurement',    'label' => 'Messstart',            'group' => 'Messung',    'example' => '2025-03-14 19:40:06'],
      ['key' => 'end_measurement',      'label' => 'Messende',             'group' => 'Messung',    'example' => '2025-03-14 22:00:47'],
      ['key' => 'log_interval',         'label' => 'Log-Intervall',        'group' => 'Messung',    'example' => '00:00:01,0'],
      ['key' => 'measurement_position', 'label' => 'Messposition',         'group' => 'Messung',    'example' => 'Reihe 15, Mittelachse'],
      ['key' => 'loudest_position',     'label' => 'Lauteste Position',    'group' => 'Messung',    'example' => 'Front-of-House'],
      // Ergebnisse
      ['key' => 'result_laeq',          'label' => 'Ergebnis LAeq',        'group' => 'Ergebnisse', 'example' => '77.4 dB(A)'],
      ['key' => 'result_laeq_g30',      'label' => 'Ergebnis LAeq,30min',  'group' => 'Ergebnisse', 'example' => '77.4 dB'],
      ['key' => 'result_peak',          'label' => 'Ergebnis LCpeak',      'group' => 'Ergebnisse', 'example' => '114.7 dB(C)'],
      // Beteiligte
      ['key' => 'operator_name',        'label' => 'Operator / Prüfer',    'group' => 'Beteiligte', 'example' => 'Max Muster'],
      ['key' => 'customer',             'label' => 'Kunde / FOH',          'group' => 'Beteiligte', 'example' => 'Mustage GmbH'],
      ['key' => 'organiser',            'label' => 'Organisator',          'group' => 'Beteiligte', 'example' => 'Philharmonie Essen GmbH'],
      // Bericht
      ['key' => 'report_date',          'label' => 'Berichtdatum',         'group' => 'Bericht',    'example' => '2025-03-15'],
      ['key' => 'report_name',          'label' => 'Berichtersteller',     'group' => 'Bericht',    'example' => 'Max Muster'],
      // Messgerät
      ['key' => 'device_model',         'label' => 'Messgerät Modell',     'group' => 'Gerät',      'example' => 'XL3'],
      ['key' => 'device_sn',            'label' => 'Messgerät S/N',        'group' => 'Gerät',      'example' => 'A3A-00805-D1'],
      ['key' => 'firmware',             'label' => 'Firmware',             'group' => 'Gerät',      'example' => 'FW1.26'],
      ['key' => 'microphone',           'label' => 'Mikrofon',             'group' => 'Gerät',      'example' => 'NTi Audio M4261 | S/N: 5506'],
      // Kalibration
      ['key' => 'calibrator_model',     'label' => 'Kalibrator Modell',    'group' => 'Kalibration','example' => 'NTi Audio CAL200'],
      ['key' => 'calibrator_sn',        'label' => 'Kalibrator S/N',       'group' => 'Kalibration','example' => '999-00001'],
      ['key' => 'kset_date',            'label' => 'k-Werte gesetzt am',   'group' => 'Korrektur',  'example' => '2025-03-14 17:32'],
      ['key' => 'correction_k1',        'label' => 'Korrekturwert k1',     'group' => 'Korrektur',  'example' => '-11,0 dB'],
      ['key' => 'correction_k2',        'label' => 'Korrekturwert k2',     'group' => 'Korrektur',  'example' => '-10,2 dB'],
      // Anlage
      ['key' => 'pa_setup',             'label' => 'Anlagen-Setup',        'group' => 'Anlage',     'example' => 'L-ACOUSTIC KARA II × 24 | L-ACOUSTIC KS21 × 4'],
    ],
  ];
}

// ---------------------------------------------------------------------------
// CRUD: Hochgeladene PDF-Vorlagen
// ---------------------------------------------------------------------------

function pdf_upload_save(PDO $db, string $title, string $pdfBytes, int $uid, string $uname): int {
  $now = pdf_template_iso_now();
  $stmt = $db->prepare(
    'INSERT INTO pdf_uploaded_templates (title, pdf_data, fields_json, owner_user_id, owner_username, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  $stmt->execute([$title, $pdfBytes, '[]', $uid, $uname, $now, $now]);
  return (int)$db->lastInsertId();
}

function pdf_upload_get(PDO $db, int $id): ?array {
  $stmt = $db->prepare(
    'SELECT id, title, fields_json, detected_acro_fields_json, owner_user_id, owner_username, created_at, updated_at
     FROM pdf_uploaded_templates WHERE id = ?'
  );
  $stmt->execute([$id]);
  $row = $stmt->fetch(PDO::FETCH_ASSOC);
  if (!is_array($row)) {
    return null;
  }

  try {
    $fields = json_decode((string)$row['fields_json'], true, 512, JSON_THROW_ON_ERROR);
  } catch (Throwable $e) {
    $fields = [];
  }

  try {
    $acroFields = json_decode((string)($row['detected_acro_fields_json'] ?? '[]'), true, 512, JSON_THROW_ON_ERROR);
  } catch (Throwable $e) {
    $acroFields = [];
  }

  return [
    'id'                   => (int)$row['id'],
    'title'                => (string)$row['title'],
    'fields'               => is_array($fields) ? $fields : [],
    'detected_acro_fields' => is_array($acroFields) ? $acroFields : [],
    'owner_user_id'        => (int)$row['owner_user_id'],
    'owner_username'       => (string)$row['owner_username'],
    'created_at'           => (string)$row['created_at'],
    'updated_at'           => (string)$row['updated_at'],
  ];
}

function pdf_upload_get_bytes(PDO $db, int $id): ?string {
  $stmt = $db->prepare('SELECT pdf_data FROM pdf_uploaded_templates WHERE id = ?');
  $stmt->execute([$id]);
  $row = $stmt->fetch(PDO::FETCH_ASSOC);
  if (!is_array($row) || !isset($row['pdf_data'])) {
    return null;
  }
  $data = $row['pdf_data'];
  return is_string($data) ? $data : null;
}

function pdf_upload_list(PDO $db): array {
  // Lädt alle Vorlagen mit Tool-Zuweisung, aber ohne pdf_data (zu groß).
  $stmt = $db->query(
    'SELECT t.id, t.title, t.fields_json, t.detected_acro_fields_json, t.owner_user_id, t.owner_username, t.created_at, t.updated_at,
            a.tool_key AS assigned_tool_key
     FROM pdf_uploaded_templates t
     LEFT JOIN pdf_tool_assignments a ON a.template_id = t.id
     ORDER BY t.updated_at DESC'
  );
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
  $result = [];
  foreach ($rows as $row) {
    try {
      $listAcro = json_decode((string)($row['detected_acro_fields_json'] ?? '[]'), true, 512, JSON_THROW_ON_ERROR);
    } catch (Throwable) {
      $listAcro = [];
    }
    try {
      $listFields = json_decode((string)($row['fields_json'] ?? '[]'), true, 512, JSON_THROW_ON_ERROR);
    } catch (Throwable) {
      $listFields = [];
    }
    $result[] = [
      'id'                   => (int)$row['id'],
      'title'                => (string)$row['title'],
      'fields'               => is_array($listFields) ? $listFields : [],
      'detected_acro_fields' => is_array($listAcro) ? $listAcro : [],
      'owner_user_id'        => (int)$row['owner_user_id'],
      'owner_username'       => (string)$row['owner_username'],
      'created_at'           => (string)$row['created_at'],
      'updated_at'           => (string)$row['updated_at'],
      'assigned_tool_key'    => isset($row['assigned_tool_key']) ? (string)$row['assigned_tool_key'] : null,
    ];
  }
  return $result;
}

function pdf_upload_delete(PDO $db, int $id): void {
  // Zuweisung zuerst entfernen, falls vorhanden.
  $stmt = $db->prepare('DELETE FROM pdf_tool_assignments WHERE template_id = ?');
  $stmt->execute([$id]);

  $stmt = $db->prepare('DELETE FROM pdf_uploaded_templates WHERE id = ?');
  $stmt->execute([$id]);
}

function pdf_upload_update_title(PDO $db, int $id, string $title): void {
  $stmt = $db->prepare(
    'UPDATE pdf_uploaded_templates SET title = ?, updated_at = ? WHERE id = ?'
  );
  $stmt->execute([$title, pdf_template_iso_now(), $id]);
}

function pdf_upload_save_detected_acro_fields(PDO $db, int $id, array $names): void {
  // Nur Strings, keine Duplikate, max 200 Einträge.
  $clean = [];
  foreach ($names as $n) {
    if (is_string($n) && $n !== '' && !in_array($n, $clean, true)) {
      $clean[] = $n;
    }
    if (count($clean) >= 200) {
      break;
    }
  }
  $stmt = $db->prepare(
    'UPDATE pdf_uploaded_templates SET detected_acro_fields_json = ?, updated_at = ? WHERE id = ?'
  );
  $stmt->execute([json_encode($clean, JSON_UNESCAPED_UNICODE), pdf_template_iso_now(), $id]);
}

function pdf_upload_save_fields(PDO $db, int $id, array $fields): void {
  $clean = [];
  foreach ($fields as $f) {
    if (!is_array($f)) {
      continue;
    }
    // AcroForm-Modus: nur field + acro_field_name gespeichert.
    if (($f['mode'] ?? '') === 'acro') {
      $clean[] = [
        'mode'           => 'acro',
        'field'          => (string)($f['field'] ?? ''),
        'acro_field_name' => (string)($f['acro_field_name'] ?? ''),
      ];
      continue;
    }
    $clean[] = [
      'field'   => (string)($f['field'] ?? ''),
      'page'    => max(1, (int)($f['page'] ?? 1)),
      'x_mm'    => (float)($f['x_mm'] ?? 0),
      'y_mm'    => (float)($f['y_mm'] ?? 0),
      'size_pt' => max(1, (float)($f['size_pt'] ?? 10)),
      'align'   => in_array($f['align'] ?? '', ['left', 'center', 'right'], true)
                     ? $f['align'] : 'left',
      'color'   => preg_match('/^#[0-9a-fA-F]{6}$/', $f['color'] ?? '')
                     ? $f['color'] : '#000000',
    ];
  }

  $stmt = $db->prepare(
    'UPDATE pdf_uploaded_templates SET fields_json = ?, updated_at = ? WHERE id = ?'
  );
  $stmt->execute([json_encode($clean, JSON_UNESCAPED_UNICODE), pdf_template_iso_now(), $id]);
}

function pdf_upload_assign_tool(PDO $db, string $toolKey, int $templateId, string $uname): void {
  // Upsert: Zuweisung für dieses Tool-Key setzen (überschreibt vorherige).
  $stmt = $db->prepare(
    'INSERT INTO pdf_tool_assignments (tool_key, template_id, assigned_at, assigned_by)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(tool_key) DO UPDATE SET template_id = excluded.template_id,
       assigned_at = excluded.assigned_at, assigned_by = excluded.assigned_by'
  );
  $stmt->execute([$toolKey, $templateId, pdf_template_iso_now(), $uname]);
}

function pdf_upload_unassign_tool(PDO $db, string $toolKey): void {
  $stmt = $db->prepare('DELETE FROM pdf_tool_assignments WHERE tool_key = ?');
  $stmt->execute([$toolKey]);
}

function pdf_upload_get_active_for_tool(PDO $db, string $toolKey): ?array {
  $stmt = $db->prepare(
    'SELECT t.id, t.title, t.fields_json, t.detected_acro_fields_json, a.tool_key AS assigned_tool_key
     FROM pdf_uploaded_templates t
     INNER JOIN pdf_tool_assignments a ON a.template_id = t.id
     WHERE a.tool_key = ?'
  );
  $stmt->execute([$toolKey]);
  $row = $stmt->fetch(PDO::FETCH_ASSOC);
  if (!is_array($row)) {
    return null;
  }

  try {
    $fields = json_decode((string)$row['fields_json'], true, 512, JSON_THROW_ON_ERROR);
  } catch (Throwable $e) {
    $fields = [];
  }

  try {
    $acroFields = json_decode((string)($row['detected_acro_fields_json'] ?? '[]'), true, 512, JSON_THROW_ON_ERROR);
  } catch (Throwable $e) {
    $acroFields = [];
  }

  return [
    'id'                   => (int)$row['id'],
    'title'                => (string)$row['title'],
    'fields'               => is_array($fields) ? $fields : [],
    'detected_acro_fields' => is_array($acroFields) ? $acroFields : [],
    'assigned_tool_key'    => (string)$row['assigned_tool_key'],
  ];
}
