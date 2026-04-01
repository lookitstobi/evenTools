<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/app/pdf_template_lib.php';

header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none';");

function pdf_template_json_response(array $payload, int $status = 200): never {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function pdf_template_read_json_input(): array {
  $contentType = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
  if ($contentType !== '' && strpos($contentType, 'application/json') === false) {
    return is_array($_POST) ? $_POST : [];
  }

  $raw = file_get_contents('php://input');
  if ($raw === false || $raw === '') {
    return is_array($_POST) ? $_POST : [];
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

$adminOnlyActions = ['create', 'save', 'set_status', 'delete', 'duplicate', 'import_json'];
$builderToolActions = ['bootstrap', 'list_repo_images', 'list', 'get', 'export', 'render_preview', 'render_final', 'preview_session_init', 'preview_session_page', 'preview_session_pdf'];
$isAdminOnlyAction = in_array($action, $adminOnlyActions, true);
$isBuilderToolAction = in_array($action, $builderToolActions, true);
$isRuntimeAction = $action === 'render_tool';

if ($isAdminOnlyAction) {
  pdf_template_require_admin_tool_access();
} elseif ($isBuilderToolAction) {
  pdf_template_require_tool_access('pdf_template_builder');
} elseif ($isRuntimeAction) {
  require_login();
} else {
  require_login();
}

if ($method === 'POST' && !$isRuntimeAction) {
  $token = (string)($input['csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''));
  require_csrf_token($token);
}

$db = pdf_template_db();
pdf_template_ensure_starter_templates($db, pdf_template_current_uid(), pdf_template_current_username());

function pdf_template_encode_path_for_url(string $relativePath): string {
  $parts = array_values(array_filter(explode('/', str_replace('\\', '/', $relativePath)), static fn($v) => $v !== ''));
  return implode('/', array_map('rawurlencode', $parts));
}

function pdf_template_collect_repo_images(string $baseDir, string $baseUrlPrefix): array {
  $images = [];
  if (!is_dir($baseDir)) {
    return $images;
  }

  $it = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($baseDir, FilesystemIterator::SKIP_DOTS)
  );

  foreach ($it as $file) {
    if (!$file instanceof SplFileInfo || !$file->isFile()) {
      continue;
    }
    $ext = strtolower((string)$file->getExtension());
    if (!in_array($ext, ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'], true)) {
      continue;
    }

    $fullPath = $file->getPathname();
    $relative = ltrim(str_replace('\\', '/', substr($fullPath, strlen($baseDir))), '/');
    if ($relative === '') {
      continue;
    }
    $url = rtrim($baseUrlPrefix, '/') . '/' . pdf_template_encode_path_for_url($relative);
    $images[] = [
      'name' => $file->getBasename('.' . $file->getExtension()),
      'path' => $relative,
      'url' => $url,
    ];
  }

  usort($images, static function (array $a, array $b): int {
    return strcmp($a['path'], $b['path']);
  });

  return $images;
}

function pdf_template_build_download_filename(string $resolvedTitle, string $fallback = 'pdf-export'): array {
  $name = trim($resolvedTitle);
  $name = preg_replace('/[\x00-\x1F\x7F]+/u', '', $name) ?? $name;
  $name = preg_replace('/[\\\\\/:*?"<>|]+/u', '-', $name) ?? $name;
  $name = preg_replace('/\s+/u', ' ', $name) ?? $name;
  $name = trim($name, " .\t\n\r\0\x0B-");
  if ($name === '') {
    $name = $fallback;
  }

  if (mb_strlen($name) > 120) {
    $name = mb_substr($name, 0, 120);
    $name = rtrim($name, " .\t\n\r\0\x0B-");
  }

  $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $name);
  if (!is_string($ascii) || $ascii === '') {
    $ascii = $name;
  }
  $ascii = strtolower($ascii);
  $ascii = preg_replace('/[^a-z0-9._-]+/', '-', $ascii) ?? $ascii;
  $ascii = trim($ascii, '-_.');
  if ($ascii === '') {
    $ascii = $fallback;
  }

  return ['display' => $name, 'ascii' => $ascii];
}

function pdf_template_preview_store_get_all(): array {
  $items = $_SESSION['pdf_template_preview_store'] ?? [];
  return is_array($items) ? $items : [];
}

function pdf_template_preview_store_put(array $entry): string {
  $items = pdf_template_preview_store_get_all();
  $now = time();

  foreach ($items as $token => $stored) {
    $createdAt = (int)($stored['created_at'] ?? 0);
    if ($createdAt < ($now - 1800)) {
      unset($items[$token]);
    }
  }

  $token = bin2hex(random_bytes(16));
  $entry['created_at'] = $now;
  $items[$token] = $entry;

  if (count($items) > 8) {
    uasort($items, static function (array $a, array $b): int {
      return (int)($a['created_at'] ?? 0) <=> (int)($b['created_at'] ?? 0);
    });
    while (count($items) > 8) {
      array_shift($items);
    }
  }

  $_SESSION['pdf_template_preview_store'] = $items;
  return $token;
}

function pdf_template_preview_store_get(string $token): ?array {
  $items = pdf_template_preview_store_get_all();
  $entry = $items[$token] ?? null;
  return is_array($entry) ? $entry : null;
}

function pdf_template_escape_html(string $value): string {
  return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

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

if ($action === 'list_repo_images') {
  $assetsImages = pdf_template_collect_repo_images(__DIR__ . '/assets', '/assets');
  $toolImagesBase = __DIR__ . '/app/tools/pdf_template_builder/images';
  $toolImages = [];
  if (is_dir($toolImagesBase)) {
    foreach (pdf_template_collect_repo_images($toolImagesBase, '/toolserve.php?name=pdf_template_builder&file=images') as $img) {
      $toolImages[] = [
        'name' => $img['name'],
        'path' => 'images/' . $img['path'],
        'url' => $img['url'],
      ];
    }
  }

  pdf_template_json_response([
    'ok' => true,
    'images' => array_merge($assetsImages, $toolImages),
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

if ($action === 'export') {
  $id = (int)($_GET['id'] ?? 0);
  if ($id <= 0) {
    pdf_template_json_response(['ok' => false, 'error' => 'missing_id'], 400);
  }

  $row = pdf_template_fetch_row($db, $id);
  if (!$row) {
    pdf_template_json_response(['ok' => false, 'error' => 'not_found'], 404);
  }

  $toolKey = trim((string)($row['tool_key'] ?? ''));
  if (!in_array($toolKey, pdf_template_allowed_tool_keys(), true)) {
    pdf_template_json_response(['ok' => false, 'error' => 'invalid_tool_key'], 400);
  }

  try {
    $payload = json_decode((string)$row['payload_json'], true, 512, JSON_THROW_ON_ERROR);
  } catch (Throwable $e) {
    $payload = [];
  }
  if (!is_array($payload)) {
    $payload = [];
  }

  $normalizedPayload = pdf_template_normalize_payload($payload, $toolKey);

  pdf_template_json_response([
    'ok' => true,
    'template' => [
      'export_version' => 1,
      'exported_at' => pdf_template_iso_now(),
      'title' => (string)$row['title'],
      'tool_key' => $toolKey,
      'status' => pdf_template_normalize_status((string)($row['status'] ?? 'draft')),
      'payload' => $normalizedPayload,
      'source' => [
        'id' => (int)$row['id'],
        'version' => (int)$row['version'],
        'updated_at' => (string)$row['updated_at'],
        'updated_by_username' => (string)$row['updated_by_username'],
      ],
    ],
  ]);
}

if ($action === 'import_json' && $method === 'POST') {
  $importTemplate = $input['template'] ?? null;
  if (!is_array($importTemplate)) {
    pdf_template_json_response(['ok' => false, 'error' => 'missing_template'], 400);
  }

  $toolKey = trim((string)($importTemplate['tool_key'] ?? ''));
  if ($toolKey === '' && is_array($importTemplate['payload'] ?? null)) {
    $toolKey = trim((string)(($importTemplate['payload']['tool_key'] ?? '')));
  }
  if ($toolKey === '') {
    pdf_template_json_response(['ok' => false, 'error' => 'missing_tool_key'], 400);
  }
  if (!in_array($toolKey, pdf_template_allowed_tool_keys(), true)) {
    pdf_template_json_response(['ok' => false, 'error' => 'invalid_tool_key'], 400);
  }

  $payloadInput = $importTemplate['payload'] ?? null;
  if (!is_array($payloadInput)) {
    pdf_template_json_response(['ok' => false, 'error' => 'missing_payload'], 400);
  }

  $payload = pdf_template_normalize_payload($payloadInput, $toolKey);
  $errors = pdf_template_validate_payload($payload, $toolKey);
  if ($errors !== []) {
    pdf_template_json_response(['ok' => false, 'error' => 'invalid_payload', 'details' => $errors], 400);
  }

  $title = trim((string)($importTemplate['title'] ?? 'Importierte PDF-Vorlage'));
  if ($title === '') {
    $title = 'Importierte PDF-Vorlage';
  }

  $status = pdf_template_normalize_status((string)($importTemplate['status'] ?? 'draft'));
  $mode = trim((string)($input['mode'] ?? 'create'));
  if (!in_array($mode, ['create', 'update'], true)) {
    $mode = 'create';
  }

  $now = pdf_template_iso_now();
  $uid = pdf_template_current_uid();
  $username = pdf_template_current_username();

  if ($mode === 'update') {
    $id = (int)($input['id'] ?? 0);
    if ($id <= 0) {
      pdf_template_json_response(['ok' => false, 'error' => 'missing_id'], 400);
    }

    $row = pdf_template_fetch_row($db, $id);
    if (!$row) {
      pdf_template_json_response(['ok' => false, 'error' => 'not_found'], 404);
    }

    $currentVersion = (int)($row['version'] ?? 1);
    $requestedVersion = (int)($input['version'] ?? 0);
    if ($requestedVersion > 0 && $requestedVersion !== $currentVersion) {
      pdf_template_json_response([
        'ok' => false,
        'error' => 'version_conflict',
        'current_version' => $currentVersion,
        'updated_at' => (string)$row['updated_at'],
        'updated_by_username' => (string)$row['updated_by_username'],
      ], 409);
    }

    $newVersion = $currentVersion + 1;
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

    pdf_template_json_response([
      'ok' => true,
      'id' => $id,
      'version' => $newVersion,
      'mode' => 'update',
      'updated_at' => $now,
    ]);
  }

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

  pdf_template_json_response([
    'ok' => true,
    'id' => $id,
    'version' => 1,
    'mode' => 'create',
    'updated_at' => $now,
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

if ($action === 'preview_session_init' && $method === 'POST') {
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
  $resolvedTitle = pdf_template_resolve_title_template(
    (string)($payload['pdf_title_template'] ?? $title),
    $sampleData,
    $title
  );
  $fileName = pdf_template_build_download_filename($resolvedTitle, 'pdf-template-preview');
  $token = pdf_template_preview_store_put([
    'tool_key' => $toolKey,
    'title' => $title,
    'payload' => $payload,
    'sample_data' => $sampleData,
    'resolved_title' => $resolvedTitle,
    'file_name' => $fileName,
  ]);

  pdf_template_json_response([
    'ok' => true,
    'token' => $token,
    'preview_page_url' => '/pdf_template_api.php?action=preview_session_page&token=' . rawurlencode($token),
    'file_name' => $fileName['display'] . '.pdf',
  ]);
}

if ($action === 'preview_session_page' && $method === 'GET') {
  $token = trim((string)($_GET['token'] ?? ''));
  $entry = $token !== '' ? pdf_template_preview_store_get($token) : null;
  if (!is_array($entry)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Preview not found';
    exit;
  }

  $displayName = (string)((($entry['file_name'] ?? [])['display'] ?? 'PDF Vorschau'));
  $downloadUrl = '/pdf_template_api.php?action=preview_session_pdf&token=' . rawurlencode($token) . '&download=1';
  $inlineUrl = '/pdf_template_api.php?action=preview_session_pdf&token=' . rawurlencode($token);

  header("Content-Security-Policy: default-src 'none'; img-src 'self' data: blob:; style-src 'unsafe-inline'; frame-src 'self'; child-src 'self'; navigate-to 'self'; frame-ancestors 'self';");
  header('Content-Type: text/html; charset=utf-8');
  echo '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">';
  echo '<title>' . pdf_template_escape_html($displayName . '.pdf') . '</title>';
  echo '<style>';
  echo 'html,body{margin:0;height:100%;background:#1f1f1f;color:#f4f4f4;font-family:Segoe UI,system-ui,sans-serif;}';
  echo '.topbar{height:48px;display:flex;align-items:center;gap:10px;padding:0 14px;background:#2b2b2b;border-bottom:1px solid #4b4b4b;}';
  echo '.name{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:14px;}';
  echo '.download{color:#fff;text-decoration:none;background:#5478ff;padding:7px 12px;border-radius:8px;font-weight:600;font-size:13px;}';
  echo 'iframe{width:100%;height:calc(100% - 48px);border:0;background:#2a2a2a;}';
  echo '</style></head><body>';
  echo '<div class="topbar"><div class="name">' . pdf_template_escape_html($displayName . '.pdf') . '</div><a class="download" href="' . pdf_template_escape_html($downloadUrl) . '">PDF herunterladen</a></div>';
  echo '<iframe src="' . pdf_template_escape_html($inlineUrl) . '#view=FitH"></iframe>';
  echo '</body></html>';
  exit;
}

if ($action === 'preview_session_pdf' && $method === 'GET') {
  $token = trim((string)($_GET['token'] ?? ''));
  $entry = $token !== '' ? pdf_template_preview_store_get($token) : null;
  if (!is_array($entry)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Preview not found';
    exit;
  }

  $toolKey = (string)($entry['tool_key'] ?? 'nti_tool');
  $payload = is_array($entry['payload'] ?? null) ? $entry['payload'] : [];
  $sampleData = is_array($entry['sample_data'] ?? null) ? $entry['sample_data'] : pdf_template_example_data($toolKey);
  $resolvedTitle = (string)($entry['resolved_title'] ?? 'PDF Vorschau');
  $pdf = pdf_template_render_pdf($payload, $sampleData, $resolvedTitle);
  $fileName = is_array($entry['file_name'] ?? null) ? $entry['file_name'] : pdf_template_build_download_filename($resolvedTitle, 'pdf-template-preview');
  $asciiName = (string)($fileName['ascii'] ?? 'pdf-template-preview');
  $displayName = (string)($fileName['display'] ?? 'pdf-template-preview');
  $download = (string)($_GET['download'] ?? '') === '1';
  $disposition = $download ? 'attachment' : 'inline';

  header("Content-Security-Policy: default-src 'none'; frame-ancestors 'self';");
  header('Content-Type: application/pdf');
  header('Content-Disposition: ' . $disposition . '; filename="' . $asciiName . '.pdf"; filename*=UTF-8\'\'' . rawurlencode($displayName . '.pdf'));
  header('Cache-Control: no-store');
  echo $pdf;
  exit;
}

if ($action === 'render_preview' && $method === 'POST') {
  $toolKey = trim((string)($input['tool_key'] ?? ''));
  $title = trim((string)($input['title'] ?? 'PDF-Vorschau'));
  $payloadInput = $input['payload'] ?? null;
  $sampleDataInput = $input['sample_data'] ?? null;

  if (is_string($payloadInput) && $payloadInput !== '') {
    try {
      $decodedPayload = json_decode($payloadInput, true, 512, JSON_THROW_ON_ERROR);
      if (is_array($decodedPayload)) {
        $payloadInput = $decodedPayload;
      }
    } catch (Throwable $e) {
      // Leave as-is; validation below will return missing_payload.
    }
  }

  if (is_string($sampleDataInput) && $sampleDataInput !== '') {
    try {
      $decodedSample = json_decode($sampleDataInput, true, 512, JSON_THROW_ON_ERROR);
      if (is_array($decodedSample)) {
        $sampleDataInput = $decodedSample;
      }
    } catch (Throwable $e) {
      // Ignore and use default sample data below.
    }
  }

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
  $resolvedTitle = pdf_template_resolve_title_template(
    (string)($payload['pdf_title_template'] ?? $title),
    $sampleData,
    $title
  );
  $pdf = pdf_template_render_pdf($payload, $sampleData, $resolvedTitle);
  $fileName = pdf_template_build_download_filename($resolvedTitle, 'pdf-template-preview');
  $asciiName = $fileName['ascii'];
  $displayName = $fileName['display'];

  header('Content-Type: application/pdf');
  header('Content-Disposition: inline; filename="' . $asciiName . '.pdf"; filename*=UTF-8\'\'' . rawurlencode($displayName . '.pdf'));
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
  $resolvedTitle = pdf_template_resolve_title_template(
    (string)($payload['pdf_title_template'] ?? $title),
    $data,
    $title
  );
  $pdf = pdf_template_render_pdf($payload, $data, $resolvedTitle);

  $fileName = pdf_template_build_download_filename($resolvedTitle, 'pdf-export');
  $asciiName = $fileName['ascii'];
  $displayName = $fileName['display'];

  header('Content-Type: application/pdf');
  header('Content-Disposition: attachment; filename="' . $asciiName . '.pdf"; filename*=UTF-8\'\'' . rawurlencode($displayName . '.pdf'));
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
  $resolvedTitle = pdf_template_resolve_title_template(
    (string)($payload['pdf_title_template'] ?? $title),
    $data,
    $title
  );
  $pdf = pdf_template_render_pdf($payload, $data, $resolvedTitle);

  $fileName = pdf_template_build_download_filename($resolvedTitle, 'pdf-export');
  $asciiName = $fileName['ascii'];
  $displayName = $fileName['display'];

  $disposition = strtolower(trim((string)($input['disposition'] ?? 'inline')));
  if (!in_array($disposition, ['inline', 'attachment'], true)) {
    $disposition = 'inline';
  }

  header('X-PDF-Template-Id: ' . (int)$row['id']);
  header('X-PDF-Template-Tool: ' . $toolKey);
  header('X-PDF-Template-Status: ' . (string)($row['status'] ?? 'draft'));
  header('Content-Type: application/pdf');
  header('Content-Disposition: ' . $disposition . '; filename="' . $asciiName . '.pdf"; filename*=UTF-8\'\'' . rawurlencode($displayName . '.pdf'));
  header('Cache-Control: no-store');
  echo $pdf;
  exit;
}

pdf_template_json_response(['ok' => false, 'error' => 'unknown_action'], 400);
