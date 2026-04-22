<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
require_login();

header("Content-Security-Policy: default-src 'none'; frame-ancestors 'self';");

function preview_json(array $payload, int $status = 200): never {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function preview_storage_dir(): string {
  $config = require __DIR__ . '/app/config.php';
  $base = (string)($config['data_dir'] ?? (__DIR__ . '/app'));
  $dir = rtrim($base, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'tmp_pdf_previews';
  if (!is_dir($dir)) {
    mkdir($dir, 0775, true);
  }
  return $dir;
}

function preview_cleanup(array &$map): void {
  $now = time();
  foreach ($map as $token => $entry) {
    $expires = (int)($entry['expires'] ?? 0);
    $path = (string)($entry['path'] ?? '');
    if ($expires > 0 && $expires < $now) {
      if ($path !== '' && is_file($path)) {
        @unlink($path);
      }
      unset($map[$token]);
    }
  }
}

function preview_safe_name(string $name): string {
  $name = trim($name);
  if ($name === '') {
    return 'Messprotokoll.pdf';
  }

  $name = preg_replace('/[^a-zA-Z0-9\-_. ]/', '', $name) ?? '';
  $name = preg_replace('/\s+/', ' ', $name) ?? '';
  $name = trim($name);

  if ($name === '') {
    return 'Messprotokoll.pdf';
  }
  if (!str_ends_with(strtolower($name), '.pdf')) {
    $name .= '.pdf';
  }
  return $name;
}

$action = trim((string)($_GET['action'] ?? ''));
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($action === 'create' && $method === 'POST') {
  $csrf = (string)($_POST['csrf'] ?? '');
  require_csrf_token($csrf);

  $file = $_FILES['pdf_file'] ?? null;
  if (!is_array($file) || (int)($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    preview_json(['ok' => false, 'error' => 'upload_error'], 400);
  }

  $tmp = (string)($file['tmp_name'] ?? '');
  $size = (int)($file['size'] ?? 0);
  if ($tmp === '' || !is_uploaded_file($tmp) || $size <= 0 || $size > (30 * 1024 * 1024)) {
    preview_json(['ok' => false, 'error' => 'invalid_upload'], 400);
  }

  $bytes = file_get_contents($tmp);
  if ($bytes === false || $bytes === '') {
    preview_json(['ok' => false, 'error' => 'empty_file'], 400);
  }

  if (strncmp($bytes, '%PDF-', 5) !== 0) {
    preview_json(['ok' => false, 'error' => 'not_pdf'], 400);
  }

  $safeName = preview_safe_name((string)($_POST['filename'] ?? 'Messprotokoll.pdf'));
  $token = bin2hex(random_bytes(24));
  $dir = preview_storage_dir();
  $path = $dir . DIRECTORY_SEPARATOR . $token . '.pdf';

  if (file_put_contents($path, $bytes) === false) {
    preview_json(['ok' => false, 'error' => 'store_failed'], 500);
  }

  if (empty($_SESSION['pdf_previews']) || !is_array($_SESSION['pdf_previews'])) {
    $_SESSION['pdf_previews'] = [];
  }

  $map = $_SESSION['pdf_previews'];
  preview_cleanup($map);
  $map[$token] = [
    'path' => $path,
    'name' => $safeName,
    'expires' => time() + 900,
  ];
  $_SESSION['pdf_previews'] = $map;

  preview_json([
    'ok' => true,
    'url' => '/pdf_preview_api.php?action=view&token=' . rawurlencode($token),
  ]);
}

if ($action === 'view' && $method === 'GET') {
  $token = trim((string)($_GET['token'] ?? ''));
  if ($token === '') {
    http_response_code(400);
    echo '400';
    exit;
  }

  $map = $_SESSION['pdf_previews'] ?? [];
  if (!is_array($map)) {
    $map = [];
  }
  preview_cleanup($map);
  $_SESSION['pdf_previews'] = $map;

  $entry = $map[$token] ?? null;
  if (!is_array($entry)) {
    http_response_code(404);
    echo '404';
    exit;
  }

  $path = (string)($entry['path'] ?? '');
  $name = preview_safe_name((string)($entry['name'] ?? 'Messprotokoll.pdf'));
  if ($path === '' || !is_file($path)) {
    unset($map[$token]);
    $_SESSION['pdf_previews'] = $map;
    http_response_code(404);
    echo '404';
    exit;
  }

  $asciiName = preg_replace('/[^\x20-\x7E]/', '_', $name) ?? 'Messprotokoll.pdf';
  $encodedName = rawurlencode($name);

  header("Content-Security-Policy: frame-ancestors 'self';");
  header('Content-Type: application/pdf');
  header('Content-Length: ' . (string)filesize($path));
  header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
  header('Pragma: no-cache');
  header('Content-Disposition: inline; filename="' . $asciiName . '"; filename*=UTF-8\'\'' . $encodedName);

  readfile($path);
  exit;
}

preview_json(['ok' => false, 'error' => 'unknown_action'], 404);
