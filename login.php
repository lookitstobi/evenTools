<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
$config = require __DIR__ . '/app/config.php';

$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $username = trim($_POST['username'] ?? '');
  $password = $_POST['password'] ?? '';

  $db = new PDO('sqlite:' . $config['db_path']);
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  $stmt = $db->prepare("SELECT id, passhash, tools, is_admin FROM users WHERE username = ?");
  $stmt->execute([$username]);
  $row = $stmt->fetch(PDO::FETCH_ASSOC);

  if ($row && password_verify($password, $row['passhash'])) {
    session_regenerate_id(true);
    $_SESSION['uid'] = (int)$row['id'];
    $_SESSION['username'] = $username;
    $_SESSION['is_admin'] = (int)$row['is_admin'];
    if ((int)$row['is_admin'] === 1) {
      $_SESSION['tools'] = all_tools();
    } else {
      $_SESSION['tools'] = json_decode($row['tools'], true) ?: [];
    }
    redirect('/index.php');
  } else {
    $error = 'Login fehlgeschlagen.';
  }
}

page_start('Login', false);
?>
<div class="container" style="padding-top: 36px;">
  <div class="card" style="max-width:520px;margin:0 auto;">
    <div class="login-logo-wrap">
      <img class="login-logo" src="/assets/Logo.png" alt="<?=$config['site_name']?> Logo">
    </div>
    <div class="sep"></div>

    <div style="display:flex;gap:12px;align-items:center;">
      <div>
        <div class="h1" style="margin:0;">Login</div>
        <div class="small">Bitte anmelden, um Tools zu öffnen.</div>
      </div>
    </div>

    <div class="sep"></div>

    <?php if ($error): ?>
      <div class="flash bad"><?=h($error)?></div>
      <div style="height:10px;"></div>
    <?php endif; ?>

    <form method="post" style="display:grid;gap:12px;">
      <div class="field">
        <div class="label">Benutzername</div>
        <input class="input" name="username" autocomplete="username" required>
      </div>

      <div class="field">
        <div class="label">Passwort</div>
        <input class="input" type="password" name="password" autocomplete="current-password" required>
      </div>

      <button class="btn btn-primary" type="submit" style="width:100%;">Einloggen</button>

      <div class="help">
        Tipp: Wenn du irgendwann “privat/beruflich” trennen willst, bauen wir das später über Rollen & Mandanten sauber ein.
      </div>
    </form>
  </div>
</div>
<?php page_end(); ?>