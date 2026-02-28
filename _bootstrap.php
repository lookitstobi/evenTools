<?php
declare(strict_types=1);

$config = require __DIR__ . '/app/config.php';

foreach (['db_path', 'dguv_db_path', 'cuesheet_db_path'] as $dbConfigKey) {
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

function h(string $s): string {
  return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
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
  $site = h(($GLOBALS['config']['site_name'] ?? 'Tools'));
  $t = h($title);

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
  <link rel=\"stylesheet\" href=\"/assets/app.css\">
</head>
<body{$body_class}>";

  if ($show_nav) {
    echo "<header class=\"topbar\">
      <div class=\"topbar-inner\">
        <a class=\"brand\" href=\"/index.php\">
                <img class=\"brand-logo\" src=\"/assets/evenTools%20Logo.png\" alt=\"{$site} Logo\">
          <div>
            <span>{$site}</span>
            <small>Hub für deine Web-Tools</small>
          </div>
        </a>
        <nav class=\"nav\">";

    if ($is_authed) {
      echo "<a class=\"btn\" href=\"/index.php\">Home</a>";
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