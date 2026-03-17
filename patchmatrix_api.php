<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/app/patchmatrix_lib.php';

function patchmatrix_json_response(array $payload, int $status = 200): never {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function patchmatrix_read_json_input(): array {
  $raw = file_get_contents('php://input');
  if ($raw === false || $raw === '') {
    return [];
  }

  try {
    $parsed = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    return is_array($parsed) ? $parsed : [];
  } catch (Throwable $e) {
    patchmatrix_json_response(['ok' => false, 'error' => 'invalid_json'], 400);
  }
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$input = $method === 'POST' ? patchmatrix_read_json_input() : [];
$action = (string)($_GET['action'] ?? $input['action'] ?? '');

patchmatrix_require_tool_access();
if ($method === 'POST') {
  $token = (string)($input['csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''));
  require_csrf_token($token);
}

$db = patchmatrix_db();

if ($action === 'bootstrap') {
  patchmatrix_json_response([
    'ok' => true,
    'csrf' => csrf_token(),
    'schema_version' => 1,
    'user' => [
      'id' => patchmatrix_current_uid(),
      'username' => patchmatrix_current_username(),
      'is_admin' => !empty($_SESSION['is_admin']),
    ],
  ]);
}

if ($action === 'list') {
  $stmt = $db->query('SELECT id, title, version, created_at, created_by_user_id, created_by_username, updated_at, updated_by_user_id, updated_by_username
    FROM patchmatrix_documents
    ORDER BY updated_at DESC');
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

  patchmatrix_json_response(['ok' => true, 'items' => $rows]);
}

if ($action === 'get') {
  $id = (int)($_GET['id'] ?? 0);
  if ($id <= 0) {
    patchmatrix_json_response(['ok' => false, 'error' => 'missing_id'], 400);
  }

  $row = patchmatrix_fetch_row($db, $id);
  if (!$row) {
    patchmatrix_json_response(['ok' => false, 'error' => 'not_found'], 404);
  }

  try {
    $payload = json_decode((string)$row['payload_json'], true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($payload)) {
      $payload = patchmatrix_default_payload((string)$row['title']);
    }
  } catch (Throwable $e) {
    patchmatrix_json_response(['ok' => false, 'error' => 'invalid_payload'], 500);
  }

  patchmatrix_json_response([
    'ok' => true,
    'item' => [
      'id' => (int)$row['id'],
      'title' => (string)$row['title'],
      'version' => (int)$row['version'],
      'created_at' => (string)$row['created_at'],
      'created_by_user_id' => (int)$row['created_by_user_id'],
      'created_by_username' => (string)$row['created_by_username'],
      'updated_at' => (string)$row['updated_at'],
      'updated_by_user_id' => (int)$row['updated_by_user_id'],
      'updated_by_username' => (string)$row['updated_by_username'],
      'payload' => $payload,
    ],
  ]);
}

if ($action === 'create' && $method === 'POST') {
  $payloadInput = $input['payload'] ?? null;
  $payload = is_array($payloadInput) ? patchmatrix_normalize_payload($payloadInput) : patchmatrix_default_payload();

  $title = trim((string)($input['title'] ?? ($payload['meta']['title'] ?? 'Neue Nexus Konfiguration')));
  if ($title === '') {
    $title = 'Neue Nexus Konfiguration';
  }

  $now = patchmatrix_iso_now();
  $uid = patchmatrix_current_uid();
  $username = patchmatrix_current_username();
  $payload = patchmatrix_apply_server_meta($payload, $title, $now, $uid, $username);

  $errors = patchmatrix_validate_payload($payload);
  if ($errors !== []) {
    patchmatrix_json_response(['ok' => false, 'error' => 'validation_error', 'details' => $errors], 400);
  }

  $stmt = $db->prepare('INSERT INTO patchmatrix_documents (title, payload_json, version, created_at, created_by_user_id, created_by_username, updated_at, updated_by_user_id, updated_by_username)
    VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([
    $title,
    json_encode($payload, JSON_THROW_ON_ERROR),
    $now,
    $uid,
    $username,
    $now,
    $uid,
    $username,
  ]);

  patchmatrix_json_response([
    'ok' => true,
    'id' => (int)$db->lastInsertId(),
    'version' => 1,
    'updated_at' => $now,
  ]);
}

if ($action === 'save' && $method === 'POST') {
  $id = (int)($input['id'] ?? 0);
  if ($id <= 0) {
    patchmatrix_json_response(['ok' => false, 'error' => 'missing_id'], 400);
  }

  $row = patchmatrix_fetch_row($db, $id);
  if (!$row) {
    patchmatrix_json_response(['ok' => false, 'error' => 'not_found'], 404);
  }

  $payloadInput = $input['payload'] ?? null;
  if (!is_array($payloadInput)) {
    patchmatrix_json_response([
      'ok' => false,
      'error' => 'validation_error',
      'details' => [['path' => 'payload', 'message' => 'missing_payload']],
    ], 400);
  }

  $requestedVersion = (int)($input['version'] ?? 0);
  $currentVersion = (int)($row['version'] ?? 1);
  if ($requestedVersion > 0 && $requestedVersion !== $currentVersion) {
    patchmatrix_json_response([
      'ok' => false,
      'error' => 'version_conflict',
      'current_version' => $currentVersion,
      'updated_at' => (string)$row['updated_at'],
      'updated_by_username' => (string)$row['updated_by_username'],
    ], 409);
  }

  $payload = patchmatrix_normalize_payload($payloadInput);
  $title = trim((string)($input['title'] ?? ($payload['meta']['title'] ?? $row['title'] ?? 'Nexus Konfiguration')));
  if ($title === '') {
    $title = (string)$row['title'];
  }

  $existingPayload = [];
  try {
    $decoded = json_decode((string)$row['payload_json'], true, 512, JSON_THROW_ON_ERROR);
    if (is_array($decoded)) {
      $existingPayload = $decoded;
    }
  } catch (Throwable $e) {
    $existingPayload = [];
  }

  $now = patchmatrix_iso_now();
  $uid = patchmatrix_current_uid();
  $username = patchmatrix_current_username();
  $existingMeta = is_array($existingPayload['meta'] ?? null) ? $existingPayload['meta'] : null;
  $payload = patchmatrix_apply_server_meta($payload, $title, $now, $uid, $username, $existingMeta);

  $errors = patchmatrix_validate_payload($payload);
  if ($errors !== []) {
    patchmatrix_json_response(['ok' => false, 'error' => 'validation_error', 'details' => $errors], 400);
  }

  $newVersion = $currentVersion + 1;
  $stmt = $db->prepare('UPDATE patchmatrix_documents
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

  patchmatrix_json_response([
    'ok' => true,
    'version' => $newVersion,
    'updated_at' => $now,
  ]);
}

if ($action === 'delete' && $method === 'POST') {
  $id = (int)($input['id'] ?? 0);
  if ($id <= 0) {
    patchmatrix_json_response(['ok' => false, 'error' => 'missing_id'], 400);
  }

  $row = patchmatrix_fetch_row($db, $id);
  if (!$row) {
    patchmatrix_json_response(['ok' => false, 'error' => 'not_found'], 404);
  }

  $stmt = $db->prepare('DELETE FROM patchmatrix_documents WHERE id = ?');
  $stmt->execute([$id]);

  patchmatrix_json_response(['ok' => true]);
}

patchmatrix_json_response(['ok' => false, 'error' => 'unknown_action'], 400);
