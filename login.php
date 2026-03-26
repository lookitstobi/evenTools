<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
$config = require __DIR__ . '/app/config.php';

$error = null;

function verify_login_password(PDO $db, int $userId, string $plainPassword, string $storedPasshash): bool {
  $normalizedHash = trim($storedPasshash);

  if ($normalizedHash !== '' && password_verify($plainPassword, $normalizedHash)) {
    if (password_needs_rehash($normalizedHash, PASSWORD_DEFAULT)) {
      $db->prepare('UPDATE users SET passhash = ? WHERE id = ?')
         ->execute([password_hash($plainPassword, PASSWORD_DEFAULT), $userId]);
    }
    return true;
  }

  // Legacy fallback for migrated installations with non-password_hash storage.
  $legacyCandidates = [
    $plainPassword,
    md5($plainPassword),
    sha1($plainPassword),
    hash('sha256', $plainPassword),
  ];

  foreach ($legacyCandidates as $candidate) {
    if (hash_equals($normalizedHash, $candidate)) {
      $db->prepare('UPDATE users SET passhash = ? WHERE id = ?')
         ->execute([password_hash($plainPassword, PASSWORD_DEFAULT), $userId]);
      return true;
    }
  }

  return false;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $username = trim($_POST['username'] ?? '');
  $password = $_POST['password'] ?? '';

  try {
    $db = new PDO('sqlite:' . $config['db_path']);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $stmt = $db->prepare("SELECT id, username, passhash, tools, is_admin FROM users WHERE username = ?");
    $stmt->execute([$username]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row && verify_login_password($db, (int)$row['id'], $password, (string)$row['passhash'])) {
      session_regenerate_id(true);
      $_SESSION['uid'] = (int)$row['id'];
      $_SESSION['username'] = (string)$row['username'];
      $_SESSION['is_admin'] = (int)$row['is_admin'];
      if ((int)$row['is_admin'] === 1) {
        $_SESSION['tools'] = all_tools();
      } else {
        $_SESSION['tools'] = json_decode($row['tools'], true) ?: [];
      }
      redirect('/index.php');
    } else {
      // Log login failure for diagnostics (with rate limiting consideration)
      error_log('[TOOLSAPP LOGIN] Failed attempt for username: ' . $username . ' (user_exists=' . ($row ? '1' : '0') . ')');
      $error = 'Login fehlgeschlagen.';
    }
  } catch (Exception $e) {
    error_log('[TOOLSAPP LOGIN] Database error: ' . $e->getMessage() . ' (db_path=' . $config['db_path'] . ')');
    $error = 'Ein Fehler ist aufgetreten. Bitte kontaktiere den Administrator.';
  }
}

page_start('Login', false);
?>
<div class="login-shell">
  <div class="card">
    <div class="login-logo-wrap">
      <img class="login-logo" src="/assets/Logos/evenTools%20Main%20Logo.png" alt="<?=$config['site_name']?> Logo">
    </div>
    <div class="sep"></div>

    <div class="login-intro">
      <div>
        <div class="h1">Login</div>
        <div class="small">Bitte anmelden, um Tools zu öffnen.</div>
      </div>
    </div>

    <div class="sep"></div>

    <?php if ($error): ?>
      <div class="flash bad"><?=h($error)?></div>
      <div class="spacer-10"></div>
    <?php endif; ?>

    <form method="post" class="form-grid">
      <div class="field">
        <div class="label">Benutzername</div>
        <input class="input" name="username" autocomplete="username" required>
      </div>

      <div class="field">
        <div class="label">Passwort</div>
        <input class="input" type="password" name="password" autocomplete="current-password" required>
      </div>

      <button class="btn btn-primary btn-fullwidth" type="submit">Einloggen</button>

      <div class="help">
        Tipp: Wenn du irgendwann “privat/beruflich” trennen willst, bauen wir das später über Rollen & Mandanten sauber ein.
      </div>
    </form>
  </div>
</div>
<?php page_end(); ?>