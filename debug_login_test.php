<?php
declare(strict_types=1);
$config = require __DIR__ . '/app/config.php';

echo "<h2>Debug: Login-Flow Analyse</h2>";

// Get POST data if it's a test
$testUsername = $_POST['test_username'] ?? '';
$testPassword = $_POST['test_password'] ?? '';

if (empty($testUsername)) {
  $testUsername = 'tobi';
}

echo "<h3>Test mit Benutzer: <code>$testUsername</code></h3>";

try {
  $db = new PDO('sqlite:' . $config['db_path']);
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  
  // Fetch user like login.php does
  $stmt = $db->prepare("SELECT id, passhash, tools, is_admin FROM users WHERE username = ?");
  $stmt->execute([$testUsername]);
  $row = $stmt->fetch(PDO::FETCH_ASSOC);
  
  if (!$row) {
    echo "<p style='color: red;'><strong>❌ Benutzer nicht gefunden!</strong></p>";
  } else {
    echo "<p style='color: green;'><strong>✓ Benutzer gefunden</strong></p>";
    echo "<ul>";
    echo "<li><strong>ID:</strong> " . htmlspecialchars((string)$row['id']) . "</li>";
    echo "<li><strong>is_admin:</strong> " . htmlspecialchars((string)$row['is_admin']) . "</li>";
    echo "<li><strong>tools:</strong> " . htmlspecialchars($row['tools']) . "</li>";
    echo "<li><strong>passhash (erste 30 Zeichen):</strong> " . substr($row['passhash'], 0, 30) . "...</li>";
    echo "</ul>";
    
    // Now test password verification
    if (!empty($testPassword)) {
      echo "<h4>Passwort-Test</h4>";
      echo "<p>Getestetes Passwort: <code>" . htmlspecialchars($testPassword) . "</code></p>";
      
      $verify_result = password_verify($testPassword, $row['passhash']);
      
      if ($verify_result) {
        echo "<p style='color: green;'><strong>✓ PASSWORD KORREKT!</strong></p>";
        echo "<p>Das Passwort stimmt mit dem Hash überein.</p>";
        echo "<p style='color: #ff6600;'><strong>⚠️ Wenn du dich aber trotzdem nicht einloggen kannst, dann liegt das Problem NICHT am Passwort!</strong></p>";
        echo "<p>Mögliche andere Ursachen:</p>";
        echo "<ul>";
        echo "<li>Session-Probleme (Cookie nicht gesetzt)</li>";
        echo "<li>Browser-Cache oder Cookies deaktiviert</li>";
        echo "<li>CSRF-Protection oder andere Sicherheits-Header</li>";
        echo "<li>JavaScript-Fehler im Browser</li>";
        echo "</ul>";
      } else {
        echo "<p style='color: red;'><strong>❌ PASSWORT FALSCH!</strong></p>";
        echo "<p>Das angegebene Passwort stimmt nicht mit dem Hash überein.</p>";
        echo "<p>Überprüfe bitte:</p>";
        echo "<ul>";
        echo "<li>Groß-/Kleinschreibung</li>";
        echo "<li>Leerzeichen am Anfang oder Ende</li>";
        echo "<li>Sonderzeichen</li>";
        echo "<li>Ob die Caps-Lock-Taste gerade an ist</li>";
        echo "</ul>";
      }
    } else {
      echo "<h4>📝 Passwort-Test</h4>";
      echo "<p>Gib unten dein Passwort ein, um es zu testen:</p>";
    }
  }
  
} catch (Exception $e) {
  echo "<p style='color: red;'><strong>Datenbankfehler:</strong></p>";
  echo "<pre>" . htmlspecialchars($e->getMessage()) . "</pre>";
}
?>

<hr>
<h3>Passwort-Test-Formular</h3>
<form method="post" style="border: 1px solid #ccc; padding: 15px; border-radius: 5px; background: #f5f5f5;">
  <div style="margin-bottom: 10px;">
    <label for="test_username" style="display: block; font-weight: bold; margin-bottom: 5px;">Benutzername:</label>
    <input type="text" id="test_username" name="test_username" value="<?=htmlspecialchars($testUsername)?>" style="width: 100%; padding: 8px; box-sizing: border-box;">
  </div>
  <div style="margin-bottom: 10px;">
    <label for="test_password" style="display: block; font-weight: bold; margin-bottom: 5px;">Passwort:</label>
    <input type="password" id="test_password" name="test_password" placeholder="Gib hier dein Passwort ein" style="width: 100%; padding: 8px; box-sizing: border-box;">
  </div>
  <button type="submit" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Testen</button>
</form>

<hr>
<h3>HTTP-Header und Session-Info</h3>
<p><strong>Session Name:</strong> <code><?=htmlspecialchars($config['session_name'])?></code></p>
<p><strong>Current Session ID:</strong> <code><?=htmlspecialchars(session_id())?></code></p>
<p><strong>SESSION data:</strong></p>
<pre><?=htmlspecialchars(print_r($_SESSION, true))?></pre>

<?php
echo "<h3>PHP und Setup-Info</h3>";
echo "<ul>";
echo "<li><strong>PHP Version:</strong> " . phpversion() . "</li>";
echo "<li><strong>DB Path:</strong> " . htmlspecialchars($config['db_path']) . "</li>";
echo "<li><strong>DB exists:</strong> " . (file_exists($config['db_path']) ? "✓ Ja" : "❌ Nein") . "</li>";
echo "<li><strong>password_hash Algorithm:</strong> " . htmlspecialchars((string)PASSWORD_DEFAULT) . "</li>";
echo "</ul>";
?>
