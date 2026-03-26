<?php
declare(strict_types=1);

/**
 * Diagnose für Login-Fehler auf Production
 * 
 * Aufruf über Web oder CLI:
 *   php diagnose.php        (als CLI mit Stderr-Output)
 *   curl https://site/diagnose.php  (über Browser)
 */

$isCliMode = php_sapi_name() === 'cli';

header('Content-Type: text/plain; charset=UTF-8', true, 200);

function out($msg) {
  echo $msg . PHP_EOL;
}

out("=====================================");
out("TOOLSAPP DIAGNOSIS REPORT");
out("Date: " . date('c'));
out("PHP Version: " . PHP_VERSION);
out("=====================================");
out("");

// === Environment & Paths ===
out("[1] ENVIRONMENT & PATH RESOLUTION");
out("APP_DATA_DIR env: " . (getenv('APP_DATA_DIR') ?: '(nicht gesetzt)'));
out("getcwd(): " . getcwd());
out("__DIR__: " . __DIR__);
out("");

// === Config Loading ===
out("[2] CONFIG RESOLUTION");
try {
  $config = require __DIR__ . '/app/config.php';
  out("✓ config.php geladen");
  out("  db_path: " . $config['db_path']);
  out("  data_dir: " . $config['data_dir']);
  out("");
  
  // Überprüfe, ob DBs existieren
  out("[3] DATABASE FILES");
  $dbPaths = [
    'app/users.sqlite' => __DIR__ . '/app/users.sqlite',
    'data/users.sqlite' => __DIR__ . '/data/users.sqlite',
    'configured db_path' => $config['db_path'],
  ];
  
  foreach ($dbPaths as $label => $path) {
    $exists = file_exists($path) ? 'YES' : 'NO';
    $size = file_exists($path) ? filesize($path) : 'N/A';
    out("  $label: exists=$exists, size=$size, path=$path");
  }
  out("");
  
  // === Database Connection Test ===
  out("[4] DATABASE CONNECTION TEST");
  try {
    $db = new PDO('sqlite:' . $config['db_path']);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    out("✓ PDO connection erfolgreich zu: " . $config['db_path']);
    
    // Check schema
    out("[5] SCHEMA & USERS");
    $result = $db->query("SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name='users'");
    $tableExists = ($result && $result->fetchColumn() == 1) ? 'YES' : 'NO';
    out("  users table exists: $tableExists");
    
    if ($tableExists === 'YES') {
      $stmt = $db->query("SELECT id, username, is_admin, LENGTH(passhash) as hash_len FROM users");
      $users = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
      out("  Total users: " . count($users));
      foreach ($users as $u) {
        out("    - ID " . $u['id'] . ": " . $u['username'] . " (admin=" . $u['is_admin'] . ", hash_len=" . $u['hash_len'] . ")");
      }
    }
    out("");
    
  } catch (Exception $e) {
    out("✗ PDO connection FAILED!");
    out("  Error: " . $e->getMessage());
    out("");
  }
  
} catch (Exception $e) {
  out("✗ config.php FAILED!");
  out("  Error: " . $e->getMessage());
  out("");
}

// === Session Configuration ===
out("[6] SESSION CONFIGURATION");
out("  session_name: " . (session_name() ?: '(keine)'));
out("  session.cookie_httponly: " . ini_get('session.cookie_httponly'));
out("  session.cookie_secure: " . ini_get('session.cookie_secure'));
out("  session.cookie_samesite: " . ini_get('session.cookie_samesite'));
out("");

// === File Permissions ===
out("[7] FILE PERMISSIONS");
$dirs = [
  'app/' => __DIR__ . '/app',
  'data/' => __DIR__ . '/data',
];

foreach ($dirs as $label => $dir) {
  if (is_dir($dir)) {
    $perms = substr(sprintf('%o', fileperms($dir)), -4);
    out("  $label: exists (perms=$perms)");
  } else {
    out("  $label: NOT EXISTS (should create!)");
  }
}
out("");

// === Login Test (if POST) ===
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
  out("[8] LOGIN TEST");
  $username = $_POST['username'] ?? '';
  $password = $_POST['password'] ?? '';
  
  if (!$username || !$password) {
    out("✗ Missing username or password");
  } else {
    try {
      $db = new PDO('sqlite:' . $config['db_path']);
      $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
      
      $stmt = $db->prepare("SELECT id, passhash, is_admin FROM users WHERE username = ?");
      $stmt->execute([$username]);
      $row = $stmt->fetch(PDO::FETCH_ASSOC);
      
      if (!$row) {
        out("✗ User not found: $username");
      } else {
        out("✓ User found: $username (id=" . $row['id'] . ")");
        
        $match = password_verify($password, $row['passhash']);
        if ($match) {
          out("✓ Password matches!");
        } else {
          out("✗ Password does NOT match");
          out("  (First 40 chars of stored hash: " . substr($row['passhash'], 0, 40) . ")");
        }
      }
    } catch (Exception $e) {
      out("✗ Login test DB error: " . $e->getMessage());
    }
  }
  out("");
}

out("=====================================");
out("END OF DIAGNOSIS");
out("=====================================");

if (!$isCliMode) {
  out("");
  out("💡 UPLOAD FIXES:");
  out("   1. Überprüfe ob APP_DATA_DIR auf dem Server gesetzt ist");
  out("   2. Stelle sicher, dass data/ Verzeichnis existiert und Schreibrechte hat");
  out("   3. Führe 'php app/migrate.php' mit APP_DATA_DIR aus");
  out("   4. Vergleiche PHP-Versionen (local vs. server)");
}
?>
