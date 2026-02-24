<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
require_login();

$tools = $_SESSION['tools'] ?? [];
$is_admin = !empty($_SESSION['is_admin']);

page_start('Dashboard');
?>
<div class="grid">
  <div class="col-8">
    <div class="card">
      <div class="h1">Deine Tools</div>
      <div class="small">Klick ein Tool an – Rechte werden serverseitig geprüft.</div>

      <div class="sep"></div>

      <?php if (!$tools): ?>
        <div class="flash warn">Keine Tools zugewiesen.</div>
      <?php else: ?>
        <ul class="tool-list">
          <?php foreach ($tools as $t): ?>
            <li class="tool-item">
              <div class="tool-meta">
                <div class="tool-title"><?=h((string)$t)?></div>
                <div class="tool-sub">Startet über den geschützten Loader</div>
              </div>
              <a class="btn" href="/t/<?= urlencode((string)$t) ?>/">Öffnen</a>
            </li>
          <?php endforeach; ?>
        </ul>
      <?php endif; ?>
    </div>
  </div>

  <div class="col-4">
    <div class="card">
      <div class="h2" style="margin-top:0;">Status</div>
      <div class="small">Session aktiv · Tools per Whitelist</div>
      <div class="sep"></div>

      <?php if ($is_admin): ?>
        <div class="flash ok">Adminrechte aktiv.</div>
        <div style="height:10px;"></div>
        <a class="btn" href="/admin_users.php">Benutzer verwalten</a>
      <?php else: ?>
        <div class="flash">Standardnutzer.</div>
      <?php endif; ?>
    </div>

    <div class="card">
      <div class="h2" style="margin-top:0;">Kurz erklärt</div>
      <div class="small">
        Tools liegen geschützt unter <span style="font-family:var(--mono)">/app/</span> und werden nur nach Login ausgeliefert.
      </div>
    </div>
  </div>
</div>
<?php page_end(); ?>