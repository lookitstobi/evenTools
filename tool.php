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

if ($name === 'pdf_template_builder') {
  http_response_code(503);
  page_start('PDF-Editor in Bearbeitung');
  echo '<div class="card">';
  echo '<div class="h1">PDF-Editor derzeit inaktiv</div>';
  echo '<div class="small">Der Editor bleibt als Entwicklungsstand erhalten, ist aber vorübergehend deaktiviert.</div>';
  echo '<div class="sep"></div>';
  echo '<div class="flash warn">Bitte nutze im Dashboard den PDF-Modus-Schalter, um für Berichte zwischen Legacy und neuem Templatesystem zu wechseln.</div>';
  echo '<div class="spacer-10"></div>';
  echo '<a class="btn" href="/index.php">Zurück zum Dashboard</a>';
  echo '</div>';
  page_end();
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

$html = file_get_contents($path);
$runtimeScript = '<script>window.TOOLSAPP_RUNTIME=' . json_encode([
  'pdf_mode' => get_pdf_runtime_mode(),
  'can_switch_pdf_mode' => is_pdf_mode_switch_user(),
  'username' => (string)($_SESSION['username'] ?? ''),
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . ';</script>';

$style = '<style>' .
  '.tool-home-link{' .
  'display:inline-flex;align-items:center;gap:6px;' .
  'text-decoration:none;color:inherit;font-weight:700;font-size:13px;' .
  'padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.16);' .
  'background:#333333;' .
  '}' .
  '.tool-home-link:hover{opacity:0.9}' .
  '.tool-home-icon{width:14px;height:14px;display:inline-block}' .
  '.tool-global-header{' .
  'display:flex;align-items:center;gap:12px;padding:10px 16px;' .
  'border-bottom:1px solid rgba(255,255,255,.12);' .
  'background:#272727;backdrop-filter:blur(10px);' .
  '}' .
  'select{color:#f4f4f4;background:#333333}' .
  'select option,select optgroup{color:#f4f4f4;background:#333333}' .
  '@media (max-width: 600px){' .
  '.tool-global-header{padding:8px 10px;gap:8px;position:sticky;top:0;z-index:80}' .
  '.tool-home-link{font-size:12px;padding:6px 9px}' .
  '}' .
  '</style>';
$homeIcon = '<svg class="tool-home-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' .
  '<path fill="currentColor" d="M12 3 2.5 10.5l1.4 1.4L5 11v8h5v-5h4v5h5v-8l1.1.9 1.4-1.4L12 3z"/>' .
  '</svg>';
$homeLink = '<a class="tool-home-link" href="/index.php" title="Zum Dashboard">' . $homeIcon . '<span>Home</span></a>';

$headPos = stripos($html, '</head>');
if ($headPos !== false) {
  $html = substr_replace($html, $style . "\n" . $runtimeScript . "\n", $headPos, 0);
} else {
  $html = $style . "\n" . $runtimeScript . "\n" . $html;
}

$injectedHeader = false;
$html = preg_replace(
  '/(<header\b[^>]*class=["\"][^"\"]*header[^"\"]*["\"][^>]*>)/i',
  '$1' . $homeLink,
  $html,
  1,
  $count
);
if (!empty($count)) {
  $injectedHeader = true;
}

if (!$injectedHeader) {
  $bodyPos = stripos($html, '<body');
  if ($bodyPos !== false) {
    $bodyEnd = stripos($html, '>', $bodyPos);
    if ($bodyEnd !== false) {
      $headerBar = '<header class="tool-global-header">' . $homeLink . '</header>';
      $html = substr_replace($html, $headerBar, $bodyEnd + 1, 0);
      $injectedHeader = true;
    }
  }
}

echo $html;