<?php
declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
$config = require __DIR__ . '/app/config.php';

$name = preg_replace('/[^a-zA-Z0-9_-]/', '', $_GET['name'] ?? '');
$file = $_GET['file'] ?? 'index.html';

if (!$name) {
  http_response_code(403);
  echo "403";
  exit;
}

if (!can_access_tool($name)) {
  if (empty($_SESSION['uid'])) {
    redirect('/login.php');
  }
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
if (in_array($ext, ['html', 'htm'], true)) {
  $nonce = csp_nonce();
  header("Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'nonce-{$nonce}'; script-src 'self' 'nonce-{$nonce}'; connect-src 'self'; font-src 'self' data:; worker-src blob:; frame-ancestors 'self';");
}
header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
header('X-Content-Type-Options: nosniff');

if (in_array($ext, ['html', 'htm'], true)) {
  $html = file_get_contents($target);
  // Nonce zu vorhandenen inline <script>- und <style>-Tags im Tool-HTML hinzufügen
  $html = preg_replace('/<script\b(?![^>]*\b(?:src|nonce)\b)/i', '<script nonce="' . $nonce . '"', $html);
  $html = preg_replace('/<style\b(?![^>]*\bnonce\b)/i', '<style nonce="' . $nonce . '"', $html);

  $style = '<style nonce="' . $nonce . '">' .
    '.tool-home-btn{' .
    'position:fixed;right:16px;top:16px;z-index:9999;' .
    'background:#333333;color:#fff;text-decoration:none;' .
    'padding:8px 12px;border-radius:8px;font:600 12px/1 system-ui,Segoe UI,Roboto,Arial,sans-serif;' .
    'box-shadow:0 6px 18px rgba(0,0,0,0.25);' .
    '}' .
    '.tool-home-btn:hover{opacity:0.9}' .
    '.tool-home-inline{margin-right:8px}' .
    'select{color:#f4f4f4;background:#333333}' .
    'select option,select optgroup{color:#f4f4f4;background:#333333}' .
    '@media (max-width: 600px){' .
    '.tool-home-btn{top:auto;bottom:12px;right:12px;padding:10px 12px;border-radius:10px}' .
    '.tool-home-inline{margin-right:6px}' .
    '}' .
    '</style>';

  $inlineButton = '<a class="icon-btn subtle tool-home-inline" href="/index.php" title="Zum Dashboard">Home</a>';
  $floatingButton = '<a class="tool-home-btn" href="/index.php">Home</a>';

  $headPos = stripos($html, '</head>');
  if ($headPos !== false) {
    $html = substr_replace($html, $style . "\n", $headPos, 0);
  } else {
    $html = $style . "\n" . $html;
  }

  $injectedInline = false;
  $html = preg_replace(
    '/(<div\s+class=["\"]header-controls["\"]\s*>|<div\s+class=\'header-controls\'\s*>)/i',
    '$1' . $inlineButton,
    $html,
    1,
    $count
  );
  if (!empty($count)) {
    $injectedInline = true;
  }

  if (!$injectedInline) {
    $bodyPos = stripos($html, '</body>');
    if ($bodyPos !== false) {
      $html = substr_replace($html, $floatingButton . "\n", $bodyPos, 0);
    } else {
      $html .= "\n" . $floatingButton;
    }
  }

  echo $html;
  exit;
}

readfile($target);