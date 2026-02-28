<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/app/dguv_lib.php';

function dguv_json_response(array $payload, int $status = 200): never {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function dguv_read_json_input(): array {
  $raw = file_get_contents('php://input');
  if ($raw === false || $raw === '') {
    return [];
  }

  try {
    $parsed = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    return is_array($parsed) ? $parsed : [];
  } catch (Throwable $e) {
    dguv_json_response(['ok' => false, 'error' => 'invalid_json'], 400);
  }
}

function dguv_validate_agent_token(array $input): void {
  $config = require __DIR__ . '/app/config.php';
  $configured = trim((string)($config['dguv_agent_token'] ?? ''));
  $header = (string)($_SERVER['HTTP_X_DGUV_AGENT_TOKEN'] ?? '');
  $provided = trim((string)($input['agent_token'] ?? $header));

  if ($configured === '') {
    dguv_json_response(['ok' => false, 'error' => 'agent_token_not_configured'], 503);
  }

  if ($provided === '' || !hash_equals($configured, $provided)) {
    dguv_json_response(['ok' => false, 'error' => 'unauthorized_agent'], 403);
  }
}

function dguv_normalize_status(string $status): string {
  $allowed = ['offen', 'bestanden', 'nicht_bestanden'];
  return in_array($status, $allowed, true) ? $status : 'offen';
}

function dguv_next_asset_uid(PDO $db): string {
  $value = $db->query('SELECT MAX(CAST(asset_uid AS INTEGER)) FROM assets WHERE asset_uid GLOB "[0-9]*" AND deleted_at IS NULL')->fetchColumn();
  $max = is_numeric($value) ? (int)$value : 0;
  return (string)($max + 1);
}

function dguv_compose_location(string $customer, string $site, string $department, string $fallback = ''): string {
  $parts = array_values(array_filter([$customer, $site, $department], static fn(string $value): bool => $value !== ''));
  if ($parts !== []) {
    return implode(' / ', $parts);
  }
  return $fallback;
}

function dguv_is_valid_date(string $value): bool {
  return (bool)preg_match('/^\d{4}-\d{2}-\d{2}$/', $value);
}

function dguv_insert_inspection_record(PDO $db, int $assetId, array $payload, int $createdBy): int {
  $inspectionDate = trim((string)($payload['inspection_date'] ?? ''));
  if (!dguv_is_valid_date($inspectionDate)) {
    throw new RuntimeException('invalid_inspection_date');
  }

  $nextDue = trim((string)($payload['next_due_date'] ?? ''));
  if ($nextDue !== '' && !dguv_is_valid_date($nextDue)) {
    throw new RuntimeException('invalid_next_due_date');
  }

  $measured = $payload['measured_values'] ?? [];
  if (!is_array($measured)) {
    $measured = [];
  }

  $now = dguv_iso_now();
  $stmt = $db->prepare('INSERT INTO inspections (asset_id, inspection_date, next_due_date, result_status, measured_values_json, defects_text, inspector_name, source_type, source_ref, expires_at, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([
    $assetId,
    $inspectionDate,
    $nextDue !== '' ? $nextDue : null,
    dguv_normalize_status((string)($payload['result_status'] ?? 'offen')),
    json_encode($measured, JSON_THROW_ON_ERROR),
    trim((string)($payload['defects_text'] ?? '')),
    trim((string)($payload['inspector_name'] ?? '')),
    trim((string)($payload['source_type'] ?? 'manual')),
    trim((string)($payload['source_ref'] ?? '')),
    dguv_retention_expires_at($inspectionDate),
    $createdBy,
    $now,
    $now,
  ]);

  return (int)$db->lastInsertId();
}

function dguv_import_row(PDO $db, array $row, int $importRunId, string $sourceName, string $sourceFormat, int $createdBy): array {
  $assetUid = trim((string)($row['asset_uid'] ?? ''));
  $rowPayload = [
    'asset_uid' => $assetUid,
    'inspection_date' => trim((string)($row['inspection_date'] ?? '')),
    'next_due_date' => trim((string)($row['next_due_date'] ?? '')),
    'result_status' => trim((string)($row['result_status'] ?? 'offen')),
    'measured_values' => is_array($row['measured_values'] ?? null) ? $row['measured_values'] : [],
    'defects_text' => trim((string)($row['defects_text'] ?? '')),
    'inspector_name' => trim((string)($row['inspector_name'] ?? '')),
    'source_type' => trim((string)($row['source_type'] ?? 'device_import')),
    'source_ref' => trim((string)($row['source_ref'] ?? '')),
  ];

  if ($assetUid === '' || !dguv_is_valid_date($rowPayload['inspection_date'])) {
    $stmtStaging = $db->prepare('INSERT INTO import_staging (import_run_id, source_name, source_format, detected_asset_uid, payload_json, status, matched_asset_id, resolution_note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmtStaging->execute([
      $importRunId,
      $sourceName,
      $sourceFormat,
      $assetUid,
      json_encode($rowPayload, JSON_THROW_ON_ERROR),
      'invalid',
      null,
      'missing_asset_uid_or_invalid_inspection_date',
      $createdBy,
      dguv_iso_now(),
    ]);
    return ['created' => false, 'staged' => true, 'reason' => 'invalid'];
  }

  $stmtAsset = $db->prepare('SELECT id FROM assets WHERE asset_uid = ? AND deleted_at IS NULL LIMIT 1');
  $stmtAsset->execute([$assetUid]);
  $asset = $stmtAsset->fetch(PDO::FETCH_ASSOC);

  if (!$asset) {
    $stmtStaging = $db->prepare('INSERT INTO import_staging (import_run_id, source_name, source_format, detected_asset_uid, payload_json, status, matched_asset_id, resolution_note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmtStaging->execute([
      $importRunId,
      $sourceName,
      $sourceFormat,
      $assetUid,
      json_encode($rowPayload, JSON_THROW_ON_ERROR),
      'open',
      null,
      'asset_uid_not_found',
      $createdBy,
      dguv_iso_now(),
    ]);
    return ['created' => false, 'staged' => true, 'reason' => 'asset_not_found'];
  }

  dguv_insert_inspection_record($db, (int)$asset['id'], $rowPayload, $createdBy);
  return ['created' => true, 'staged' => false, 'reason' => 'matched'];
}

function dguv_get_rows_for_print(PDO $db, array $assetIds, string $filterText): array {
  $sql = 'SELECT
      a.id,
      a.asset_uid,
      a.asset_name,
      a.location,
  a.customer,
  a.site,
  a.department,
  a.autotest_code,
      a.device_type,
      a.manufacturer,
      a.model,
      a.serial_number,
      i.result_status,
      i.next_due_date,
      i.inspection_date
    FROM assets a
    LEFT JOIN inspections i ON i.id = (
      SELECT i2.id
      FROM inspections i2
      WHERE i2.asset_id = a.id AND i2.deleted_at IS NULL
      ORDER BY i2.inspection_date DESC, i2.id DESC
      LIMIT 1
    )
    WHERE a.deleted_at IS NULL';

  $params = [];

  if ($assetIds !== []) {
    $placeholders = implode(',', array_fill(0, count($assetIds), '?'));
    $sql .= ' AND a.id IN (' . $placeholders . ')';
    foreach ($assetIds as $id) {
      $params[] = (int)$id;
    }
  }

  $needle = trim($filterText);
  if ($needle !== '') {
    $sql .= ' AND (a.asset_uid LIKE ? OR a.asset_name LIKE ? OR a.location LIKE ? OR a.device_type LIKE ? OR a.customer LIKE ? OR a.site LIKE ? OR a.department LIKE ? OR a.autotest_code LIKE ?)';
    $like = '%' . $needle . '%';
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
  }

  $sql .= ' ORDER BY a.asset_uid ASC';

  $stmt = $db->prepare($sql);
  $stmt->execute($params);
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

  foreach ($rows as &$row) {
    $row['barcode_value'] = 'DGUV-' . (string)$row['asset_uid'];
    $row['inspection_result'] = (string)($row['result_status'] ?? 'offen');
    $row['next_due_date'] = (string)($row['next_due_date'] ?? '');
  }

  return $rows;
}

function dguv_build_csv(array $rows, array $mapping, string $delimiter, string $enclosure, string $linebreak): string {
  $allowedKeys = [
    'asset_uid',
    'asset_name',
    'location',
    'customer',
    'site',
    'department',
    'autotest_code',
    'device_type',
    'manufacturer',
    'model',
    'serial_number',
    'inspection_result',
    'inspection_date',
    'next_due_date',
    'barcode_value',
  ];

  if ($mapping === []) {
    $mapping = [
      ['header' => 'Barcode', 'source' => 'barcode_value'],
      ['header' => 'Inventarnummer', 'source' => 'asset_uid'],
      ['header' => 'Name', 'source' => 'asset_name'],
      ['header' => 'Standort', 'source' => 'location'],
      ['header' => 'Naechste Pruefung', 'source' => 'next_due_date'],
    ];
  }

  $delimiter = $delimiter !== '' ? mb_substr($delimiter, 0, 1) : ';';
  $enclosure = $enclosure !== '' ? mb_substr($enclosure, 0, 1) : '"';
  $linebreak = $linebreak === '\\r\\n' ? "\r\n" : "\n";

  $fp = fopen('php://temp', 'w+');
  if ($fp === false) {
    return '';
  }

  $headers = [];
  $sources = [];
  foreach ($mapping as $entry) {
    $header = trim((string)($entry['header'] ?? ''));
    $source = trim((string)($entry['source'] ?? ''));
    if ($header === '' || !in_array($source, $allowedKeys, true)) {
      continue;
    }
    $headers[] = $header;
    $sources[] = $source;
  }

  if ($headers === []) {
    $headers = ['Barcode', 'Inventarnummer'];
    $sources = ['barcode_value', 'asset_uid'];
  }

  fputcsv($fp, $headers, $delimiter, $enclosure);

  foreach ($rows as $row) {
    $line = [];
    foreach ($sources as $source) {
      $line[] = (string)($row[$source] ?? '');
    }
    fputcsv($fp, $line, $delimiter, $enclosure);
  }

  rewind($fp);
  $csv = stream_get_contents($fp);
  fclose($fp);

  if ($csv === false) {
    return '';
  }

  if ($linebreak !== "\n") {
    $csv = str_replace("\n", $linebreak, $csv);
  }

  return $csv;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$input = $method === 'POST' ? dguv_read_json_input() : [];
$action = (string)($_GET['action'] ?? $input['action'] ?? '');

$agentActions = ['agent_claim_job', 'agent_finish_job', 'agent_claim_device_job', 'agent_finish_device_job', 'agent_push_import'];
if (in_array($action, $agentActions, true)) {
  dguv_validate_agent_token($input);
} else {
  dguv_require_tool_access();
  if ($method === 'POST') {
    $token = (string)($input['csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''));
    require_csrf_token($token);
  }
}

$db = dguv_db();

if ($action === 'bootstrap') {
  $profiles = $db->query('SELECT id, profile_name, delimiter, enclosure, linebreak, mapping_json FROM print_profiles ORDER BY profile_name ASC')
    ->fetchAll(PDO::FETCH_ASSOC);

  dguv_json_response([
    'ok' => true,
    'csrf' => csrf_token(),
    'print_profiles' => array_map(static function(array $profile): array {
      $profile['mapping'] = dguv_json_decode_array((string)($profile['mapping_json'] ?? '[]'));
      unset($profile['mapping_json']);
      return $profile;
    }, $profiles),
  ]);
}

if ($action === 'list_assets') {
  $search = trim((string)($_GET['q'] ?? ''));

  $sql = 'SELECT
      a.id,
      a.asset_uid,
      a.asset_name,
      a.location,
      a.customer,
      a.site,
      a.department,
      a.autotest_code,
      a.device_type,
      a.manufacturer,
      a.model,
      a.serial_number,
      a.updated_at,
      i.inspection_date,
      i.next_due_date,
      i.result_status
    FROM assets a
    LEFT JOIN inspections i ON i.id = (
      SELECT i2.id
      FROM inspections i2
      WHERE i2.asset_id = a.id AND i2.deleted_at IS NULL
      ORDER BY i2.inspection_date DESC, i2.id DESC
      LIMIT 1
    )
    WHERE a.deleted_at IS NULL';

  $params = [];
  if ($search !== '') {
    $sql .= ' AND (a.asset_uid LIKE ? OR a.asset_name LIKE ? OR a.location LIKE ? OR a.device_type LIKE ? OR a.customer LIKE ? OR a.site LIKE ? OR a.department LIKE ? OR a.autotest_code LIKE ?)';
    $needle = '%' . $search . '%';
    $params[] = $needle;
    $params[] = $needle;
    $params[] = $needle;
    $params[] = $needle;
    $params[] = $needle;
    $params[] = $needle;
    $params[] = $needle;
    $params[] = $needle;
  }

  $sql .= ' ORDER BY a.asset_uid ASC LIMIT 250';

  $stmt = $db->prepare($sql);
  $stmt->execute($params);
  $assets = $stmt->fetchAll(PDO::FETCH_ASSOC);

  dguv_json_response(['ok' => true, 'assets' => $assets]);
}

if ($action === 'next_asset_uid') {
  dguv_json_response(['ok' => true, 'asset_uid' => dguv_next_asset_uid($db)]);
}

if ($action === 'create_asset' && $method === 'POST') {
  $assetUid = trim((string)($input['asset_uid'] ?? ''));
  if ($assetUid === '') {
    $assetUid = dguv_next_asset_uid($db);
  }
  $assetName = trim((string)($input['asset_name'] ?? ''));
  $customer = trim((string)($input['customer'] ?? ''));
  $site = trim((string)($input['site'] ?? ''));
  $department = trim((string)($input['department'] ?? ''));
  $location = dguv_compose_location($customer, $site, $department, trim((string)($input['location'] ?? '')));
  $deviceType = trim((string)($input['device_type'] ?? ''));
  $autotestCode = trim((string)($input['autotest_code'] ?? ''));

  if ($assetUid === '' || $assetName === '' || $location === '' || $deviceType === '' || $customer === '' || $site === '' || $department === '' || $autotestCode === '') {
    dguv_json_response(['ok' => false, 'error' => 'missing_required_fields'], 400);
  }

  $now = dguv_iso_now();

  try {
    $stmt = $db->prepare('INSERT INTO assets (asset_uid, asset_name, location, customer, site, department, autotest_code, device_type, manufacturer, model, serial_number, notes, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
      $assetUid,
      $assetName,
      $location,
      $customer,
      $site,
      $department,
      $autotestCode,
      $deviceType,
      trim((string)($input['manufacturer'] ?? '')),
      trim((string)($input['model'] ?? '')),
      trim((string)($input['serial_number'] ?? '')),
      trim((string)($input['notes'] ?? '')),
      (int)($_SESSION['uid'] ?? 0),
      $now,
      $now,
    ]);
  } catch (Throwable $e) {
    dguv_json_response(['ok' => false, 'error' => 'asset_uid_exists'], 409);
  }

  $assetId = (int)$db->lastInsertId();
  dguv_audit($db, 'create_asset', 'asset', (string)$assetId, [
    'asset_uid' => $assetUid,
    'customer' => $customer,
    'site' => $site,
    'department' => $department,
    'autotest_code' => $autotestCode,
  ]);

  $response = ['ok' => true, 'asset_id' => $assetId];
  $printAfterCreate = !empty($input['print_after_create']);
  if ($printAfterCreate) {
    $rows = dguv_get_rows_for_print($db, [$assetId], '');
    $csv = dguv_build_csv($rows, [], ';', '"', '\\n');
    $stmtJob = $db->prepare('INSERT INTO print_jobs (job_mode, print_profile_id, filter_text, selected_ids_json, csv_payload, status, requested_by, requested_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $stmtJob->execute([
      (string)($input['print_job_mode'] ?? 'open_only') === 'print_now' ? 'print_now' : 'open_only',
      null,
      '',
      json_encode([$assetId], JSON_THROW_ON_ERROR),
      $csv,
      'queued',
      (int)($_SESSION['uid'] ?? 0),
      dguv_iso_now(),
    ]);
    $response['print_job_id'] = (int)$db->lastInsertId();
  }

  dguv_json_response($response);
}

if ($action === 'create_inspection' && $method === 'POST') {
  $assetId = (int)($input['asset_id'] ?? 0);
  $inspectionDate = trim((string)($input['inspection_date'] ?? ''));
  $resultStatus = dguv_normalize_status((string)($input['result_status'] ?? 'offen'));

  if ($assetId <= 0 || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $inspectionDate)) {
    dguv_json_response(['ok' => false, 'error' => 'invalid_inspection_payload'], 400);
  }

  $stmtAsset = $db->prepare('SELECT id FROM assets WHERE id = ? AND deleted_at IS NULL');
  $stmtAsset->execute([$assetId]);
  if (!$stmtAsset->fetch(PDO::FETCH_ASSOC)) {
    dguv_json_response(['ok' => false, 'error' => 'asset_not_found'], 404);
  }

  $nextDue = trim((string)($input['next_due_date'] ?? ''));
  if ($nextDue !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $nextDue)) {
    dguv_json_response(['ok' => false, 'error' => 'invalid_next_due_date'], 400);
  }

  $measured = $input['measured_values'] ?? [];
  if (!is_array($measured)) {
    $measured = [];
  }

  $now = dguv_iso_now();

  $stmt = $db->prepare('INSERT INTO inspections (asset_id, inspection_date, next_due_date, result_status, measured_values_json, defects_text, inspector_name, source_type, source_ref, expires_at, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([
    $assetId,
    $inspectionDate,
    $nextDue !== '' ? $nextDue : null,
    $resultStatus,
    json_encode($measured, JSON_THROW_ON_ERROR),
    trim((string)($input['defects_text'] ?? '')),
    trim((string)($input['inspector_name'] ?? '')),
    trim((string)($input['source_type'] ?? 'manual')),
    trim((string)($input['source_ref'] ?? '')),
    dguv_retention_expires_at($inspectionDate),
    (int)($_SESSION['uid'] ?? 0),
    $now,
    $now,
  ]);

  $inspectionId = (int)$db->lastInsertId();
  dguv_audit($db, 'create_inspection', 'inspection', (string)$inspectionId, ['asset_id' => $assetId]);

  dguv_json_response(['ok' => true, 'inspection_id' => $inspectionId]);
}

if ($action === 'import_upload' && $method === 'POST') {
  $rows = $input['rows'] ?? [];
  if (!is_array($rows)) {
    dguv_json_response(['ok' => false, 'error' => 'invalid_import_rows'], 400);
  }

  $sourceName = trim((string)($input['source_name'] ?? 'manual_import'));
  $sourceFormat = trim((string)($input['source_format'] ?? 'json'));
  $rawPayload = json_encode($rows, JSON_THROW_ON_ERROR);

  $stmtRun = $db->prepare('INSERT INTO import_runs (source_name, source_hash, source_format, imported_count, warning_count, status, raw_payload, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $stmtRun->execute([
    $sourceName,
    hash('sha256', $rawPayload),
    $sourceFormat,
    0,
    0,
    'running',
    $rawPayload,
    (int)($_SESSION['uid'] ?? 0),
    dguv_iso_now(),
  ]);

  $runId = (int)$db->lastInsertId();
  $createdCount = 0;
  $stagedCount = 0;

  foreach ($rows as $row) {
    if (!is_array($row)) {
      $stagedCount++;
      $stmtStaging = $db->prepare('INSERT INTO import_staging (import_run_id, source_name, source_format, detected_asset_uid, payload_json, status, matched_asset_id, resolution_note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      $stmtStaging->execute([
        $runId,
        $sourceName,
        $sourceFormat,
        '',
        json_encode(['raw' => $row], JSON_THROW_ON_ERROR),
        'invalid',
        null,
        'row_not_object',
        (int)($_SESSION['uid'] ?? 0),
        dguv_iso_now(),
      ]);
      continue;
    }

    $result = dguv_import_row($db, $row, $runId, $sourceName, $sourceFormat, (int)($_SESSION['uid'] ?? 0));
    if (!empty($result['created'])) {
      $createdCount++;
    }
    if (!empty($result['staged'])) {
      $stagedCount++;
    }
  }

  $stmtFinish = $db->prepare('UPDATE import_runs SET imported_count = ?, warning_count = ?, status = ? WHERE id = ?');
  $stmtFinish->execute([$createdCount, $stagedCount, 'done', $runId]);

  dguv_audit($db, 'import_upload', 'import_run', (string)$runId, [
    'created_count' => $createdCount,
    'staged_count' => $stagedCount,
    'source_name' => $sourceName,
    'source_format' => $sourceFormat,
  ]);

  dguv_json_response(['ok' => true, 'import_run_id' => $runId, 'created_count' => $createdCount, 'staged_count' => $stagedCount]);
}

if ($action === 'list_import_staging') {
  $status = trim((string)($_GET['status'] ?? 'open'));
  $allowed = ['open', 'invalid', 'resolved', 'all'];
  if (!in_array($status, $allowed, true)) {
    $status = 'open';
  }

  $limit = (int)($_GET['limit'] ?? 100);
  if ($limit < 1 || $limit > 500) {
    $limit = 100;
  }

  $sql = 'SELECT s.id, s.import_run_id, s.source_name, s.source_format, s.detected_asset_uid, s.status, s.resolution_note, s.created_at, s.resolved_at, s.matched_asset_id, a.asset_uid AS matched_asset_uid, a.asset_name AS matched_asset_name FROM import_staging s LEFT JOIN assets a ON a.id = s.matched_asset_id';
  $params = [];
  if ($status !== 'all') {
    $sql .= ' WHERE s.status = ?';
    $params[] = $status;
  }
  $sql .= ' ORDER BY s.id DESC LIMIT ?';

  $stmt = $db->prepare($sql);
  $index = 1;
  foreach ($params as $param) {
    $stmt->bindValue($index++, $param, PDO::PARAM_STR);
  }
  $stmt->bindValue($index, $limit, PDO::PARAM_INT);
  $stmt->execute();

  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
  dguv_json_response(['ok' => true, 'items' => $rows]);
}

if ($action === 'resolve_import_staging' && $method === 'POST') {
  $stagingId = (int)($input['staging_id'] ?? 0);
  $assetId = (int)($input['asset_id'] ?? 0);
  if ($stagingId <= 0 || $assetId <= 0) {
    dguv_json_response(['ok' => false, 'error' => 'invalid_resolve_payload'], 400);
  }

  $stmtStage = $db->prepare('SELECT id, status, payload_json FROM import_staging WHERE id = ? LIMIT 1');
  $stmtStage->execute([$stagingId]);
  $stage = $stmtStage->fetch(PDO::FETCH_ASSOC);
  if (!$stage) {
    dguv_json_response(['ok' => false, 'error' => 'staging_not_found'], 404);
  }
  if ((string)$stage['status'] === 'resolved') {
    dguv_json_response(['ok' => false, 'error' => 'staging_already_resolved'], 409);
  }

  $stmtAsset = $db->prepare('SELECT id FROM assets WHERE id = ? AND deleted_at IS NULL LIMIT 1');
  $stmtAsset->execute([$assetId]);
  $asset = $stmtAsset->fetch(PDO::FETCH_ASSOC);
  if (!$asset) {
    dguv_json_response(['ok' => false, 'error' => 'asset_not_found'], 404);
  }

  $payload = dguv_json_decode_array((string)$stage['payload_json']);
  try {
    $inspectionId = dguv_insert_inspection_record($db, (int)$asset['id'], $payload, (int)($_SESSION['uid'] ?? 0));
  } catch (Throwable $e) {
    dguv_json_response(['ok' => false, 'error' => 'resolve_failed_' . $e->getMessage()], 400);
  }

  $stmtUpdate = $db->prepare('UPDATE import_staging SET status = ?, matched_asset_id = ?, resolution_note = ?, resolved_at = ? WHERE id = ?');
  $stmtUpdate->execute(['resolved', $assetId, 'manually_matched', dguv_iso_now(), $stagingId]);

  dguv_audit($db, 'resolve_import_staging', 'import_staging', (string)$stagingId, ['asset_id' => $assetId, 'inspection_id' => $inspectionId]);
  dguv_json_response(['ok' => true, 'inspection_id' => $inspectionId]);
}

if ($action === 'queue_device_export' && $method === 'POST') {
  $selectedIds = $input['selected_ids'] ?? [];
  if (!is_array($selectedIds)) {
    $selectedIds = [];
  }
  $selectedIds = array_values(array_unique(array_map('intval', $selectedIds)));
  $filterText = trim((string)($input['filter_text'] ?? ''));
  $sourceFormat = trim((string)($input['source_format'] ?? 'json'));

  $rows = dguv_get_rows_for_print($db, $selectedIds, $filterText);
  if ($rows === []) {
    dguv_json_response(['ok' => false, 'error' => 'no_rows_for_export'], 400);
  }

  $payload = [];
  foreach ($rows as $row) {
    $payload[] = [
      'asset_uid' => (string)($row['asset_uid'] ?? ''),
      'asset_name' => (string)($row['asset_name'] ?? ''),
      'device_type' => (string)($row['device_type'] ?? ''),
      'customer' => (string)($row['customer'] ?? ''),
      'site' => (string)($row['site'] ?? ''),
      'department' => (string)($row['department'] ?? ''),
      'autotest_code' => (string)($row['autotest_code'] ?? ''),
      'barcode_value' => (string)($row['barcode_value'] ?? ''),
    ];
  }

  $stmt = $db->prepare('INSERT INTO device_jobs (job_type, transport_mode, source_format, selected_ids_json, filter_text, payload_json, status, requested_by, requested_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([
    'export',
    'agent',
    $sourceFormat,
    json_encode($selectedIds, JSON_THROW_ON_ERROR),
    $filterText,
    json_encode($payload, JSON_THROW_ON_ERROR),
    'queued',
    (int)($_SESSION['uid'] ?? 0),
    dguv_iso_now(),
  ]);

  $jobId = (int)$db->lastInsertId();
  dguv_audit($db, 'queue_device_export', 'device_job', (string)$jobId, ['row_count' => count($payload)]);
  dguv_json_response(['ok' => true, 'job_id' => $jobId, 'row_count' => count($payload)]);
}

if ($action === 'list_device_jobs') {
  $limit = (int)($_GET['limit'] ?? 30);
  if ($limit < 1 || $limit > 200) {
    $limit = 30;
  }

  $stmt = $db->prepare('SELECT id, job_type, source_format, status, requested_at, started_at, finished_at, error_text, agent_name, selected_ids_json FROM device_jobs ORDER BY id DESC LIMIT ?');
  $stmt->bindValue(1, $limit, PDO::PARAM_INT);
  $stmt->execute();
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

  foreach ($rows as &$row) {
    $selected = dguv_json_decode_array((string)($row['selected_ids_json'] ?? '[]'));
    $row['selected_count'] = count($selected);
    unset($row['selected_ids_json']);
  }

  dguv_json_response(['ok' => true, 'jobs' => $rows]);
}

if ($action === 'agent_claim_device_job' && $method === 'POST') {
  $agentName = trim((string)($input['agent_name'] ?? 'unknown-agent'));

  $db->beginTransaction();
  try {
    $stmt = $db->query('SELECT id, job_type, source_format, payload_json FROM device_jobs WHERE status = "queued" ORDER BY id ASC LIMIT 1');
    $job = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$job) {
      $db->commit();
      dguv_json_response(['ok' => true, 'job' => null]);
    }

    $update = $db->prepare('UPDATE device_jobs SET status = ?, started_at = ?, agent_name = ? WHERE id = ? AND status = "queued"');
    $update->execute(['running', dguv_iso_now(), $agentName, (int)$job['id']]);

    if ($update->rowCount() !== 1) {
      $db->rollBack();
      dguv_json_response(['ok' => true, 'job' => null]);
    }

    $db->commit();
  } catch (Throwable $e) {
    if ($db->inTransaction()) {
      $db->rollBack();
    }
    dguv_json_response(['ok' => false, 'error' => 'device_claim_failed'], 500);
  }

  dguv_json_response([
    'ok' => true,
    'job' => [
      'id' => (int)$job['id'],
      'job_type' => (string)$job['job_type'],
      'source_format' => (string)$job['source_format'],
      'payload' => dguv_json_decode_array((string)$job['payload_json']),
    ],
  ]);
}

if ($action === 'agent_finish_device_job' && $method === 'POST') {
  $jobId = (int)($input['job_id'] ?? 0);
  $success = !empty($input['success']);
  $errorText = trim((string)($input['error_text'] ?? ''));
  $meta = $input['agent_meta'] ?? [];
  if (!is_array($meta)) {
    $meta = [];
  }

  if ($jobId <= 0) {
    dguv_json_response(['ok' => false, 'error' => 'invalid_job_id'], 400);
  }

  $status = $success ? 'done' : 'failed';
  $stmt = $db->prepare('UPDATE device_jobs SET status = ?, finished_at = ?, error_text = ?, agent_meta_json = ? WHERE id = ?');
  $stmt->execute([
    $status,
    dguv_iso_now(),
    $errorText,
    json_encode($meta, JSON_THROW_ON_ERROR),
    $jobId,
  ]);

  dguv_json_response(['ok' => true]);
}

if ($action === 'agent_push_import' && $method === 'POST') {
  $rows = $input['rows'] ?? [];
  if (!is_array($rows)) {
    dguv_json_response(['ok' => false, 'error' => 'invalid_import_rows'], 400);
  }

  $sourceName = trim((string)($input['source_name'] ?? 'device_agent'));
  $sourceFormat = trim((string)($input['source_format'] ?? 'json'));

  $stmtRun = $db->prepare('INSERT INTO import_runs (source_name, source_hash, source_format, imported_count, warning_count, status, raw_payload, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  $payloadRaw = json_encode($rows, JSON_THROW_ON_ERROR);
  $stmtRun->execute([
    $sourceName,
    hash('sha256', $payloadRaw),
    $sourceFormat,
    0,
    0,
    'running',
    $payloadRaw,
    0,
    dguv_iso_now(),
  ]);

  $runId = (int)$db->lastInsertId();
  $createdCount = 0;
  $stagedCount = 0;
  foreach ($rows as $row) {
    if (!is_array($row)) {
      $stagedCount++;
      continue;
    }
    $result = dguv_import_row($db, $row, $runId, $sourceName, $sourceFormat, 0);
    if (!empty($result['created'])) {
      $createdCount++;
    }
    if (!empty($result['staged'])) {
      $stagedCount++;
    }
  }

  $stmtFinish = $db->prepare('UPDATE import_runs SET imported_count = ?, warning_count = ?, status = ? WHERE id = ?');
  $stmtFinish->execute([$createdCount, $stagedCount, 'done', $runId]);

  dguv_json_response(['ok' => true, 'import_run_id' => $runId, 'created_count' => $createdCount, 'staged_count' => $stagedCount]);
}

if ($action === 'batch_update_meta' && $method === 'POST') {
  $assetIds = $input['asset_ids'] ?? [];
  if (!is_array($assetIds) || $assetIds === []) {
    dguv_json_response(['ok' => false, 'error' => 'missing_asset_ids'], 400);
  }
  $assetIds = array_values(array_unique(array_map('intval', $assetIds)));

  $allowedFields = ['device_type', 'autotest_code', 'manufacturer', 'model', 'notes'];
  $updates = $input['updates'] ?? [];
  if (!is_array($updates) || $updates === []) {
    dguv_json_response(['ok' => false, 'error' => 'missing_updates'], 400);
  }

  $setParts = [];
  $params = [];
  foreach ($allowedFields as $field) {
    if (!array_key_exists($field, $updates)) {
      continue;
    }
    $setParts[] = $field . ' = ?';
    $params[] = trim((string)$updates[$field]);
  }

  if ($setParts === []) {
    dguv_json_response(['ok' => false, 'error' => 'no_allowed_update_fields'], 400);
  }

  $setParts[] = 'updated_at = ?';
  $params[] = dguv_iso_now();

  $placeholders = implode(',', array_fill(0, count($assetIds), '?'));
  $sql = 'UPDATE assets SET ' . implode(', ', $setParts) . ' WHERE deleted_at IS NULL AND id IN (' . $placeholders . ')';
  $stmt = $db->prepare($sql);
  $stmt->execute(array_merge($params, $assetIds));

  dguv_audit($db, 'batch_update_meta', 'asset', 'bulk', ['asset_count' => count($assetIds), 'fields' => array_keys($updates)]);
  dguv_json_response(['ok' => true, 'updated' => $stmt->rowCount()]);
}

if ($action === 'batch_move_hierarchy' && $method === 'POST') {
  $assetIds = $input['asset_ids'] ?? [];
  if (!is_array($assetIds) || $assetIds === []) {
    dguv_json_response(['ok' => false, 'error' => 'missing_asset_ids'], 400);
  }
  $assetIds = array_values(array_unique(array_map('intval', $assetIds)));

  $customer = trim((string)($input['customer'] ?? ''));
  $site = trim((string)($input['site'] ?? ''));
  $department = trim((string)($input['department'] ?? ''));
  if ($customer === '' || $site === '' || $department === '') {
    dguv_json_response(['ok' => false, 'error' => 'missing_hierarchy_fields'], 400);
  }

  $location = dguv_compose_location($customer, $site, $department, '');

  $placeholders = implode(',', array_fill(0, count($assetIds), '?'));
  $sql = 'UPDATE assets SET customer = ?, site = ?, department = ?, location = ?, updated_at = ? WHERE deleted_at IS NULL AND id IN (' . $placeholders . ')';
  $stmt = $db->prepare($sql);
  $stmt->execute(array_merge([$customer, $site, $department, $location, dguv_iso_now()], $assetIds));

  dguv_audit($db, 'batch_move_hierarchy', 'asset', 'bulk', [
    'asset_count' => count($assetIds),
    'customer' => $customer,
    'site' => $site,
    'department' => $department,
  ]);

  dguv_json_response(['ok' => true, 'updated' => $stmt->rowCount()]);
}

if ($action === 'create_print_profile' && $method === 'POST') {
  $profileName = trim((string)($input['profile_name'] ?? ''));
  $mapping = $input['mapping'] ?? [];

  if ($profileName === '' || !is_array($mapping)) {
    dguv_json_response(['ok' => false, 'error' => 'invalid_profile_payload'], 400);
  }

  $delimiter = (string)($input['delimiter'] ?? ';');
  $enclosure = (string)($input['enclosure'] ?? '"');
  $linebreak = (string)($input['linebreak'] ?? '\\n');

  $now = dguv_iso_now();

  $stmt = $db->prepare('INSERT INTO print_profiles (profile_name, delimiter, enclosure, linebreak, mapping_json, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(profile_name) DO UPDATE SET delimiter = excluded.delimiter, enclosure = excluded.enclosure, linebreak = excluded.linebreak, mapping_json = excluded.mapping_json, updated_at = excluded.updated_at');

  $stmt->execute([
    $profileName,
    $delimiter,
    $enclosure,
    $linebreak,
    json_encode($mapping, JSON_THROW_ON_ERROR),
    (int)($_SESSION['uid'] ?? 0),
    $now,
    $now,
  ]);

  dguv_audit($db, 'upsert_print_profile', 'print_profile', $profileName, ['mapping_count' => count($mapping)]);
  dguv_json_response(['ok' => true]);
}

if ($action === 'queue_print_job' && $method === 'POST') {
  $mode = (string)($input['job_mode'] ?? 'open_only');
  if (!in_array($mode, ['open_only', 'print_now'], true)) {
    $mode = 'open_only';
  }

  $selectedIds = $input['selected_ids'] ?? [];
  if (!is_array($selectedIds)) {
    $selectedIds = [];
  }
  $selectedIds = array_values(array_unique(array_map('intval', $selectedIds)));

  $filterText = trim((string)($input['filter_text'] ?? ''));
  $profileId = (int)($input['print_profile_id'] ?? 0);

  $profile = null;
  if ($profileId > 0) {
    $stmtProfile = $db->prepare('SELECT id, profile_name, delimiter, enclosure, linebreak, mapping_json FROM print_profiles WHERE id = ?');
    $stmtProfile->execute([$profileId]);
    $profile = $stmtProfile->fetch(PDO::FETCH_ASSOC) ?: null;
  }

  $mapping = $profile ? dguv_json_decode_array((string)$profile['mapping_json']) : [];
  $delimiter = $profile ? (string)$profile['delimiter'] : ';';
  $enclosure = $profile ? (string)$profile['enclosure'] : '"';
  $linebreak = $profile ? (string)$profile['linebreak'] : '\\n';

  $rows = dguv_get_rows_for_print($db, $selectedIds, $filterText);
  if ($rows === []) {
    dguv_json_response(['ok' => false, 'error' => 'no_rows_for_print'], 400);
  }

  $csv = dguv_build_csv($rows, $mapping, $delimiter, $enclosure, $linebreak);

  $stmt = $db->prepare('INSERT INTO print_jobs (job_mode, print_profile_id, filter_text, selected_ids_json, csv_payload, status, requested_by, requested_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([
    $mode,
    $profileId > 0 ? $profileId : null,
    $filterText,
    json_encode($selectedIds, JSON_THROW_ON_ERROR),
    $csv,
    'queued',
    (int)($_SESSION['uid'] ?? 0),
    dguv_iso_now(),
  ]);

  $jobId = (int)$db->lastInsertId();
  dguv_audit($db, 'queue_print_job', 'print_job', (string)$jobId, [
    'mode' => $mode,
    'row_count' => count($rows),
    'selected_count' => count($selectedIds),
  ]);

  dguv_json_response(['ok' => true, 'job_id' => $jobId, 'row_count' => count($rows)]);
}

if ($action === 'list_jobs') {
  $limit = (int)($_GET['limit'] ?? 30);
  if ($limit < 1 || $limit > 200) {
    $limit = 30;
  }

  $stmt = $db->prepare('SELECT id, job_mode, status, requested_at, started_at, finished_at, error_text, agent_name, selected_ids_json FROM print_jobs ORDER BY id DESC LIMIT ?');
  $stmt->bindValue(1, $limit, PDO::PARAM_INT);
  $stmt->execute();
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

  foreach ($rows as &$row) {
    $selected = dguv_json_decode_array((string)($row['selected_ids_json'] ?? '[]'));
    $row['selected_count'] = count($selected);
    unset($row['selected_ids_json']);
  }

  dguv_json_response(['ok' => true, 'jobs' => $rows]);
}

if ($action === 'agent_claim_job' && $method === 'POST') {
  $agentName = trim((string)($input['agent_name'] ?? 'unknown-agent'));

  $db->beginTransaction();
  try {
    $stmt = $db->query('SELECT id, job_mode, csv_payload FROM print_jobs WHERE status = "queued" ORDER BY id ASC LIMIT 1');
    $job = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$job) {
      $db->commit();
      dguv_json_response(['ok' => true, 'job' => null]);
    }

    $update = $db->prepare('UPDATE print_jobs SET status = ?, started_at = ?, agent_name = ? WHERE id = ? AND status = "queued"');
    $update->execute(['running', dguv_iso_now(), $agentName, (int)$job['id']]);

    if ($update->rowCount() !== 1) {
      $db->rollBack();
      dguv_json_response(['ok' => true, 'job' => null]);
    }

    $db->commit();
  } catch (Throwable $e) {
    if ($db->inTransaction()) {
      $db->rollBack();
    }
    dguv_json_response(['ok' => false, 'error' => 'claim_failed'], 500);
  }

  dguv_json_response([
    'ok' => true,
    'job' => [
      'id' => (int)$job['id'],
      'mode' => (string)$job['job_mode'],
      'csv_payload' => (string)$job['csv_payload'],
    ],
  ]);
}

if ($action === 'agent_finish_job' && $method === 'POST') {
  $jobId = (int)($input['job_id'] ?? 0);
  $success = !empty($input['success']);
  $errorText = trim((string)($input['error_text'] ?? ''));
  $meta = $input['agent_meta'] ?? [];
  if (!is_array($meta)) {
    $meta = [];
  }

  if ($jobId <= 0) {
    dguv_json_response(['ok' => false, 'error' => 'invalid_job_id'], 400);
  }

  $status = $success ? 'done' : 'failed';
  $stmt = $db->prepare('UPDATE print_jobs SET status = ?, finished_at = ?, error_text = ?, agent_meta_json = ? WHERE id = ?');
  $stmt->execute([
    $status,
    dguv_iso_now(),
    $errorText,
    json_encode($meta, JSON_THROW_ON_ERROR),
    $jobId,
  ]);

  dguv_json_response(['ok' => true]);
}

if ($action === 'purge_expired' && $method === 'POST') {
  require_admin();

  $now = dguv_iso_now();
  $stmt = $db->prepare('UPDATE inspections SET deleted_at = ? WHERE deleted_at IS NULL AND expires_at <= ?');
  $stmt->execute([$now, $now]);
  $count = $stmt->rowCount();

  dguv_audit($db, 'purge_expired', 'inspection', 'bulk', ['count' => $count]);

  dguv_json_response(['ok' => true, 'purged' => $count]);
}

dguv_json_response(['ok' => false, 'error' => 'unknown_action'], 404);
