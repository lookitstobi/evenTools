const MM_TO_PX = 3;
const PT_TO_STAGE_PX = MM_TO_PX * (25.4 / 72);

const state = {
  csrf: '',
  list: [],
  current: null,
  selectedIds: [],
  allowedToolKeys: [],
  fieldCatalog: {},
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
const propAlignEl = document.getElementById('propAlign');
const propSnapEl = document.getElementById('propSnap');
const propTextColorEl = document.getElementById('propTextColor');
const propStrokeColorEl = document.getElementById('propStrokeColor');
const propFillColorEl = document.getElementById('propFillColor');
const propStrokeWidthEl = document.getElementById('propStrokeWidth');
const propImageSrcEl = document.getElementById('propImageSrc');
const addElementTypeEl = document.getElementById('addElementType');
const selectionInfoEl = document.getElementById('selectionInfo');
const rulerXEl = document.getElementById('rulerX');
const rulerYEl = document.getElementById('rulerY');
const messageEl = document.getElementById('message');
const btnZoomOut = document.getElementById('btnZoomOut');
const btnZoomReset = document.getElementById('btnZoomReset');
const btnZoomIn = document.getElementById('btnZoomIn');
const helpDialogEl = document.getElementById('helpDialog');
const assignDialogEl = document.getElementById('assignDialog');
const assignDialogBodyEl = document.getElementById('assignDialogBody');
const assignPanelEl = document.getElementById('assignPanel');
const propsPanelEl = document.getElementById('propsPanel');
const btnToggleAssign = document.getElementById('btnToggleAssign');
const btnToggleProps = document.getElementById('btnToggleProps');
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
const btnPreview = document.getElementById('btnPreview');
const btnHelp = document.getElementById('btnHelp');
const btnDelete = document.getElementById('btnDelete');
const btnAddElement = document.getElementById('btnAddElement');
const btnDeleteSelected = document.getElementById('btnDeleteSelected');
const btnAssign = document.getElementById('btnAssign');

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

function isPanelOpen(panelEl) {
  return !!panelEl && !panelEl.classList.contains('is-collapsed');
}

function setPanelState(panelEl, toggleBtn, shouldOpen) {
  if (!panelEl || !toggleBtn) return;
  panelEl.classList.toggle('is-collapsed', !shouldOpen);
  toggleBtn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
}

function togglePanel(panelEl, toggleBtn) {
  setPanelState(panelEl, toggleBtn, !isPanelOpen(panelEl));
}

function showMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.classList.toggle('error', isError);
  messageEl.classList.add('show');
  window.setTimeout(() => messageEl.classList.remove('show'), 2600);
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

async function api(action, payload = null, method = 'GET', query = {}) {
  const url = new URL('/pdf_template_api.php', window.location.origin);
  url.searchParams.set('action', action);
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });

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
  return {
    schema_version: 1,
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
        group_id: '',
      },
    ],
  };
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

  const list = state.fieldCatalog[toolKey] || [];
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
    selectionInfoEl.textContent = 'Keine Auswahl';
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
    div.style.fontSize = `${fontPx}px`;
    div.style.lineHeight = `${Math.max(fontPx * 1.08, Math.min(el.h * MM_TO_PX, fontPx * 1.22))}px`;
    div.style.fontWeight = el.font_weight || 'normal';
    div.style.textAlign = el.align || 'left';
    div.style.color = el.text_color || '#272727';
    div.style.borderColor = el.stroke_color || '#747474';
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
}

function updatePropertyInputs() {
  const items = selectedElements();
  const el = items[0] || null;
  if (!el || items.length === 0) {
    selectionInfoEl.textContent = 'Keine Auswahl';
    propTextEl.value = '';
    propBindEl.value = '';
    propXEl.value = '';
    propYEl.value = '';
    propWEl.value = '';
    propHEl.value = '';
    propFontSizeEl.value = '';
    propFontWeightEl.value = 'normal';
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
    const bounds = selectedBoundsMm();
    selectionInfoEl.textContent = `${items.length} Elemente ausgewählt${bounds ? ` @ ${bounds.x.toFixed(1)} / ${bounds.y.toFixed(1)} mm` : ''}`;
    propXEl.value = '';
    propYEl.value = '';
    propWEl.value = '';
    propHEl.value = '';
    return;
  }

  selectionInfoEl.textContent = `${el.id} @ ${el.x.toFixed(1)} / ${el.y.toFixed(1)} mm`;
  propTextEl.value = el.text || '';
  propBindEl.value = el.bind || '';
  propXEl.value = String(el.x);
  propYEl.value = String(el.y);
  propWEl.value = String(el.w);
  propHEl.value = String(el.h);
  propFontSizeEl.value = String(el.font_size || 11);
  propFontWeightEl.value = el.font_weight || 'normal';
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

  items.forEach((el) => {
    el.text = propTextEl.value;
    el.bind = propBindEl.value;
    if (items.length === 1) {
      el.x = Number(propXEl.value || 0);
      el.y = Number(propYEl.value || 0);
      el.w = Number(propWEl.value || 1);
      el.h = Number(propHEl.value || 1);
    }
    el.font_size = Number(propFontSizeEl.value || 11);
    el.font_weight = propFontWeightEl.value;
    el.align = propAlignEl.value;
    el.snap = !!propSnapEl.checked;
    el.text_color = propTextColorEl.value || '#272727';
    el.stroke_color = propStrokeColorEl.value || '#747474';
    el.fill_color = propFillColorEl.value || '#14a76c';
    el.stroke_width = Number(propStrokeWidthEl.value || 1);
    el.image_src = propImageSrcEl.value || '';
    if (el.type === 'image') {
      updateImageAspectCache(el);
    }
  });

  renderStage();
  updatePropertyInputs();
}

let dragCtx = null;
let marqueeCtx = null;

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
  const gid = `grp_${Math.random().toString(16).slice(2, 10)}`;
  items.forEach((el) => {
    el.group_id = gid;
  });
  renderStage();
  updatePropertyInputs();
  showMessage('Gruppe erstellt.');
}

function ungroupSelection() {
  const items = selectedElements();
  if (items.length === 0) {
    showMessage('Keine Auswahl für Gruppierung.', true);
    return;
  }
  items.forEach((el) => {
    el.group_id = '';
  });
  renderStage();
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
  updatePropertyInputs();

  if (selectedItems.length > 1) {
    dragCtx = {
      mode: 'drag-multi',
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
  if (ev.target !== stageEl) return;
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
  const list = state.fieldCatalog[currentToolKey] || [];

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
    updatePropertyInputs();
  }
  openContextMenu(ev.clientX, ev.clientY);
}

function onStageContextMenu(ev) {
  ev.preventDefault();
  if (ev.target === stageEl && !ev.shiftKey) {
    setSelectedIds([]);
    renderStage();
    updatePropertyInputs();
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

  const dxMm = dxPx / MM_TO_PX;
  const dyMm = dyPx / MM_TO_PX;
  const snapDefault = !!(el?.snap);
  const snapActive = ev.shiftKey ? !snapDefault : snapDefault;

  const snapToGrid = (valueMm) => {
    if (!snapActive) return valueMm;
    const stepMm = getGridStepMm();
    return Math.round(valueMm / stepMm) * stepMm;
  };

  if (dragCtx.mode === 'drag-multi') {
    dragCtx.items.forEach((item) => {
      const target = elements.find((elx) => elx.id === item.id);
      if (!target) return;
      let nextX = Math.max(0, Math.min(PAGE_WIDTH_MM - Number(target.w || item.startW || 1), item.startX + dxMm));
      let nextY = Math.max(0, Math.min(PAGE_HEIGHT_MM - Number(target.h || item.startH || 1), item.startY + dyMm));
      nextX = snapToGrid(nextX);
      nextY = snapToGrid(nextY);
      target.x = Number(nextX.toFixed(1));
      target.y = Number(nextY.toFixed(1));
    });
    renderStage();
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
    nextX = snapToGrid(nextX);
    nextY = snapToGrid(nextY);
    nextW = Math.max(minW, snapToGrid(nextW));
    nextH = Math.max(minH, snapToGrid(nextH));
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

  const elements = getCurrentElements();
  const selectedSet = new Set(state.selectedIds);
  const before = elements.length;
  const kept = elements.filter((item) => !selectedSet.has(item.id));
  if (kept.length === before) {
    showMessage('Element nicht gefunden.', true);
    return;
  }

  state.current.payload.elements = kept;
  setSelectedIds(kept[0] ? [kept[0].id] : []);
  renderStage();
  updatePropertyInputs();
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
  // Auswahl im Assign-Dropdown auf aktuelle Zuordnung setzen
  if (toolKeySelectEl) {
    toolKeySelectEl.value = currentToolKey;
  }
  updateAssignButtonState();
  fillBindingSelect(currentToolKey);
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
    refreshCurrentHeader();
    renderStage();
    updatePropertyInputs();
    return;
  }

  const result = await api('get', null, 'GET', { id });
  if (!result.ok) {
    throw new Error(result.error || 'get_failed');
  }

  state.current = result.item;
  setSelectedIds(state.current?.payload?.elements?.[0] ? [state.current.payload.elements[0].id] : []);
  refreshCurrentHeader();
  renderStage();
  updatePropertyInputs();
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
  const allowedBindings = (state.fieldCatalog[newKey] || []).map(f => f.key);

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
  payload.tool_key = toolKey;

  return {
    title: titleInputEl.value.trim() || 'PDF-Vorlage',
    tool_key: toolKey,
    status: statusSelectEl.value,
    payload,
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

  const url = new URL('/pdf_template_api.php', window.location.origin);
  url.searchParams.set('action', 'render_preview');

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

function addElement(elementTypeOverride = null) {
  if (!state.current || !state.current.payload) return;

  const elementType = elementTypeOverride || (addElementTypeEl ? addElementTypeEl.value : 'text');
  const elements = getCurrentElements();
  const step = getGridStepMm();
  const startX = 4 * step;
  const startY = (6 + (elements.length * 2)) * step;
  const base = {
    id: `el_${Math.random().toString(16).slice(2, 10)}`,
    type: elementType,
    x: startX,
    y: startY,
    w: 20 * step,
    h: 2 * step,
    text: 'Neues Element',
    bind: '',
    snap: false,
    font_size: 11,
    font_weight: 'normal',
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
    next = { ...base, text: 'Neues Textfeld', w: 24 * step, h: 2 * step };
  } else if (elementType === 'line') {
    next = { ...base, text: '', w: 24 * step, h: 1 * step };
  } else if (elementType === 'rect') {
    next = { ...base, text: '', w: 22 * step, h: 6 * step, fill_color: 'transparent' };
  } else if (elementType === 'rect_fill') {
    next = { ...base, text: '', w: 22 * step, h: 6 * step, fill_color: '#98e3c3' };
  } else if (elementType === 'image') {
    next = { ...base, text: '', w: 14 * step, h: 9 * step, image_src: '' };
  }

  elements.push(next);
  setSelectedIds([next.id]);
  renderStage();
  updatePropertyInputs();
}

function addElementByType(elementType) {
  if (addElementTypeEl) {
    addElementTypeEl.value = elementType;
  }
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

  if (btnToggleAssign) {
    btnToggleAssign.addEventListener('click', () => togglePanel(assignPanelEl, btnToggleAssign));
  }

  if (btnToggleProps) {
    btnToggleProps.addEventListener('click', () => togglePanel(propsPanelEl, btnToggleProps));
  }

  stageEl.addEventListener('contextmenu', onStageContextMenu);
  stageEl.addEventListener('pointerdown', onStagePointerDown);

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
    if (ev.key === 'Escape') {
      closeContextMenu();
      if (assignPanelEl && btnToggleAssign) {
        setPanelState(assignPanelEl, btnToggleAssign, false);
      }
    }
    const tag = (document.activeElement?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      return;
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'g') {
      ev.preventDefault();
      createGroupFromSelection();
      return;
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'u') {
      ev.preventDefault();
      ungroupSelection();
      return;
    }
    if (ev.key === 'Delete' || ev.key === 'Backspace') {
      if (state.selectedIds.length > 0) {
        ev.preventDefault();
        deleteSelectedElement();
      }
    }
  });

  if (btnAddElement) {
    btnAddElement.addEventListener('click', addElement);
  }

  [
    propTextEl,
    propBindEl,
    propXEl,
    propYEl,
    propWEl,
    propHEl,
    propFontSizeEl,
    propFontWeightEl,
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
    initViewportMetrics();
    renderRulers();

    await loadTemplateList();
    await openTemplate('');
    wireEvents();
  } catch (err) {
    showMessage(`Init fehlgeschlagen: ${err.message}`, true);
  }
}

init();
