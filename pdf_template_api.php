<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/app/pdf_template_lib.php';

function pdf_template_json_response(array $payload, int $status = 200): never {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function pdf_template_read_json_input(): array {
  $raw = file_get_contents('php://input');
  if ($raw === false || $raw === '') {
    return [];
  }

  try {
    $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    return is_array($decoded) ? $decoded : [];
  } catch (Throwable $e) {
    pdf_template_json_response(['ok' => false, 'error' => 'invalid_json'], 400);
  }
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$input = $method === 'POST' ? pdf_template_read_json_input() : [];
$action = (string)($_GET['action'] ?? $input['action'] ?? '');

$runtimeActions = ['render_tool'];
$isRuntimeAction = in_array($action, $runtimeActions, true);

if ($isRuntimeAction) {
  require_login();
} else {
  pdf_template_require_admin_tool_access();
}

if ($method === 'POST' && !$isRuntimeAction) {
  $token = (string)($input['csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''));
  require_csrf_token($token);
}

$db = pdf_template_db();
pdf_template_ensure_starter_templates($db, pdf_template_current_uid(), pdf_template_current_username());

if ($action === 'bootstrap') {
  pdf_template_json_response([
    'ok' => true,
    'csrf' => csrf_token(),
    'allowed_tool_keys' => pdf_template_allowed_tool_keys(),
    'field_catalog' => pdf_template_field_catalog(),
    'user' => [
      'id' => pdf_template_current_uid(),
      'username' => pdf_template_current_username(),
      'is_admin' => !empty($_SESSION['is_admin']),
    ],
  ]);
}

if ($action === 'list') {
  $toolFilter = trim((string)($_GET['tool_key'] ?? ''));
  if ($toolFilter !== '' && !in_array($toolFilter, pdf_template_allowed_tool_keys(), true)) {
    pdf_template_json_response(['ok' => false, 'error' => 'invalid_tool_key'], 400);
  }

  $params = [];
  $sql = 'SELECT id, title, tool_key, status, version, owner_user_id, owner_username, created_at, updated_at, updated_by_user_id, updated_by_username
    FROM pdf_templates
    WHERE deleted_at IS NULL';

  if ($toolFilter !== '') {
    $sql .= ' AND tool_key = ?';
    $params[] = $toolFilter;
  }

  $sql .= ' ORDER BY updated_at DESC';

  $stmt = $db->prepare($sql);
  $stmt->execute($params);
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

  pdf_template_json_response(['ok' => true, 'items' => $rows]);
}

if ($action === 'get') {
  $id = (int)($_GET['id'] ?? 0);
  if ($id <= 0) {
    pdf_template_json_response(['ok' => false, 'error' => 'missing_id'], 400);
  }

  $row = pdf_template_fetch_row($db, $id);
  if (!$row) {
    pdf_template_json_response(['ok' => false, 'error' => 'not_found'], 404);
  }

  try {
    $payload = json_decode((string)$row['payload_json'], true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($payload)) {
      $payload = [];
    }
  } catch (Throwable $e) {
    $payload = [];
  }

  pdf_template_json_response([
    'ok' => true,
    'item' => [
      'id' => (int)$row['id'],
      'title' => (string)$row['title'],
      'tool_key' => (string)$row['tool_key'],
      'status' => (string)$row['status'],
      'version' => (int)$row['version'],
      'owner_user_id' => (int)$row['owner_user_id'],
      'owner_username' => (string)$row['owner_username'],
      'created_at' => (string)$row['created_at'],
      'updated_at' => (string)$row['updated_at'],
      'updated_by_user_id' => (int)$row['updated_by_user_id'],
      'updated_by_username' => (string)$row['updated_by_username'],
      'payload' => $payload,
    ],
  ]);
}

if ($action === 'create' && $method === 'POST') {
  $toolKey = trim((string)($input['tool_key'] ?? 'nti_tool'));
  if (!in_array($toolKey, pdf_template_allowed_tool_keys(), true)) {
    pdf_template_json_response(['ok' => false, 'error' => 'invalid_tool_key'], 400);
  }

  $title = trim((string)($input['title'] ?? 'Neue PDF-Vorlage'));
  if ($title === '') {
    $title = 'Neue PDF-Vorlage';
  }

  $status = pdf_template_normalize_status((string)($input['status'] ?? 'draft'));

  $payloadInput = $input['payload'] ?? null;
  $payload = is_array($payloadInput)
    ? pdf_template_normalize_payload($payloadInput, $toolKey)
    : pdf_template_default_payload($toolKey);

  $errors = pdf_template_validate_payload($payload, $toolKey);
  if ($errors !== []) {
    pdf_template_json_response(['ok' => false, 'error' => 'invalid_payload', 'details' => $errors], 400);
  }

  $now = pdf_template_iso_now();
  $uid = pdf_template_current_uid();
  $username = pdf_template_current_username();

  $stmt = $db->prepare('INSERT INTO pdf_templates (title, tool_key, status, payload_json, owner_user_id, owner_username, version, created_at, updated_at, updated_by_user_id, updated_by_username)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)');
  $stmt->execute([
    $title,
    $toolKey,
    $status,
    json_encode($payload, JSON_THROW_ON_ERROR),
    $uid,
    $username,
    $now,
    $now,
    $uid,
    $username,
  ]);

  $id = (int)$db->lastInsertId();
  $revStmt = $db->prepare('INSERT INTO pdf_template_revisions (template_id, version, title, tool_key, status, payload_json, updated_at, updated_by_user_id, updated_by_username)
    VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?)');
  $revStmt->execute([
    $id,
    $title,
    $toolKey,
    $status,
    json_encode($payload, JSON_THROW_ON_ERROR),
    $now,
    $uid,
    $username,
  ]);

  pdf_template_json_response(['ok' => true, 'id' => $id]);
}

if ($action === 'save' && $method === 'POST') {
  $id = (int)($input['id'] ?? 0);
  if ($id <= 0) {
    pdf_template_json_response(['ok' => false, 'error' => 'missing_id'], 400);
  }

  $row = pdf_template_fetch_row($db, $id);
  if (!$row) {
    pdf_template_json_response(['ok' => false, 'error' => 'not_found'], 404);
  }

  $toolKey = trim((string)($input['tool_key'] ?? $row['tool_key'] ?? ''));
  if (!in_array($toolKey, pdf_template_allowed_tool_keys(), true)) {
    pdf_template_json_response(['ok' => false, 'error' => 'invalid_tool_key'], 400);
  }

  $requestedVersion = (int)($input['version'] ?? 0);
  $currentVersion = (int)($row['version'] ?? 1);
  if ($requestedVersion > 0 && $requestedVersion !== $currentVersion) {
    pdf_template_json_response([
      'ok' => false,
      'error' => 'version_conflict',
      'current_version' => $currentVersion,
      'updated_at' => (string)$row['updated_at'],
      'updated_by_username' => (string)$row['updated_by_username'],
    ], 409);
  }

  $payloadInput = $input['payload'] ?? null;
  if (!is_array($payloadInput)) {
    pdf_template_json_response(['ok' => false, 'error' => 'missing_payload'], 400);
  }

  $payload = pdf_template_normalize_payload($payloadInput, $toolKey);
  $errors = pdf_template_validate_payload($payload, $toolKey);
  if ($errors !== []) {
    pdf_template_json_response(['ok' => false, 'error' => 'invalid_payload', 'details' => $errors], 400);
  }

  $title = trim((string)($input['title'] ?? $row['title'] ?? 'PDF-Vorlage'));
  if ($title === '') {
    $title = (string)$row['title'];
  }

  $status = pdf_template_normalize_status((string)($input['status'] ?? $row['status'] ?? 'draft'));

  $newVersion = $currentVersion + 1;
  $now = pdf_template_iso_now();
  $uid = pdf_template_current_uid();
  $username = pdf_template_current_username();

  $stmt = $db->prepare('UPDATE pdf_templates
    SET title = ?, tool_key = ?, status = ?, payload_json = ?, version = ?, updated_at = ?, updated_by_user_id = ?, updated_by_username = ?
    WHERE id = ?');
  $stmt->execute([
    $title,
    $toolKey,
    $status,
    json_encode($payload, JSON_THROW_ON_ERROR),
    $newVersion,
    $now,
    $uid,
    $username,
    $id,
  ]);

  $revStmt = $db->prepare('INSERT INTO pdf_template_revisions (template_id, version, title, tool_key, status, payload_json, updated_at, updated_by_user_id, updated_by_username)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $revStmt->execute([
    $id,
    $newVersion,
    $title,
    $toolKey,
    $status,
    json_encode($payload, JSON_THROW_ON_ERROR),
    $now,
    $uid,
    $username,
  ]);

  pdf_template_json_response(['ok' => true, 'version' => $newVersion, 'updated_at' => $now]);
}

if ($action === 'set_status' && $method === 'POST') {
  $id = (int)($input['id'] ?? 0);
  if ($id <= 0) {
    pdf_template_json_response(['ok' => false, 'error' => 'missing_id'], 400);
  }

  $row = pdf_template_fetch_row($db, $id);
  if (!$row) {
    pdf_template_json_response(['ok' => false, 'error' => 'not_found'], 404);
  }

  $status = pdf_template_normalize_status((string)($input['status'] ?? 'draft'));
  $newVersion = ((int)$row['version']) + 1;
  $now = pdf_template_iso_now();
  $uid = pdf_template_current_uid();
  $username = pdf_template_current_username();

  $stmt = $db->prepare('UPDATE pdf_templates
    SET status = ?, version = ?, updated_at = ?, updated_by_user_id = ?, updated_by_username = ?
    WHERE id = ?');
  $stmt->execute([$status, $newVersion, $now, $uid, $username, $id]);

  $revStmt = $db->prepare('INSERT INTO pdf_template_revisions (template_id, version, title, tool_key, status, payload_json, updated_at, updated_by_user_id, updated_by_username)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $revStmt->execute([
    $id,
    $newVersion,
    (string)$row['title'],
    (string)$row['tool_key'],
    $status,
    (string)$row['payload_json'],
    $now,
    $uid,
    $username,
  ]);

  pdf_template_json_response(['ok' => true, 'status' => $status, 'version' => $newVersion]);
}

if ($action === 'delete' && $method === 'POST') {
  $id = (int)($input['id'] ?? 0);
  if ($id <= 0) {
    pdf_template_json_response(['ok' => false, 'error' => 'missing_id'], 400);
  }

  $row = pdf_template_fetch_row($db, $id);
  if (!$row) {
    pdf_template_json_response(['ok' => false, 'error' => 'not_found'], 404);
  }

  $stmt = $db->prepare('UPDATE pdf_templates SET deleted_at = ?, updated_at = ?, updated_by_user_id = ?, updated_by_username = ? WHERE id = ?');
  $now = pdf_template_iso_now();
  $uid = pdf_template_current_uid();
  $username = pdf_template_current_username();
  $stmt->execute([$now, $now, $uid, $username, $id]);

  pdf_template_json_response(['ok' => true]);
}

if ($action === 'render_preview' && $method === 'POST') {
  $toolKey = trim((string)($input['tool_key'] ?? ''));
  $title = trim((string)($input['title'] ?? 'PDF-Vorschau'));
  $payloadInput = $input['payload'] ?? null;
  $sampleDataInput = $input['sample_data'] ?? null;

  if (!is_array($payloadInput)) {
    pdf_template_json_response(['ok' => false, 'error' => 'missing_payload'], 400);
  }

  if ($toolKey === '') {
    $toolKey = trim((string)($payloadInput['tool_key'] ?? 'nti_tool'));
  }

  if (!in_array($toolKey, pdf_template_allowed_tool_keys(), true)) {
    pdf_template_json_response(['ok' => false, 'error' => 'invalid_tool_key'], 400);
  }

  $payload = pdf_template_normalize_payload($payloadInput, $toolKey);
  $errors = pdf_template_validate_payload($payload, $toolKey);
  if ($errors !== []) {
    pdf_template_json_response(['ok' => false, 'error' => 'invalid_payload', 'details' => $errors], 400);
  }

  $sampleData = is_array($sampleDataInput) ? $sampleDataInput : pdf_template_example_data($toolKey);
  $pdf = pdf_template_render_pdf($payload, $sampleData, $title);

  header('Content-Type: application/pdf');
  header('Content-Disposition: inline; filename="pdf-template-preview.pdf"');
  header('Cache-Control: no-store');
  echo $pdf;
  exit;
}

if ($action === 'render_final' && $method === 'POST') {
  $id = (int)($input['id'] ?? 0);
  if ($id <= 0) {
    pdf_template_json_response(['ok' => false, 'error' => 'missing_id'], 400);
  }

  $row = pdf_template_fetch_row($db, $id);
  if (!$row) {
    pdf_template_json_response(['ok' => false, 'error' => 'not_found'], 404);
  }

  if ((string)($row['status'] ?? 'draft') !== 'published') {
    pdf_template_json_response(['ok' => false, 'error' => 'template_not_published'], 409);
  }

  try {
    $payload = json_decode((string)$row['payload_json'], true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($payload)) {
      $payload = [];
    }
  } catch (Throwable $e) {
    $payload = [];
  }

  $toolKey = trim((string)($row['tool_key'] ?? ''));
  if (!in_array($toolKey, pdf_template_allowed_tool_keys(), true)) {
    pdf_template_json_response(['ok' => false, 'error' => 'invalid_tool_key'], 400);
  }

  $payload = pdf_template_normalize_payload($payload, $toolKey);
  $errors = pdf_template_validate_payload($payload, $toolKey);
  if ($errors !== []) {
    pdf_template_json_response(['ok' => false, 'error' => 'invalid_payload', 'details' => $errors], 400);
  }

  $data = is_array($input['data'] ?? null) ? $input['data'] : pdf_template_example_data($toolKey);
  $title = trim((string)($row['title'] ?? 'PDF Export'));
  $pdf = pdf_template_render_pdf($payload, $data, $title);

  $safeName = preg_replace('/[^a-zA-Z0-9_-]+/', '-', strtolower($title));
  if (!is_string($safeName) || $safeName === '') {
    $safeName = 'pdf-export';
  }

  header('Content-Type: application/pdf');
  header('Content-Disposition: attachment; filename="' . $safeName . '.pdf"');
  header('Cache-Control: no-store');
  echo $pdf;
  exit;
}

if ($action === 'render_tool' && $method === 'POST') {
  $toolKey = trim((string)($input['tool_key'] ?? ''));
  if ($toolKey === '') {
    pdf_template_json_response(['ok' => false, 'error' => 'missing_tool_key'], 400);
  }

  if (!in_array($toolKey, pdf_template_allowed_tool_keys(), true)) {
    pdf_template_json_response(['ok' => false, 'error' => 'invalid_tool_key'], 400);
  }

  pdf_template_require_tool_access($toolKey);

  $templateTitle = trim((string)($input['template_title'] ?? ''));
  $row = null;
  if ($templateTitle !== '') {
    $byTitleStmt = $db->prepare('SELECT *
      FROM pdf_templates
      WHERE deleted_at IS NULL AND tool_key = ? AND title = ?
      ORDER BY updated_at DESC, version DESC, id DESC
      LIMIT 1');
    $byTitleStmt->execute([$toolKey, $templateTitle]);
    $candidate = $byTitleStmt->fetch(PDO::FETCH_ASSOC);
    if (is_array($candidate)) {
      $row = $candidate;
    } else {
      pdf_template_json_response([
        'ok' => false,
        'error' => 'template_title_not_found',
        'tool_key' => $toolKey,
        'template_title' => $templateTitle,
      ], 404);
    }
  }

  if (!is_array($row)) {
    $row = pdf_template_find_active_template_for_tool($db, $toolKey);
  }

  if (!is_array($row)) {
    pdf_template_json_response(['ok' => false, 'error' => 'no_template_for_tool'], 404);
  }

  try {
    $payload = json_decode((string)$row['payload_json'], true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($payload)) {
      $payload = [];
    }
  } catch (Throwable $e) {
    $payload = [];
  }

  $payload = pdf_template_normalize_payload($payload, $toolKey);
  $errors = pdf_template_validate_payload($payload, $toolKey);
  if ($errors !== []) {
    pdf_template_json_response(['ok' => false, 'error' => 'invalid_payload', 'details' => $errors], 400);
  }

  $data = is_array($input['data'] ?? null) ? $input['data'] : pdf_template_example_data($toolKey);
  $title = trim((string)($row['title'] ?? 'PDF Export'));
  $pdf = pdf_template_render_pdf($payload, $data, $title);

  $safeName = preg_replace('/[^a-zA-Z0-9_-]+/', '-', strtolower($title));
  if (!is_string($safeName) || $safeName === '') {
    $safeName = 'pdf-export';
  }

  $disposition = strtolower(trim((string)($input['disposition'] ?? 'inline')));
  if (!in_array($disposition, ['inline', 'attachment'], true)) {
    $disposition = 'inline';
  }

  header('X-PDF-Template-Id: ' . (int)$row['id']);
  header('X-PDF-Template-Tool: ' . $toolKey);
  header('X-PDF-Template-Status: ' . (string)($row['status'] ?? 'draft'));
  header('Content-Type: application/pdf');
  header('Content-Disposition: ' . $disposition . '; filename="' . $safeName . '.pdf"');
  header('Cache-Control: no-store');
  echo $pdf;
  exit;
}

pdf_template_json_response(['ok' => false, 'error' => 'unknown_action'], 400);
