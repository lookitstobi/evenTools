<?php
declare(strict_types=1);
$config = require __DIR__ . '/app/config.php';

try {
  $db = new PDO('sqlite:' . $config['db_path']);
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  
  echo "<h2>Debug: Benutzer-Datenbank</h2>";
  
  // Check table structure
  echo "<h3>Tabellen-Schema</h3><pre>";
  $schema = $db->query("PRAGMA table_info(users);")->fetchAll(PDO::FETCH_ASSOC);
  foreach ($schema as $col) {
    echo "- {$col['name']} ({$col['type']})\n";
  }
  echo "</pre>";
  
  // Check all users
  echo "<h3>Alle Benutzer in der Datenbank</h3>";
  $users = $db->query("SELECT id, username, is_admin, LENGTH(passhash) as passhash_length FROM users ORDER BY username;")->fetchAll(PDO::FETCH_ASSOC);
  
  if (empty($users)) {
    echo "<p style='color: red;'><strong>❌ KEINE BENUTZER GEFUNDEN!</strong></p>";
    echo "<p>Die Datenbank ist leer. Bitte einen Benutzer über <code>/admin_users.php</code> erstellen.</p>";
  } else {
    echo "<ul>";
    foreach ($users as $user) {
      $admin_label = $user['is_admin'] ? ' (Admin)' : '';
      echo "<li><strong>{$user['username']}</strong>{$admin_label} - Passhash-Länge: {$user['passhash_length']}</li>";
    }
    echo "</ul>";
  }
  
  // Test password verification for tobi
  echo "<h3>Test: Passwort-Verifikation für 'tobi'</h3>";
  $stmt = $db->prepare("SELECT id, passhash FROM users WHERE username = ?");
  $stmt->execute(['tobi']);
  $row = $stmt->fetch(PDO::FETCH_ASSOC);
  
  if ($row) {
    echo "<p style='color: green;'>✓ Benutzer 'tobi' GEFUNDEN</p>";
    echo "<p>Passhash-Länge: " . strlen($row['passhash']) . " Zeichen</p>";
  } else {
    echo "<p style='color: red;'><strong>❌ Benutzer 'tobi' wurde NICHT GEFUNDEN!</strong></p>";
    echo "<p>Mögliche Ursachen:</p>";
    echo "<ul>";
    echo "<li>Der Benutzer wurde nicht erstellt</li>";
    echo "<li>Der Benutzername ist anders geschrieben (Groß/Kleinschreibung beachten!)</li>";
    echo "<li>Die Datenbank wurde zurückgesetzt</li>";
    echo "</ul>";
  }
  
} catch (Exception $e) {
  echo "<p style='color: red;'><strong>Datenbankfehler:</strong></p>";
  echo "<pre>" . htmlspecialchars($e->getMessage()) . "</pre>";
}
?>
