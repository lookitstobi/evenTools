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
  $action = (string)($_POST['action'] ?? 'create');

  if ($action === 'delete') {
    require_csrf_token((string)($_POST['csrf_token'] ?? ''));

    $deleteId = (int)($_POST['delete_id'] ?? 0);
    $currentUid = (int)($_SESSION['uid'] ?? 0);

    if ($deleteId <= 0) {
      $msg = 'Ungültiger Benutzer.';
      $msg_type = 'warn';
    } elseif ($deleteId === $currentUid) {
      $msg = 'Du kannst deinen eigenen Benutzer nicht löschen.';
      $msg_type = 'warn';
    } else {
      $stmt = $db->prepare('SELECT id, username, is_admin FROM users WHERE id = ?');
      $stmt->execute([$deleteId]);
      $targetUser = $stmt->fetch(PDO::FETCH_ASSOC);

      if (!$targetUser) {
        $msg = 'Benutzer wurde nicht gefunden.';
        $msg_type = 'warn';
      } elseif ((int)$targetUser['is_admin'] === 1) {
        $adminCount = (int)$db->query('SELECT COUNT(*) FROM users WHERE is_admin = 1')->fetchColumn();
        if ($adminCount <= 1) {
          $msg = 'Der letzte Admin kann nicht gelöscht werden.';
          $msg_type = 'warn';
        } else {
          $del = $db->prepare('DELETE FROM users WHERE id = ?');
          $del->execute([$deleteId]);
          $msg = 'Benutzer „' . (string)$targetUser['username'] . '“ gelöscht.';
          $msg_type = 'ok';
        }
      } else {
        $del = $db->prepare('DELETE FROM users WHERE id = ?');
        $del->execute([$deleteId]);
        $msg = 'Benutzer „' . (string)$targetUser['username'] . '“ gelöscht.';
        $msg_type = 'ok';
      }
    }
  } else {
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
        <input type="hidden" name="action" value="create">
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
            <td style="display:flex;gap:8px;flex-wrap:wrap;">
              <a class="btn" href="/admin_edit.php?id=<?=urlencode((string)$u['id'])?>">Bearbeiten</a>
              <form method="post" onsubmit="return confirm('Benutzer wirklich löschen?');" style="display:inline;">
                <input type="hidden" name="action" value="delete">
                <input type="hidden" name="csrf_token" value="<?=h(csrf_token())?>">
                <input type="hidden" name="delete_id" value="<?=h((string)$u['id'])?>">
                <button class="btn btn-danger" type="submit">Löschen</button>
              </form>
            </td>
          </tr>
        <?php endforeach; ?>
      </table>
    </div>
  </div>
</div>
<?php page_end(); ?>