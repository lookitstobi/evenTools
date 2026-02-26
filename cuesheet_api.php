<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/app/cuesheet_lib.php';

function cuesheet_json_response(array $payload, int $status = 200): never {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function cuesheet_read_json_input(): array {
  $raw = file_get_contents('php://input');
  if ($raw === false || $raw === '') {
    return [];
  }

  try {
    $parsed = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    return is_array($parsed) ? $parsed : [];
  } catch (Throwable $e) {
    cuesheet_json_response(['ok' => false, 'error' => 'invalid_json'], 400);
  }
}

function cuesheet_require_row_readable(array $row): void {
  if (!cuesheet_can_read($row)) {
    cuesheet_json_response(['ok' => false, 'error' => 'forbidden'], 403);
  }
}

function cuesheet_require_row_writable(array $row): void {
  if (!cuesheet_can_write($row)) {
    cuesheet_json_response(['ok' => false, 'error' => 'forbidden'], 403);
  }
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$input = $method === 'POST' ? cuesheet_read_json_input() : [];
$action = (string)($_GET['action'] ?? $input['action'] ?? '');

cuesheet_require_tool_access();
if ($method === 'POST') {
  $token = (string)($input['csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''));
  require_csrf_token($token);
}

$db = cuesheet_db();

if ($action === 'bootstrap') {
  cuesheet_json_response([
    'ok' => true,
    'csrf' => csrf_token(),
    'user' => [
      'id' => cuesheet_current_uid(),
      'username' => cuesheet_current_username(),
      'is_admin' => cuesheet_is_admin(),
    ],
  ]);
}

if ($action === 'list') {
  $uid = cuesheet_current_uid();
  $stmt = $db->prepare('SELECT id, title, visibility, owner_user_id, owner_username, version, created_at, updated_at, updated_by_user_id, updated_by_username
      FROM cuesheets
      WHERE owner_user_id = :uid OR visibility = "shared"
      ORDER BY updated_at DESC');
  $stmt->execute([':uid' => $uid]);
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

  cuesheet_json_response(['ok' => true, 'items' => $rows]);
}

if ($action === 'get') {
  $id = (int)($_GET['id'] ?? 0);
  if ($id <= 0) {
    cuesheet_json_response(['ok' => false, 'error' => 'missing_id'], 400);
  }

  $row = cuesheet_fetch_row($db, $id);
  if (!$row) {
    cuesheet_json_response(['ok' => false, 'error' => 'not_found'], 404);
  }
  cuesheet_require_row_readable($row);

  $payload = [];
  try {
    $payloadDecoded = json_decode((string)$row['payload_json'], true, 512, JSON_THROW_ON_ERROR);
    if (is_array($payloadDecoded)) {
      $payload = $payloadDecoded;
    }
  } catch (Throwable $e) {
    $payload = [];
  }

  cuesheet_json_response([
    'ok' => true,
    'item' => [
      'id' => (int)$row['id'],
      'title' => (string)$row['title'],
      'visibility' => (string)$row['visibility'],
      'owner_user_id' => (int)$row['owner_user_id'],
      'owner_username' => (string)$row['owner_username'],
      'version' => (int)$row['version'],
      'created_at' => (string)$row['created_at'],
      'updated_at' => (string)$row['updated_at'],
      'updated_by_user_id' => (int)$row['updated_by_user_id'],
      'updated_by_username' => (string)$row['updated_by_username'],
      'payload' => $payload,
    ],
  ]);
}

if ($action === 'create' && $method === 'POST') {
  $payload = cuesheet_payload_normalize(is_array($input['payload'] ?? null) ? $input['payload'] : []);
  $title = trim((string)($input['title'] ?? $payload['title'] ?? 'Neue Cueliste'));
  if ($title === '') {
    $title = 'Neue Cueliste';
  }

  $visibility = cuesheet_normalize_visibility((string)($input['visibility'] ?? 'private'));
  $now = cuesheet_iso_now();
  $uid = cuesheet_current_uid();
  $username = cuesheet_current_username();

  $stmt = $db->prepare('INSERT INTO cuesheets (title, visibility, payload_json, owner_user_id, owner_username, version, created_at, updated_at, updated_by_user_id, updated_by_username)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)');
  $stmt->execute([
    $title,
    $visibility,
    json_encode($payload, JSON_THROW_ON_ERROR),
    $uid,
    $username,
    $now,
    $now,
    $uid,
    $username,
  ]);

  cuesheet_json_response(['ok' => true, 'id' => (int)$db->lastInsertId()]);
}

if ($action === 'save' && $method === 'POST') {
  $id = (int)($input['id'] ?? 0);
  if ($id <= 0) {
    cuesheet_json_response(['ok' => false, 'error' => 'missing_id'], 400);
  }

  $row = cuesheet_fetch_row($db, $id);
  if (!$row) {
    cuesheet_json_response(['ok' => false, 'error' => 'not_found'], 404);
  }
  cuesheet_require_row_writable($row);

  $payload = cuesheet_payload_normalize(is_array($input['payload'] ?? null) ? $input['payload'] : []);
  $title = trim((string)($input['title'] ?? $payload['title'] ?? $row['title'] ?? 'Cueliste'));
  if ($title === '') {
    $title = (string)$row['title'];
  }

  $requestedVersion = (int)($input['version'] ?? 0);
  $currentVersion = (int)($row['version'] ?? 1);
  if ($requestedVersion > 0 && $requestedVersion !== $currentVersion) {
    cuesheet_json_response([
      'ok' => false,
      'error' => 'version_conflict',
      'current_version' => $currentVersion,
      'updated_at' => (string)$row['updated_at'],
      'updated_by_username' => (string)$row['updated_by_username'],
    ], 409);
  }

  $newVersion = $currentVersion + 1;
  $now = cuesheet_iso_now();
  $uid = cuesheet_current_uid();
  $username = cuesheet_current_username();

  $stmt = $db->prepare('UPDATE cuesheets
      SET title = ?, payload_json = ?, version = ?, updated_at = ?, updated_by_user_id = ?, updated_by_username = ?
      WHERE id = ?');
  $stmt->execute([
    $title,
    json_encode($payload, JSON_THROW_ON_ERROR),
    $newVersion,
    $now,
    $uid,
    $username,
    $id,
  ]);

  cuesheet_json_response(['ok' => true, 'version' => $newVersion, 'updated_at' => $now]);
}

if ($action === 'set_visibility' && $method === 'POST') {
  $id = (int)($input['id'] ?? 0);
  if ($id <= 0) {
    cuesheet_json_response(['ok' => false, 'error' => 'missing_id'], 400);
  }

  $row = cuesheet_fetch_row($db, $id);
  if (!$row) {
    cuesheet_json_response(['ok' => false, 'error' => 'not_found'], 404);
  }

  $isOwner = (int)$row['owner_user_id'] === cuesheet_current_uid();
  if (!$isOwner && !cuesheet_is_admin()) {
    cuesheet_json_response(['ok' => false, 'error' => 'forbidden'], 403);
  }

  $visibility = cuesheet_normalize_visibility((string)($input['visibility'] ?? 'private'));
  $now = cuesheet_iso_now();
  $uid = cuesheet_current_uid();
  $username = cuesheet_current_username();

  $stmt = $db->prepare('UPDATE cuesheets
      SET visibility = ?, updated_at = ?, updated_by_user_id = ?, updated_by_username = ?, version = version + 1
      WHERE id = ?');
  $stmt->execute([$visibility, $now, $uid, $username, $id]);

  cuesheet_json_response(['ok' => true, 'visibility' => $visibility]);
}

if ($action === 'delete' && $method === 'POST') {
  $id = (int)($input['id'] ?? 0);
  if ($id <= 0) {
    cuesheet_json_response(['ok' => false, 'error' => 'missing_id'], 400);
  }

  $row = cuesheet_fetch_row($db, $id);
  if (!$row) {
    cuesheet_json_response(['ok' => false, 'error' => 'not_found'], 404);
  }

  if (!cuesheet_can_delete($row)) {
    cuesheet_json_response(['ok' => false, 'error' => 'forbidden'], 403);
  }

  $stmt = $db->prepare('DELETE FROM cuesheets WHERE id = ?');
  $stmt->execute([$id]);

  cuesheet_json_response(['ok' => true]);
}

if ($action === 'import_json' && $method === 'POST') {
  $import = $input['document'] ?? null;
  if (!is_array($import)) {
    cuesheet_json_response(['ok' => false, 'error' => 'missing_document'], 400);
  }

  $payload = cuesheet_payload_normalize(is_array($import['payload'] ?? null) ? $import['payload'] : []);
  $title = trim((string)($import['title'] ?? $payload['title'] ?? 'Importierte Cueliste'));
  if ($title === '') {
    $title = 'Importierte Cueliste';
  }

  $visibility = cuesheet_normalize_visibility((string)($import['visibility'] ?? 'private'));
  $now = cuesheet_iso_now();
  $uid = cuesheet_current_uid();
  $username = cuesheet_current_username();

  $stmt = $db->prepare('INSERT INTO cuesheets (title, visibility, payload_json, owner_user_id, owner_username, version, created_at, updated_at, updated_by_user_id, updated_by_username)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)');
  $stmt->execute([
    $title,
    $visibility,
    json_encode($payload, JSON_THROW_ON_ERROR),
    $uid,
    $username,
    $now,
    $now,
    $uid,
    $username,
  ]);

  cuesheet_json_response(['ok' => true, 'id' => (int)$db->lastInsertId()]);
}

if ($action === 'export_json') {
  $id = (int)($_GET['id'] ?? 0);
  if ($id <= 0) {
    cuesheet_json_response(['ok' => false, 'error' => 'missing_id'], 400);
  }

  $row = cuesheet_fetch_row($db, $id);
  if (!$row) {
    cuesheet_json_response(['ok' => false, 'error' => 'not_found'], 404);
  }
  cuesheet_require_row_readable($row);

  $payload = [];
  try {
    $decoded = json_decode((string)$row['payload_json'], true, 512, JSON_THROW_ON_ERROR);
    if (is_array($decoded)) {
      $payload = $decoded;
    }
  } catch (Throwable $e) {
    $payload = [];
  }

  cuesheet_json_response([
    'ok' => true,
    'document' => [
      'format' => 'toolsapp.cuesheet.v1',
      'title' => (string)$row['title'],
      'visibility' => (string)$row['visibility'],
      'exported_at' => cuesheet_iso_now(),
      'payload' => $payload,
    ],
  ]);
}

cuesheet_json_response(['ok' => false, 'error' => 'unknown_action'], 400);
