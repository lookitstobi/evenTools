<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/app/pdf_template_lib.php';

header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none';");

function pdf_api_json(array $payload, int $status = 200): never {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function pdf_api_read_json(): array {
  $ct = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
  if ($ct !== '' && strpos($ct, 'application/json') === false) {
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
    pdf_api_json(['ok' => false, 'error' => 'invalid_json'], 400);
  }
}

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$action = trim((string)($_GET['action'] ?? ''));

// ---------------------------------------------------------------------------
// Zugangskontrolle
// ---------------------------------------------------------------------------

$adminActions  = ['upload', 'save_fields', 'assign_tool', 'unassign_tool', 'delete', 'update_title', 'scan_acro_fields'];
$builderActions = ['list', 'get_meta', 'get_pdf', 'get_active_template', 'field_catalog', 'tool_keys'];

if (in_array($action, $adminActions, true)) {
  pdf_template_require_admin_tool_access();
} elseif (in_array($action, $builderActions, true)) {
  // get_active_template und get_pdf können auch vom Ziel-Tool aus aufgerufen werden.
  if ($action === 'get_active_template' || $action === 'get_pdf') {
    require_login();
    // Weitere Tool-Prüfung erfolgt innerhalb der Action.
  } else {
    pdf_template_require_tool_access('pdf_template_builder');
  }
} else {
  http_response_code(404);
  pdf_api_json(['ok' => false, 'error' => 'unknown_action'], 404);
}

// ---------------------------------------------------------------------------
// CSRF für alle mutierende POST-Requests
// ---------------------------------------------------------------------------

if ($method === 'POST') {
  $input = pdf_api_read_json();
  $token = (string)($input['csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''));
  if ($action !== 'upload') {
    // upload nutzt multipart/form-data, Token kommt dort als Form-Feld.
    require_csrf_token($token);
  }
} else {
  $input = [];
}

$db = pdf_template_db();

// ---------------------------------------------------------------------------
// Action: list — alle Templates (kein pdf_data)
// ---------------------------------------------------------------------------

if ($action === 'list') {
  pdf_api_json([
    'ok'    => true,
    'csrf'  => csrf_token(),
    'items' => pdf_upload_list($db),
  ]);
}

// ---------------------------------------------------------------------------
// Action: tool_keys — erlaubte Tool-Keys + Field-Catalog
// ---------------------------------------------------------------------------

if ($action === 'tool_keys') {
  pdf_api_json([
    'ok'           => true,
    'tool_keys'    => pdf_template_allowed_tool_keys(),
    'field_catalog' => pdf_template_field_catalog(),
  ]);
}

// ---------------------------------------------------------------------------
// Action: field_catalog
// ---------------------------------------------------------------------------

if ($action === 'field_catalog') {
  $toolKey = trim((string)($_GET['tool_key'] ?? ''));
  $catalog  = pdf_template_field_catalog();
  $fields   = $catalog[$toolKey] ?? [];
  pdf_api_json(['ok' => true, 'fields' => $fields]);
}

// ---------------------------------------------------------------------------
// Action: get_meta — Template-Metadaten + Felder (kein pdf_data)
// ---------------------------------------------------------------------------

if ($action === 'get_meta') {
  $id = (int)($_GET['id'] ?? 0);
  if ($id <= 0) {
    pdf_api_json(['ok' => false, 'error' => 'missing_id'], 400);
  }

  $meta = pdf_upload_get($db, $id);
  if ($meta === null) {
    pdf_api_json(['ok' => false, 'error' => 'not_found'], 404);
  }

  pdf_api_json(['ok' => true, 'item' => $meta]);
}

// ---------------------------------------------------------------------------
// Action: get_pdf — streamt das PDF-Binary
// ---------------------------------------------------------------------------

if ($action === 'get_pdf') {
  $id      = (int)($_GET['id'] ?? 0);
  $toolKey = trim((string)($_GET['tool_key'] ?? ''));

  if ($id <= 0) {
    pdf_api_json(['ok' => false, 'error' => 'missing_id'], 400);
  }

  // Zugang: Admin/builder-Zugang ODER Nutzer hat Zugang zum zugewiesenen Tool.
  if (!empty($_SESSION['is_admin'])) {
    // Admin darf immer.
  } elseif ($toolKey !== '') {
    // Prüfen ob Nutzer das Tool nutzen darf.
    $allowed = $_SESSION['tools'] ?? [];
    if (!is_array($allowed) || !in_array($toolKey, $allowed, true)) {
      http_response_code(403);
      exit;
    }
    // Prüfen ob dieses Template dem Tool zugewiesen ist.
    $active = pdf_upload_get_active_for_tool($db, $toolKey);
    if ($active === null || $active['id'] !== $id) {
      http_response_code(403);
      exit;
    }
  } else {
    // Kein Tool-Key → Builder-Tool-Zugang nötig.
    $allowed = $_SESSION['tools'] ?? [];
    if (!is_array($allowed) || !in_array('pdf_template_builder', $allowed, true)) {
      http_response_code(403);
      exit;
    }
  }

  $pdfBytes = pdf_upload_get_bytes($db, $id);
  if ($pdfBytes === null) {
    http_response_code(404);
    exit;
  }

  header('Content-Type: application/pdf');
  header('Content-Disposition: inline; filename="vorlage-' . $id . '.pdf"');
  header('Content-Length: ' . strlen($pdfBytes));
  header('Cache-Control: no-store');
  echo $pdfBytes;
  exit;
}

// ---------------------------------------------------------------------------
// Action: get_active_template — aktive Vorlage für ein Tool (kein pdf_data)
// ---------------------------------------------------------------------------

if ($action === 'get_active_template') {
  $toolKey = trim((string)($_GET['tool_key'] ?? ''));
  if ($toolKey === '') {
    pdf_api_json(['ok' => false, 'error' => 'missing_tool_key'], 400);
  }

  // Zugangscheck: Nutzer muss das Ziel-Tool nutzen dürfen.
  if (empty($_SESSION['is_admin'])) {
    $allowed = $_SESSION['tools'] ?? [];
    if (!is_array($allowed) || !in_array($toolKey, $allowed, true)) {
      http_response_code(403);
      pdf_api_json(['ok' => false, 'error' => 'forbidden'], 403);
    }
  }

  $active = pdf_upload_get_active_for_tool($db, $toolKey);
  if ($active === null) {
    pdf_api_json(['ok' => false, 'error' => 'no_template_assigned'], 404);
  }

  pdf_api_json(['ok' => true, 'template' => $active]);
}

// ---------------------------------------------------------------------------
// Action: upload — neue PDF-Vorlage hochladen (multipart/form-data)
// ---------------------------------------------------------------------------

if ($action === 'upload' && $method === 'POST') {
  // CSRF bei multipart via Form-Feld.
  $csrfToken = (string)($_POST['csrf'] ?? '');
  require_csrf_token($csrfToken);

  $title = trim((string)($_POST['title'] ?? ''));
  if ($title === '') {
    pdf_api_json(['ok' => false, 'error' => 'missing_title'], 400);
  }

  $file = $_FILES['pdf_file'] ?? null;
  if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    $errCode = is_array($file) ? (int)($file['error'] ?? -1) : -1;
    pdf_api_json(['ok' => false, 'error' => 'upload_error', 'code' => $errCode], 400);
  }

  $maxBytes = 15 * 1024 * 1024; // 15 MB
  $size = (int)($file['size'] ?? 0);
  if ($size > $maxBytes || $size === 0) {
    pdf_api_json(['ok' => false, 'error' => 'file_too_large'], 400);
  }

  $tmpPath = (string)($file['tmp_name'] ?? '');
  if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
    pdf_api_json(['ok' => false, 'error' => 'invalid_upload'], 400);
  }

  // Prüfen ob es ein gültiges PDF ist (Signatur %PDF-).
  $fh = fopen($tmpPath, 'rb');
  if ($fh === false) {
    pdf_api_json(['ok' => false, 'error' => 'read_error'], 500);
  }
  $sig = fread($fh, 5);
  fclose($fh);
  if ($sig !== '%PDF-') {
    pdf_api_json(['ok' => false, 'error' => 'not_a_pdf'], 400);
  }

  $pdfBytes = file_get_contents($tmpPath);
  if ($pdfBytes === false) {
    pdf_api_json(['ok' => false, 'error' => 'read_error'], 500);
  }

  $uid  = pdf_template_current_uid();
  $user = pdf_template_current_username();
  $id   = pdf_upload_save($db, $title, $pdfBytes, $uid, $user);

  pdf_api_json(['ok' => true, 'id' => $id]);
}

// ---------------------------------------------------------------------------
// Action: update_title
// ---------------------------------------------------------------------------

if ($action === 'update_title' && $method === 'POST') {
  $id    = (int)($input['id'] ?? 0);
  $title = trim((string)($input['title'] ?? ''));
  if ($id <= 0 || $title === '') {
    pdf_api_json(['ok' => false, 'error' => 'missing_params'], 400);
  }
  if (pdf_upload_get($db, $id) === null) {
    pdf_api_json(['ok' => false, 'error' => 'not_found'], 404);
  }
  pdf_upload_update_title($db, $id, $title);
  pdf_api_json(['ok' => true]);
}

// ---------------------------------------------------------------------------
// Action: save_fields
// ---------------------------------------------------------------------------

if ($action === 'save_fields' && $method === 'POST') {
  $id     = (int)($input['id'] ?? 0);
  $fields = $input['fields'] ?? [];
  if ($id <= 0) {
    pdf_api_json(['ok' => false, 'error' => 'missing_id'], 400);
  }
  if (!is_array($fields)) {
    pdf_api_json(['ok' => false, 'error' => 'invalid_fields'], 400);
  }
  if (pdf_upload_get($db, $id) === null) {
    pdf_api_json(['ok' => false, 'error' => 'not_found'], 404);
  }

  // Validierung: Binding-Keys gegen Katalog.
  $catalog   = pdf_template_field_catalog();
  $allKeys   = [];
  foreach ($catalog as $toolFields) {
    foreach ($toolFields as $f) {
      $allKeys[(string)$f['key']] = true;
    }
  }

  $sanitized = [];
  foreach ($fields as $f) {
    if (!is_array($f)) {
      continue;
    }
    $key = (string)($f['field'] ?? '');
    if ($key !== '' && !isset($allKeys[$key])) {
      pdf_api_json(['ok' => false, 'error' => 'invalid_field_key', 'key' => $key], 400);
    }
    // AcroForm-Einträge brauchen acro_field_name.
    if (($f['mode'] ?? '') === 'acro' && trim((string)($f['acro_field_name'] ?? '')) === '') {
      pdf_api_json(['ok' => false, 'error' => 'missing_acro_field_name'], 400);
    }
    $sanitized[] = $f;
  }

  pdf_upload_save_fields($db, $id, $sanitized);
  pdf_api_json(['ok' => true]);
}

// ---------------------------------------------------------------------------
// Action: scan_acro_fields — erkannte AcroForm-Feldnamen für eine Vorlage speichern
// ---------------------------------------------------------------------------

if ($action === 'scan_acro_fields' && $method === 'POST') {
  $id         = (int)($input['id'] ?? 0);
  $acroFields = $input['acro_fields'] ?? [];
  if ($id <= 0) {
    pdf_api_json(['ok' => false, 'error' => 'missing_id'], 400);
  }
  if (!is_array($acroFields)) {
    pdf_api_json(['ok' => false, 'error' => 'invalid_acro_fields'], 400);
  }
  if (pdf_upload_get($db, $id) === null) {
    pdf_api_json(['ok' => false, 'error' => 'not_found'], 404);
  }
  pdf_upload_save_detected_acro_fields($db, $id, $acroFields);
  pdf_api_json(['ok' => true]);
}

// ---------------------------------------------------------------------------
// Action: assign_tool
// ---------------------------------------------------------------------------

if ($action === 'assign_tool' && $method === 'POST') {
  $id      = (int)($input['id'] ?? 0);
  $toolKey = trim((string)($input['tool_key'] ?? ''));
  if ($id <= 0 || $toolKey === '') {
    pdf_api_json(['ok' => false, 'error' => 'missing_params'], 400);
  }
  if (!in_array($toolKey, pdf_template_allowed_tool_keys(), true)) {
    pdf_api_json(['ok' => false, 'error' => 'invalid_tool_key'], 400);
  }
  if (pdf_upload_get($db, $id) === null) {
    pdf_api_json(['ok' => false, 'error' => 'not_found'], 404);
  }
  pdf_upload_assign_tool($db, $toolKey, $id, pdf_template_current_username());
  pdf_api_json(['ok' => true]);
}

// ---------------------------------------------------------------------------
// Action: unassign_tool
// ---------------------------------------------------------------------------

if ($action === 'unassign_tool' && $method === 'POST') {
  $toolKey = trim((string)($input['tool_key'] ?? ''));
  if ($toolKey === '') {
    pdf_api_json(['ok' => false, 'error' => 'missing_tool_key'], 400);
  }
  pdf_upload_unassign_tool($db, $toolKey);
  pdf_api_json(['ok' => true]);
}

// ---------------------------------------------------------------------------
// Action: delete
// ---------------------------------------------------------------------------

if ($action === 'delete' && $method === 'POST') {
  $id = (int)($input['id'] ?? 0);
  if ($id <= 0) {
    pdf_api_json(['ok' => false, 'error' => 'missing_id'], 400);
  }
  if (pdf_upload_get($db, $id) === null) {
    pdf_api_json(['ok' => false, 'error' => 'not_found'], 404);
  }
  pdf_upload_delete($db, $id);
  pdf_api_json(['ok' => true]);
}

// Fallback (sollte nicht erreicht werden, da oben bereits 404 bei unbekannter Action).
pdf_api_json(['ok' => false, 'error' => 'method_not_allowed'], 405);
