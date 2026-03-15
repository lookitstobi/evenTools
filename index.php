<?php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
require_login();

$tools = $_SESSION['tools'] ?? [];
$is_admin = !empty($_SESSION['is_admin']);
$can_switch_pdf_mode = is_pdf_mode_switch_user();
$uid = (int)($_SESSION['uid'] ?? 0);
$dashboard_tools_setting_key = 'dashboard_visible_tools_' . $uid;
$dashboard_tools_raw = get_app_setting($dashboard_tools_setting_key, '__unset__');

if ($_SERVER['REQUEST_METHOD'] === 'POST' && (string)($_POST['action'] ?? '') === 'set_dashboard_visible_tools') {
  require_csrf_token((string)($_POST['csrf'] ?? ''));
  $selected_tools = $_POST['dashboard_tools'] ?? [];
  if (!is_array($selected_tools)) {
    $selected_tools = [];
  }
  $selected_tools = array_values(array_intersect($tools, $selected_tools));
  set_app_setting($dashboard_tools_setting_key, json_encode($selected_tools, JSON_THROW_ON_ERROR));
  redirect('/index.php?dashboard_tools_saved=1');
}

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

$dashboard_tools = [];
if ($dashboard_tools_raw === '__unset__') {
  $dashboard_tools = $tools;
} else {
  $decoded_dashboard_tools = json_decode($dashboard_tools_raw, true);
  if (!is_array($decoded_dashboard_tools)) {
    $decoded_dashboard_tools = [];
  }
  $dashboard_tools = array_values(array_intersect($tools, $decoded_dashboard_tools));
}

$has_todo_tool = in_array('dev_todo', $dashboard_tools, true);
$visible_tools = array_values(array_filter(
  $dashboard_tools,
  static fn(string $tool): bool => $tool !== 'dev_todo'
));

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
      <div class="dashboard-tools-head">
        <div>
          <div class="h1">Deine Tools</div>
          <div class="small">Klick ein Tool an – Rechte werden serverseitig geprüft.</div>
        </div>
        <?php if ($can_switch_pdf_mode): ?>
          <form method="post" class="pdf-mode-compact" id="pdfModeCompactForm">
            <input type="hidden" name="action" value="set_pdf_runtime_mode">
            <input type="hidden" name="csrf" value="<?=h(csrf_token())?>">
            <div class="label">PDF-Modus</div>
            <select class="select" name="pdf_runtime_mode" id="pdfModeCompactSelect" data-current="<?=h($current_pdf_mode)?>">
              <option value="legacy" <?=$current_pdf_mode === 'legacy' ? 'selected' : ''?>>Legacy</option>
              <option value="template" <?=$current_pdf_mode === 'template' ? 'selected' : ''?>>Neues PDF-System</option>
            </select>
          </form>
        <?php endif; ?>
      </div>

      <div class="sep"></div>

      <?php if (!$visible_tools): ?>
        <?php if ($has_todo_tool): ?>
          <div class="flash">Dein todoTools ist als kompaktes Panel rechts eingebunden.</div>
        <?php else: ?>
          <div class="flash warn">Keine Tools zugewiesen.</div>
        <?php endif; ?>
      <?php else: ?>
        <ul class="tool-list">
          <?php foreach ($visible_tools as $t): ?>
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
                <div class="tool-actions">
                  <a class="btn tool-open-btn" href="/tool.php?name=<?= urlencode((string)$t) ?>">Öffnen</a>
                </div>
              <?php endif; ?>
            </li>
          <?php endforeach; ?>
        </ul>
      <?php endif; ?>
    </div>
  </div>

  <div class="col-4">
    <?php if ($has_todo_tool): ?>
      <div class="card todo-dashboard-panel" id="todoDashboardPanel">
        <div class="todo-dashboard-head">
          <a class="todo-dashboard-title" href="/tool.php?name=dev_todo" title="Zum todoTools Board">
            <div class="h2" style="margin-top:0;">todoTools</div>
          </a>
          <span class="chip" id="todoDashboardCount">0 offen</span>
        </div>
        <div class="small">Schnell erfassen, Überblick behalten und direkt als erledigt markieren.</div>
        <div class="sep"></div>

        <form id="todoQuickForm" class="todo-quick-form">
          <input id="todoQuickTitle" class="input" name="title" placeholder="Neue Aufgabe" required>
          <button class="btn btn-primary" type="submit">Anlegen</button>

          <details class="todo-quick-advanced">
            <summary>Erweiterte Optionen</summary>
            <div class="todo-quick-grid">
              <div class="field">
                <div class="label">Beschreibung</div>
                <textarea id="todoQuickDetail" class="input" name="detail" rows="2" placeholder="Optional"></textarea>
              </div>
              <div class="field">
                <div class="label">Bereich</div>
                <select id="todoQuickAreaType" class="select" name="areaType">
                  <option value="tool">Tool</option>
                  <option value="page">Seite</option>
                  <option value="infra">Infrastruktur</option>
                </select>
              </div>
              <div class="field">
                <div class="label">Tool/Seite</div>
                <input id="todoQuickAreaValue" class="input" name="areaValue" value="cuesheet">
              </div>
              <div class="field">
                <div class="label">Priorität</div>
                <select id="todoQuickPriority" class="select" name="priority">
                  <option value="high">Hoch</option>
                  <option value="medium" selected>Mittel</option>
                  <option value="low">Niedrig</option>
                </select>
              </div>
              <div class="field">
                <div class="label">Status</div>
                <select id="todoQuickStatus" class="select" name="status">
                  <option value="backlog" selected>Backlog</option>
                  <option value="in_progress">In Arbeit</option>
                  <option value="done">Erledigt</option>
                </select>
              </div>
              <div class="field">
                <div class="label">Fällig bis</div>
                <input id="todoQuickDue" class="input" type="date" name="due">
              </div>
            </div>
          </details>
        </form>

        <details class="todo-quick-advanced">
          <summary>Ansicht</summary>
          <div class="field">
            <div class="label">Anzeigen</div>
            <select id="todoQuickFilter" class="select">
              <option value="open" selected>Nur offen</option>
              <option value="all">Alle</option>
              <option value="done">Nur erledigt</option>
            </select>
          </div>
        </details>

        <div class="spacer-10"></div>
        <div id="todoQuickList" class="todo-quick-list small">Keine Aufgaben vorhanden.</div>
      </div>
    <?php endif; ?>

    <div class="card">
      <div class="h2" style="margin-top:0;">Status</div>
      <div class="small">Session aktiv · Tools per Whitelist</div>
      <div class="sep"></div>

      <?php if ($can_switch_pdf_mode && isset($_GET['pdf_mode_saved'])): ?>
        <div class="flash ok">PDF-Modus global gespeichert.</div>
        <div class="spacer-10"></div>
      <?php endif; ?>

      <?php if (isset($_GET['dashboard_tools_saved'])): ?>
        <div class="flash ok">Dashboard-Toolauswahl gespeichert.</div>
        <div class="spacer-10"></div>
      <?php endif; ?>

      <details class="dashboard-tool-chooser">
        <summary>Sichtbare Dashboard-Tools</summary>
        <form method="post" class="dashboard-tool-chooser-form">
          <input type="hidden" name="action" value="set_dashboard_visible_tools">
          <input type="hidden" name="csrf" value="<?=h(csrf_token())?>">
          <div class="dashboard-tool-chooser-list">
            <?php foreach ($tools as $tool_key): ?>
              <?php $tool_label = (string)($tool_meta[$tool_key]['title'] ?? $tool_key); ?>
              <label class="dashboard-tool-chooser-item">
                <input type="checkbox" name="dashboard_tools[]" value="<?=h($tool_key)?>" <?=in_array($tool_key, $dashboard_tools, true) ? 'checked' : ''?>>
                <span><?=h($tool_label)?></span>
              </label>
            <?php endforeach; ?>
          </div>
          <button class="btn" type="submit">Auswahl speichern</button>
        </form>
      </details>

      <?php if ($is_admin): ?>
        <div class="flash ok">Adminrechte aktiv.</div>
        <div class="spacer-10"></div>
        <a class="btn" href="/admin_users.php">Benutzer verwalten</a>
      <?php else: ?>
        <div class="flash">Standardnutzer.</div>
      <?php endif; ?>
    </div>

  </div>
</div>
<?php if ($can_switch_pdf_mode): ?>
<script>
const pdfModeCompactForm = document.getElementById("pdfModeCompactForm");
const pdfModeCompactSelect = document.getElementById("pdfModeCompactSelect");

if (pdfModeCompactForm && pdfModeCompactSelect) {
  pdfModeCompactSelect.addEventListener("change", () => {
    const currentMode = pdfModeCompactSelect.dataset.current || "legacy";
    const nextMode = pdfModeCompactSelect.value;
    if (currentMode === nextMode) {
      return;
    }

    const nextLabel = nextMode === "legacy" ? "Legacy" : "Neues PDF-System";
    const confirmed = window.confirm(`PDF-Modus wirklich auf ${nextLabel} umstellen? Die Änderung gilt global für alle Benutzer.`);
    if (!confirmed) {
      pdfModeCompactSelect.value = currentMode;
      return;
    }

    pdfModeCompactForm.submit();
  });
}
</script>
<?php endif; ?>
<?php if ($has_todo_tool): ?>
<script>
const TODO_DASHBOARD_KEY = "toolsapp_dev_todos_v1";
const todoPanel = document.getElementById("todoDashboardPanel");

function loadTodoTasks(){
  const raw = localStorage.getItem(TODO_DASHBOARD_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveTodoTasks(tasks){
  localStorage.setItem(TODO_DASHBOARD_KEY, JSON.stringify(tasks));
}

function makeTodoId(){
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function labelForArea(task){
  const value = (task.customArea || "").trim() || task.areaValue || "";
  if (task.areaType === "tool") return `Tool: ${value}`;
  if (task.areaType === "page") return `Seite: ${value}`;
  return `Infra: ${value}`;
}

function renderTodoDashboard(){
  if (!todoPanel) return;

  const todoList = document.getElementById("todoQuickList");
  const todoCount = document.getElementById("todoDashboardCount");
  const filter = document.getElementById("todoQuickFilter");
  const mode = filter ? filter.value : "open";

  const all = loadTodoTasks().slice().sort((a, b) => {
    const aTime = Date.parse(a.createdAt || "") || 0;
    const bTime = Date.parse(b.createdAt || "") || 0;
    return bTime - aTime;
  });
  const openCount = all.filter(task => task.status !== "done").length;
  todoCount.textContent = `${openCount} offen`;

  let tasks = all;
  if (mode === "open") tasks = all.filter(task => task.status !== "done");
  if (mode === "done") tasks = all.filter(task => task.status === "done");

  todoList.innerHTML = "";

  if (tasks.length === 0) {
    todoList.textContent = "Keine Aufgaben vorhanden.";
    return;
  }

  const list = document.createElement("div");
  list.className = "todo-quick-items";

  tasks.slice(0, 8).forEach(task => {
    const row = document.createElement("label");
    row.className = "todo-quick-item";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = task.status === "done";
    cb.addEventListener("change", () => {
      const next = loadTodoTasks().map(item => {
        if (item.id !== task.id) return item;
        return {
          ...item,
          status: cb.checked ? "done" : "backlog"
        };
      });
      saveTodoTasks(next);
      renderTodoDashboard();
    });

    const textWrap = document.createElement("div");
    textWrap.className = "todo-quick-text";

    const title = document.createElement("strong");
    title.textContent = task.title || "Ohne Titel";

    const meta = document.createElement("span");
    meta.className = "small";
    meta.textContent = labelForArea(task);

    textWrap.append(title, meta);
    row.append(cb, textWrap);
    list.appendChild(row);
  });

  todoList.appendChild(list);
}

if (todoPanel) {
  const form = document.getElementById("todoQuickForm");
  const title = document.getElementById("todoQuickTitle");
  const detail = document.getElementById("todoQuickDetail");
  const areaType = document.getElementById("todoQuickAreaType");
  const areaValue = document.getElementById("todoQuickAreaValue");
  const priority = document.getElementById("todoQuickPriority");
  const status = document.getElementById("todoQuickStatus");
  const due = document.getElementById("todoQuickDue");
  const filter = document.getElementById("todoQuickFilter");

  form.addEventListener("submit", event => {
    event.preventDefault();
    const nextTitle = title.value.trim();
    if (!nextTitle) return;

    const nextAreaType = areaType.value;
    const fallbackArea = nextAreaType === "tool" ? "cuesheet" : nextAreaType === "page" ? "index.php" : "deployment";

    const next = loadTodoTasks();
    next.push({
      id: makeTodoId(),
      title: nextTitle,
      detail: detail.value.trim(),
      areaType: nextAreaType,
      areaValue: areaValue.value.trim() || fallbackArea,
      customArea: "",
      priority: priority.value,
      due: due.value,
      status: status.value,
      createdAt: new Date().toISOString()
    });
    saveTodoTasks(next);
    form.reset();
    priority.value = "medium";
    status.value = "backlog";
    areaType.value = "tool";
    areaValue.value = "cuesheet";
    renderTodoDashboard();
  });

  filter.addEventListener("change", renderTodoDashboard);
  areaType.addEventListener("change", () => {
    if (areaType.value === "tool") areaValue.value = "cuesheet";
    if (areaType.value === "page") areaValue.value = "index.php";
    if (areaType.value === "infra") areaValue.value = "deployment";
  });

  renderTodoDashboard();
}
</script>
<?php endif; ?>
<?php page_end(); ?>