(function() {
  'use strict';

  const REQUIRED_FIELDS = [
    { key: 'id', label: '#ID', required: true, visible: true, custom: false },
    { key: 'name', label: 'Cuename', required: true, visible: true, custom: false },
    { key: 'wer', label: 'Wer', required: true, visible: true, custom: false },
  ];

  const OPTIONAL_FIELDS = [
    { key: 'preCue', label: 'Pre-Cue', required: false, visible: true, custom: false },
    { key: 'standby', label: 'Standby', required: false, visible: true, custom: false },
    { key: 'goText', label: 'GO-Text', required: false, visible: true, custom: false },
    { key: 'duration', label: 'Dauer', required: false, visible: true, custom: false },
    { key: 'comment', label: 'Notiz', required: false, visible: true, custom: false },
  ];

  const state = {
    csrf: '',
    user: null,
    mode: 'editor',
    lists: [],
    current: null,
    selectedRows: new Set(),
    lastClickedIndex: null,
    showBlockIndex: 0,
    showHeader: true,
    showScale: 140,
  };

  const el = {
    body: document.body,
    status: byId('status'),
    showStage: byId('showStage'),
    helpOverlay: byId('helpOverlay'),
    listContainer: byId('listContainer'),
    listTitle: byId('listTitle'),
    listMeta: byId('listMeta'),
    selectionState: byId('selectionState'),
    floatingActions: byId('floatingActions'),
    floatingSelectionCount: byId('floatingSelectionCount'),
    groupTarget: byId('groupTarget'),
    fieldToggles: byId('fieldToggles'),
    cueTableHead: byId('cueTableHead'),
    cueTableBody: byId('cueTableBody'),
    showTitle: byId('showTitle'),
    showCounter: byId('showCounter'),
    showScroll: byId('showScroll'),
    toggleShowHeader: byId('toggleShowHeader'),
    showFontScale: byId('showFontScale'),
    showFontScaleValue: byId('showFontScaleValue'),
    fileImport: byId('fileImport'),
  };

  boot().catch((error) => {
    console.error(error);
    setStatus('Initialisierung fehlgeschlagen.', true);
  });

  function byId(id) {
    return document.getElementById(id);
  }

  function defaultSheet(title = 'Neue Cueliste') {
    return {
      title,
      fields: [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map(cloneField),
      cues: [],
    };
  }

  function cloneField(field) {
    return {
      key: String(field.key || ''),
      label: String(field.label || ''),
      required: Boolean(field.required),
      visible: field.visible !== false,
      custom: Boolean(field.custom),
    };
  }

  function defaultCue() {
    return {
      id: '',
      name: '',
      wer: '',
      group: '',
      values: {},
    };
  }

  function normalizeSheet(input) {
    const base = defaultSheet();
    const source = (input && typeof input === 'object') ? input : {};
    base.title = String(source.title || base.title);

    if (Array.isArray(source.fields)) {
      const normalized = [];
      for (const rawField of source.fields) {
        if (!rawField || typeof rawField !== 'object') {
          continue;
        }
        const key = String(rawField.key || '').trim();
        const label = String(rawField.label || '').trim();
        if (!key || !label) {
          continue;
        }
        normalized.push(cloneField(rawField));
      }
      if (normalized.length > 0) {
        base.fields = normalized;
      }
    }

    ensureRequiredFields(base.fields);

    if (Array.isArray(source.cues)) {
      base.cues = source.cues
        .filter((cue) => cue && typeof cue === 'object')
        .map((cue) => ({
          id: String(cue.id || ''),
          name: String(cue.name || ''),
          wer: String(cue.wer || ''),
          group: String(cue.group || ''),
          values: cue.values && typeof cue.values === 'object' ? { ...cue.values } : {},
        }));
    }

    for (const cue of base.cues) {
      for (const field of base.fields) {
        if (isBuiltinField(field.key)) {
          continue;
        }
        if (!Object.prototype.hasOwnProperty.call(cue.values, field.key)) {
          cue.values[field.key] = '';
        }
      }
    }

    return base;
  }

  function ensureRequiredFields(fields) {
    for (const requiredField of REQUIRED_FIELDS) {
      const existing = fields.find((field) => field.key === requiredField.key);
      if (!existing) {
        fields.unshift(cloneField(requiredField));
        continue;
      }
      existing.required = true;
      existing.visible = true;
      existing.custom = false;
    }
  }

  function isBuiltinField(key) {
    return key === 'id' || key === 'name' || key === 'wer';
  }

  async function api(action, options = {}) {
    const method = options.method || 'GET';
    const query = options.query || null;
    const body = options.body || null;
    const url = new URL('/cuesheet_api.php', window.location.origin);
    url.searchParams.set('action', action);

    if (query && typeof query === 'object') {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) {
          continue;
        }
        url.searchParams.set(key, String(value));
      }
    }

    const init = { method, headers: {} };
    if (method === 'POST') {
      init.headers['Content-Type'] = 'application/json';
      const payload = { ...(body || {}), csrf: state.csrf };
      init.body = JSON.stringify(payload);
    }

    const response = await fetch(url.toString(), init);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.error || `http_${response.status}`);
    }
    return data;
  }

  async function boot() {
    bindEvents();
    const bootData = await api('bootstrap');
    state.csrf = String(bootData.csrf || '');
    state.user = bootData.user || null;
    await refreshLists();
    setStatus('Bereit.');
  }

  function bindEvents() {
    byId('btnModeEditor').addEventListener('click', () => switchMode('editor'));
    byId('btnModeShow').addEventListener('click', () => switchMode('show'));
    byId('btnBackEditor').addEventListener('click', () => switchMode('editor'));
    byId('btnHelp').addEventListener('click', openHelp);
    byId('btnCloseHelp').addEventListener('click', closeHelp);

    byId('btnRefresh').addEventListener('click', () => {
      refreshLists().catch(handleError);
    });

    byId('btnNewPrivate').addEventListener('click', () => {
      createNewList('private').catch(handleError);
    });

    byId('btnNewShared').addEventListener('click', () => {
      createNewList('shared').catch(handleError);
    });

    byId('btnSave').addEventListener('click', () => {
      saveCurrent().catch(handleError);
    });

    byId('btnDelete').addEventListener('click', () => {
      deleteCurrent().catch(handleError);
    });

    byId('btnVisPrivate').addEventListener('click', () => {
      setVisibility('private').catch(handleError);
    });

    byId('btnVisShared').addEventListener('click', () => {
      setVisibility('shared').catch(handleError);
    });

    byId('btnAddCue').addEventListener('click', () => {
      if (!state.current) {
        return;
      }
      state.current.payload.cues.push(defaultCue());
      renderEditor();
    });

    byId('btnAdd10').addEventListener('click', () => {
      if (!state.current) {
        return;
      }
      for (let i = 0; i < 10; i += 1) {
        state.current.payload.cues.push(defaultCue());
      }
      renderEditor();
    });

    byId('btnApplyGroup').addEventListener('click', () => {
      applyGroupToSelection();
    });

    byId('btnClearGroup').addEventListener('click', () => {
      clearGroupFromSelection();
    });

    byId('btnDeleteSelection').addEventListener('click', () => {
      deleteSelectedRows();
    });

    byId('btnAddCustomField').addEventListener('click', addCustomField);

    el.listTitle.addEventListener('input', () => {
      if (!state.current) {
        return;
      }
      state.current.title = el.listTitle.value;
      state.current.payload.title = el.listTitle.value;
      renderListMeta();
    });

    byId('btnExport').addEventListener('click', () => {
      exportCurrent().catch(handleError);
    });

    el.fileImport.addEventListener('change', () => {
      importFromFile().catch(handleError).finally(() => {
        el.fileImport.value = '';
      });
    });

    byId('btnPrevBlock').addEventListener('click', (event) => {
      event.stopPropagation();
      stepBlock(-1);
    });
    byId('btnNextBlock').addEventListener('click', (event) => {
      event.stopPropagation();
      stepBlock(1);
    });

    el.toggleShowHeader.addEventListener('change', () => {
      state.showHeader = el.toggleShowHeader.checked;
      const head = document.querySelector('.show-head');
      if (head) {
        head.style.display = state.showHeader ? 'flex' : 'none';
      }
    });

    el.showFontScale.addEventListener('input', () => {
      const raw = Number(el.showFontScale.value || state.showScale);
      state.showScale = clamp(raw, 90, 220);
      applyShowScale();
    });

    el.showStage.addEventListener('click', (event) => {
      if (state.mode !== 'show') {
        return;
      }
      if (event.target && event.target.closest('.show-head')) {
        return;
      }
      const rect = el.showStage.getBoundingClientRect();
      const middle = rect.left + rect.width / 2;
      const direction = event.clientX < middle ? -1 : 1;
      stepBlock(direction);
    });

    el.helpOverlay.addEventListener('click', (event) => {
      if (event.target === el.helpOverlay) {
        closeHelp();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !el.helpOverlay.classList.contains('hidden')) {
        closeHelp();
        return;
      }
      if (state.mode !== 'show') {
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        stepBlock(1);
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        stepBlock(-1);
      }
    });

    applyShowScale();
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function applyShowScale() {
    if (el.showFontScale) {
      el.showFontScale.value = String(state.showScale);
    }
    if (el.showFontScaleValue) {
      el.showFontScaleValue.textContent = `${state.showScale}%`;
    }
    if (el.showStage) {
      el.showStage.style.setProperty('--show-scale-factor', String(state.showScale / 100));
    }
  }

  function openHelp() {
    el.helpOverlay.classList.remove('hidden');
    el.helpOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeHelp() {
    el.helpOverlay.classList.add('hidden');
    el.helpOverlay.setAttribute('aria-hidden', 'true');
  }

  function setStatus(text, isError = false) {
    el.status.textContent = text;
    el.status.style.color = isError ? '#fb7185' : '';
  }

  function handleError(error) {
    const message = (error && error.message) ? error.message : 'Unbekannter Fehler';
    console.error(error);
    setStatus(`Fehler: ${message}`, true);
  }

  async function refreshLists() {
    const data = await api('list');
    state.lists = Array.isArray(data.items) ? data.items : [];
    renderListPanel();

    if (!state.current && state.lists.length > 0) {
      await loadList(state.lists[0].id);
    }
    if (state.current) {
      const exists = state.lists.find((item) => Number(item.id) === Number(state.current.id));
      if (!exists) {
        state.current = null;
      }
    }
    renderListMeta();
  }

  async function createNewList(visibility) {
    const title = visibility === 'shared' ? 'Neue geteilte Cueliste' : 'Neue Cueliste';
    const payload = defaultSheet(title);
    const created = await api('create', {
      method: 'POST',
      body: {
        title,
        visibility,
        payload,
      },
    });
    await refreshLists();
    await loadList(created.id);
    setStatus('Neue Cueliste erstellt.');
  }

  async function loadList(id) {
    const data = await api('get', { query: { id } });
    const item = data.item || {};
    state.current = {
      id: Number(item.id || 0),
      title: String(item.title || ''),
      visibility: String(item.visibility || 'private'),
      owner_user_id: Number(item.owner_user_id || 0),
      owner_username: String(item.owner_username || ''),
      version: Number(item.version || 1),
      updated_at: String(item.updated_at || ''),
      updated_by_username: String(item.updated_by_username || ''),
      payload: normalizeSheet(item.payload || {}),
    };
    state.selectedRows.clear();
    state.lastClickedIndex = null;
    state.showBlockIndex = 0;
    el.listTitle.value = state.current.title;
    renderListPanel();
    renderListMeta();
    renderEditor();
    renderShow();
  }

  async function saveCurrent() {
    if (!state.current) {
      setStatus('Keine Cueliste geladen.', true);
      return;
    }
    state.current.title = el.listTitle.value.trim() || 'Cueliste';
    state.current.payload.title = state.current.title;

    const saved = await api('save', {
      method: 'POST',
      body: {
        id: state.current.id,
        title: state.current.title,
        version: state.current.version,
        payload: state.current.payload,
      },
    });

    state.current.version = Number(saved.version || state.current.version + 1);
    state.current.updated_at = String(saved.updated_at || '');
    await refreshLists();
    renderListMeta();
    setStatus('Gespeichert.');
  }

  async function deleteCurrent() {
    if (!state.current) {
      return;
    }
    const okay = window.confirm('Diese Cueliste wirklich löschen?');
    if (!okay) {
      return;
    }
    await api('delete', { method: 'POST', body: { id: state.current.id } });
    state.current = null;
    state.selectedRows.clear();
    state.lastClickedIndex = null;
    await refreshLists();
    renderEditor();
    renderShow();
    setStatus('Cueliste gelöscht.');
  }

  async function setVisibility(visibility) {
    if (!state.current) {
      return;
    }
    await api('set_visibility', {
      method: 'POST',
      body: {
        id: state.current.id,
        visibility,
      },
    });
    state.current.visibility = visibility;
    await refreshLists();
    renderListMeta();
    setStatus('Sichtbarkeit aktualisiert.');
  }

  async function exportCurrent() {
    if (!state.current) {
      return;
    }
    const data = await api('export_json', { query: { id: state.current.id } });
    const json = JSON.stringify(data.document || {}, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const namePart = String(state.current.title || 'cueliste').replace(/[^a-zA-Z0-9_-]+/g, '_');
    downloadBlob(blob, `${namePart}.json`);
    setStatus('Export erstellt.');
  }

  async function importFromFile() {
    const file = el.fileImport.files && el.fileImport.files[0];
    if (!file) {
      return;
    }
    const raw = await file.text();
    const parsed = JSON.parse(raw);
    await api('import_json', {
      method: 'POST',
      body: {
        document: parsed,
      },
    });
    await refreshLists();
    setStatus('Import abgeschlossen.');
  }

  function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function renderListPanel() {
    const currentId = state.current ? Number(state.current.id) : 0;
    if (state.lists.length === 0) {
      el.listContainer.innerHTML = '<div class="muted" style="padding:10px;">Noch keine Cueliste vorhanden.</div>';
      return;
    }
    el.listContainer.innerHTML = '';
    for (const item of state.lists) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'list-item' + (Number(item.id) === currentId ? ' active' : '');
      const vis = item.visibility === 'shared' ? 'Alle' : 'Nur ich';
      button.innerHTML = `<strong>${escapeHtml(item.title || 'Ohne Titel')}</strong><br><span class="muted">${vis} · Owner: ${escapeHtml(item.owner_username || '')}</span>`;
      button.addEventListener('click', () => {
        loadList(item.id).catch(handleError);
      });
      el.listContainer.appendChild(button);
    }
  }

  function renderListMeta() {
    if (!state.current) {
      el.listMeta.textContent = 'Keine Liste geladen.';
      return;
    }
    const visibility = state.current.visibility === 'shared' ? 'Alle' : 'Nur ich';
    el.listMeta.textContent = `ID ${state.current.id} · ${visibility} · Owner: ${state.current.owner_username} · Version ${state.current.version} · zuletzt von ${state.current.updated_by_username}`;
  }

  function addCustomField() {
    if (!state.current) {
      return;
    }
    const input = byId('customFieldLabel');
    const label = String(input.value || '').trim();
    if (!label) {
      return;
    }
    const key = slugify(label);
    if (!key) {
      setStatus('Ungültiger Feldname.', true);
      return;
    }
    if (state.current.payload.fields.some((field) => field.key === key)) {
      setStatus('Feld existiert bereits.', true);
      return;
    }
    state.current.payload.fields.push({ key, label, required: false, visible: true, custom: true });
    for (const cue of state.current.payload.cues) {
      cue.values[key] = '';
    }
    input.value = '';
    renderEditor();
  }

  function slugify(value) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function renderEditor() {
    if (!state.current) {
      el.fieldToggles.innerHTML = '';
      el.cueTableHead.innerHTML = '';
      el.cueTableBody.innerHTML = '<tr><td class="muted">Keine Liste geladen.</td></tr>';
      renderSelectionState();
      return;
    }

    renderFieldToggles();
    renderCueTable();
    renderSelectionState();
  }

  function renderSelectionState() {
    if (!el.selectionState) {
      return;
    }
    const selected = state.selectedRows.size;
    const total = state.current && state.current.payload ? state.current.payload.cues.length : 0;
    el.selectionState.textContent = `${selected} von ${total} Cues ausgewählt`;

    if (!el.floatingActions || !el.floatingSelectionCount) {
      return;
    }

    if (selected > 0) {
      el.floatingActions.classList.remove('hidden');
      el.floatingSelectionCount.textContent = `${selected} ausgewählt`;
    } else {
      el.floatingActions.classList.add('hidden');
      el.floatingSelectionCount.textContent = '0 ausgewählt';
    }
  }

  function renderFieldToggles() {
    const fields = state.current.payload.fields;
    el.fieldToggles.innerHTML = '';
    for (const field of fields) {
      const label = document.createElement('label');
      label.className = 'chip';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = field.visible !== false;
      checkbox.disabled = field.required;
      checkbox.addEventListener('change', () => {
        field.visible = checkbox.checked;
        renderCueTable();
      });

      label.appendChild(checkbox);
      label.append(' ' + field.label);

      if (field.custom) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn';
        remove.textContent = 'x';
        remove.addEventListener('click', () => {
          state.current.payload.fields = state.current.payload.fields.filter((item) => item.key !== field.key);
          for (const cue of state.current.payload.cues) {
            if (cue.values && typeof cue.values === 'object') {
              delete cue.values[field.key];
            }
          }
          renderEditor();
        });
        label.appendChild(remove);
      }

      el.fieldToggles.appendChild(label);
    }
  }

  function visibleFields() {
    if (!state.current) {
      return [];
    }
    return state.current.payload.fields.filter((field) => field.visible !== false || field.required);
  }

  function renderCueTable() {
    const fields = visibleFields();
    const cues = state.current.payload.cues;

    el.cueTableHead.innerHTML = '';
    const headCells = ['Gruppe'];
    for (const title of headCells) {
      const th = document.createElement('th');
      th.textContent = title;
      el.cueTableHead.appendChild(th);
    }
    for (const field of fields) {
      const th = document.createElement('th');
      th.textContent = field.label;
      el.cueTableHead.appendChild(th);
    }

    el.cueTableBody.innerHTML = '';

    if (cues.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 1 + fields.length;
      td.className = 'muted';
      td.textContent = 'Noch keine Cues vorhanden.';
      tr.appendChild(td);
      el.cueTableBody.appendChild(tr);
      renderSelectionState();
      return;
    }

    cues.forEach((cue, index) => {
      const tr = document.createElement('tr');
      tr.classList.add('cue-row');
      if (state.selectedRows.has(index)) {
        tr.classList.add('selected');
      }

      tr.addEventListener('click', (event) => {
        if (isInteractiveTarget(event.target)) {
          return;
        }
        handleRowSelection(index, event.shiftKey);
      });

      const tdGroup = document.createElement('td');
      const groupInput = document.createElement('input');
      groupInput.value = cue.group;
      groupInput.placeholder = 'z.B. Szene 1 / Act A';
      groupInput.addEventListener('input', () => {
        cue.group = groupInput.value;
        renderShow();
      });
      tdGroup.appendChild(groupInput);
      tr.appendChild(tdGroup);

      for (const field of fields) {
        const td = document.createElement('td');
        const input = document.createElement('input');
        input.value = readCueValue(cue, field.key);
        input.addEventListener('input', () => {
          writeCueValue(cue, field.key, input.value);
        });
        td.appendChild(input);
        tr.appendChild(td);
      }

      el.cueTableBody.appendChild(tr);
    });

    renderSelectionState();
  }

  function isInteractiveTarget(target) {
    if (!(target instanceof Element)) {
      return false;
    }
    return Boolean(target.closest('input, select, textarea, button, a, label, [contenteditable="true"]'));
  }

  function readCueValue(cue, key) {
    if (key === 'id' || key === 'name' || key === 'wer') {
      return String(cue[key] || '');
    }
    return String((cue.values && cue.values[key]) || '');
  }

  function writeCueValue(cue, key, value) {
    if (key === 'id' || key === 'name' || key === 'wer') {
      cue[key] = value;
      if (key === 'id') {
        renderShow();
      }
      return;
    }
    cue.values = cue.values && typeof cue.values === 'object' ? cue.values : {};
    cue.values[key] = value;
  }

  function handleRowSelection(index, isShift) {
    if (!isShift || state.lastClickedIndex === null) {
      state.selectedRows.clear();
      state.selectedRows.add(index);
      state.lastClickedIndex = index;
      renderCueTable();
      renderSelectionState();
      return;
    }

    const start = Math.min(state.lastClickedIndex, index);
    const end = Math.max(state.lastClickedIndex, index);
    state.selectedRows.clear();
    for (let i = start; i <= end; i += 1) {
      state.selectedRows.add(i);
    }
    state.lastClickedIndex = index;
    renderCueTable();
    renderSelectionState();
  }

  function applyGroupToSelection() {
    if (!state.current) {
      return;
    }
    if (state.selectedRows.size === 0) {
      setStatus('Keine Cues ausgewählt.', true);
      return;
    }
    const target = String(el.groupTarget.value || '').trim();
    if (!target) {
      setStatus('Bitte Gruppennamen angeben.', true);
      return;
    }
    for (const index of state.selectedRows) {
      const cue = state.current.payload.cues[index];
      if (cue) {
        cue.group = target;
      }
    }
    renderCueTable();
    renderSelectionState();
    renderShow();
    setStatus(`Auswahl Gruppe „${target}“ zugewiesen.`);
  }

  function clearGroupFromSelection() {
    if (!state.current) {
      return;
    }
    if (state.selectedRows.size === 0) {
      setStatus('Keine Cues ausgewählt.', true);
      return;
    }
    for (const index of state.selectedRows) {
      const cue = state.current.payload.cues[index];
      if (cue) {
        cue.group = '';
      }
    }
    renderCueTable();
    renderSelectionState();
    renderShow();
    setStatus('Gruppenzuordnung entfernt.');
  }

  function deleteSelectedRows() {
    if (!state.current || state.selectedRows.size === 0) {
      return;
    }
    const selected = new Set(state.selectedRows);
    state.current.payload.cues = state.current.payload.cues.filter((_, index) => !selected.has(index));
    state.selectedRows.clear();
    state.lastClickedIndex = null;
    renderEditor();
    renderShow();
    setStatus('Ausgewählte Cues gelöscht.');
  }

  function switchMode(mode) {
    state.mode = mode === 'show' ? 'show' : 'editor';
    el.body.classList.toggle('mode-show', state.mode === 'show');
    el.body.classList.toggle('mode-editor', state.mode !== 'show');
    if (state.mode === 'show') {
      renderShow();
    }
  }

  function getShowBlocks() {
    if (!state.current) {
      return [];
    }

    const sorted = state.current.payload.cues
      .map((cue, index) => ({ ...cue, __index: index }))
      .sort((a, b) => compareCueIds(a.id, b.id));

    const blocks = [];
    for (const cue of sorted) {
      const groupName = String(cue.group || '').trim();
      if (!groupName) {
        blocks.push({ group: '', grouped: false, items: [cue] });
        continue;
      }

      const previous = blocks[blocks.length - 1];
      if (previous && previous.grouped && previous.group === groupName) {
        previous.items.push(cue);
      } else {
        blocks.push({ group: groupName, grouped: true, items: [cue] });
      }
    }

    return blocks;
  }

  function compareCueIds(a, b) {
    const aid = parseCueId(a);
    const bid = parseCueId(b);

    if (aid.numeric !== null && bid.numeric !== null && aid.numeric !== bid.numeric) {
      return aid.numeric - bid.numeric;
    }
    if (aid.numeric !== null && bid.numeric === null) {
      return -1;
    }
    if (aid.numeric === null && bid.numeric !== null) {
      return 1;
    }

    return aid.lex.localeCompare(bid.lex, 'de', { numeric: true, sensitivity: 'base' });
  }

  function parseCueId(value) {
    const lex = String(value || '').trim();
    const match = lex.match(/(\d+)/);
    if (!match) {
      return { numeric: null, lex };
    }
    const numeric = Number.parseInt(match[1], 10);
    if (Number.isNaN(numeric)) {
      return { numeric: null, lex };
    }
    return { numeric, lex };
  }

  function renderShow() {
    const blocks = getShowBlocks();
    if (blocks.length === 0) {
      el.showScroll.innerHTML = '<div class="muted">Keine Cues vorhanden.</div>';
      el.showCounter.textContent = '';
      return;
    }

    if (state.showBlockIndex >= blocks.length) {
      state.showBlockIndex = blocks.length - 1;
    }
    if (state.showBlockIndex < 0) {
      state.showBlockIndex = 0;
    }

    el.showTitle.textContent = state.current ? state.current.title : 'Show';
    el.showCounter.textContent = `Block ${state.showBlockIndex + 1}/${blocks.length}`;

    el.showScroll.innerHTML = '';
    blocks.forEach((blockData, index) => {
      const block = document.createElement('section');
      block.className = 'show-block' + (index === state.showBlockIndex ? ' active' : '');
      if (blockData.grouped) {
        block.classList.add('grouped');
      }
      block.dataset.blockIndex = String(index);

      const firstCue = blockData.items[0];
      const lastCue = blockData.items[blockData.items.length - 1];
      const firstId = firstCue ? firstCue.id : '';
      const lastId = lastCue ? lastCue.id : '';

      const title = document.createElement('div');
      title.className = 'show-title';
      if (blockData.grouped) {
        title.textContent = `${blockData.group} · ${firstId}${firstId && lastId ? ' - ' : ''}${lastId}`;
      } else {
        title.textContent = `${firstId} · ${firstCue ? firstCue.name : ''}`.trim();
      }
      block.appendChild(title);

      for (const cue of blockData.items) {
        const cueNode = document.createElement('article');
        cueNode.className = 'show-cue';
        cueNode.innerHTML = `<strong>${escapeHtml(cue.id)} · ${escapeHtml(cue.name)}</strong><span>${escapeHtml(cue.wer)}</span>${cue.group ? `<span>${escapeHtml(cue.group)}</span>` : ''}`;
        block.appendChild(cueNode);
      }

      el.showScroll.appendChild(block);
    });

    scrollActiveBlockIntoView();
  }

  function stepBlock(direction) {
    const blocks = getShowBlocks();
    if (blocks.length === 0) {
      return;
    }
    state.showBlockIndex += direction;
    if (state.showBlockIndex < 0) {
      state.showBlockIndex = 0;
    }
    if (state.showBlockIndex >= blocks.length) {
      state.showBlockIndex = blocks.length - 1;
    }
    renderShow();
  }

  function scrollActiveBlockIntoView() {
    const active = el.showScroll.querySelector('.show-block.active');
    if (!active) {
      return;
    }
    active.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
