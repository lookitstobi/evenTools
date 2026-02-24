<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
require_login();
$config = require __DIR__ . '/app/config.php';

$name = preg_replace('/[^a-zA-Z0-9_-]/', '', $_GET['name'] ?? '');
$file = $_GET['file'] ?? 'index.html';

$allowed = $_SESSION['tools'] ?? [];
if (!$name || !in_array($name, $allowed, true)) {
  http_response_code(403);
  echo "403";
  exit;
}

/**
 * file sanitizing: no absolute paths, no traversal
 */
$file = str_replace(["\\", "\0"], ["/", ""], $file);
$file = ltrim($file, "/");
if ($file === '' || str_contains($file, '..')) {
  http_response_code(400);
  echo "bad file";
  exit;
}

$toolBase = realpath($config['tools_dir'] . '/' . $name);
if (!$toolBase) {
  http_response_code(404);
  echo "tool not found";
  exit;
}

$target = realpath($toolBase . '/' . $file);
if (!$target || strpos($target, $toolBase . DIRECTORY_SEPARATOR) !== 0 || !is_file($target)) {
  http_response_code(404);
  echo "404";
  exit;
}

// content-type grob nach extension
$ext = strtolower(pathinfo($target, PATHINFO_EXTENSION));
$types = [
  'html' => 'text/html; charset=utf-8',
  'htm'  => 'text/html; charset=utf-8',
  'css'  => 'text/css; charset=utf-8',
  'js'   => 'application/javascript; charset=utf-8',
  'json' => 'application/json; charset=utf-8',
  'svg'  => 'image/svg+xml',
  'png'  => 'image/png',
  'jpg'  => 'image/jpeg',
  'jpeg' => 'image/jpeg',
  'webp' => 'image/webp',
  'woff' => 'font/woff',
  'woff2'=> 'font/woff2',
  'ttf'  => 'font/ttf',
];
header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
header('X-Content-Type-Options: nosniff');

readfile($target);