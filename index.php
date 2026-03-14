<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
require_login();

$tools = $_SESSION['tools'] ?? [];
$is_admin = !empty($_SESSION['is_admin']);
$can_switch_pdf_mode = is_pdf_mode_switch_user();

if ($_SERVER['REQUEST_METHOD'] === 'POST' && (string)($_POST['action'] ?? '') === 'set_pdf_runtime_mode') {
  if (!$can_switch_pdf_mode) {
    http_response_code(403);
    echo '403';
    exit;
  }

  require_csrf_token((string)($_POST['csrf'] ?? ''));
  set_pdf_runtime_mode((string)($_POST['pdf_runtime_mode'] ?? 'legacy'));
  redirect('/index.php?pdf_mode_saved=1');
}

$current_pdf_mode = get_pdf_runtime_mode();

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
  ],
  'pdf_template_builder' => [
    'title' => 'pdfTemplateTools',
    'sub' => 'GUI fuer PDF-Vorlagen und Platzhalter',
    'logo' => '/assets/evenTools%20Logo.png',
    'disabled' => true,
    'disabled_note' => 'Der Editor ist aktuell inaktiv und bleibt fuer laufende Arbeiten erhalten.'
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
            <?php $toolDisabled = !empty($meta['disabled']); ?>
            <li class="tool-item">
              <div class="tool-meta">
                <?php if (!empty($meta['logo'])): ?>
                  <img class="tool-logo" src="<?=h((string)$meta['logo'])?>" alt="<?=h(($meta['title'] ?? (string)$t) . ' Logo')?>">
                <?php endif; ?>
                <div>
                  <div class="tool-title"><?=h($meta['title'] ?? (string)$t)?></div>
                  <div class="tool-sub"><?=h($meta['sub'] ?? 'Startet über den geschützten Loader')?></div>
                  <?php if ($toolDisabled): ?>
                    <div class="tool-note"><?=h((string)($meta['disabled_note'] ?? 'Dieses Tool ist derzeit inaktiv.'))?></div>
                  <?php endif; ?>
                </div>
              </div>
              <?php if ($toolDisabled): ?>
                <div class="tool-actions">
                  <span class="chip chip-warn">Inaktiv</span>
                  <button class="btn" type="button" disabled aria-disabled="true">In Bearbeitung</button>
                </div>
              <?php else: ?>
                <a class="btn" href="/tool.php?name=<?= urlencode((string)$t) ?>">Öffnen</a>
              <?php endif; ?>
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

      <?php if ($can_switch_pdf_mode && isset($_GET['pdf_mode_saved'])): ?>
        <div class="flash ok">PDF-Modus global gespeichert.</div>
        <div style="height:10px;"></div>
      <?php endif; ?>

      <?php if ($is_admin): ?>
        <div class="flash ok">Adminrechte aktiv.</div>
        <div style="height:10px;"></div>
        <a class="btn" href="/admin_users.php">Benutzer verwalten</a>
      <?php else: ?>
        <div class="flash">Standardnutzer.</div>
      <?php endif; ?>
    </div>

    <?php if ($can_switch_pdf_mode): ?>
      <div class="card">
        <div class="h2" style="margin-top:0;">PDF-Modus</div>
        <div class="small">Nur für dich sichtbar. Die Auswahl gilt global für alle Benutzer und alle Tools.</div>
        <div class="sep"></div>
        <form method="post" class="pdf-mode-form">
          <input type="hidden" name="action" value="set_pdf_runtime_mode">
          <input type="hidden" name="csrf" value="<?=h(csrf_token())?>">
          <fieldset class="pdf-mode-fieldset">
            <legend class="label">PDF-Erstellung für Berichte</legend>
            <label class="pdf-mode-option">
              <input type="radio" name="pdf_runtime_mode" value="legacy" <?=$current_pdf_mode === 'legacy' ? 'checked' : ''?>>
              <span>
                <strong>Legacy</strong>
                <small>Verwendet den alten, verlässlichen PDF-Generator.</small>
              </span>
            </label>
            <label class="pdf-mode-option">
              <input type="radio" name="pdf_runtime_mode" value="template" <?=$current_pdf_mode === 'template' ? 'checked' : ''?>>
              <span>
                <strong>Neues PDF-System</strong>
                <small>Verwendet die Vorlage aus dem PDF-Editor bzw. dem neuen Templatesystem.</small>
              </span>
            </label>
          </fieldset>
          <div class="pdf-mode-actions">
            <button class="btn btn-primary" type="submit">Modus speichern</button>
            <div class="small">Global aktiv: <strong><?=h($current_pdf_mode === 'legacy' ? 'Legacy' : 'Neues PDF-System')?></strong></div>
          </div>
        </form>
      </div>
    <?php endif; ?>

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