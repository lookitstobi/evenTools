<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
require_admin();
$config = require __DIR__ . '/app/config.php';

$db = new PDO('sqlite:' . $config['db_path']);
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// Tool-Liste laden (auto-discovery)
$allTools = [];
$toolsBase = realpath($config['tools_dir']);
if ($toolsBase) {
  foreach (glob($toolsBase . '/*', GLOB_ONLYDIR) as $dir) $allTools[] = basename($dir);
  sort($allTools);
}

$msg     = null;
$msg_type = 'ok';
$open_id  = (int)($_GET['expanded'] ?? 0);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $action = (string)($_POST['action'] ?? 'create');

  // ── DELETE ───────────────────────────────────────────────────────────────
  if ($action === 'delete') {
    require_csrf_token((string)($_POST['csrf_token'] ?? ''));
    $deleteId   = (int)($_POST['delete_id'] ?? 0);
    $currentUid = (int)($_SESSION['uid'] ?? 0);

    if ($deleteId <= 0) {
      $msg = 'Ungültiger Benutzer.'; $msg_type = 'warn';
    } elseif ($deleteId === $currentUid) {
      $msg = 'Du kannst deinen eigenen Benutzer nicht loschen.'; $msg_type = 'warn';
    } else {
      $stmt = $db->prepare('SELECT id, username, is_admin FROM users WHERE id = ?');
      $stmt->execute([$deleteId]);
      $targetUser = $stmt->fetch(PDO::FETCH_ASSOC);
      if (!$targetUser) {
        $msg = 'Benutzer nicht gefunden.'; $msg_type = 'warn';
      } elseif ((int)$targetUser['is_admin'] === 1) {
        $adminCount = (int)$db->query('SELECT COUNT(*) FROM users WHERE is_admin = 1')->fetchColumn();
        if ($adminCount <= 1) {
          $msg = 'Der letzte Admin kann nicht geloscht werden.'; $msg_type = 'warn';
          $open_id = $deleteId;
        } else {
          $db->prepare('DELETE FROM users WHERE id = ?')->execute([$deleteId]);
          $msg = 'Benutzer "' . (string)$targetUser['username'] . '" geloscht.';
        }
      } else {
        $db->prepare('DELETE FROM users WHERE id = ?')->execute([$deleteId]);
        $msg = 'Benutzer "' . (string)$targetUser['username'] . '" geloscht.';
      }
    }

  // ── UPDATE ───────────────────────────────────────────────────────────────
  } elseif ($action === 'update') {
    require_csrf_token((string)($_POST['csrf_token'] ?? ''));
    $updateId   = (int)($_POST['update_id'] ?? 0);
    $currentUid = (int)($_SESSION['uid'] ?? 0);
    $open_id    = $updateId;

    $stmt = $db->prepare('SELECT id, username, is_admin FROM users WHERE id = ?');
    $stmt->execute([$updateId]);
    $targetUser = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$targetUser) {
      $msg = 'Benutzer nicht gefunden.'; $msg_type = 'warn';
    } else {
      $newUsername = trim($_POST['username'] ?? '');
      $is_admin    = !empty($_POST['is_admin']) ? 1 : 0;
      $newTools    = $_POST['tools'] ?? [];
      if (!is_array($newTools)) $newTools = [];
      $newTools = array_values(array_intersect($newTools, $allTools));
      if ($is_admin === 1) $newTools = $allTools;

      if ($newUsername === '') {
        $msg = 'Username darf nicht leer sein.'; $msg_type = 'warn';
      } else {
        $dup = $db->prepare('SELECT id FROM users WHERE username = ? AND id != ?');
        $dup->execute([$newUsername, $updateId]);
        if ($dup->fetch()) {
          $msg = 'Dieser Benutzername ist bereits vergeben.'; $msg_type = 'warn';
        } else {
          if ($is_admin === 0 && (int)$targetUser['is_admin'] === 1) {
            $adminCount = (int)$db->query('SELECT COUNT(*) FROM users WHERE is_admin = 1')->fetchColumn();
            if ($adminCount <= 1) {
              $msg = 'Du bist der letzte Admin - Adminrechte konnen nicht entzogen werden.';
              $msg_type = 'warn';
              goto update_done;
            }
          }
          $db->prepare('UPDATE users SET username = ?, is_admin = ?, tools = ? WHERE id = ?')
             ->execute([$newUsername, $is_admin, json_encode($newTools, JSON_THROW_ON_ERROR), $updateId]);
          $pw = $_POST['new_password'] ?? '';
          if ($pw !== '') {
            $db->prepare('UPDATE users SET passhash = ? WHERE id = ?')
               ->execute([password_hash($pw, PASSWORD_DEFAULT), $updateId]);
          }
          if ($updateId === $currentUid) {
            $_SESSION['username'] = $newUsername;
            $_SESSION['is_admin'] = $is_admin;
          }
          $msg = 'Anderungen gespeichert.';
        }
      }
    }
    update_done:

  // ── CREATE ───────────────────────────────────────────────────────────────
  } elseif ($action === 'create') {
    require_csrf_token((string)($_POST['csrf_token'] ?? ''));
    $u        = trim($_POST['username'] ?? '');
    $p        = $_POST['password'] ?? '';
    $is_admin = !empty($_POST['is_admin']) ? 1 : 0;

    if ($u === '' || $p === '') {
      $msg = 'Bitte Username und Passwort angeben.'; $msg_type = 'warn';
    } else {
      try {
        $stmt = $db->prepare('INSERT INTO users(username, passhash, tools, is_admin) VALUES(?,?,?,?)');
        $stmt->execute([$u, password_hash($p, PASSWORD_DEFAULT), json_encode([], JSON_THROW_ON_ERROR), $is_admin]);
        $open_id = (int)$db->lastInsertId();
        $msg = 'Benutzer "' . $u . '" angelegt.';
      } catch (Throwable $e) {
        $msg = 'Konnte Benutzer nicht anlegen (Username evtl. bereits vergeben).';
        $msg_type = 'bad';
      }
    }
  }
}

$users = $db->query("SELECT id, username, is_admin, tools FROM users ORDER BY username")->fetchAll(PDO::FETCH_ASSOC);

page_start('Admin · Benutzer');
?>
<!-- ══════════════════════════════════════════════════════════
     MODAL: Neuer Benutzer
     ══════════════════════════════════════════════════════════ -->
<div class="modal-overlay" id="create-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <div class="modal-box">
    <button class="modal-close" onclick="closeCreateModal()" aria-label="Schliessen">&#x2715;</button>
    <div class="h2" id="modal-title">Neuer Benutzer</div>
    <div class="sep"></div>
    <form method="post" class="modal-form-grid" id="create-form">
      <input type="hidden" name="action" value="create">
      <input type="hidden" name="csrf_token" value="<?=h(csrf_token())?>">
      <div class="field">
        <div class="label">Benutzername</div>
        <input class="input" name="username" id="modal-username" placeholder="z.B. tobi" required autocomplete="off">
      </div>
      <div class="field">
        <div class="label">Passwort</div>
        <input class="input" type="password" name="password" placeholder="Mindestens 8 Zeichen" required autocomplete="new-password">
      </div>
      <label class="chip chip-flex">
        <input type="checkbox" name="is_admin" value="1">
        <span>Adminrechte vergeben</span>
      </label>
      <div class="modal-actions">
        <button class="btn btn-primary" type="submit">Benutzer anlegen</button>
        <button class="btn" type="button" onclick="closeCreateModal()">Abbrechen</button>
      </div>
    </form>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     SEITE
     ══════════════════════════════════════════════════════════ -->
<div class="card card-compact-bottom">

  <?php if ($msg): ?>
    <div class="flash flash-spaced <?=h($msg_type)?>"><?=h($msg)?></div>
  <?php endif; ?>

  <!-- Toolbar -->
  <div class="um-toolbar">
    <button class="btn btn-primary" onclick="openCreateModal()">&#43; Neuer Benutzer</button>
    <select class="select um-sort-select" id="um-sort" onchange="sortUsers(this.value)" title="Sortierung">
      <option value="az">A &#x2013; Z</option>
      <option value="za">Z &#x2013; A</option>
      <option value="admin">Admins zuerst</option>
    </select>
    <div class="um-search-wrap">
      <input class="input um-search" id="um-search" type="search" placeholder="Benutzer suchen &#x2026;" oninput="filterUsers(this.value)" autocomplete="off">
    </div>
    <span class="um-count" id="um-count"><?=count($users)?> Benutzer</span>
  </div>

  <!-- Benutzerliste -->
  <div class="um-list" id="um-list">
  <?php foreach ($users as $u):
    $uid       = (int)$u['id'];
    $uname     = (string)$u['username'];
    $uadmin    = (int)$u['is_admin'];
    $utools    = json_decode((string)$u['tools'], true) ?: [];
    if ($uadmin) $utools = $allTools;
    $toolCount = count($utools);
    $initial   = mb_strtoupper(mb_substr($uname, 0, 1, 'UTF-8'), 'UTF-8');
  ?>
    <div class="um-item" id="um-item-<?=$uid?>" data-uid="<?=$uid?>" data-username="<?=h(strtolower($uname))?>" data-admin="<?=$uadmin?>">

      <!-- Row (klickbar) -->
      <div class="um-row" onclick="toggleUser(<?=$uid?>)" tabindex="0" role="button" aria-expanded="false" aria-controls="um-panel-<?=$uid?>">
        <div class="um-avatar"><?=h($initial)?></div>
        <div class="um-meta">
          <span class="um-username"><?=h($uname)?></span>
          <?php if ($uadmin): ?>
            <span class="um-badge um-badge-admin">Admin</span>
          <?php endif; ?>
          <span class="um-badge um-badge-tools"><?=$toolCount?> Tool<?=($toolCount !== 1 ? 's' : '')?></span>
        </div>
        <span class="um-chevron" aria-hidden="true">&#x203A;</span>
      </div>

      <!-- Panel (aufklappbar) -->
      <div class="um-panel" id="um-panel-<?=$uid?>">
        <form class="um-panel-form" method="post">
          <input type="hidden" name="action" value="update">
          <input type="hidden" name="update_id" value="<?=$uid?>">
          <input type="hidden" name="csrf_token" value="<?=h(csrf_token())?>">

          <!-- Felder -->
          <div class="um-panel-fields">
            <div class="field">
              <div class="label">Benutzername</div>
              <input class="input" type="text" name="username" value="<?=h($uname)?>" required autocomplete="off">
            </div>
            <div class="field">
              <div class="label">Neues Passwort</div>
              <input class="input" type="password" name="new_password" placeholder="Leer lassen = unverandert" autocomplete="new-password">
            </div>
          </div>

          <!-- Admin -->
          <div class="um-section-spacing">
            <label class="chip um-admin-chip chip-flex">
              <input type="checkbox" name="is_admin" value="1"
                <?=($uadmin ? 'checked' : '')?>
                onchange="onAdminToggle(<?=$uid?>, this.checked)">
              <span>Adminrechte</span>
            </label>
          </div>

          <!-- Tools -->
          <?php if ($allTools): ?>
          <div class="um-tools-section" id="tools-section-<?=$uid?>">
            <div class="label label-bottom-margin">Tools zuweisen</div>
            <div class="um-tools-grid">
              <?php foreach ($allTools as $t): ?>
                <label class="chip um-tool-chip <?=($uadmin ? 'um-tool-disabled' : '')?>">
                  <input type="checkbox" name="tools[]" value="<?=h($t)?>"
                    <?=(in_array($t, $utools, true) ? 'checked' : '')?>
                    <?=($uadmin ? 'disabled' : '')?>>
                  <span><?=h($t)?></span>
                </label>
              <?php endforeach; ?>
            </div>
            <?php if ($uadmin): ?>
              <div class="help help-top-margin">Als Admin werden alle Tools automatisch zugewiesen.</div>
            <?php endif; ?>
          </div>
          <?php endif; ?>

          <!-- Aktionen -->
          <div class="um-panel-actions">
            <button class="btn btn-primary" type="submit">Speichern</button>
            <span class="um-divider"></span>
            <?php if ((int)($_SESSION['uid'] ?? 0) !== $uid): ?>
              <button class="btn btn-danger um-delete-btn" type="button" onclick="showDeleteConfirm(<?=$uid?>)">Benutzer loschen</button>
              <div class="um-delete-confirm" id="um-del-<?=$uid?>">
                <span class="um-delete-warn">Wirklich loschen? Diese Aktion ist unwiederruflich.</span>
                <form method="post" class="form-display-contents">
                  <input type="hidden" name="action" value="delete">
                  <input type="hidden" name="csrf_token" value="<?=h(csrf_token())?>">
                  <input type="hidden" name="delete_id" value="<?=$uid?>">
                  <button class="btn btn-danger" type="submit">Ja, loschen</button>
                </form>
                <button class="btn" type="button" onclick="hideDeleteConfirm(<?=$uid?>)">Abbrechen</button>
              </div>
            <?php else: ?>
              <span class="help">Du kannst deinen eigenen Account nicht loschen.</span>
            <?php endif; ?>
          </div>

        </form>
      </div><!-- /um-panel -->
    </div><!-- /um-item -->
  <?php endforeach; ?>
  </div><!-- /um-list -->

</div>

<script nonce="<?= csp_nonce() ?>">
// ── State ──────────────────────────────────────────────────────────────────
var openUserId = <?=($open_id > 0 ? $open_id : 'null')?>;

// ── Accordion ──────────────────────────────────────────────────────────────
function toggleUser(uid) {
  document.querySelectorAll('.um-item').forEach(function(item) {
    var id    = parseInt(item.dataset.uid, 10);
    var panel = document.getElementById('um-panel-' + id);
    var row   = item.querySelector('.um-row');
    if (id === uid) {
      var isOpen = item.classList.contains('um-open');
      item.classList.toggle('um-open', !isOpen);
      panel.style.display = isOpen ? 'none' : 'block';
      row.setAttribute('aria-expanded', String(!isOpen));
    } else {
      item.classList.remove('um-open');
      if (panel) panel.style.display = 'none';
      if (row)   row.setAttribute('aria-expanded', 'false');
    }
  });
}

document.querySelectorAll('.um-row').forEach(function(row) {
  row.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleUser(parseInt(row.closest('.um-item').dataset.uid, 10));
    }
  });
});

// ── Admin-Toggle ───────────────────────────────────────────────────────────
function onAdminToggle(uid, isAdmin) {
  var section = document.getElementById('tools-section-' + uid);
  if (!section) return;
  section.querySelectorAll('.um-tool-chip').forEach(function(chip) {
    var cb = chip.querySelector('input[type="checkbox"]');
    cb.disabled = isAdmin;
    if (isAdmin) cb.checked = true;
    chip.classList.toggle('um-tool-disabled', isAdmin);
  });
  var hint = section.querySelector('.help');
  if (hint) hint.style.display = isAdmin ? '' : 'none';
}

// ── Filter ─────────────────────────────────────────────────────────────────
function filterUsers(q) {
  q = q.toLowerCase().trim();
  var visible = 0;
  document.querySelectorAll('.um-item').forEach(function(item) {
    var show = q === '' || (item.dataset.username || '').includes(q);
    item.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  var counter = document.getElementById('um-count');
  if (counter) counter.textContent = visible + ' Benutzer';
}

// ── Sort ───────────────────────────────────────────────────────────────────
function sortUsers(mode) {
  var list  = document.getElementById('um-list');
  var items = Array.from(list.querySelectorAll(':scope > .um-item'));
  items.sort(function(a, b) {
    if (mode === 'admin') {
      var diff = parseInt(b.dataset.admin, 10) - parseInt(a.dataset.admin, 10);
      if (diff !== 0) return diff;
    }
    var na = a.dataset.username || '';
    var nb = b.dataset.username || '';
    return mode === 'za' ? nb.localeCompare(na) : na.localeCompare(nb);
  });
  items.forEach(function(item) { list.appendChild(item); });
}

// ── Delete-Confirm (zweistufig) ────────────────────────────────────────────
function showDeleteConfirm(uid) {
  var conf   = document.getElementById('um-del-' + uid);
  var delBtn = conf ? conf.previousElementSibling : null;
  if (conf)   conf.style.display = 'flex';
  if (delBtn) delBtn.style.display = 'none';
}
function hideDeleteConfirm(uid) {
  var conf   = document.getElementById('um-del-' + uid);
  var delBtn = conf ? conf.previousElementSibling : null;
  if (conf)   conf.style.display = 'none';
  if (delBtn) delBtn.style.display = '';
}

// ── Modal ──────────────────────────────────────────────────────────────────
function openCreateModal() {
  var overlay = document.getElementById('create-modal');
  overlay.style.display = 'flex';
  setTimeout(function() {
    var inp = document.getElementById('modal-username');
    if (inp) inp.focus();
  }, 60);
}
function closeCreateModal() {
  document.getElementById('create-modal').style.display = 'none';
}
document.getElementById('create-modal').addEventListener('click', function(e) {
  if (e.target === this) closeCreateModal();
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeCreateModal();
});

// ── Auto-open nach Speichern ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  if (openUserId) toggleUser(openUserId);
});
</script>

<?php page_end(); ?>