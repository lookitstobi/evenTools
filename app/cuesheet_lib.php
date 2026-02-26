<?php
declare(strict_types=1);

function cuesheet_db(): PDO {
  static $db = null;
  if ($db instanceof PDO) {
    return $db;
  }

  $config = require __DIR__ . '/config.php';
  $path = (string)($config['cuesheet_db_path'] ?? (__DIR__ . '/cuesheet.sqlite'));

  $db = new PDO('sqlite:' . $path);
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $db->exec('PRAGMA foreign_keys = ON;');

  cuesheet_init_schema($db);

  return $db;
}

function cuesheet_init_schema(PDO $db): void {
  $db->exec('CREATE TABLE IF NOT EXISTS cuesheets (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT "private",
    payload_json TEXT NOT NULL,
    owner_user_id INTEGER NOT NULL,
    owner_username TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by_user_id INTEGER NOT NULL,
    updated_by_username TEXT NOT NULL
  )');

  $db->exec('CREATE INDEX IF NOT EXISTS idx_cuesheets_owner ON cuesheets(owner_user_id)');
  $db->exec('CREATE INDEX IF NOT EXISTS idx_cuesheets_visibility ON cuesheets(visibility)');
  $db->exec('CREATE INDEX IF NOT EXISTS idx_cuesheets_updated ON cuesheets(updated_at)');
}

function cuesheet_iso_now(): string {
  return gmdate('c');
}

function cuesheet_require_tool_access(): void {
  require_login();
  $allowed = $_SESSION['tools'] ?? [];
  if (!is_array($allowed) || !in_array('cuesheet', $allowed, true)) {
    http_response_code(403);
    echo '403';
    exit;
  }
}

function cuesheet_is_admin(): bool {
  return !empty($_SESSION['is_admin']);
}

function cuesheet_current_uid(): int {
  return (int)($_SESSION['uid'] ?? 0);
}

function cuesheet_current_username(): string {
  return (string)($_SESSION['username'] ?? '');
}

function cuesheet_normalize_visibility(string $value): string {
  return $value === 'shared' ? 'shared' : 'private';
}

function cuesheet_can_read(array $row): bool {
  $uid = cuesheet_current_uid();
  if ((int)($row['owner_user_id'] ?? 0) === $uid) {
    return true;
  }
  return (string)($row['visibility'] ?? 'private') === 'shared';
}

function cuesheet_can_write(array $row): bool {
  $uid = cuesheet_current_uid();
  if ((int)($row['owner_user_id'] ?? 0) === $uid) {
    return true;
  }
  return (string)($row['visibility'] ?? 'private') === 'shared';
}

function cuesheet_can_delete(array $row): bool {
  $uid = cuesheet_current_uid();
  if ((int)($row['owner_user_id'] ?? 0) === $uid) {
    return true;
  }
  return cuesheet_is_admin();
}

function cuesheet_payload_normalize(array $payload): array {
  $title = trim((string)($payload['title'] ?? ''));
  $fields = $payload['fields'] ?? [];
  $cues = $payload['cues'] ?? [];

  if (!is_array($fields)) {
    $fields = [];
  }
  if (!is_array($cues)) {
    $cues = [];
  }

  $normalizedFields = [];
  foreach ($fields as $field) {
    if (!is_array($field)) {
      continue;
    }
    $key = trim((string)($field['key'] ?? ''));
    $label = trim((string)($field['label'] ?? ''));
    if ($key === '' || $label === '') {
      continue;
    }
    $normalizedFields[] = [
      'key' => $key,
      'label' => $label,
      'required' => !empty($field['required']),
      'visible' => !array_key_exists('visible', $field) || !empty($field['visible']),
      'custom' => !empty($field['custom']),
    ];
  }

  $normalizedCues = [];
  foreach ($cues as $cue) {
    if (!is_array($cue)) {
      continue;
    }
    $normalizedCues[] = [
      'id' => trim((string)($cue['id'] ?? '')),
      'name' => trim((string)($cue['name'] ?? '')),
      'wer' => trim((string)($cue['wer'] ?? '')),
      'group' => trim((string)($cue['group'] ?? '')),
      'ae' => trim((string)($cue['ae'] ?? '')),
      'values' => is_array($cue['values'] ?? null) ? $cue['values'] : [],
    ];
  }

  return [
    'title' => $title,
    'fields' => $normalizedFields,
    'cues' => $normalizedCues,
  ];
}

function cuesheet_fetch_row(PDO $db, int $id): ?array {
  $stmt = $db->prepare('SELECT * FROM cuesheets WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $row = $stmt->fetch(PDO::FETCH_ASSOC);
  return is_array($row) ? $row : null;
}
