<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
require_login();

$tools = $_SESSION['tools'] ?? [];
$is_admin = !empty($_SESSION['is_admin']);

$tool_meta = [
  'cuesheet' => [
    'title' => 'cueTools',
    'sub' => 'Cue-Planung und Ablaufhilfe',
    'logo' => '/assets/cueTools%20Logo.png'
  ],
  'dev_todo' => [
    'title' => 'todoTools',
    'sub' => 'Aufgaben fuer Tools, Seiten und Infrastruktur',
    'logo' => '/assets/todoTools%20Logo.png'
  ],
  'dguv_v3' => [
    'title' => 'dguvTools',
    'sub' => 'Prüflinge, Prüfungen, CSV-Labeldruckjobs',
    'logo' => '/assets/dguvTools%20Logo.png'
  ],
  'nti_tool' => [
    'title' => 'ntiTools',
    'sub' => 'Netzwerk- und Infrastrukturtool',
    'logo' => '/assets/ntiTools%20Logo.png'
  ],
  'patchmatrix' => [
    'title' => 'nexusTools',
    'sub' => 'Patchmatrix und Verbindungsübersicht',
    'logo' => '/assets/nexusTools%20Logo.png'
  ]
];

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
            <?php $meta = $tool_meta[$t] ?? null; ?>
            <li class="tool-item">
              <div class="tool-meta">
                <?php if (!empty($meta['logo'])): ?>
                  <img class="tool-logo" src="<?=h((string)$meta['logo'])?>" alt="<?=h(($meta['title'] ?? (string)$t) . ' Logo')?>">
                <?php endif; ?>
                <div>
                  <div class="tool-title"><?=h($meta['title'] ?? (string)$t)?></div>
                  <div class="tool-sub"><?=h($meta['sub'] ?? 'Startet über den geschützten Loader')?></div>
                </div>
              </div>
              <a class="btn" href="/tool.php?name=<?= urlencode((string)$t) ?>">Öffnen</a>
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

    <?php if ($is_admin): ?>
      <div class="card" id="adminTodoCard">
        <div class="h2" style="margin-top:0;">Admin Aufgaben</div>
        <div class="small">Schnellzugriff aus dem Dev To-Do Board</div>
        <div class="sep"></div>
        <div id="adminTodoList" class="small">Keine offenen Aufgaben.</div>
        <div style="height:10px;"></div>
        <a class="btn" href="/tool.php?name=dev_todo">Zum Board</a>
      </div>
    <?php endif; ?>

    <div class="card">
      <div class="h2" style="margin-top:0;">Kurz erklärt</div>
      <div class="small">
        Tools liegen geschützt unter <span style="font-family:var(--mono)">/app/</span> und werden nur nach Login ausgeliefert.
      </div>
    </div>
  </div>
</div>
<?php if ($is_admin): ?>
<script>
const ADMIN_TODO_KEY = "toolsapp_dev_todos_v1";
const adminTodoList = document.getElementById("adminTodoList");

function loadAdminTasks(){
  const raw = localStorage.getItem(ADMIN_TODO_KEY);
  if(!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveAdminTasks(tasks){
  localStorage.setItem(ADMIN_TODO_KEY, JSON.stringify(tasks));
}

function renderAdminTodo(){
  const tasks = loadAdminTasks().filter(task => task.status !== 'done');
  adminTodoList.innerHTML = '';

  if(tasks.length === 0){
    adminTodoList.textContent = 'Keine offenen Aufgaben.';
    return;
  }

  const list = document.createElement('div');
  list.style.display = 'grid';
  list.style.gap = '8px';

  tasks.slice(0, 6).forEach(task => {
    const row = document.createElement('label');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.addEventListener('change', () => {
      const all = loadAdminTasks();
      const next = all.map(item => item.id === task.id ? {...item, status: 'done'} : item);
      saveAdminTasks(next);
      renderAdminTodo();
    });

    const text = document.createElement('span');
    const label = task.title || 'Ohne Titel';
    const area = task.customArea?.trim() || task.areaValue || '';
    text.textContent = area ? `${label} (${area})` : label;

    row.append(cb, text);
    list.appendChild(row);
  });

  adminTodoList.appendChild(list);
}

renderAdminTodo();
</script>
<?php endif; ?>
<?php page_end(); ?>