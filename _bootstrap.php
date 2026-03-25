<?php
declare(strict_types=1);

$config = require __DIR__ . '/app/config.php';

foreach (['db_path', 'dguv_db_path', 'cuesheet_db_path', 'pdf_template_db_path', 'patchmatrix_db_path'] as $dbConfigKey) {
  $dbPath = (string)($config[$dbConfigKey] ?? '');
  if ($dbPath === '') {
    continue;
  }
  $dbDir = dirname($dbPath);
  if (!is_dir($dbDir)) {
    mkdir($dbDir, 0775, true);
  }
}

session_name($config['session_name']);
session_set_cookie_params([
  'httponly' => true,
  'samesite' => 'Lax',
  'secure'   => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
  'path'     => '/',
]);
session_start();

// Universelle Security-Header (CSP wird seitenspezifisch über csp_nonce() gesetzt)
if (!headers_sent()) {
  if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
  }
  header('X-Frame-Options: SAMEORIGIN');
  header('X-Content-Type-Options: nosniff');
  header('Referrer-Policy: strict-origin-when-cross-origin');
  header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()');
}

function h(string $s): string {
  return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function csp_nonce(): string {
  static $nonce = null;
  if ($nonce === null) {
    $nonce = base64_encode(random_bytes(16));
  }
  return $nonce;
}

function redirect(string $to): never {
  header("Location: $to");
  exit;
}

function require_login(): void {
  if (empty($_SESSION['uid'])) redirect('/login.php');
}

function require_admin(): void {
  require_login();
  if (empty($_SESSION['is_admin'])) {
    http_response_code(403);
    echo "403";
    exit;
  }
}

function is_pdf_mode_switch_user(): bool {
  $username = (string)($_SESSION['username'] ?? '');
  return in_array($username, ['möhrchen', 'admin'], true);
}

function app_settings_db(): PDO {
  static $db = null;
  if ($db instanceof PDO) {
    return $db;
  }

  $config = require __DIR__ . '/app/config.php';
  $db = new PDO('sqlite:' . (string)$config['db_path']);
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $db->exec('CREATE TABLE IF NOT EXISTS app_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by TEXT NOT NULL
  )');

  return $db;
}

function get_app_setting(string $key, string $default = ''): string {
  $db = app_settings_db();
  $stmt = $db->prepare('SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1');
  $stmt->execute([$key]);
  $value = $stmt->fetchColumn();
  return is_string($value) ? $value : $default;
}

function set_app_setting(string $key, string $value): void {
  $db = app_settings_db();
  $stmt = $db->prepare('INSERT INTO app_settings (setting_key, setting_value, updated_at, updated_by)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(setting_key) DO UPDATE SET
      setting_value = excluded.setting_value,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by');
  $stmt->execute([
    $key,
    $value,
    gmdate('c'),
    (string)($_SESSION['username'] ?? 'system'),
  ]);
}

function get_pdf_runtime_mode(): string {
  $mode = get_app_setting('pdf_runtime_mode', 'legacy');
  return in_array($mode, ['legacy', 'template'], true) ? $mode : 'legacy';
}

function set_pdf_runtime_mode(string $mode): void {
  if (!is_pdf_mode_switch_user()) {
    return;
  }

  set_app_setting('pdf_runtime_mode', $mode === 'template' ? 'template' : 'legacy');
}

function csrf_token(): string {
  if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(24));
  }
  return (string)$_SESSION['csrf_token'];
}

function require_csrf_token(string $token): void {
  $expected = (string)($_SESSION['csrf_token'] ?? '');
  if ($expected === '' || !hash_equals($expected, $token)) {
    http_response_code(403);
    echo "CSRF";
    exit;
  }
}

function all_tools(): array {
  $tools = [];
  $toolsBase = realpath($GLOBALS['config']['tools_dir'] ?? '');
  if (!$toolsBase) {
    return $tools;
  }
  foreach (glob($toolsBase . '/*', GLOB_ONLYDIR) as $dir) {
    $tools[] = basename($dir);
  }
  sort($tools);
  return $tools;
}

function page_start(string $title, bool $show_nav = true): void {
  $nonce = csp_nonce();
  if (!headers_sent()) {
    header("Content-Security-Policy: default-src 'self'; style-src 'self' 'nonce-{$nonce}'; script-src 'self' 'nonce-{$nonce}'; img-src 'self' data:; font-src 'self'; frame-ancestors 'self';");
  }

  $site = h(($GLOBALS['config']['site_name'] ?? 'Tools'));
  $t = h($title);
  $cssVersion = (string)@filemtime(__DIR__ . '/assets/app.css');
  if ($cssVersion === '') {
    $cssVersion = '1';
  }

  $is_authed = !empty($_SESSION['uid']);
  $is_admin  = !empty($_SESSION['is_admin']);
  $username_raw = (string)($_SESSION['username'] ?? '');
  $user         = h($username_raw);
  $body_class   = ($username_raw === 'möhrchen') ? ' class="user-theme-pink"' : '';

  echo "<!doctype html>
<html lang=\"de\">
<head>
  <meta charset=\"utf-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
  <title>{$t} · {$site}</title>
  <link rel=\"stylesheet\" href=\"/assets/app.css?v={$cssVersion}\">
</head>
<body{$body_class}>";

  if ($show_nav) {
    echo "<header class=\"topbar\">
      <div class=\"topbar-inner\">
        <a class=\"brand\" href=\"/index.php\">
                <img class=\"brand-logo\" src=\"/assets/Logos/evenTools%20Main%20Logo.png\" alt=\"{$site} Logo\">
          <div>
            <small>Hub für deine Web-Tools</small>
          </div>
        </a>
        <nav class=\"nav\">";

    if ($is_authed) {
      echo "<a class=\"btn\" href=\"/index.php\">Home</a>";
      echo "<a class=\"btn\" href=\"/color_inventory.php\">Farben</a>";
      echo "<span class=\"chip\">Angemeldet als <strong>{$user}</strong></span>";
      if ($is_admin) {
        echo "<a class=\"btn\" href=\"/admin_users.php\">Admin</a>";
      }
      echo "<a class=\"btn btn-ghost\" href=\"/logout.php\">Logout</a>";
    } else {
      echo "<a class=\"btn btn-primary\" href=\"/login.php\">Login</a>";
    }

    echo "</nav>
      </div>
    </header>";
  }

  echo "<main class=\"container\">";
}

function page_end(): void {
  echo "</main></body></html>";
}