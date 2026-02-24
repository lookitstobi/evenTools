<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
require_admin();
$config = require __DIR__ . '/app/config.php';

$db = new PDO('sqlite:' . $config['db_path']);
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$msg = null;
$msg_type = 'ok';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $u = trim($_POST['username'] ?? '');
  $p = $_POST['password'] ?? '';
  $is_admin = !empty($_POST['is_admin']) ? 1 : 0;

  if ($u !== '' && $p !== '') {
    try {
      $stmt = $db->prepare("INSERT INTO users(username, passhash, tools, is_admin) VALUES(?,?,?,?)");
      $stmt->execute([$u, password_hash($p, PASSWORD_DEFAULT), json_encode([], JSON_THROW_ON_ERROR), $is_admin]);
      $msg = "User angelegt.";
      $msg_type = 'ok';
    } catch (Throwable $e) {
      $msg = "Konnte User nicht anlegen (evtl. Username schon vergeben).";
      $msg_type = 'bad';
    }
  } else {
    $msg = "Bitte Username + Passwort.";
    $msg_type = 'warn';
  }
}

$users = $db->query("SELECT id, username, is_admin, tools FROM users ORDER BY username")->fetchAll(PDO::FETCH_ASSOC);

page_start('Admin · Benutzer');
?>
<div class="grid">
  <div class="col-4">
    <div class="card">
      <div class="h1">Admin</div>
      <div class="small">Benutzer anlegen & verwalten</div>
      <div class="sep"></div>

      <?php if ($msg): ?>
        <div class="flash <?=$msg_type?>"><?=h($msg)?></div>
        <div style="height:10px;"></div>
      <?php endif; ?>

      <form method="post" style="display:grid;gap:12px;">
        <div class="field">
          <div class="label">Username</div>
          <input class="input" name="username" placeholder="z.B. tobi" required>
        </div>

        <div class="field">
          <div class="label">Passwort</div>
          <input class="input" type="password" name="password" placeholder="mindestens 8 Zeichen" required>
        </div>

        <label class="chip" style="justify-content:flex-start;">
          <input type="checkbox" name="is_admin" value="1">
          <span>Admin</span>
        </label>

        <button class="btn btn-primary" type="submit">Anlegen</button>
        <a class="btn" href="/index.php">← zurück</a>
      </form>
    </div>
  </div>

  <div class="col-8">
    <div class="card">
      <div class="h1">Bestehende Benutzer</div>
      <div class="small">Tools werden als JSON-Liste gespeichert (später ersetzen wir das durch Rollen/Permissions).</div>
      <div class="sep"></div>

      <table class="table">
        <tr><th>User</th><th>Admin</th><th>Tools</th><th>Aktion</th></tr>
        <?php foreach ($users as $u): ?>
          <tr>
            <td><?=h((string)$u['username'])?></td>
            <td><?=((int)$u['is_admin'] === 1) ? 'ja' : 'nein'?></td>
            <td><code><?=h((string)$u['tools'])?></code></td>
            <td><a class="btn" href="/admin_edit.php?id=<?=urlencode((string)$u['id'])?>">Bearbeiten</a></td>
          </tr>
        <?php endforeach; ?>
      </table>
    </div>
  </div>
</div>
<?php page_end(); ?>