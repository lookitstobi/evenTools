<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
require_login();
$config = require __DIR__ . '/app/config.php';

$name = preg_replace('/[^a-zA-Z0-9_-]/', '', $_GET['name'] ?? '');
$allowed = $_SESSION['tools'] ?? [];

if (!$name || !in_array($name, $allowed, true)) {
  http_response_code(403);
  echo "403";
  exit;
}

$path = realpath($config['tools_dir'] . '/' . $name . '/index.html');
$base = realpath($config['tools_dir']);

if (!$path || !$base || strncmp($path, $base, strlen($base)) !== 0) {
  http_response_code(404);
  echo "404";
  exit;
}

// Erlaubt externe CDNs für Tool-Libraries + Inline-Skripte der Tools
header("Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; connect-src 'self' https:;");

readfile($path);