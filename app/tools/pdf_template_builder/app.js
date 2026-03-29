const MM_TO_PX = 3;
const PT_TO_STAGE_PX = MM_TO_PX * (25.4 / 72);

const state = {
  csrf: '',
  list: [],
  current: null,
  selectedIds: [],
  allowedToolKeys: [],
  fieldCatalog: {},
  bindingCatalogToolKey: '',
  bindingCatalogToolManual: false,
  bindingCatalogToolLastTemplate: '',
  undoStack: [],
  redoStack: [],
  clipboard: null,
  gridVisible: true,
};

const stageEl = document.getElementById('stage');
const stageViewportEl = document.getElementById('stageViewport');
const stageSurfaceEl = document.getElementById('stageSurface');
const stageCanvasEl = document.getElementById('stageCanvas');
const templateSelectEl = document.getElementById('templateSelect');
const titleInputEl = document.getElementById('titleInput');
const toolKeySelectEl = document.getElementById('toolKeySelect');
const assignCurrentDisplayEl = document.getElementById('assignCurrentDisplay');
const statusSelectEl = document.getElementById('statusSelect');
const propTextEl = document.getElementById('propText');
const propBindEl = document.getElementById('propBind');
const propXEl = document.getElementById('propX');
const propYEl = document.getElementById('propY');
const propWEl = document.getElementById('propW');
const propHEl = document.getElementById('propH');
const propFontSizeEl = document.getElementById('propFontSize');
const propFontWeightEl = document.getElementById('propFontWeight');
const propFontFamilyIdEl = document.getElementById('propFontFamilyId');
const propLineHeightFactorEl = document.getElementById('propLineHeightFactor');
const propBaselineOffsetMmEl = document.getElementById('propBaselineOffsetMm');
const propMaxLinesEl = document.getElementById('propMaxLines');
const propOverflowModeEl = document.getElementById('propOverflowMode');
const propAlignEl = document.getElementById('propAlign');
const propSnapEl = document.getElementById('propSnap');
const propTextColorEl = document.getElementById('propTextColor');
const propStrokeColorEl = document.getElementById('propStrokeColor');
const propFillColorEl = document.getElementById('propFillColor');
const propStrokeWidthEl = document.getElementById('propStrokeWidth');
const propImageSrcEl = document.getElementById('propImageSrc');
const selectionInfoEl = document.getElementById('selectionInfo');
const selectionToolbarEl = document.getElementById('selectionToolbar');
const rulerXEl = document.getElementById('rulerX');
const rulerYEl = document.getElementById('rulerY');
const messageEl = document.getElementById('message');
const btnZoomOut = document.getElementById('btnZoomOut');
const btnZoomReset = document.getElementById('btnZoomReset');
const btnZoomIn = document.getElementById('btnZoomIn');
const btnFitPage = document.getElementById('btnFitPage');
const btnFitWidth = document.getElementById('btnFitWidth');
const btnToggleGrid = document.getElementById('btnToggleGrid');
const helpDialogEl = document.getElementById('helpDialog');
const assignDialogEl = document.getElementById('assignDialog');
const assignDialogBodyEl = document.getElementById('assignDialogBody');
const propsPanelEl = document.getElementById('propsPanel');
const stageContextMenuEl = document.getElementById('stageContextMenu');
const ctxAddToggleEl = document.getElementById('ctxAddToggle');
const ctxAddSubEl = document.getElementById('ctxAddSub');
const ctxDeleteEl = document.getElementById('ctxDelete');
const ctxBindToggleEl = document.getElementById('ctxBindToggle');
const ctxBindSubEl = document.getElementById('ctxBindSub');
const ctxToolToggleEl = document.getElementById('ctxToolToggle');
const ctxToolSubEl = document.getElementById('ctxToolSub');
const ctxSnapEl = document.getElementById('ctxSnap');
const ctxGroupEl = document.getElementById('ctxGroup');
const ctxUngroupEl = document.getElementById('ctxUngroup');
const btnHelpClose = document.getElementById('btnHelpClose');
const btnAssignCancel = document.getElementById('btnAssignCancel');
const btnAssignConfirm = document.getElementById('btnAssignConfirm');

const btnNew = document.getElementById('btnNew');
const btnSave = document.getElementById('btnSave');
const btnExport = document.getElementById('btnExport');
const btnImport = document.getElementById('btnImport');
const btnPreview = document.getElementById('btnPreview');
const btnHelp = document.getElementById('btnHelp');
const btnDelete = document.getElementById('btnDelete');
const importFileInputEl = document.getElementById('importFileInput');
const btnDeleteSelected = document.getElementById('btnDeleteSelected');
const btnDuplicateSelected = document.getElementById('btnDuplicateSelected');
const btnDuplicateTemplate = document.getElementById('btnDuplicateTemplate');
const btnGroupSelection = document.getElementById('btnGroupSelection');
const btnUngroupSelection = document.getElementById('btnUngroupSelection');
const btnAssign = document.getElementById('btnAssign');
const layerListEl = document.getElementById('layerList');
const layerCountInfoEl = document.getElementById('layerCountInfo');
const templateVersionInfoEl = document.getElementById('templateVersionInfo');
const bindingListEl = document.getElementById('bindingList');
const bindingSearchInputEl = document.getElementById('bindingSearchInput');
const bindingToolFilterSelectEl = document.getElementById('bindingToolFilterSelect');
const repoImageSelectEl = document.getElementById('repoImageSelect');
const btnApplyRepoImageEl = document.getElementById('btnApplyRepoImage');
const imageUploadInputEl = document.getElementById('imageUploadInput');

const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.4;
const ZOOM_STEP = 0.1;

const viewState = {
  zoom: 1,
  baseWidthPx: 654,
  baseHeightPx: 915,
  panActive: false,
  panPointerId: null,
  panStartX: 0,
  panStartY: 0,
  panScrollLeft: 0,
  panScrollTop: 0,
};

const imageAspectCache = new Map();

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  if (num < min) return min;
  if (num > max) return max;
  return num;
}

function normalizeElementForEditor(raw) {
  const el = raw && typeof raw === 'object' ? raw : {};
  const type = ['text', 'line', 'rect', 'rect_fill', 'image'].includes(el.type) ? el.type : 'text';
  const minHeight = type === 'line' ? 0.6 : 1;
  const align = ['left', 'center', 'right'].includes(el.align) ? el.align : 'left';
  const overflowMode = ['clip', 'ellipsis'].includes(el.overflow_mode) ? el.overflow_mode : 'clip';
  const fontFamilyId = (el.font_family_id === 'helvetica') ? 'helvetica' : 'helvetica';

  return {
    id: String(el.id || `el_${Math.random().toString(16).slice(2, 10)}`),
    type,
    x: clampNumber(el.x, 0, PAGE_WIDTH_MM, 0),
    y: clampNumber(el.y, 0, PAGE_HEIGHT_MM, 0),
    w: clampNumber(el.w, 1, PAGE_WIDTH_MM, 50),
    h: clampNumber(el.h, minHeight, PAGE_HEIGHT_MM, type === 'line' ? 1 : 6),
    text: String(el.text || ''),
    bind: String(el.bind || ''),
    snap: !!el.snap,
    font_size: clampNumber(el.font_size, 6, 40, 11),
    font_weight: (el.font_weight === 'bold') ? 'bold' : 'normal',
    align,
    stroke_color: String(el.stroke_color || '#747474'),
    fill_color: String(el.fill_color || '#14a76c'),
    text_color: String(el.text_color || '#272727'),
    stroke_width: clampNumber(el.stroke_width, 0.2, 10, 1),
    image_src: String(el.image_src || ''),
    group_id: String(el.group_id || ''),
    line_height_factor: clampNumber(el.line_height_factor, 0.8, 2.0, 1.2),
    baseline_offset_mm: clampNumber(el.baseline_offset_mm, -5, 5, 0),
    overflow_mode: overflowMode,
    max_lines: Math.round(clampNumber(el.max_lines, 0, 200, 0)),
    font_family_id: fontFamilyId,
  };
}

function normalizePayloadForEditor(payload, fallbackToolKey) {
  const src = payload && typeof payload === 'object' ? payload : {};
  const page = src.page && typeof src.page === 'object' ? src.page : {};
  const toolKey = String(src.tool_key || fallbackToolKey || 'nti_tool');
  const elementsRaw = Array.isArray(src.elements) ? src.elements : [];

  return {
    schema_version: 2,
    tool_key: toolKey,
    page: {
      format: 'a4',
      orientation: page.orientation === 'landscape' ? 'landscape' : 'portrait',
      unit: 'mm',
      width: clampNumber(page.width, 1, 210, 210),
      height: clampNumber(page.height, 1, 297, 297),
    },
    elements: elementsRaw.map((el) => normalizeElementForEditor(el)),
  };
}

function elementImageAspect(el) {
  if (!el || (el.type || '') !== 'image') {
    return null;
  }

  const cached = imageAspectCache.get(el.id);
  if (Number.isFinite(cached) && cached > 0) {
    return cached;
  }

  const fallback = (Number(el.w) > 0 && Number(el.h) > 0) ? (Number(el.w) / Number(el.h)) : null;
  return (Number.isFinite(fallback) && fallback > 0) ? fallback : null;
}

function updateImageAspectCache(el) {
  if (!el || (el.type || '') !== 'image') {
    return;
  }

  const src = String(el.image_src || '').trim();
  if (src === '') {
    imageAspectCache.delete(el.id);
    return;
  }

  const img = new Image();
  img.onload = () => {
    const w = Number(img.naturalWidth || 0);
    const h = Number(img.naturalHeight || 0);
    if (w > 0 && h > 0) {
      imageAspectCache.set(el.id, w / h);
    }
  };
  img.onerror = () => {
    // Bei Ladefehlern auf bestehendes/fallback-Verhältnis zurückfallen.
  };
  img.src = src;
}

function showMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.classList.toggle('error', isError);
  messageEl.classList.add('show');
  window.setTimeout(() => messageEl.classList.remove('show'), 2600);
}

/* ── Undo / Redo ──────────────────────────────────────────── */
function snapshotElements() {
  if (!state.current?.payload?.elements) return [];
  return JSON.parse(JSON.stringify(state.current.payload.elements));
}

function pushUndo() {
  state.undoStack.push(snapshotElements());
  if (state.undoStack.length > 60) state.undoStack.shift();
  state.redoStack = [];
}

let undoDebounceTimer = null;
let lastUndoWasPropertyChange = false;
let lastUndoShortcutAt = 0;
let lastRedoShortcutAt = 0;

function resetUndoDebounceState() {
  if (undoDebounceTimer) {
    clearTimeout(undoDebounceTimer);
    undoDebounceTimer = null;
  }
  lastUndoWasPropertyChange = false;
}

function pushUndoDebounced(isPropertyChange = true) {
  if (!undoDebounceTimer || !isPropertyChange || !lastUndoWasPropertyChange) {
    pushUndo();
  }
  lastUndoWasPropertyChange = isPropertyChange;
  if (undoDebounceTimer) {
    clearTimeout(undoDebounceTimer);
  }
  undoDebounceTimer = setTimeout(() => {
    undoDebounceTimer = null;
    lastUndoWasPropertyChange = false;
  }, 600);
}

function undoAction() {
  resetUndoDebounceState();
  if (state.undoStack.length === 0) return;
  if (state.current?.payload) {
    state.redoStack.push(snapshotElements());
    state.current.payload.elements = state.undoStack.pop();
    renderStage();
    renderLayerList();
    updatePropertyInputs();
    updateSelectionToolbar();
    showMessage('Rückgängig');
  }
}

function redoAction() {
  resetUndoDebounceState();
  if (state.redoStack.length === 0) return;
  if (state.current?.payload) {
    state.undoStack.push(snapshotElements());
    state.current.payload.elements = state.redoStack.pop();
    renderStage();
    renderLayerList();
    updatePropertyInputs();
    updateSelectionToolbar();
    showMessage('Wiederherstellen');
  }
}

/* ── Layer list ───────────────────────────────────────────── */
const LAYER_ICONS = { text: 'T', line: '―', rect: '☐', rect_fill: '▪', image: '🖼' };

function renderLayerList() {
  if (!layerListEl) return;
  const elements = getCurrentElements();
  layerListEl.innerHTML = '';

  if (layerCountInfoEl) {
    layerCountInfoEl.textContent = String(elements.length);
  }

  [...elements].reverse().forEach((el) => {
    const item = document.createElement('div');
    item.className = 'layer-item' + (isSelected(el.id) ? ' is-selected' : '');
    item.dataset.id = el.id;

    const icon = document.createElement('span');
    icon.className = 'layer-icon';
    icon.textContent = LAYER_ICONS[el.type] || '?';

    const groupBadge = document.createElement('span');
    groupBadge.className = 'layer-group-badge';
    groupBadge.textContent = el.group_id ? 'G' : '';
    groupBadge.title = el.group_id ? `Gruppe ${el.group_id}` : '';
      if (el.group_id) {
        groupBadge.style.backgroundColor = getGroupColor(el.group_id);
        groupBadge.style.color = '#fff';
        groupBadge.style.borderRadius = '3px';
        groupBadge.style.padding = '2px 4px';
        groupBadge.style.fontSize = '11px';
        groupBadge.style.fontWeight = 'bold';
      }

    const label = document.createElement('span');
    label.className = 'layer-label';
    const name = el.bind ? `{{${el.bind}}}` : (el.text || el.id);
    label.textContent = name;
    label.title = name;

    item.appendChild(icon);
    item.appendChild(groupBadge);
    item.appendChild(label);

    item.addEventListener('click', (ev) => {
      const id = item.dataset.id;
      if (ev.shiftKey) {
        if (isSelected(id)) {
          setSelectedIds(state.selectedIds.filter(v => v !== id));
        } else {
          setSelectedIds(expandSelectionWithGroupIds([...state.selectedIds, id]));
        }
      } else {
        setSelectedIds(expandSelectionWithGroupIds([id]));
      }
      renderStage();
      renderLayerList();
      updatePropertyInputs();
      updateSelectionToolbar();
    });

    layerListEl.appendChild(item);
  });
}

/* ── Binding catalog ──────────────────────────────────────── */
function catalogItemsForTool(toolKey) {
  const rawItems = Array.isArray(state.fieldCatalog[toolKey]) ? state.fieldCatalog[toolKey] : [];
  const normalized = rawItems
    .map((item) => {
      const key = String(item?.key || '').trim();
      if (key === '') return null;
      const label = String(item?.label || key).trim() || key;
      const group = String(item?.group || 'Allgemein').trim() || 'Allgemein';
      return { key, label, group };
    })
    .filter(Boolean);

  normalized.sort((a, b) => {
    const groupCmp = a.group.localeCompare(b.group, 'de', { sensitivity: 'base' });
    if (groupCmp !== 0) return groupCmp;
    const labelCmp = a.label.localeCompare(b.label, 'de', { sensitivity: 'base' });
    if (labelCmp !== 0) return labelCmp;
    return a.key.localeCompare(b.key, 'de', { sensitivity: 'base' });
  });

  return normalized;
}

function getBindingCatalogToolKey() {
  const fallback = state.current?.tool_key || state.allowedToolKeys[0] || '';
  if (state.bindingCatalogToolManual && state.bindingCatalogToolKey) {
    return state.bindingCatalogToolKey;
  }
  return fallback;
}

function fillBindingToolFilterSelect() {
  if (!bindingToolFilterSelectEl) return;
  const currentTool = state.current?.tool_key || state.allowedToolKeys[0] || '';

  bindingToolFilterSelectEl.innerHTML = '';
  state.allowedToolKeys.forEach((key) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = key;
    if (key === currentTool) {
      opt.textContent = `${key} (aktuelle Vorlage)`;
    }
    bindingToolFilterSelectEl.appendChild(opt);
  });

  if (!state.bindingCatalogToolManual || !state.bindingCatalogToolKey) {
    state.bindingCatalogToolKey = currentTool;
  }

  if (state.bindingCatalogToolKey && !state.allowedToolKeys.includes(state.bindingCatalogToolKey)) {
    state.bindingCatalogToolKey = currentTool;
    state.bindingCatalogToolManual = false;
  }

  if (state.bindingCatalogToolKey) {
    bindingToolFilterSelectEl.value = state.bindingCatalogToolKey;
  }
}

function renderBindingList(filter = '') {
  if (!bindingListEl) return;
  const toolKey = getBindingCatalogToolKey();
  const list = catalogItemsForTool(toolKey);
  const selectedBindings = new Set(selectedElements().map((el) => (el.bind || '').trim()).filter(Boolean));
  const query = filter.trim().toLowerCase();

  bindingListEl.innerHTML = '';
  const filtered = query
    ? list.filter(item => item.key.toLowerCase().includes(query) || (item.label || '').toLowerCase().includes(query))
    : list;

  const groups = new Map();
  filtered.forEach((item) => {
    const group = item.group || 'Allgemein';
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group).push(item);
  });

  Array.from(groups.keys())
    .sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }))
    .forEach((groupName) => {
      const wrap = document.createElement('div');
      wrap.className = 'binding-group';

      const title = document.createElement('div');
      title.className = 'binding-group-title';
      title.textContent = groupName;
      wrap.appendChild(title);

      groups.get(groupName).forEach((item) => {
        const el = document.createElement('div');
        el.className = 'binding-item';
        if (selectedBindings.has(item.key)) {
          el.classList.add('is-selected-binding');
        }

        const key = document.createElement('span');
        key.className = 'binding-key';
        key.textContent = item.key;

        const lbl = document.createElement('span');
        lbl.className = 'binding-label-text';
        lbl.textContent = item.label || '';

        el.appendChild(key);
        el.appendChild(lbl);

        el.addEventListener('click', () => {
          const items = selectedElements();
          if (items.length === 0) {
            showMessage('Zuerst ein Element auswählen.', true);
            return;
          }
          pushUndo();
          items.forEach(sel => { sel.bind = item.key; });
          renderStage();
          renderLayerList();
          updatePropertyInputs();
          showMessage(`Binding «${item.key}» gesetzt.`);
        });

        wrap.appendChild(el);
      });

      bindingListEl.appendChild(wrap);
    });
}

/* ── Selection toolbar show/hide + count update ──────────── */
function updateSelectionToolbar() {
  if (!selectionToolbarEl) return;
  const count = state.selectedIds.length;
  selectionToolbarEl.classList.toggle('is-disabled', count === 0);
  selectionToolbarEl.querySelectorAll('button').forEach((btn) => {
    btn.disabled = count === 0;
  });
  if (selectionInfoEl) {
    if (count === 0) {
      selectionInfoEl.textContent = 'Keine Auswahl';
    } else if (count === 1) {
      const el = selectedElement();
      selectionInfoEl.textContent = el ? `${el.id} @ ${el.x.toFixed(1)} / ${el.y.toFixed(1)} mm` : '1 Element';
    } else {
      selectionInfoEl.textContent = `${count} Elemente ausgewählt`;
    }
  }
  renderBindingList(bindingSearchInputEl ? bindingSearchInputEl.value : '');
}

/* ── Align & distribute ───────────────────────────────────── */
function alignSelection(type) {
  const items = selectedElements();
  if (items.length === 0) return;
  pushUndo();

  const groupMap = new Map();
  items.forEach(el => {
    if (el.group_id) {
      if (!groupMap.has(el.group_id)) groupMap.set(el.group_id, []);
      groupMap.get(el.group_id).push(el);
    }
  });
  
  if (groupMap.size > 0) {
    groupMap.forEach((groupElems) => {
      const minX = Math.min(...groupElems.map(e => Number(e.x)));
      const minY = Math.min(...groupElems.map(e => Number(e.y)));
      const maxX = Math.max(...groupElems.map(e => Number(e.x) + Number(e.w)));
      const maxY = Math.max(...groupElems.map(e => Number(e.y) + Number(e.h)));
      const gw = maxX - minX;
      const gh = maxY - minY;
      
      let newX = minX, newY = minY;
      if (type === 'left') newX = 0;
      else if (type === 'right') newX = PAGE_WIDTH_MM - gw;
      else if (type === 'hcenter') newX = (PAGE_WIDTH_MM - gw) / 2;
      else if (type === 'top') newY = 0;
      else if (type === 'bottom') newY = PAGE_HEIGHT_MM - gh;
      else if (type === 'vcenter') newY = (PAGE_HEIGHT_MM - gh) / 2;
      
      const ox = newX - minX, oy = newY - minY;
      groupElems.forEach(el => {
        el.x = Number((el.x + ox).toFixed(1));
        el.y = Number((el.y + oy).toFixed(1));
      });
    });
  }
  
  const ungrouped = items.filter(el => !el.group_id);

  if (type === 'page-left')    { items.forEach(el => { el.x = 0; }); }
  else if (type === 'page-right')  { items.forEach(el => { el.x = PAGE_WIDTH_MM - el.w; }); }
  else if (type === 'page-hcenter') { items.forEach(el => { el.x = (PAGE_WIDTH_MM - el.w) / 2; }); }
  else if (type === 'page-top')    { items.forEach(el => { el.y = 0; }); }
  else if (type === 'page-bottom') { items.forEach(el => { el.y = PAGE_HEIGHT_MM - el.h; }); }
  else if (type === 'page-vcenter') { items.forEach(el => { el.y = (PAGE_HEIGHT_MM - el.h) / 2; }); }
  else {
    // Align relative to bounding box of selection
    const b = selectedBoundsMm();
    if (!b) return;
    if      (type === 'left')    { ungrouped.forEach(el => { el.x = b.x; }); }
    else if (type === 'right')   { ungrouped.forEach(el => { el.x = b.x + b.w - el.w; }); }
    else if (type === 'hcenter') { ungrouped.forEach(el => { el.x = b.x + (b.w - el.w) / 2; }); }
    else if (type === 'top')     { ungrouped.forEach(el => { el.y = b.y; }); }
    else if (type === 'bottom')  { ungrouped.forEach(el => { el.y = b.y + b.h - el.h; }); }
    else if (type === 'vcenter') { ungrouped.forEach(el => { el.y = b.y + (b.h - el.h) / 2; }); }
  }

  items.forEach(el => {
    el.x = Number(Math.max(0, el.x).toFixed(1));
    el.y = Number(Math.max(0, el.y).toFixed(1));
  });

  renderStage();
  renderLayerList();
  updatePropertyInputs();
}

const GROUP_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#eab308'];
function getGroupColor(groupId) {
  if (!groupId) return null;
  const hash = [...groupId].reduce((h, c) => h + c.charCodeAt(0), 0);
  return GROUP_COLORS[hash % GROUP_COLORS.length];
}

function distributeSelection(axis) {
  const items = selectedElements();
  if (items.length < 3) {
    showMessage('Mindestens 3 Elemente für Verteilen.', true);
    return;
  }
  pushUndo();

  if (axis === 'horizontal') {
    const sorted = [...items].sort((a, b) => a.x - b.x);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalW = sorted.reduce((sum, el) => sum + el.w, 0);
    const gap = (last.x + last.w - first.x - totalW) / (sorted.length - 1);
    let cx = first.x;
    sorted.forEach(el => {
      el.x = Number(cx.toFixed(1));
      cx += el.w + gap;
    });
  } else {
    const sorted = [...items].sort((a, b) => a.y - b.y);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalH = sorted.reduce((sum, el) => sum + el.h, 0);
    const gap = (last.y + last.h - first.y - totalH) / (sorted.length - 1);
    let cy = first.y;
    sorted.forEach(el => {
      el.y = Number(cy.toFixed(1));
      cy += el.h + gap;
    });
  }

  renderStage();
  renderLayerList();
  updatePropertyInputs();
}

/* ── Duplicate selected elements ─────────────────────────── */
function duplicateSelected() {
  const items = selectedElements();
  if (items.length === 0) {
    showMessage('Keine Auswahl zum Duplizieren.', true);
    return;
  }
  pushUndo();
  const step = getGridStepMm();
  const newIds = [];
  items.forEach(el => {
    const copy = { ...el, id: `el_${Math.random().toString(16).slice(2, 10)}` };
    copy.x = Number(Math.min(PAGE_WIDTH_MM - copy.w, copy.x + step).toFixed(1));
    copy.y = Number(Math.min(PAGE_HEIGHT_MM - copy.h, copy.y + step).toFixed(1));
    copy.group_id = '';
    getCurrentElements().push(copy);
    newIds.push(copy.id);
  });
  setSelectedIds(newIds);
  renderStage();
  renderLayerList();
  updatePropertyInputs();
  updateSelectionToolbar();
  showMessage('Elemente dupliziert.');
}

/* ── Copy / Paste ─────────────────────────────────────────── */
function copySelected() {
  const items = selectedElements();
  if (items.length === 0) return;
  state.clipboard = items.map(el => ({ ...el }));
  showMessage(`${items.length} Element(e) kopiert.`);
}

function pasteClipboard() {
  if (!state.clipboard || state.clipboard.length === 0) return;
  pushUndo();
  const step = getGridStepMm();
  const newIds = [];
  state.clipboard.forEach(el => {
    const copy = { ...el, id: `el_${Math.random().toString(16).slice(2, 10)}` };
    copy.x = Number(Math.min(PAGE_WIDTH_MM - copy.w, copy.x + step * 2).toFixed(1));
    copy.y = Number(Math.min(PAGE_HEIGHT_MM - copy.h, copy.y + step * 2).toFixed(1));
    copy.group_id = '';
    getCurrentElements().push(copy);
    newIds.push(copy.id);
  });
  setSelectedIds(newIds);
  renderStage();
  renderLayerList();
  updatePropertyInputs();
  updateSelectionToolbar();
  showMessage('Eingefügt.');
}

/* ── Zoom: fit page / fit width ───────────────────────────── */
function fitPage() {
  if (!stageViewportEl) return;
  const vW = stageViewportEl.clientWidth;
  const vH = stageViewportEl.clientHeight;
  const zW = (vW - 32) / viewState.baseWidthPx;
  const zH = (vH - 32) / viewState.baseHeightPx;
  setZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.min(zW, zH))));
}

function fitWidth() {
  if (!stageViewportEl) return;
  const vW = stageViewportEl.clientWidth;
  const z = (vW - 32) / viewState.baseWidthPx;
  setZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)));
}

/* ── Toggle grid ──────────────────────────────────────────── */
function toggleGrid() {
  state.gridVisible = !state.gridVisible;
  stageEl.classList.toggle('stage-grid-on', state.gridVisible);
  if (btnToggleGrid) {
    btnToggleGrid.setAttribute('aria-pressed', String(state.gridVisible));
  }
}

/* ── Template version info ────────────────────────────────── */
function updateTemplateVersionInfo() {
  if (!templateVersionInfoEl) return;
  if (!state.current) {
    templateVersionInfoEl.textContent = 'Neu';
    return;
  }
  const v = state.current.version || 0;
  templateVersionInfoEl.textContent = v > 0 ? `v${v}` : 'Neu';
}

/* ── Duplicate current template ───────────────────────────── */
async function duplicateTemplate() {
  if (!state.current || !state.current.id) {
    showMessage('Keine gespeicherte Vorlage zum Duplizieren.', true);
    return;
  }
  const result = await api('duplicate', { id: state.current.id }, 'POST');
  if (!result.ok) throw new Error(result.error || 'duplicate_failed');
  await loadTemplateList();
  await openTemplate(String(result.id));
  fillTemplateSelect();
  showMessage('Vorlage dupliziert.');
}

function applyZoom() {
  if (!stageCanvasEl || !stageSurfaceEl) return;
  stageCanvasEl.style.transform = `scale(${viewState.zoom})`;
  stageSurfaceEl.style.width = `${Math.round(viewState.baseWidthPx * viewState.zoom)}px`;
  stageSurfaceEl.style.height = `${Math.round(viewState.baseHeightPx * viewState.zoom)}px`;
  if (btnZoomReset) {
    btnZoomReset.textContent = `${Math.round(viewState.zoom * 100)}%`;
  }
}

function setZoom(nextZoom, anchorClientX = null, anchorClientY = null) {
  if (!stageViewportEl) return;
  const prevZoom = viewState.zoom;
  const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Number(nextZoom.toFixed(2))));
  if (Math.abs(clamped - prevZoom) < 0.001) return;

  const rect = stageViewportEl.getBoundingClientRect();
  const ax = anchorClientX === null ? rect.width / 2 : (anchorClientX - rect.left);
  const ay = anchorClientY === null ? rect.height / 2 : (anchorClientY - rect.top);
  const logicalX = (stageViewportEl.scrollLeft + ax) / prevZoom;
  const logicalY = (stageViewportEl.scrollTop + ay) / prevZoom;

  viewState.zoom = clamped;
  applyZoom();

  stageViewportEl.scrollLeft = Math.max(0, logicalX * clamped - ax);
  stageViewportEl.scrollTop = Math.max(0, logicalY * clamped - ay);
}

function initViewportMetrics() {
  if (!stageCanvasEl || !stageSurfaceEl) return;
  const rect = stageCanvasEl.getBoundingClientRect();
  viewState.baseWidthPx = Math.round(rect.width) || 654;
  viewState.baseHeightPx = Math.round(rect.height) || 915;
  applyZoom();
}

function onViewportPointerDown(ev) {
  if (!stageViewportEl || ev.button !== 1) return;
  ev.preventDefault();
  viewState.panActive = true;
  viewState.panPointerId = ev.pointerId;
  viewState.panStartX = ev.clientX;
  viewState.panStartY = ev.clientY;
  viewState.panScrollLeft = stageViewportEl.scrollLeft;
  viewState.panScrollTop = stageViewportEl.scrollTop;
  stageViewportEl.classList.add('panning');
  stageViewportEl.setPointerCapture(ev.pointerId);
}

function onViewportPointerMove(ev) {
  if (!stageViewportEl || !viewState.panActive || ev.pointerId !== viewState.panPointerId) return;
  const dx = ev.clientX - viewState.panStartX;
  const dy = ev.clientY - viewState.panStartY;
  stageViewportEl.scrollLeft = viewState.panScrollLeft - dx;
  stageViewportEl.scrollTop = viewState.panScrollTop - dy;
}

function endViewportPan(ev) {
  if (!stageViewportEl || !viewState.panActive) return;
  if (ev && viewState.panPointerId !== null && ev.pointerId !== viewState.panPointerId) return;
  if (viewState.panPointerId !== null) {
    try {
      stageViewportEl.releasePointerCapture(viewState.panPointerId);
    } catch (_) {
      // ignore release failures (e.g. when capture already released)
    }
  }
  viewState.panActive = false;
  viewState.panPointerId = null;
  stageViewportEl.classList.remove('panning');
}

function onViewportWheel(ev) {
  if (!stageViewportEl) return;
  if (!(ev.ctrlKey || ev.metaKey)) return;
  ev.preventDefault();
  const delta = ev.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
  setZoom(viewState.zoom + delta, ev.clientX, ev.clientY);
}

function resolveApiBasePath() {
  const scripts = Array.from(document.getElementsByTagName('script'));
  const appScriptSrc = scripts
    .map((script) => script.src)
    .find((src) => typeof src === 'string' && src.includes('toolserve.php') && src.includes('file=app.js'));

  if (appScriptSrc) {
    const scriptUrl = new URL(appScriptSrc, window.location.href);
    const fromToolserve = scriptUrl.pathname.replace(/\/toolserve\.php$/i, '');
    if (fromToolserve) {
      return fromToolserve;
    }
  }

  const currentPath = window.location.pathname || '/';
  if (/\/[^/]+\.[a-z0-9]+$/i.test(currentPath)) {
    return currentPath.replace(/\/[^/]+$/, '') || '';
  }
  return currentPath.replace(/\/$/, '');
}

const API_BASE_PATH = resolveApiBasePath();

function buildApiUrl(action, query = {}) {
  const apiPath = `${API_BASE_PATH}/pdf_template_api.php`;
  const url = new URL(apiPath, window.location.origin);
  url.searchParams.set('action', action);
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });
  return url;
}

async function api(action, payload = null, method = 'GET', query = {}) {
  const url = buildApiUrl(action, query);

  if (method === 'GET') {
    const res = await fetch(url.toString(), { credentials: 'same-origin' });
    return res.json();
  }

  const body = payload ? { ...payload, csrf: state.csrf } : { csrf: state.csrf };
  const res = await fetch(url.toString(), {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return res.json();
}

function createDefaultPayload(toolKey) {
  const step = getGridStepMm();
  return normalizePayloadForEditor({
    schema_version: 2,
    tool_key: toolKey,
    page: {
      format: 'a4',
      orientation: 'portrait',
      unit: 'mm',
      width: 210,
      height: 297,
    },
    elements: [
      {
        id: `el_${Math.random().toString(16).slice(2, 10)}`,
        type: 'text',
        x: 4 * step,
        y: 4 * step,
        w: 24 * step,
        h: 2 * step,
        text: 'Neue Vorlage',
        bind: '',
        snap: false,
        font_size: 13,
        font_weight: 'bold',
        align: 'left',
        line_height_factor: 1.2,
        baseline_offset_mm: 0,
        overflow_mode: 'clip',
        max_lines: 0,
        font_family_id: 'helvetica',
        group_id: '',
      },
    ],
  }, toolKey);
}

function getCurrentElements() {
  if (!state.current || !state.current.payload || !Array.isArray(state.current.payload.elements)) {
    return [];
  }
  return state.current.payload.elements;
}

function fillTemplateSelect() {
  templateSelectEl.innerHTML = '';

  const optNew = document.createElement('option');
  optNew.value = '';
  optNew.textContent = 'Neue Vorlage';
  templateSelectEl.appendChild(optNew);

  state.list.forEach(item => {
    const opt = document.createElement('option');
    opt.value = String(item.id);
    opt.textContent = `${item.title} [${item.tool_key}] v${item.version}`;
    templateSelectEl.appendChild(opt);
  });

  if (state.current && state.current.id) {
    templateSelectEl.value = String(state.current.id);
  } else {
    templateSelectEl.value = '';
  }
}

function fillToolSelect() {
  toolKeySelectEl.innerHTML = '';
  state.allowedToolKeys.forEach(key => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = key;
    toolKeySelectEl.appendChild(opt);
  });
}

function fillBindingSelect(toolKey) {
  propBindEl.innerHTML = '';
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = '-';
  propBindEl.appendChild(empty);

  const list = catalogItemsForTool(toolKey);
  list.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.key;
    opt.textContent = `${item.key} · ${item.label}`;
    propBindEl.appendChild(opt);
  });
}

function renderStage() {
  stageEl.innerHTML = '';

  if (!state.current || !state.current.payload) {
    updateSelectionToolbar();
    return;
  }

  const payload = state.current.payload;
  const elements = Array.isArray(payload.elements) ? payload.elements : [];
  const hasMultiSelection = state.selectedIds.length > 1;

  elements.forEach(el => {
    const div = document.createElement('div');
    div.className = `element element-type-${el.type || 'text'}${isSelected(el.id) ? ' selected' : ''}`;
    div.dataset.id = el.id;
    if (el.group_id) {
      div.dataset.grouped = '1';
    }
    div.style.left = `${el.x * MM_TO_PX}px`;
    div.style.top = `${el.y * MM_TO_PX}px`;
    div.style.width = `${el.w * MM_TO_PX}px`;
    div.style.height = `${el.h * MM_TO_PX}px`;
    const fontPx = Math.max(1, (el.font_size || 11) * PT_TO_STAGE_PX);
    const lineHeightFactor = clampNumber(el.line_height_factor, 0.8, 2.0, 1.2);
    const baselineOffsetPx = clampNumber(el.baseline_offset_mm, -5, 5, 0) * MM_TO_PX;
    const maxLines = Math.round(clampNumber(el.max_lines, 0, 200, 0));
    const overflowMode = ['clip', 'ellipsis'].includes(el.overflow_mode) ? el.overflow_mode : 'clip';
    div.style.fontSize = `${fontPx}px`;
    div.style.lineHeight = `${Math.max(fontPx * 0.95, fontPx * lineHeightFactor)}px`;
    div.style.paddingTop = `${baselineOffsetPx}px`;
    div.style.fontWeight = el.font_weight || 'normal';
    div.style.fontFamily = 'Helvetica, Arial, sans-serif';
    div.style.textAlign = el.align || 'left';
    div.style.color = el.text_color || '#272727';
    if (el.group_id) {
      div.style.borderColor = getGroupColor(el.group_id);
    } else {
      div.style.borderColor = el.stroke_color || '#747474';
    }
    div.style.borderWidth = `${el.stroke_width || 1}px`;
    div.style.background = (el.type === 'rect_fill') ? (el.fill_color || '#14a76c') : 'rgba(255, 255, 255, 0.65)';

    if (el.type === 'line') {
      div.textContent = '';
      div.style.background = el.stroke_color || '#747474';
      div.style.border = '0';
      div.style.height = `${Math.max(1, (el.h || 1) * MM_TO_PX)}px`;
    } else if (el.type === 'image') {
      const imageSrc = (el.image_src || '').trim();
      if (imageSrc !== '') {
        if (!imageAspectCache.has(el.id)) {
          updateImageAspectCache(el);
        }
        div.style.backgroundImage = `url(${imageSrc})`;
        div.style.backgroundSize = 'contain';
        div.style.backgroundRepeat = 'no-repeat';
        div.style.backgroundPosition = 'center';
        div.style.backgroundColor = '#fff';
        div.textContent = '';
      } else {
        div.style.backgroundSize = '';
        div.style.backgroundRepeat = '';
        div.style.backgroundPosition = '';
        div.style.backgroundImage = 'none';
        div.style.backgroundColor = 'rgba(255, 228, 0, 0.12)';
        div.textContent = 'Bild';
      }
    } else {
      const label = el.bind ? `{{${el.bind}}}` : el.text;
      div.textContent = label || '(leer)';
      div.style.overflow = 'hidden';
      if (maxLines > 0) {
        div.style.display = '-webkit-box';
        div.style.webkitBoxOrient = 'vertical';
        div.style.webkitLineClamp = String(maxLines);
      } else {
        div.style.display = 'block';
        div.style.webkitLineClamp = '';
      }
      div.style.textOverflow = overflowMode === 'ellipsis' ? 'ellipsis' : 'clip';
    }

    if (!hasMultiSelection && isSelected(el.id)) {
      ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'].forEach(handle => {
        const h = document.createElement('span');
        h.className = `resize-handle resize-handle-${handle}`;
        h.dataset.handle = handle;
        h.addEventListener('pointerdown', onResizeHandlePointerDown);
        div.appendChild(h);
      });
    }

    div.addEventListener('pointerdown', onElementPointerDown);
    div.addEventListener('contextmenu', onElementContextMenu);

    stageEl.appendChild(div);
  });

  if (hasMultiSelection) {
    const bounds = selectedBoundsMm();
    if (bounds) {
      const box = document.createElement('div');
      box.className = 'selection-box';
      box.style.left = `${bounds.x * MM_TO_PX}px`;
      box.style.top = `${bounds.y * MM_TO_PX}px`;
      box.style.width = `${bounds.w * MM_TO_PX}px`;
      box.style.height = `${bounds.h * MM_TO_PX}px`;
      box.addEventListener('pointerdown', onSelectionBoxPointerDown);

      ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'].forEach(handle => {
        const h = document.createElement('span');
        h.className = `resize-handle resize-handle-${handle}`;
        h.dataset.handle = handle;
        h.addEventListener('pointerdown', onSelectionResizeHandlePointerDown);
        box.appendChild(h);
      });

      stageEl.appendChild(box);
    }
  }
  stageEl.classList.toggle('draw-mode-active', drawToolType !== '');
}

function updatePropertyInputs() {
  const items = selectedElements();
  const el = items[0] || null;
  updateSelectionToolbar();

  if (!el || items.length === 0) {
    propTextEl.value = '';
    propBindEl.value = '';
    propXEl.value = '';
    propYEl.value = '';
    propWEl.value = '';
    propHEl.value = '';
    propFontSizeEl.value = '';
    propFontWeightEl.value = 'normal';
    propFontFamilyIdEl.value = 'helvetica';
    propLineHeightFactorEl.value = '1.2';
    propBaselineOffsetMmEl.value = '0';
    propMaxLinesEl.value = '0';
    propOverflowModeEl.value = 'clip';
    propAlignEl.value = 'left';
    propSnapEl.checked = false;
    propTextColorEl.value = '#272727';
    propStrokeColorEl.value = '#747474';
    propFillColorEl.value = '#14a76c';
    propStrokeWidthEl.value = '1';
    propImageSrcEl.value = '';
    return;
  }

  if (items.length > 1) {
    // Multi-selection: show common values, leave position/size empty
    const mixedOrFirst = (getter) => {
      const vals = items.map(getter);
      return vals.every(v => v === vals[0]) ? String(vals[0]) : '';
    };
    propXEl.value = '';
    propYEl.value = '';
    propWEl.value = '';
    propHEl.value = '';
    propTextEl.value = mixedOrFirst(e => e.text);
    propBindEl.value = mixedOrFirst(e => e.bind);
    propFontSizeEl.value = mixedOrFirst(e => e.font_size);
    propFontWeightEl.value = mixedOrFirst(e => e.font_weight) || 'normal';
    propTextColorEl.value = mixedOrFirst(e => e.text_color) || '#272727';
    propFillColorEl.value = mixedOrFirst(e => e.fill_color) || '#14a76c';
    propStrokeColorEl.value = mixedOrFirst(e => e.stroke_color) || '#747474';
    propStrokeWidthEl.value = mixedOrFirst(e => e.stroke_width) || '1';
    return;
  }

  propTextEl.value = el.text || '';
  propBindEl.value = el.bind || '';
  propXEl.value = String(el.x);
  propYEl.value = String(el.y);
  propWEl.value = String(el.w);
  propHEl.value = String(el.h);
  propFontSizeEl.value = String(el.font_size || 11);
  propFontWeightEl.value = el.font_weight || 'normal';
  propFontFamilyIdEl.value = el.font_family_id || 'helvetica';
  propLineHeightFactorEl.value = String(el.line_height_factor ?? 1.2);
  propBaselineOffsetMmEl.value = String(el.baseline_offset_mm ?? 0);
  propMaxLinesEl.value = String(el.max_lines ?? 0);
  propOverflowModeEl.value = el.overflow_mode || 'clip';
  propAlignEl.value = el.align || 'left';
  propSnapEl.checked = !!el.snap;
  propTextColorEl.value = el.text_color || '#272727';
  propStrokeColorEl.value = el.stroke_color || '#747474';
  propFillColorEl.value = el.fill_color || '#14a76c';
  propStrokeWidthEl.value = String(el.stroke_width || 1);
  propImageSrcEl.value = el.image_src || '';
}

function applyPropsToSelection() {
  const items = selectedElements();
  if (items.length === 0) return;
  pushUndoDebounced(true);

  items.forEach((el) => {
    if (propTextEl.value !== '' || items.length === 1) el.text = propTextEl.value;
    if (propBindEl.value !== '' || items.length === 1) el.bind = propBindEl.value;
    if (items.length === 1) {
      el.x = Number(propXEl.value || 0);
      el.y = Number(propYEl.value || 0);
      el.w = Number(propWEl.value || 1);
      el.h = Number(propHEl.value || 1);
    }
    if (propFontSizeEl.value !== '') el.font_size = Number(propFontSizeEl.value || 11);
    if (propFontWeightEl.value) el.font_weight = propFontWeightEl.value;
    if (propFontFamilyIdEl.value) el.font_family_id = propFontFamilyIdEl.value || 'helvetica';
    el.line_height_factor = clampNumber(propLineHeightFactorEl.value || 1.2, 0.8, 2.0, 1.2);
    el.baseline_offset_mm = clampNumber(propBaselineOffsetMmEl.value || 0, -5, 5, 0);
    el.max_lines = Math.round(clampNumber(propMaxLinesEl.value || 0, 0, 200, 0));
    el.overflow_mode = ['clip', 'ellipsis'].includes(propOverflowModeEl.value) ? propOverflowModeEl.value : 'clip';
    if (propAlignEl.value) el.align = propAlignEl.value;
    el.snap = !!propSnapEl.checked;
    if (propTextColorEl.value) el.text_color = propTextColorEl.value || '#272727';
    if (propStrokeColorEl.value) el.stroke_color = propStrokeColorEl.value || '#747474';
    if (propFillColorEl.value) el.fill_color = propFillColorEl.value || '#14a76c';
    if (propStrokeWidthEl.value !== '') el.stroke_width = Number(propStrokeWidthEl.value || 1);
    if (items.length === 1) el.image_src = propImageSrcEl.value || '';
    if (el.type === 'image') {
      updateImageAspectCache(el);
    }
  });

  renderStage();
  renderLayerList();
  updatePropertyInputs();
}

let dragCtx = null;
let marqueeCtx = null;
let drawToolType = '';
let drawCtx = null;

function uniqueStrings(values) {
  return Array.from(new Set((values || []).filter(v => typeof v === 'string' && v !== '')));
}

function selectedElements() {
  const ids = new Set(state.selectedIds);
  return getCurrentElements().filter(el => ids.has(el.id));
}

function selectedElement() {
  return selectedElements()[0] || null;
}

function setSelectedIds(ids) {
  state.selectedIds = uniqueStrings(ids);
}

function clearSelection() {
  if (state.selectedIds.length === 0) return;
  setSelectedIds([]);
  renderStage();
  renderLayerList();
  updatePropertyInputs();
  updateSelectionToolbar();
}

function isSelected(id) {
  return state.selectedIds.includes(id);
}

function expandSelectionWithGroupIds(ids) {
  const idSet = new Set(uniqueStrings(ids));
  const elements = getCurrentElements();
  const grouped = new Set();
  elements.forEach((el) => {
    if (idSet.has(el.id) && el.group_id) {
      grouped.add(el.group_id);
    }
  });
  if (grouped.size === 0) {
    return Array.from(idSet);
  }
  elements.forEach((el) => {
    if (el.group_id && grouped.has(el.group_id)) {
      idSet.add(el.id);
    }
  });
  return Array.from(idSet);
}

function selectedBoundsMm() {
  const items = selectedElements();
  if (items.length === 0) {
    return null;
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  items.forEach((el) => {
    minX = Math.min(minX, Number(el.x || 0));
    minY = Math.min(minY, Number(el.y || 0));
    maxX = Math.max(maxX, Number(el.x || 0) + Number(el.w || 0));
    maxY = Math.max(maxY, Number(el.y || 0) + Number(el.h || 0));
  });
  return {
    x: minX,
    y: minY,
    w: Math.max(1, maxX - minX),
    h: Math.max(1, maxY - minY),
  };
}

function createGroupFromSelection() {
  const items = selectedElements();
  if (items.length < 2) {
    showMessage('Mindestens 2 Elemente auswählen.', true);
    return;
  }
  pushUndo();
  const gid = `grp_${Math.random().toString(16).slice(2, 10)}`;
  items.forEach((el) => { el.group_id = gid; });
  renderStage();
  renderLayerList();
  updatePropertyInputs();
  showMessage('Gruppe erstellt.');
}

function ungroupSelection() {
  const items = selectedElements();
  if (items.length === 0) {
    showMessage('Keine Auswahl für Gruppierung.', true);
    return;
  }
  pushUndo();
  items.forEach((el) => { el.group_id = ''; });
  renderStage();
  renderLayerList();
  updatePropertyInputs();
  showMessage('Gruppierung aufgehoben.');
}

function onElementPointerDown(ev) {
  if (ev.button !== 0) {
    return;
  }
  ev.preventDefault();
  const id = ev.currentTarget.dataset.id;
  const el = getCurrentElements().find(item => item.id === id);
  if (!el) return;

  const alreadySelected = isSelected(id);
  if (ev.shiftKey) {
    if (alreadySelected) {
      setSelectedIds(state.selectedIds.filter(v => v !== id));
    } else {
      setSelectedIds(expandSelectionWithGroupIds([...state.selectedIds, id]));
    }
  } else if (!alreadySelected) {
    setSelectedIds(expandSelectionWithGroupIds([id]));
  }

  const selectedItems = selectedElements();
  renderStage();
  renderLayerList();
  updatePropertyInputs();

  if (selectedItems.length > 1) {
    dragCtx = {
      mode: 'drag-multi',
      undoPushed: false,
      startPointerX: ev.clientX,
      startPointerY: ev.clientY,
      items: selectedItems.map((item) => ({
        id: item.id,
        startX: Number(item.x || 0),
        startY: Number(item.y || 0),
        startW: Number(item.w || 0),
        startH: Number(item.h || 0),
      })),
    };
  } else {
    const stageRect = stageEl.getBoundingClientRect();
    dragCtx = {
      mode: 'drag',
      undoPushed: false,
      id,
      startPointerX: ev.clientX,
      startPointerY: ev.clientY,
      startX: el.x,
      startY: el.y,
      startW: el.w,
      startH: el.h,
      handle: '',
      stageRect,
    };
  }

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp, { once: true });
}

function onSelectionBoxPointerDown(ev) {
  if (ev.button !== 0) return;
  if (ev.target.closest('.resize-handle')) return;
  ev.preventDefault();
  const items = selectedElements();
  if (items.length <= 1) return;

  dragCtx = {
    mode: 'drag-multi',
    undoPushed: false,
    startPointerX: ev.clientX,
    startPointerY: ev.clientY,
    items: items.map((item) => ({
      id: item.id,
      startX: Number(item.x || 0),
      startY: Number(item.y || 0),
      startW: Number(item.w || 0),
      startH: Number(item.h || 0),
    })),
  };

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp, { once: true });
}

function onSelectionResizeHandlePointerDown(ev) {
  if (ev.button !== 0) return;
  ev.preventDefault();
  ev.stopPropagation();

  const bounds = selectedBoundsMm();
  const items = selectedElements();
  if (!bounds || items.length <= 1) return;

  dragCtx = {
    mode: 'resize-group',
    undoPushed: false,
    startPointerX: ev.clientX,
    startPointerY: ev.clientY,
    handle: ev.currentTarget.dataset.handle || 'se',
    startBounds: { ...bounds },
    items: items.map((item) => ({
      id: item.id,
      startX: Number(item.x || 0),
      startY: Number(item.y || 0),
      startW: Number(item.w || 0),
      startH: Number(item.h || 0),
    })),
  };

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp, { once: true });
}

function onStagePointerDown(ev) {
  if (ev.button !== 0) return;
  if (ev.target.closest('.element, .selection-box, .resize-handle')) return;
  if (ev.target !== stageEl) return;

  if (drawToolType !== '') {
    ev.preventDefault();
    const start = clientPointToStageMm(ev.clientX, ev.clientY);
    const preview = document.createElement('div');
    preview.className = `draw-preview draw-preview-${drawToolType}`;
    preview.style.left = `${start.x * MM_TO_PX}px`;
    preview.style.top = `${start.y * MM_TO_PX}px`;
    preview.style.width = '1px';
    preview.style.height = '1px';
    stageEl.appendChild(preview);

    drawCtx = {
      type: drawToolType,
      start,
      latest: start,
      previewEl: preview,
    };

    window.addEventListener('pointermove', onDrawPointerMove);
    window.addEventListener('pointerup', onDrawPointerUp, { once: true });
    return;
  }

  ev.preventDefault();

  marqueeCtx = {
    startX: ev.clientX,
    startY: ev.clientY,
    append: !!ev.shiftKey,
    overlayEl: null,
  };

  const overlay = document.createElement('div');
  overlay.className = 'selection-marquee';
  overlay.style.left = `${ev.clientX}px`;
  overlay.style.top = `${ev.clientY}px`;
  overlay.style.width = '0px';
  overlay.style.height = '0px';
  document.body.appendChild(overlay);
  marqueeCtx.overlayEl = overlay;

  window.addEventListener('pointermove', onStageMarqueeMove);
  window.addEventListener('pointerup', onStageMarqueeUp, { once: true });
}

function onDrawPointerMove(ev) {
  if (!drawCtx || !drawCtx.previewEl) return;
  const point = clientPointToStageMm(ev.clientX, ev.clientY);
  drawCtx.latest = point;

  const left = Math.min(drawCtx.start.x, point.x);
  const top = Math.min(drawCtx.start.y, point.y);
  const width = Math.max(0.3, Math.abs(point.x - drawCtx.start.x));
  const height = Math.max(0.3, Math.abs(point.y - drawCtx.start.y));

  drawCtx.previewEl.style.left = `${left * MM_TO_PX}px`;
  drawCtx.previewEl.style.top = `${top * MM_TO_PX}px`;
  drawCtx.previewEl.style.width = `${width * MM_TO_PX}px`;
  drawCtx.previewEl.style.height = `${height * MM_TO_PX}px`;
}

function onDrawPointerUp() {
  window.removeEventListener('pointermove', onDrawPointerMove);
  if (!drawCtx) return;

  const step = getGridStepMm();
  const start = drawCtx.start;
  const end = drawCtx.latest || start;
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const rawW = Math.abs(end.x - start.x);
  const rawH = Math.abs(end.y - start.y);
  const width = Math.max(step, rawW);
  const height = Math.max(drawCtx.type === 'line' ? Math.max(0.6, step * 0.5) : step, rawH);

  if (drawCtx.previewEl && drawCtx.previewEl.parentNode) {
    drawCtx.previewEl.parentNode.removeChild(drawCtx.previewEl);
  }

  addElement(drawCtx.type, {
    x: Math.max(0, Math.min(PAGE_WIDTH_MM - width, left)),
    y: Math.max(0, Math.min(PAGE_HEIGHT_MM - height, top)),
    w: width,
    h: height,
  });

  drawCtx = null;
}

function onCanvasBackgroundPointerDown(ev) {
  if (ev.button !== 0) return;
  if (ev.shiftKey) return;
  if (viewState.panActive) return;
  const target = ev.target;
  if (!(target instanceof Element)) return;
  if (target.closest('.element, .selection-box, .resize-handle, .ruler')) return;
  clearSelection();
}

function onStageMarqueeMove(ev) {
  if (!marqueeCtx || !marqueeCtx.overlayEl) return;
  const left = Math.min(marqueeCtx.startX, ev.clientX);
  const top = Math.min(marqueeCtx.startY, ev.clientY);
  const width = Math.abs(ev.clientX - marqueeCtx.startX);
  const height = Math.abs(ev.clientY - marqueeCtx.startY);
  marqueeCtx.overlayEl.style.left = `${left}px`;
  marqueeCtx.overlayEl.style.top = `${top}px`;
  marqueeCtx.overlayEl.style.width = `${width}px`;
  marqueeCtx.overlayEl.style.height = `${height}px`;
}

function onStageMarqueeUp(ev) {
  window.removeEventListener('pointermove', onStageMarqueeMove);
  if (!marqueeCtx) return;

  const left = Math.min(marqueeCtx.startX, ev.clientX);
  const top = Math.min(marqueeCtx.startY, ev.clientY);
  const right = Math.max(marqueeCtx.startX, ev.clientX);
  const bottom = Math.max(marqueeCtx.startY, ev.clientY);

  const nextIds = [];
  stageEl.querySelectorAll('.element').forEach((node) => {
    const rect = node.getBoundingClientRect();
    const intersects = rect.right >= left && rect.left <= right && rect.bottom >= top && rect.top <= bottom;
    if (intersects) {
      nextIds.push(node.dataset.id || '');
    }
  });

  const expanded = expandSelectionWithGroupIds(nextIds);
  if (marqueeCtx.append) {
    setSelectedIds([...state.selectedIds, ...expanded]);
  } else {
    setSelectedIds(expanded);
  }
  renderStage();
  updatePropertyInputs();

  renderLayerList();

  if (marqueeCtx.overlayEl && marqueeCtx.overlayEl.parentNode) {
    marqueeCtx.overlayEl.parentNode.removeChild(marqueeCtx.overlayEl);
  }
  marqueeCtx = null;
}

function closeContextMenu() {
  if (!stageContextMenuEl) return;
  stageContextMenuEl.hidden = true;
  if (ctxAddSubEl) {
    ctxAddSubEl.classList.remove('open');
    ctxAddSubEl.style.left = '';
    ctxAddSubEl.style.top = '';
  }
  if (ctxBindSubEl) {
    ctxBindSubEl.classList.remove('open');
    ctxBindSubEl.style.left = '';
    ctxBindSubEl.style.top = '';
  }
  if (ctxToolSubEl) {
    ctxToolSubEl.classList.remove('open');
    ctxToolSubEl.style.left = '';
    ctxToolSubEl.style.top = '';
  }
}

function closeContextSubmenus() {
  if (ctxAddSubEl) ctxAddSubEl.classList.remove('open');
  if (ctxBindSubEl) ctxBindSubEl.classList.remove('open');
  if (ctxToolSubEl) ctxToolSubEl.classList.remove('open');
}

function toggleContextSubmenu(toggleEl, submenuEl) {
  if (!toggleEl || !submenuEl || !stageContextMenuEl || stageContextMenuEl.hidden) {
    return;
  }

  const wasOpen = submenuEl.classList.contains('open');
  closeContextSubmenus();
  if (wasOpen) {
    return;
  }

  submenuEl.classList.add('open');

  const toggleRect = toggleEl.getBoundingClientRect();
  const subRect = submenuEl.getBoundingClientRect();
  const gap = 6;

  const spaceRight = window.innerWidth - toggleRect.right - 8;
  const spaceLeft = toggleRect.left - 8;
  let left = toggleRect.right + gap;
  if (subRect.width > spaceRight && spaceLeft > spaceRight) {
    left = toggleRect.left - subRect.width - gap;
  }
  left = Math.max(8, Math.min(left, window.innerWidth - subRect.width - 8));

  const spaceBelow = window.innerHeight - toggleRect.top - 8;
  const spaceAbove = toggleRect.bottom - 8;
  let top = toggleRect.top;
  if (subRect.height > spaceBelow && spaceAbove > spaceBelow) {
    top = toggleRect.bottom - subRect.height;
  }
  top = Math.max(8, Math.min(top, window.innerHeight - subRect.height - 8));

  submenuEl.style.left = `${left}px`;
  submenuEl.style.top = `${top}px`;
}

function positionContextMenu(x, y) {
  if (!stageContextMenuEl) return;
  closeContextSubmenus();
  stageContextMenuEl.hidden = false;
  const rect = stageContextMenuEl.getBoundingClientRect();

  const spaceRight = window.innerWidth - x - 8;
  const spaceLeft = x - 8;
  let left = x;
  if (rect.width > spaceRight && spaceLeft > spaceRight) {
    left = x - rect.width;
  }
  left = Math.max(8, Math.min(left, window.innerWidth - rect.width - 8));

  const spaceBelow = window.innerHeight - y - 8;
  const spaceAbove = y - 8;
  let top = y;
  if (rect.height > spaceBelow && spaceAbove > spaceBelow) {
    top = y - rect.height;
  }
  top = Math.max(8, Math.min(top, window.innerHeight - rect.height - 8));

  stageContextMenuEl.style.left = `${left}px`;
  stageContextMenuEl.style.top = `${top}px`;
}

function fillContextBindingMenu() {
  if (!ctxBindSubEl) return;
  ctxBindSubEl.innerHTML = '';

  const el = selectedElement();
  const currentToolKey = state.current?.tool_key || state.allowedToolKeys[0] || '';
  const list = catalogItemsForTool(currentToolKey);

  const emptyBtn = document.createElement('button');
  emptyBtn.type = 'button';
  emptyBtn.className = 'ctx-item';
  emptyBtn.textContent = '- Kein Binding';
  emptyBtn.addEventListener('click', () => {
    const items = selectedElements();
    if (items.length === 0) return;
    items.forEach((item) => {
      item.bind = '';
    });
    renderStage();
    updatePropertyInputs();
    closeContextMenu();
  });
  ctxBindSubEl.appendChild(emptyBtn);

  list.forEach(item => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ctx-item';
    btn.textContent = `${item.label} (${item.key})`;
    btn.addEventListener('click', () => {
      const items = selectedElements();
      if (items.length === 0) return;
      items.forEach((entry) => {
        entry.bind = item.key;
      });
      renderStage();
      updatePropertyInputs();
      closeContextMenu();
    });
    ctxBindSubEl.appendChild(btn);
  });
}

function fillContextToolMenu() {
  if (!ctxToolSubEl) return;
  ctxToolSubEl.innerHTML = '';

  const currentKey = state.current?.tool_key || '';
  state.allowedToolKeys.forEach((key) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ctx-item';
    btn.textContent = key === currentKey ? `${key} (aktuell)` : key;
    btn.disabled = !state.current || key === currentKey;
    btn.addEventListener('click', () => {
      if (!toolKeySelectEl || !state.current) return;
      toolKeySelectEl.value = key;
      updateAssignButtonState();
      openAssignDialog();
      closeContextMenu();
    });
    ctxToolSubEl.appendChild(btn);
  });
}

function openContextMenu(clientX, clientY) {
  if (!stageContextMenuEl) return;
  const selected = selectedElements();
  const primary = selected[0] || null;
  const hasGrouped = selected.some((el) => !!el.group_id);

  if (ctxDeleteEl) {
    ctxDeleteEl.disabled = selected.length === 0;
  }

  if (ctxSnapEl) {
    ctxSnapEl.checked = !!primary?.snap;
    ctxSnapEl.disabled = !primary;
  }

  if (ctxGroupEl) {
    ctxGroupEl.disabled = selected.length < 2;
  }
  if (ctxUngroupEl) {
    ctxUngroupEl.disabled = selected.length === 0 || !hasGrouped;
  }

  fillContextBindingMenu();
  fillContextToolMenu();
  if (ctxBindToggleEl) {
    ctxBindToggleEl.disabled = !primary;
  }

  positionContextMenu(clientX, clientY);
}

function onElementContextMenu(ev) {
  ev.preventDefault();
  const id = ev.currentTarget?.dataset?.id || '';
  if (id !== '') {
    if (!isSelected(id)) {
      setSelectedIds(expandSelectionWithGroupIds([id]));
    }
    renderStage();
    renderLayerList();
    updatePropertyInputs();
  }
  openContextMenu(ev.clientX, ev.clientY);
}

function onStageContextMenu(ev) {
  ev.preventDefault();
  if (ev.target === stageEl && !ev.shiftKey) {
    clearSelection();
  }
  openContextMenu(ev.clientX, ev.clientY);
}

function onResizeHandlePointerDown(ev) {
  ev.preventDefault();
  ev.stopPropagation();

  const parent = ev.currentTarget.closest('.element');
  if (!parent) return;
  const id = parent.dataset.id;
  const el = getCurrentElements().find(item => item.id === id);
  if (!el) return;

  setSelectedIds([id]);
  renderStage();
  updatePropertyInputs();

  dragCtx = {
    mode: 'resize',
    undoPushed: false,
    id,
    startPointerX: ev.clientX,
    startPointerY: ev.clientY,
    startX: el.x,
    startY: el.y,
    startW: el.w,
    startH: el.h,
    imageAspect: elementImageAspect(el),
    handle: ev.currentTarget.dataset.handle || 'se',
  };

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp, { once: true });
}

function getGridStepMm() {
  const cssValue = getComputedStyle(stageEl).getPropertyValue('--grid-size-px').trim();
  const px = Number.parseFloat(cssValue);
  if (!Number.isFinite(px) || px <= 0) {
    return 5;
  }
  return px / MM_TO_PX;
}

function setDrawToolMode(type = '') {
  drawToolType = type || '';
  document.querySelectorAll('.tool-palette-btn[data-add-type]').forEach((btn) => {
    const btnType = btn.getAttribute('data-add-type') || '';
    const active = drawToolType !== '' && btnType === drawToolType;
    btn.classList.toggle('is-tool-active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  if (stageEl) {
    stageEl.classList.toggle('draw-mode-active', drawToolType !== '');
  }
}

function clientPointToStageMm(clientX, clientY) {
  const rect = stageEl.getBoundingClientRect();
  const logicalX = (clientX - rect.left) / viewState.zoom / MM_TO_PX;
  const logicalY = (clientY - rect.top) / viewState.zoom / MM_TO_PX;
  return {
    x: Math.max(0, Math.min(PAGE_WIDTH_MM, logicalX)),
    y: Math.max(0, Math.min(PAGE_HEIGHT_MM, logicalY)),
  };
}

function selectedImageElements() {
  return selectedElements().filter((el) => el.type === 'image');
}

async function convertImageSourceToJpegDataUrl(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';

    img.onload = () => {
      try {
        const srcW = Number(img.naturalWidth || 0);
        const srcH = Number(img.naturalHeight || 0);
        if (srcW <= 0 || srcH <= 0) {
          resolve(null);
          return;
        }

        const maxEdge = 2200;
        const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
        const outW = Math.max(1, Math.round(srcW * scale));
        const outH = Math.max(1, Math.round(srcH * scale));

        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        // JPEG has no alpha channel, so we render on white background.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, outW, outH);
        ctx.drawImage(img, 0, 0, outW, outH);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/jpeg;base64,')) {
          resolve(dataUrl);
          return;
        }
      } catch (_) {
        // Fall through to null.
      }
      resolve(null);
    };

    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function normalizeImageSourceForPdf(src) {
  const clean = String(src || '').trim();
  if (clean === '') return '';
  if (/^data:image\/(jpeg|jpg);base64,/i.test(clean)) {
    return clean;
  }

  const converted = await convertImageSourceToJpegDataUrl(clean);
  return converted || clean;
}

async function applyImageSourceToSelection(imageSrc, sourceLabel = 'Bildquelle') {
  const src = String(imageSrc || '').trim();
  if (src === '') return;
  const items = selectedImageElements();
  if (items.length === 0) {
    showMessage('Bitte zuerst ein Bildelement auswählen.', true);
    return;
  }

  const normalizedSrc = await normalizeImageSourceForPdf(src);
  pushUndo();
  items.forEach((el) => {
    el.image_src = normalizedSrc;
    updateImageAspectCache(el);
  });
  propImageSrcEl.value = normalizedSrc;
  renderStage();
  renderLayerList();
  updatePropertyInputs();
  if (normalizedSrc !== src) {
    showMessage(`${sourceLabel} übernommen (PDF-kompatibel konvertiert).`);
  } else {
    showMessage(`${sourceLabel} übernommen.`);
  }
}

async function loadRepoImages() {
  if (!repoImageSelectEl) return;
  const result = await api('list_repo_images');
  if (!result.ok) {
    throw new Error(result.error || 'list_repo_images_failed');
  }

  const images = Array.isArray(result.images) ? result.images : [];
  repoImageSelectEl.innerHTML = '';
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = '- Bild auswaehlen -';
  repoImageSelectEl.appendChild(empty);

  images.forEach((img) => {
    const opt = document.createElement('option');
    opt.value = String(img.url || '');
    const label = String(img.path || img.name || 'Bild');
    opt.textContent = label;
    opt.title = label;
    repoImageSelectEl.appendChild(opt);
  });
}

function renderRulers() {
  if (!rulerXEl || !rulerYEl) return;

  rulerXEl.innerHTML = '';
  rulerYEl.innerHTML = '';

  const stepMm = getGridStepMm();
  const majorEvery = 2;

  for (let mm = 0, i = 0; mm <= PAGE_WIDTH_MM + 0.001; mm += stepMm, i++) {
    const x = mm * MM_TO_PX;
    const tick = document.createElement('span');
    tick.className = 'ruler-tick';
    tick.style.left = `${x}px`;
    tick.style.height = (i % majorEvery === 0) ? '12px' : '7px';
    rulerXEl.appendChild(tick);

    if (i % majorEvery === 0) {
      const label = document.createElement('span');
      label.className = 'ruler-label';
      label.style.left = `${Math.max(0, x + 2)}px`;
      label.textContent = String(Math.round(mm));
      rulerXEl.appendChild(label);
    }
  }

  for (let mm = 0, i = 0; mm <= PAGE_HEIGHT_MM + 0.001; mm += stepMm, i++) {
    const y = mm * MM_TO_PX;
    const tick = document.createElement('span');
    tick.className = 'ruler-tick';
    tick.style.top = `${y}px`;
    tick.style.width = (i % majorEvery === 0) ? '12px' : '7px';
    rulerYEl.appendChild(tick);

    if (i % majorEvery === 0) {
      const label = document.createElement('span');
      label.className = 'ruler-label';
      label.style.top = `${Math.max(0, y + 1)}px`;
      label.textContent = String(Math.round(mm));
      rulerYEl.appendChild(label);
    }
  }
}

function onPointerMove(ev) {
  if (!dragCtx) return;
  const elements = getCurrentElements();
  const el = dragCtx.id ? elements.find(item => item.id === dragCtx.id) : null;

  const dxPx = ev.clientX - dragCtx.startPointerX;
  const dyPx = ev.clientY - dragCtx.startPointerY;

  if (!dragCtx.undoPushed && (Math.abs(dxPx) > 0 || Math.abs(dyPx) > 0)) {
    pushUndo();
    dragCtx.undoPushed = true;
  }

  const dxMm = dxPx / MM_TO_PX / viewState.zoom;
  const dyMm = dyPx / MM_TO_PX / viewState.zoom;
  const snapDefault = !!(el?.snap);
  const snapActive = ev.shiftKey ? !snapDefault : snapDefault;

  const snapToGrid = (valueMm) => {
    if (!snapActive) return valueMm;
    const stepMm = getGridStepMm();
    return Math.round(valueMm / stepMm) * stepMm;
  };

  if (dragCtx.mode === 'drag-multi') {
    const minStartX = Math.min(...dragCtx.items.map((item) => item.startX));
    const minStartY = Math.min(...dragCtx.items.map((item) => item.startY));
    const maxEndX = Math.max(...dragCtx.items.map((item) => item.startX + Math.max(1, item.startW || 1)));
    const maxEndY = Math.max(...dragCtx.items.map((item) => item.startY + Math.max(1, item.startH || 1)));
    const groupW = maxEndX - minStartX;
    const groupH = maxEndY - minStartY;

    let nextGroupX = Math.max(0, Math.min(PAGE_WIDTH_MM - groupW, minStartX + dxMm));
    let nextGroupY = Math.max(0, Math.min(PAGE_HEIGHT_MM - groupH, minStartY + dyMm));
    nextGroupX = snapToGrid(nextGroupX);
    nextGroupY = snapToGrid(nextGroupY);

    const offsetX = nextGroupX - minStartX;
    const offsetY = nextGroupY - minStartY;

    dragCtx.items.forEach((item) => {
      const target = elements.find((elx) => elx.id === item.id);
      if (!target) return;
      target.x = Number((item.startX + offsetX).toFixed(1));
      target.y = Number((item.startY + offsetY).toFixed(1));
    });
    renderStage();
    renderLayerList();
    updatePropertyInputs();
    return;
  }

  if (dragCtx.mode === 'resize-group') {
    const b = dragCtx.startBounds;
    if (!b) return;
    let nextX = b.x;
    let nextY = b.y;
    let nextW = b.w;
    let nextH = b.h;

    if (dragCtx.handle === 'se') {
      nextW = b.w + dxMm;
      nextH = b.h + dyMm;
    } else if (dragCtx.handle === 'e') {
      nextW = b.w + dxMm;
    } else if (dragCtx.handle === 's') {
      nextH = b.h + dyMm;
    } else if (dragCtx.handle === 'n') {
      nextH = b.h - dyMm;
      nextY = b.y + dyMm;
    } else if (dragCtx.handle === 'w') {
      nextW = b.w - dxMm;
      nextX = b.x + dxMm;
    } else if (dragCtx.handle === 'ne') {
      nextW = b.w + dxMm;
      nextH = b.h - dyMm;
      nextY = b.y + dyMm;
    } else if (dragCtx.handle === 'sw') {
      nextW = b.w - dxMm;
      nextX = b.x + dxMm;
      nextH = b.h + dyMm;
    } else {
      nextW = b.w - dxMm;
      nextX = b.x + dxMm;
      nextH = b.h - dyMm;
      nextY = b.y + dyMm;
    }

    nextW = Math.max(1, nextW);
    nextH = Math.max(1, nextH);
    const sx = nextW / b.w;
    const sy = nextH / b.h;

    dragCtx.items.forEach((item) => {
      const target = elements.find((elx) => elx.id === item.id);
      if (!target) return;
      const relX = item.startX - b.x;
      const relY = item.startY - b.y;
      target.x = Number((nextX + relX * sx).toFixed(1));
      target.y = Number((nextY + relY * sy).toFixed(1));
      target.w = Number(Math.max(1, item.startW * sx).toFixed(1));
      target.h = Number(Math.max(1, item.startH * sy).toFixed(1));
    });

    renderStage();
    updatePropertyInputs();
    return;
  }

  if (!el) return;

  if (dragCtx.mode === 'resize') {
    if (el.type === 'image') {
      const aspect = Math.max(0.0001, Number(dragCtx.imageAspect || elementImageAspect(el) || (dragCtx.startW / dragCtx.startH) || 1));
      const minW = 1;
      const minH = minW / aspect;

      let nextX = dragCtx.startX;
      let nextY = dragCtx.startY;
      let nextW = dragCtx.startW;
      let nextH = dragCtx.startH;

      const ratioFromWidth = (w) => w / dragCtx.startW;
      const ratioFromHeight = (h) => h / dragCtx.startH;

          if (dragCtx.handle === 'se' || dragCtx.handle === 'sw' || dragCtx.handle === 'ne' || dragCtx.handle === 'nw') {
            let candW = dragCtx.startW;
            let candH = dragCtx.startH;

            if (dragCtx.handle === 'se') {
              candW = dragCtx.startW + dxMm;
              candH = dragCtx.startH + dyMm;
            } else if (dragCtx.handle === 'sw') {
              candW = dragCtx.startW - dxMm;
              candH = dragCtx.startH + dyMm;
            } else if (dragCtx.handle === 'ne') {
              candW = dragCtx.startW + dxMm;
              candH = dragCtx.startH - dyMm;
            } else {
              candW = dragCtx.startW - dxMm;
              candH = dragCtx.startH - dyMm;
            }

            const wr = ratioFromWidth(candW);
            const hr = ratioFromHeight(candH);
            const scale = (Math.abs(wr - 1) >= Math.abs(hr - 1)) ? wr : hr;
            const clampedScale = Math.max(minW / dragCtx.startW, scale);

            nextW = dragCtx.startW * clampedScale;
            nextH = nextW / aspect;

            if (dragCtx.handle === 'se') {
              nextX = dragCtx.startX;
              nextY = dragCtx.startY;
            } else if (dragCtx.handle === 'sw') {
              nextX = dragCtx.startX + dragCtx.startW - nextW;
              nextY = dragCtx.startY;
            } else if (dragCtx.handle === 'ne') {
              nextX = dragCtx.startX;
              nextY = dragCtx.startY + dragCtx.startH - nextH;
            } else {
              nextX = dragCtx.startX + dragCtx.startW - nextW;
              nextY = dragCtx.startY + dragCtx.startH - nextH;
            }
          } else if (dragCtx.handle === 'e' || dragCtx.handle === 'w') {
            const candW = dragCtx.handle === 'e'
              ? (dragCtx.startW + dxMm)
              : (dragCtx.startW - dxMm);
            nextW = Math.max(minW, candW);
            nextH = nextW / aspect;
            if (dragCtx.handle === 'w') {
              nextX = dragCtx.startX + dragCtx.startW - nextW;
            }
            nextY = dragCtx.startY + (dragCtx.startH - nextH) / 2;
          } else {
            const candH = dragCtx.handle === 's'
              ? (dragCtx.startH + dyMm)
              : (dragCtx.startH - dyMm);
            nextH = Math.max(minH, candH);
            nextW = nextH * aspect;
            if (dragCtx.handle === 'n') {
              nextY = dragCtx.startY + dragCtx.startH - nextH;
            }
            nextX = dragCtx.startX + (dragCtx.startW - nextW) / 2;
          }

          nextX = snapToGrid(nextX);
          nextY = snapToGrid(nextY);
          nextW = Math.max(minW, snapToGrid(nextW));
          nextH = Math.max(minH, nextW / aspect);
          nextX = Math.max(0, Math.min(PAGE_WIDTH_MM - nextW, nextX));
          nextY = Math.max(0, Math.min(PAGE_HEIGHT_MM - nextH, nextY));

          el.x = Number(nextX.toFixed(1));
          el.y = Number(nextY.toFixed(1));
          el.w = Number(nextW.toFixed(1));
          el.h = Number(nextH.toFixed(1));

      renderStage();
      updatePropertyInputs();
      return;
    }

    const minW = 1;
    const minH = el.type === 'line' ? 0.6 : 1;

    let nextX = dragCtx.startX;
    let nextY = dragCtx.startY;
    let nextW = dragCtx.startW;
    let nextH = dragCtx.startH;

    if (dragCtx.handle === 'se') {
      nextW = dragCtx.startW + dxMm;
      nextH = dragCtx.startH + dyMm;
    } else if (dragCtx.handle === 'e') {
      nextW = dragCtx.startW + dxMm;
    } else if (dragCtx.handle === 's') {
      nextH = dragCtx.startH + dyMm;
    } else if (dragCtx.handle === 'n') {
      nextH = dragCtx.startH - dyMm;
      nextY = dragCtx.startY + dyMm;
    } else if (dragCtx.handle === 'w') {
      nextW = dragCtx.startW - dxMm;
      nextX = dragCtx.startX + dxMm;
    } else if (dragCtx.handle === 'ne') {
      nextW = dragCtx.startW + dxMm;
      nextH = dragCtx.startH - dyMm;
      nextY = dragCtx.startY + dyMm;
    } else if (dragCtx.handle === 'sw') {
      nextW = dragCtx.startW - dxMm;
      nextX = dragCtx.startX + dxMm;
      nextH = dragCtx.startH + dyMm;
    } else {
      nextW = dragCtx.startW - dxMm;
      nextX = dragCtx.startX + dxMm;
      nextH = dragCtx.startH - dyMm;
      nextY = dragCtx.startY + dyMm;
    }

    nextW = Math.max(minW, nextW);
    nextH = Math.max(minH, nextH);

    const handle = String(dragCtx.handle || 'se');
    const snapXPos = ['w', 'nw', 'sw'].includes(handle);
    const snapYPos = ['n', 'nw', 'ne'].includes(handle);
    const snapW = ['e', 'w', 'ne', 'nw', 'se', 'sw'].includes(handle);
    const snapH = ['n', 's', 'ne', 'nw', 'se', 'sw'].includes(handle);

    if (snapXPos) {
      nextX = snapToGrid(nextX);
    }
    if (snapYPos) {
      nextY = snapToGrid(nextY);
    }
    if (snapW) {
      nextW = Math.max(minW, snapToGrid(nextW));
    }
    if (snapH) {
      nextH = Math.max(minH, snapToGrid(nextH));
    }

    nextX = Math.max(0, Math.min(PAGE_WIDTH_MM - nextW, nextX));
    nextY = Math.max(0, Math.min(PAGE_HEIGHT_MM - nextH, nextY));

    el.x = Number(nextX.toFixed(1));
    el.y = Number(nextY.toFixed(1));
    el.w = Number(nextW.toFixed(1));
    el.h = Number(nextH.toFixed(1));

    renderStage();
    updatePropertyInputs();
    return;
  }

  let nextX = Math.max(0, Math.min(PAGE_WIDTH_MM, dragCtx.startX + dxMm));
  let nextY = Math.max(0, Math.min(PAGE_HEIGHT_MM, dragCtx.startY + dyMm));
  nextX = snapToGrid(nextX);
  nextY = snapToGrid(nextY);

  el.x = Number(nextX.toFixed(1));
  el.y = Number(nextY.toFixed(1));

  renderStage();
  updatePropertyInputs();
}

function deleteSelectedElement() {
  if (state.selectedIds.length === 0) {
    showMessage('Kein Element ausgewählt.', true);
    return;
  }
  pushUndo();

  const elements = getCurrentElements();
  const selectedSet = new Set(state.selectedIds);
  const before = elements.length;
  const kept = elements.filter((item) => !selectedSet.has(item.id));
  if (kept.length === before) {
    showMessage('Element nicht gefunden.', true);
    return;
  }

  state.current.payload.elements = kept;
  setSelectedIds([]);
  renderStage();
  renderLayerList();
  updatePropertyInputs();
  updateSelectionToolbar();
  const deleted = before - kept.length;
  showMessage(deleted > 1 ? `${deleted} Elemente gelöscht.` : 'Element gelöscht.');
}

function onPointerUp() {
  window.removeEventListener('pointermove', onPointerMove);
  dragCtx = null;
}

// refreshCurrentHeader aktualisiert Titel, Status und das Assign-Panel –
// state.current.tool_key wird NICHT durch toolKeySelectEl geändert.
function refreshCurrentHeader() {
  if (!state.current) return;
  titleInputEl.value = state.current.title || '';
  statusSelectEl.value = state.current.status || 'draft';

  const currentToolKey = state.current.tool_key || state.allowedToolKeys[0] || '';
  if (assignCurrentDisplayEl) {
    assignCurrentDisplayEl.textContent = currentToolKey || '–';
  }
  if (toolKeySelectEl) {
    toolKeySelectEl.value = currentToolKey;
  }

  const previousTemplateTool = state.bindingCatalogToolLastTemplate;
  if (
    !state.bindingCatalogToolManual
    || !state.bindingCatalogToolKey
    || (previousTemplateTool !== '' && state.bindingCatalogToolKey === previousTemplateTool)
  ) {
    state.bindingCatalogToolKey = currentToolKey;
    state.bindingCatalogToolManual = false;
  }
  state.bindingCatalogToolLastTemplate = currentToolKey;

  fillBindingToolFilterSelect();
  updateAssignButtonState();
  fillBindingSelect(currentToolKey);
  updateTemplateVersionInfo();
  renderBindingList(bindingSearchInputEl ? bindingSearchInputEl.value : '');
}

async function loadTemplateList() {
  const result = await api('list');
  if (!result.ok) {
    throw new Error(result.error || 'list_failed');
  }
  state.list = Array.isArray(result.items) ? result.items : [];
  fillTemplateSelect();
}

async function openTemplate(id) {
  if (!id) {
    const firstTool = state.current?.tool_key || state.allowedToolKeys[0] || 'nti_tool';
    state.current = {
      id: 0,
      title: 'Neue PDF-Vorlage',
      tool_key: firstTool,
      status: 'draft',
      version: 0,
      payload: createDefaultPayload(firstTool),
    };
    setSelectedIds(state.current.payload.elements[0] ? [state.current.payload.elements[0].id] : []);
    state.undoStack = [];
    state.redoStack = [];
    refreshCurrentHeader();
    renderStage();
    renderLayerList();
    updatePropertyInputs();
    updateSelectionToolbar();
    return;
  }

  const result = await api('get', null, 'GET', { id });
  if (!result.ok) {
    throw new Error(result.error || 'get_failed');
  }

  state.current = result.item;
  state.current.payload = normalizePayloadForEditor(state.current.payload, state.current.tool_key);
  setSelectedIds(state.current?.payload?.elements?.[0] ? [state.current.payload.elements[0].id] : []);
  state.undoStack = [];
  state.redoStack = [];
  refreshCurrentHeader();
  renderStage();
  renderLayerList();
  updatePropertyInputs();
  updateSelectionToolbar();
}

// ── Assign-Panel Logik ──────────────────────────────────────────────────────

function updateAssignButtonState() {
  if (!btnAssign) return;
  const currentKey = state.current?.tool_key || '';
  const selectedKey = toolKeySelectEl?.value || '';
  btnAssign.disabled = !state.current || selectedKey === '' || selectedKey === currentKey;
}

function openAssignDialog() {
  if (!state.current) {
    showMessage('Zuerst eine Vorlage laden.', true);
    return;
  }
  const fromKey = state.current.tool_key || '–';
  const toKey = toolKeySelectEl.value;
  if (!toKey || toKey === fromKey) {
    showMessage('Keine andere Zuordnung gewählt.', true);
    return;
  }
  if (assignDialogBodyEl) {
    assignDialogBodyEl.textContent =
      `Vorlage „${state.current.title}" wird von „${fromKey}" zu „${toKey}" umgestellt.`;
  }
  if (assignDialogEl && typeof assignDialogEl.showModal === 'function') {
    assignDialogEl.showModal();
  }
}

async function confirmAssign() {
  if (assignDialogEl && typeof assignDialogEl.close === 'function') {
    assignDialogEl.close();
  }
  if (!state.current) return;

  const newKey = toolKeySelectEl.value;
  const allowedBindings = catalogItemsForTool(newKey).map(f => f.key);

  // Bindings bereinigen: nicht mehr verfügbare Felder leeren
  const elements = getCurrentElements();
  let cleaned = 0;
  elements.forEach(el => {
    if (el.bind && !allowedBindings.includes(el.bind)) {
      el.bind = '';
      cleaned++;
    }
  });

  state.current.tool_key = newKey;
  if (state.current.payload) {
    state.current.payload.tool_key = newKey;
  }

  if (assignCurrentDisplayEl) {
    assignCurrentDisplayEl.textContent = newKey;
  }
  fillBindingSelect(newKey);
  updatePropertyInputs();
  renderStage();
  updateAssignButtonState();

  const info = cleaned > 0
    ? `Zuordnung auf „${newKey}" geändert. ${cleaned} Binding(s) zurückgesetzt.`
    : `Zuordnung auf „${newKey}" geändert.`;
  showMessage(info);
}

function collectCurrentPayload() {
  if (!state.current) return null;

  // tool_key kommt aus state.current – wird NUR durch explizite Zuordnung geändert
  const toolKey = state.current.tool_key || state.allowedToolKeys[0] || 'nti_tool';
  const payload = state.current.payload || createDefaultPayload(toolKey);
  state.current.payload = normalizePayloadForEditor(payload, toolKey);
  const normalizedPayload = state.current.payload;
  normalizedPayload.tool_key = toolKey;

  return {
    title: titleInputEl.value.trim() || 'PDF-Vorlage',
    tool_key: toolKey,
    status: statusSelectEl.value,
    payload: normalizedPayload,
  };
}

async function saveCurrent() {
  if (!state.current) return;

  const data = collectCurrentPayload();
  if (!data) return;

  if (state.current.id > 0) {
    const result = await api('save', {
      id: state.current.id,
      version: state.current.version,
      ...data,
    }, 'POST');

    if (!result.ok) {
      throw new Error(result.error || 'save_failed');
    }

    state.current.version = result.version;
    showMessage('Vorlage gespeichert.');
    await loadTemplateList();
    fillTemplateSelect();
    templateSelectEl.value = String(state.current.id);
    return;
  }

  const created = await api('create', data, 'POST');
  if (!created.ok) {
    throw new Error(created.error || 'create_failed');
  }

  state.current.id = created.id;
  state.current.version = 1;
  showMessage('Vorlage angelegt.');

  await loadTemplateList();
  fillTemplateSelect();
  templateSelectEl.value = String(state.current.id);
}

function downloadJsonFile(fileName, contentObj) {
  const pretty = JSON.stringify(contentObj, null, 2);
  const blob = new Blob([pretty], { type: 'application/json;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

function sanitizeFileStem(input, fallback = 'pdf-template') {
  const stem = String(input || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return stem || fallback;
}

async function exportCurrentTemplate() {
  if (!state.current || state.current.id <= 0) {
    showMessage('Bitte zuerst eine gespeicherte Vorlage waehlen.', true);
    return;
  }

  const result = await api('export', null, 'GET', { id: state.current.id });
  if (!result.ok || !result.template) {
    throw new Error(result.error || 'export_failed');
  }

  const stem = sanitizeFileStem(result.template.title || state.current.title || 'pdf-template');
  downloadJsonFile(`${stem}.json`, result.template);
  showMessage('JSON Export erstellt.');
}

function parseImportJson(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('invalid_import_file');
  }
  if (!parsed.payload || typeof parsed.payload !== 'object') {
    throw new Error('missing_payload');
  }
  return parsed;
}

async function importTemplateFromFile(file) {
  if (!file) return;
  const text = await file.text();
  const template = parseImportJson(text);
  const result = await api('import_json', {
    mode: 'create',
    template,
  }, 'POST');

  if (!result.ok) {
    throw new Error(result.error || 'import_failed');
  }

  await loadTemplateList();
  await openTemplate(String(result.id));
  fillTemplateSelect();
  templateSelectEl.value = String(result.id);
  showMessage('Vorlage erfolgreich importiert.');
}

async function previewCurrent() {
  if (!state.current) {
    showMessage('Keine Vorlage aktiv.', true);
    return;
  }

  const data = collectCurrentPayload();
  if (!data) {
    showMessage('Payload konnte nicht erstellt werden.', true);
    return;
  }

  const url = buildApiUrl('render_preview');

  const res = await fetch(url.toString(), {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      csrf: state.csrf,
      title: data.title,
      tool_key: data.tool_key,
      payload: data.payload,
    }),
  });

  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (!res.ok || !ct.includes('application/pdf')) {
    let message = `Preview fehlgeschlagen (HTTP ${res.status})`;
    if (ct.includes('application/json')) {
      const errPayload = await res.json();
      message = errPayload.error || message;
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
}

async function deleteCurrent() {
  if (!state.current || state.current.id <= 0) {
    showMessage('Nichts zu löschen.', true);
    return;
  }

  const ok = window.confirm('Vorlage wirklich löschen?');
  if (!ok) return;

  const result = await api('delete', { id: state.current.id }, 'POST');
  if (!result.ok) {
    throw new Error(result.error || 'delete_failed');
  }

  showMessage('Vorlage gelöscht.');
  state.current = null;
  setSelectedIds([]);
  await loadTemplateList();
  await openTemplate('');
}

function addElement(elementTypeOverride = null, boundsOverride = null) {
  if (!state.current || !state.current.payload) return;

  const elementType = elementTypeOverride || 'text';
  const elements = getCurrentElements();
  pushUndo();
  const step = getGridStepMm();
  const startX = boundsOverride ? Number(boundsOverride.x || 0) : (4 * step);
  const startY = boundsOverride ? Number(boundsOverride.y || 0) : ((6 + (elements.length * 2)) * step);
  const startW = boundsOverride ? Math.max(step, Number(boundsOverride.w || step)) : (20 * step);
  const startH = boundsOverride ? Math.max(step, Number(boundsOverride.h || step)) : (2 * step);
  const base = {
    id: `el_${Math.random().toString(16).slice(2, 10)}`,
    type: elementType,
    x: startX,
    y: startY,
    w: startW,
    h: startH,
    text: 'Neues Element',
    bind: '',
    snap: false,
    font_size: 11,
    font_weight: 'normal',
    font_family_id: 'helvetica',
    line_height_factor: 1.2,
    baseline_offset_mm: 0,
    overflow_mode: 'clip',
    max_lines: 0,
    align: 'left',
    text_color: '#272727',
    stroke_color: '#747474',
    fill_color: '#14a76c',
    stroke_width: 1,
    image_src: '',
    group_id: '',
  };

  let next = base;
  if (elementType === 'text') {
    next = { ...base, text: 'Neues Textfeld', w: boundsOverride ? startW : 24 * step, h: boundsOverride ? startH : 2 * step };
  } else if (elementType === 'line') {
    next = { ...base, text: '', w: boundsOverride ? startW : 24 * step, h: boundsOverride ? Math.max(0.6, startH) : 1 * step };
  } else if (elementType === 'rect') {
    next = { ...base, text: '', w: boundsOverride ? startW : 22 * step, h: boundsOverride ? startH : 6 * step, fill_color: 'transparent' };
  } else if (elementType === 'rect_fill') {
    next = { ...base, text: '', w: boundsOverride ? startW : 22 * step, h: boundsOverride ? startH : 6 * step, fill_color: '#98e3c3' };
  } else if (elementType === 'image') {
    next = { ...base, text: '', w: boundsOverride ? startW : 14 * step, h: boundsOverride ? startH : 9 * step, image_src: '' };
  }

  elements.push(next);
  setSelectedIds([next.id]);
  renderStage();
  renderLayerList();
  updatePropertyInputs();
  updateSelectionToolbar();
}

function addElementByType(elementType) {
  addElement(elementType);
}

function wireEvents() {
  if (stageViewportEl) {
    stageViewportEl.addEventListener('pointerdown', onViewportPointerDown);
    stageViewportEl.addEventListener('pointermove', onViewportPointerMove);
    stageViewportEl.addEventListener('pointerup', endViewportPan);
    stageViewportEl.addEventListener('pointercancel', endViewportPan);
    stageViewportEl.addEventListener('wheel', onViewportWheel, { passive: false });
  }

  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', () => setZoom(viewState.zoom + ZOOM_STEP));
  }
  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', () => setZoom(viewState.zoom - ZOOM_STEP));
  }
  if (btnZoomReset) {
    btnZoomReset.addEventListener('click', () => setZoom(1));
  }
  if (btnFitPage) {
    btnFitPage.addEventListener('click', fitPage);
  }
  if (btnFitWidth) {
    btnFitWidth.addEventListener('click', fitWidth);
  }
  if (btnToggleGrid) {
    btnToggleGrid.addEventListener('click', toggleGrid);
  }

  // ── Tool palette ──
  document.querySelectorAll('.tool-palette-btn[data-add-type]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      const type = btn.getAttribute('data-add-type') || 'text';
      if (ev.altKey) {
        addElementByType(type);
        return;
      }
      if (drawToolType === type) {
        setDrawToolMode('');
      } else {
        setDrawToolMode(type);
        showMessage(`Zeichenmodus: ${type}. Auf der Seite aufziehen.`);
      }
    });
  });

  // ── Align actions ──
  document.querySelectorAll('.align-action[data-align]').forEach((btn) => {
    btn.addEventListener('click', () => {
      alignSelection(btn.getAttribute('data-align'));
    });
  });

  // ── Distribute actions ──
  document.querySelectorAll('.distribute-action[data-distribute]').forEach((btn) => {
    btn.addEventListener('click', () => {
      distributeSelection(btn.getAttribute('data-distribute'));
    });
  });

  // ── Element sidebar actions ──
  if (btnDuplicateSelected) {
    btnDuplicateSelected.addEventListener('click', duplicateSelected);
  }
  if (btnGroupSelection) {
    btnGroupSelection.addEventListener('click', createGroupFromSelection);
  }
  if (btnUngroupSelection) {
    btnUngroupSelection.addEventListener('click', ungroupSelection);
  }

  // ── Duplicate template ──
  if (btnDuplicateTemplate) {
    btnDuplicateTemplate.addEventListener('click', async () => {
      try {
        await duplicateTemplate();
      } catch (err) {
        showMessage(`Duplizieren fehlgeschlagen: ${err.message}`, true);
      }
    });
  }

  // ── Binding search ──
  if (bindingSearchInputEl) {
    bindingSearchInputEl.addEventListener('input', () => {
      renderBindingList(bindingSearchInputEl.value);
    });
  }

  if (bindingToolFilterSelectEl) {
    bindingToolFilterSelectEl.addEventListener('change', () => {
      state.bindingCatalogToolManual = true;
      state.bindingCatalogToolKey = bindingToolFilterSelectEl.value || (state.current?.tool_key || state.allowedToolKeys[0] || '');
      renderBindingList(bindingSearchInputEl ? bindingSearchInputEl.value : '');
    });
  }

  if (btnApplyRepoImageEl && repoImageSelectEl) {
    btnApplyRepoImageEl.addEventListener('click', async () => {
      const src = repoImageSelectEl.value || '';
      if (!src) {
        showMessage('Bitte ein Repository-Bild auswaehlen.', true);
        return;
      }
      await applyImageSourceToSelection(src, 'Repository-Bild');
    });
  }

  if (imageUploadInputEl) {
    imageUploadInputEl.addEventListener('change', () => {
      const file = imageUploadInputEl.files && imageUploadInputEl.files[0];
      if (!file) return;
      if (!String(file.type || '').startsWith('image/')) {
        showMessage('Bitte eine Bilddatei auswaehlen.', true);
        imageUploadInputEl.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const src = String(reader.result || '');
        if (src === '') {
          showMessage('Bild konnte nicht gelesen werden.', true);
          return;
        }
        applyImageSourceToSelection(src, 'Lokales Bild').catch(() => {
          showMessage('Bild konnte nicht übernommen werden.', true);
        });
      };
      reader.onerror = () => {
        showMessage('Upload fehlgeschlagen.', true);
      };
      reader.readAsDataURL(file);
      imageUploadInputEl.value = '';
    });
  }

  stageEl.addEventListener('contextmenu', onStageContextMenu);
  stageEl.addEventListener('pointerdown', onStagePointerDown);
  if (stageCanvasEl) {
     stageViewportEl.addEventListener('pointerdown', onCanvasBackgroundPointerDown, true);
  }

  if (stageContextMenuEl) {
    stageContextMenuEl.addEventListener('contextmenu', (ev) => ev.preventDefault());
  }

  if (ctxAddToggleEl && ctxAddSubEl) {
    const openAddSub = () => toggleContextSubmenu(ctxAddToggleEl, ctxAddSubEl);
    ctxAddToggleEl.addEventListener('click', openAddSub);
    ctxAddToggleEl.addEventListener('mouseenter', openAddSub);
  }

  if (ctxBindToggleEl && ctxBindSubEl) {
    const openBindSub = () => {
      if (ctxBindToggleEl.disabled) return;
      toggleContextSubmenu(ctxBindToggleEl, ctxBindSubEl);
    };
    ctxBindToggleEl.addEventListener('click', openBindSub);
    ctxBindToggleEl.addEventListener('mouseenter', openBindSub);
  }

  if (ctxToolToggleEl && ctxToolSubEl) {
    const openToolSub = () => toggleContextSubmenu(ctxToolToggleEl, ctxToolSubEl);
    ctxToolToggleEl.addEventListener('click', openToolSub);
    ctxToolToggleEl.addEventListener('mouseenter', openToolSub);
  }

  if (ctxAddSubEl) {
    ctxAddSubEl.querySelectorAll('[data-add-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-add-type') || 'text';
        addElementByType(type);
        closeContextMenu();
      });
    });
  }

  if (ctxDeleteEl) {
    ctxDeleteEl.addEventListener('click', () => {
      deleteSelectedElement();
      closeContextMenu();
    });
  }

  if (ctxSnapEl) {
    ctxSnapEl.addEventListener('change', () => {
      const items = selectedElements();
      if (items.length === 0) return;
      items.forEach((el) => {
        el.snap = !!ctxSnapEl.checked;
      });
      updatePropertyInputs();
      renderStage();
    });
  }

  if (ctxGroupEl) {
    ctxGroupEl.addEventListener('click', () => {
      createGroupFromSelection();
      closeContextMenu();
    });
  }

  if (ctxUngroupEl) {
    ctxUngroupEl.addEventListener('click', () => {
      ungroupSelection();
      closeContextMenu();
    });
  }

  document.addEventListener('pointerdown', (ev) => {
    if (!stageContextMenuEl || stageContextMenuEl.hidden) return;
    if (stageContextMenuEl.contains(ev.target)) return;
    if (ctxAddSubEl && ctxAddSubEl.classList.contains('open') && ctxAddSubEl.contains(ev.target)) return;
    if (ctxBindSubEl && ctxBindSubEl.classList.contains('open') && ctxBindSubEl.contains(ev.target)) return;
    if (ctxToolSubEl && ctxToolSubEl.classList.contains('open') && ctxToolSubEl.contains(ev.target)) return;
    closeContextMenu();
  });

  window.addEventListener('blur', closeContextMenu);

  templateSelectEl.addEventListener('change', async () => {
    try {
      await openTemplate(templateSelectEl.value);
    } catch (err) {
      showMessage(`Laden fehlgeschlagen: ${err.message}`, true);
    }
  });

  btnNew.addEventListener('click', async () => {
    await openTemplate('');
    templateSelectEl.value = '';
    showMessage('Neue Vorlage gestartet.');
  });

  btnSave.addEventListener('click', async () => {
    try {
      await saveCurrent();
    } catch (err) {
      showMessage(`Speichern fehlgeschlagen: ${err.message}`, true);
    }
  });

  if (btnExport) {
    btnExport.addEventListener('click', async () => {
      try {
        await exportCurrentTemplate();
      } catch (err) {
        showMessage(`Export fehlgeschlagen: ${err.message}`, true);
      }
    });
  }

  if (btnImport && importFileInputEl) {
    btnImport.addEventListener('click', () => {
      importFileInputEl.value = '';
      importFileInputEl.click();
    });

    importFileInputEl.addEventListener('change', async () => {
      const file = importFileInputEl.files && importFileInputEl.files[0] ? importFileInputEl.files[0] : null;
      if (!file) return;
      try {
        await importTemplateFromFile(file);
      } catch (err) {
        showMessage(`Import fehlgeschlagen: ${err.message}`, true);
      } finally {
        importFileInputEl.value = '';
      }
    });
  }

  btnPreview.addEventListener('click', async () => {
    try {
      await previewCurrent();
    } catch (err) {
      showMessage(`Vorschau fehlgeschlagen: ${err.message}`, true);
    }
  });

  btnHelp.addEventListener('click', () => {
    if (helpDialogEl && typeof helpDialogEl.showModal === 'function') {
      helpDialogEl.showModal();
      return;
    }
    showMessage('Der Browser unterstützt keinen Dialog.');
  });

  if (btnHelpClose) {
    btnHelpClose.addEventListener('click', () => {
      if (helpDialogEl && typeof helpDialogEl.close === 'function') {
        helpDialogEl.close();
      }
    });
  }

  if (helpDialogEl) {
    helpDialogEl.addEventListener('click', (ev) => {
      const rect = helpDialogEl.getBoundingClientRect();
      const inside = ev.clientX >= rect.left && ev.clientX <= rect.right && ev.clientY >= rect.top && ev.clientY <= rect.bottom;
      if (!inside && typeof helpDialogEl.close === 'function') {
        helpDialogEl.close();
      }
    });
  }

  // ── Assign-Panel Events ──
  if (toolKeySelectEl) {
    // Nur Assign-Button-Zustand aktualisieren – state.current NICHT mutieren!
    toolKeySelectEl.addEventListener('change', updateAssignButtonState);
  }

  if (btnAssign) {
    btnAssign.addEventListener('click', openAssignDialog);
  }

  if (btnAssignCancel) {
    btnAssignCancel.addEventListener('click', () => {
      if (assignDialogEl && typeof assignDialogEl.close === 'function') {
        assignDialogEl.close();
      }
      // Select auf aktuelle Zuordnung zurücksetzen
      if (toolKeySelectEl && state.current) {
        toolKeySelectEl.value = state.current.tool_key || state.allowedToolKeys[0] || '';
      }
      updateAssignButtonState();
    });
  }

  if (btnAssignConfirm) {
    btnAssignConfirm.addEventListener('click', confirmAssign);
  }

  if (assignDialogEl) {
    assignDialogEl.addEventListener('click', (ev) => {
      const rect = assignDialogEl.getBoundingClientRect();
      const inside = ev.clientX >= rect.left && ev.clientX <= rect.right && ev.clientY >= rect.top && ev.clientY <= rect.bottom;
      if (!inside && typeof assignDialogEl.close === 'function') {
        assignDialogEl.close();
        if (toolKeySelectEl && state.current) {
          toolKeySelectEl.value = state.current.tool_key || '';
        }
        updateAssignButtonState();
      }
    });
  }

  btnDelete.addEventListener('click', async () => {
    try {
      await deleteCurrent();
    } catch (err) {
      showMessage(`Löschen fehlgeschlagen: ${err.message}`, true);
    }
  });

  if (btnDeleteSelected) {
    btnDeleteSelected.addEventListener('click', deleteSelectedElement);
  }

  window.addEventListener('keydown', (ev) => {
    if (ev.repeat && (ev.ctrlKey || ev.metaKey)) {
      return;
    }
    if (ev.key === 'Escape') {
      closeContextMenu();
      setDrawToolMode('');
      if (drawCtx?.previewEl && drawCtx.previewEl.parentNode) {
        drawCtx.previewEl.parentNode.removeChild(drawCtx.previewEl);
      }
      drawCtx = null;
    }
    const tag = (document.activeElement?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      return;
    }
    const ctrl = ev.ctrlKey || ev.metaKey;
    if (ctrl && ev.key.toLowerCase() === 'z') {
      const now = Date.now();
      if (now - lastUndoShortcutAt < 160) return;
      lastUndoShortcutAt = now;
      ev.preventDefault();
      ev.stopPropagation();
      undoAction();
      return;
    }
    if (ctrl && (ev.key.toLowerCase() === 'y' || (ev.shiftKey && ev.key.toLowerCase() === 'z'))) {
      const now = Date.now();
      if (now - lastRedoShortcutAt < 160) return;
      lastRedoShortcutAt = now;
      ev.preventDefault();
      ev.stopPropagation();
      redoAction();
      return;
    }
    if (ctrl && ev.key.toLowerCase() === 'd') {
      ev.preventDefault();
      duplicateSelected();
      return;
    }
    if (ctrl && ev.key.toLowerCase() === 'c') {
      ev.preventDefault();
      copySelected();
      return;
    }
    if (ctrl && ev.key.toLowerCase() === 'v') {
      ev.preventDefault();
      pasteClipboard();
      return;
    }
    if (ctrl && ev.key.toLowerCase() === 'g') {
      ev.preventDefault();
      if (ev.shiftKey) ungroupSelection(); else createGroupFromSelection();
      return;
    }
    if (ev.key === 'Delete' || ev.key === 'Backspace') {
      if (state.selectedIds.length > 0) {
        ev.preventDefault();
        deleteSelectedElement();
      }
      return;
    }
    // Arrow key nudge
    const nudge = ev.shiftKey ? getGridStepMm() * 2 : getGridStepMm() * 0.5;
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(ev.key)) {
      const items = selectedElements();
      if (items.length === 0) return;
      ev.preventDefault();
      pushUndo();
      items.forEach(el => {
        if (ev.key === 'ArrowLeft')  el.x = Number(Math.max(0, el.x - nudge).toFixed(1));
        if (ev.key === 'ArrowRight') el.x = Number(Math.min(PAGE_WIDTH_MM - el.w, el.x + nudge).toFixed(1));
        if (ev.key === 'ArrowUp')    el.y = Number(Math.max(0, el.y - nudge).toFixed(1));
        if (ev.key === 'ArrowDown')  el.y = Number(Math.min(PAGE_HEIGHT_MM - el.h, el.y + nudge).toFixed(1));
      });
      renderStage();
      renderLayerList();
      updatePropertyInputs();
    }
  });

  [
    propTextEl,
    propBindEl,
    propXEl,
    propYEl,
    propWEl,
    propHEl,
    propFontSizeEl,
    propFontWeightEl,
    propFontFamilyIdEl,
    propLineHeightFactorEl,
    propBaselineOffsetMmEl,
    propMaxLinesEl,
    propOverflowModeEl,
    propAlignEl,
    propSnapEl,
    propTextColorEl,
    propStrokeColorEl,
    propFillColorEl,
    propStrokeWidthEl,
    propImageSrcEl,
  ]
    .forEach(input => input.addEventListener('input', applyPropsToSelection));

  titleInputEl.addEventListener('input', () => {
    if (!state.current) return;
    state.current.title = titleInputEl.value;
  });

  // toolKeySelectEl mutiert state NICHT direkt – Änderung nur via bestätigten Assign-Dialog

  statusSelectEl.addEventListener('change', () => {
    if (!state.current) return;
    state.current.status = statusSelectEl.value;
  });

}

async function init() {
  try {
    const boot = await api('bootstrap');
    if (!boot.ok) {
      throw new Error(boot.error || 'bootstrap_failed');
    }

    state.csrf = boot.csrf || '';
    state.allowedToolKeys = Array.isArray(boot.allowed_tool_keys) ? boot.allowed_tool_keys : [];
    state.fieldCatalog = typeof boot.field_catalog === 'object' && boot.field_catalog ? boot.field_catalog : {};

    fillToolSelect();
    fillBindingSelect(state.allowedToolKeys[0] || 'nti_tool');
    updateAssignButtonState();
    setDrawToolMode('');
    initViewportMetrics();
    renderRulers();

    try {
      await loadRepoImages();
    } catch (err) {
      showMessage(`Bildliste konnte nicht geladen werden: ${err.message}`, true);
    }

    await loadTemplateList();
    await openTemplate('');
    wireEvents();
  } catch (err) {
    showMessage(`Init fehlgeschlagen: ${err.message}`, true);
  }
}

init();
