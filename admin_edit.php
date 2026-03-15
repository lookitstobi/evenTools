<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
require_admin();
$config = require __DIR__ . '/app/config.php';

$db = new PDO('sqlite:' . $config['db_path']);
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$id = (int)($_GET['id'] ?? 0);
$stmt = $db->prepare("SELECT id, username, is_admin, tools FROM users WHERE id = ?");
$stmt->execute([$id]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$user) { http_response_code(404); echo "404"; exit; }

$allTools = [];
$toolsBase = realpath($config['tools_dir']);
if ($toolsBase) {
  foreach (glob($toolsBase . '/*', GLOB_ONLYDIR) as $dir) $allTools[] = basename($dir);
  sort($allTools);
}

$msg = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $newTools = $_POST['tools'] ?? [];
  if (!is_array($newTools)) $newTools = [];
  $newTools = array_values(array_intersect($newTools, $allTools));

  $is_admin = !empty($_POST['is_admin']) ? 1 : 0;

  if ($is_admin === 1) {
    $newTools = $allTools;
  }

  $db->prepare("UPDATE users SET tools = ?, is_admin = ? WHERE id = ?")
     ->execute([json_encode($newTools, JSON_THROW_ON_ERROR), $is_admin, $id]);

  $pw = $_POST['new_password'] ?? '';
  if ($pw !== '') {
    $db->prepare("UPDATE users SET passhash = ? WHERE id = ?")
       ->execute([password_hash($pw, PASSWORD_DEFAULT), $id]);
  }

  $msg = "Gespeichert.";
  $stmt->execute([$id]);
  $user = $stmt->fetch(PDO::FETCH_ASSOC);
}

$currentTools = json_decode($user['tools'], true) ?: [];
if ((int)$user['is_admin'] === 1) {
  $currentTools = $allTools;
}

page_start('Admin · User bearbeiten');
?>
<div class="card">
  <div class="h1">User bearbeiten</div>
  <div class="small">
    <span class="mono-inline"><?=h((string)$user['username'])?></span> · ID <?=h((string)$user['id'])?>
  </div>

  <div class="sep"></div>

  <?php if ($msg): ?>
    <div class="flash ok"><?=h($msg)?></div>
    <div class="spacer-10"></div>
  <?php endif; ?>

  <form method="post" class="grid">
    <div class="col-12">
      <label class="chip" style="justify-content:flex-start;">
        <input type="checkbox" name="is_admin" value="1" <?=((int)$user['is_admin']===1?'checked':'')?>>
        <span>Adminrechte</span>
      </label>
    </div>

    <div class="col-12">
      <div class="h2">Tools zuweisen</div>
      <div class="small">Tool-Ordner liegen unter <span class="mono-inline">/app/tools/</span>.</div>
      <div class="spacer-10"></div>

      <?php if (!$allTools): ?>
        <div class="flash warn">Keine Tools gefunden. Lege Ordner in <span class="mono-inline">/app/tools/</span> an.</div>
      <?php else: ?>
        <div class="grid admin-edit-tool-grid">
          <?php foreach ($allTools as $t): ?>
            <label class="col-4 chip" style="border-radius:14px;justify-content:flex-start;">
              <input type="checkbox" name="tools[]" value="<?=h($t)?>" <?=in_array($t, $currentTools, true) ? 'checked' : ''?>>
              <span><?=h($t)?></span>
            </label>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </div>

    <div class="col-6">
      <div class="h2">Passwort ändern</div>
      <div class="field">
        <div class="label">Neues Passwort</div>
        <input class="input" type="password" name="new_password" placeholder="leer lassen = unverändert">
        <div class="help">Optional. Wird nur gesetzt, wenn das Feld nicht leer ist.</div>
      </div>
    </div>

    <div class="col-12 admin-edit-actions">
      <button class="btn btn-primary" type="submit">Speichern</button>
      <a class="btn" href="/admin_users.php">← zurück</a>
      <a class="btn" href="/index.php">Dashboard</a>
    </div>
  </form>
</div>
<?php page_end(); ?>