(function () {
  'use strict';

  const state = {
    csrf: '',
    user: null,
    docs: [],
    current: null,
    selection: null,
    dirty: false,
    matrix: {
      sourceCardId: '',
      targetCardId: '',
      stateFilter: 'active',
    },
    activeTab: 'manage',
    treeExpanded: {
      base_device: Object.create(null),
      card: Object.create(null),
    },
    helpMode: false,
    helpTarget: null,
  };

  const el = {
    status: byId('status'),
    docList: byId('docList'),
    docTitle: byId('docTitle'),
    docMeta: byId('docMeta'),
    dirtyBadge: byId('dirtyBadge'),
    metaLocation: byId('metaLocation'),
    metaProject: byId('metaProject'),
    metaNotes: byId('metaNotes'),
    btnCreate: byId('btnCreate'),
    btnSave: byId('btnSave'),
    btnDelete: byId('btnDelete'),
    btnRefresh: byId('btnRefresh'),
    btnHelpMode: byId('btnHelpMode'),
    btnTabManage: byId('btnTabManage'),
    btnTabMatrix: byId('btnTabMatrix'),
    tabManage: byId('tabManage'),
    tabMatrix: byId('tabMatrix'),
    btnAddBaseDevice: byId('btnAddBaseDevice'),
    btnAddCard: byId('btnAddCard'),
    treeView: byId('treeView'),
    portSearch: byId('portSearch'),
    portDirectionFilter: byId('portDirectionFilter'),
    btnNewPatch: byId('btnNewPatch'),
    matrixSourceCard: byId('matrixSourceCard'),
    matrixTargetCard: byId('matrixTargetCard'),
    matrixStateFilter: byId('matrixStateFilter'),
    matrixLegend: byId('matrixLegend'),
    matrixWrap: byId('matrixWrap'),
    patchList: byId('patchList'),
    detailEmpty: byId('detailEmpty'),
    detailForm: byId('detailForm'),
    detailFields: byId('detailFields'),
    btnDeletePatch: byId('btnDeletePatch'),
    helpTooltip: byId('helpTooltip'),
  };

  let matrixTextMeasureCtx = null;

  boot().catch((error) => {
    console.error(error);
    setStatus('Initialisierung fehlgeschlagen: ' + String(error.message || error), true);
  });

  function byId(id) {
    return document.getElementById(id);
  }

  function setStatus(text, isError = false) {
    el.status.textContent = text;
    el.status.classList.toggle('error', Boolean(isError));
  }

  function setDirty(dirty) {
    state.dirty = Boolean(dirty);
    el.dirtyBadge.classList.toggle('hidden', !state.dirty);
    el.btnSave.disabled = !state.current || !state.dirty;
  }

  function activePayload() {
    return state.current && state.current.payload ? state.current.payload : null;
  }

  async function api(action, options = {}) {
    const method = options.method || 'GET';
    const query = options.query || null;
    const body = options.body || null;

    const url = new URL('/patchmatrix_api.php', window.location.origin);
    url.searchParams.set('action', action);

    if (query && typeof query === 'object') {
      Object.entries(query).forEach(([k, v]) => {
        if (v === undefined || v === null || v === '') {
          return;
        }
        url.searchParams.set(k, String(v));
      });
    }

    const init = {
      method,
      credentials: 'same-origin',
      headers: {},
    };

    if (method !== 'GET') {
      init.headers['Content-Type'] = 'application/json';
      const payload = Object.assign({}, body || {});
      payload.csrf = state.csrf;
      init.body = JSON.stringify(payload);
    }

    const response = await fetch(url.toString(), init);
    let data = {};
    try {
      data = await response.json();
    } catch (_) {
      data = {};
    }

    if (!response.ok || !data.ok) {
      const err = new Error(data.error || ('http_' + response.status));
      err.payload = data;
      throw err;
    }

    return data;
  }

  async function boot() {
    bindEvents();
    setHelpMode(false, false);
    const bootData = await api('bootstrap');
    state.csrf = String(bootData.csrf || '');
    state.user = bootData.user || null;

    await reloadDocumentList();
    if (state.docs.length > 0) {
      await openDocument(state.docs[0].id, false);
    } else {
      renderAll();
      setStatus('Noch kein Dokument vorhanden. Lege ein neues Dokument an.');
    }
  }

  function bindEvents() {
    el.btnRefresh.addEventListener('click', () => {
      reloadDocumentList().catch(handleError);
    });

    el.btnCreate.addEventListener('click', () => {
      createDocument().catch(handleError);
    });

    el.btnSave.addEventListener('click', () => {
      saveDocument().catch(handleError);
    });

    el.btnDelete.addEventListener('click', () => {
      deleteDocument().catch(handleError);
    });

    el.btnHelpMode.addEventListener('click', () => {
      setHelpMode(!state.helpMode, true);
    });

    el.btnTabManage.addEventListener('click', () => {
      switchTab('manage');
    });

    el.btnTabMatrix.addEventListener('click', () => {
      switchTab('matrix');
    });

    el.docList.addEventListener('click', (ev) => {
      const target = ev.target;
      const button = target.closest('button[data-doc-id]');
      if (!button) {
        return;
      }
      const id = Number(button.dataset.docId || 0);
      if (id > 0) {
        openDocument(id, true).catch(handleError);
      }
    });

    el.docTitle.addEventListener('input', () => {
      if (!state.current) {
        return;
      }
      const title = String(el.docTitle.value || '').trim();
      state.current.title = title;
      const payload = activePayload();
      if (payload && payload.meta) {
        payload.meta.title = title;
      }
      setDirty(true);
      renderDocMeta();
      renderDocList();
    });

    el.metaLocation.addEventListener('input', () => {
      const payload = activePayload();
      if (!payload || !payload.meta) {
        return;
      }
      payload.meta.location = String(el.metaLocation.value || '');
      setDirty(true);
    });

    el.metaProject.addEventListener('input', () => {
      const payload = activePayload();
      if (!payload || !payload.meta) {
        return;
      }
      payload.meta.show_or_project = String(el.metaProject.value || '');
      setDirty(true);
    });

    el.metaNotes.addEventListener('input', () => {
      const payload = activePayload();
      if (!payload || !payload.meta) {
        return;
      }
      payload.meta.notes = String(el.metaNotes.value || '');
      setDirty(true);
    });

    el.btnAddBaseDevice.addEventListener('click', () => {
      addBaseDevice();
    });

    el.btnAddCard.addEventListener('click', () => {
      addCard();
    });

    el.btnNewPatch.addEventListener('click', () => {
      addPatch();
    });

    el.treeView.addEventListener('click', onEntityListClick);

    el.portSearch.addEventListener('input', () => {
      renderEntityLists();
    });

    el.portDirectionFilter.addEventListener('change', () => {
      renderEntityLists();
    });

    el.matrixSourceCard.addEventListener('change', () => {
      state.matrix.sourceCardId = String(el.matrixSourceCard.value || '');
      renderMatrixSection();
    });

    el.matrixTargetCard.addEventListener('change', () => {
      state.matrix.targetCardId = String(el.matrixTargetCard.value || '');
      renderMatrixSection();
    });

    el.matrixStateFilter.addEventListener('change', () => {
      const next = String(el.matrixStateFilter.value || 'active');
      state.matrix.stateFilter = next === 'all' ? 'all' : 'active';
      renderMatrixSection();
    });

    el.matrixWrap.addEventListener('click', (ev) => {
      const target = ev.target;
      const cell = target.closest('button[data-cell-source][data-cell-target]');
      if (!cell) {
        return;
      }
      const sourcePortId = String(cell.dataset.cellSource || '');
      const targetPortId = String(cell.dataset.cellTarget || '');
      if (sourcePortId === '' || targetPortId === '') {
        return;
      }
      onMatrixCellClick(sourcePortId, targetPortId);
    });

    el.detailForm.addEventListener('submit', (ev) => {
      ev.preventDefault();
      applyDetailForm();
    });

    el.btnDeletePatch.addEventListener('click', () => {
      deleteSelectedPatch();
    });

    window.addEventListener('beforeunload', (ev) => {
      if (!state.dirty) {
        return;
      }
      ev.preventDefault();
      ev.returnValue = '';
    });

    document.addEventListener('mousemove', (ev) => {
      updateHelpTooltipFromPointer(ev);
    });

    document.addEventListener('mouseleave', () => {
      hideHelpTooltip();
    });
  }

  function switchTab(nextTab) {
    const normalized = nextTab === 'matrix' ? 'matrix' : 'manage';
    if (normalized === state.activeTab) {
      return;
    }

    state.activeTab = normalized;
    el.tabManage.classList.toggle('hidden', state.activeTab !== 'manage');
    el.tabMatrix.classList.toggle('hidden', state.activeTab !== 'matrix');
    el.btnTabManage.classList.toggle('btn-primary', state.activeTab === 'manage');
    el.btnTabMatrix.classList.toggle('btn-primary', state.activeTab === 'matrix');
  }

  function setHelpMode(enabled, withStatus) {
    state.helpMode = Boolean(enabled);
    document.body.classList.toggle('pm-help-on', state.helpMode);
    el.btnHelpMode.classList.toggle('is-active', state.helpMode);
    el.btnHelpMode.setAttribute('aria-pressed', state.helpMode ? 'true' : 'false');
    el.btnHelpMode.textContent = state.helpMode ? 'Help Mode: An' : 'Help Mode: Aus';

    if (!state.helpMode) {
      hideHelpTooltip();
    }

    if (withStatus) {
      setStatus(state.helpMode
        ? 'Help Mode aktiv: Fahre mit der Maus über markierte Elemente für Erklärungen.'
        : 'Help Mode deaktiviert.');
    }
  }

  function updateHelpTooltipFromPointer(ev) {
    if (!state.helpMode) {
      return;
    }

    const target = document.elementFromPoint(ev.clientX, ev.clientY);
    const helpTarget = findHelpTarget(target);
    if (!helpTarget) {
      hideHelpTooltip();
      return;
    }

    showHelpTooltip(helpTarget, ev.clientX, ev.clientY);
  }

  function findHelpTarget(startNode) {
    if (!startNode) {
      return null;
    }
    if (!(startNode instanceof Element)) {
      return null;
    }
    if (startNode.id === 'helpTooltip') {
      return null;
    }
    return startNode.closest('[data-help]');
  }

  function showHelpTooltip(target, clientX, clientY) {
    const title = String(target.getAttribute('data-help-title') || 'Hilfe').trim();
    const text = String(target.getAttribute('data-help') || '').trim();
    if (!text) {
      hideHelpTooltip();
      return;
    }

    if (state.helpTarget !== target) {
      el.helpTooltip.innerHTML = [
        '<div class="pm-help-title">' + escapeHtml(title) + '</div>',
        '<div class="pm-help-text">' + escapeHtml(text) + '</div>',
      ].join('');
      state.helpTarget = target;
    }

    positionHelpTooltip(clientX, clientY);
    el.helpTooltip.classList.remove('hidden');
  }

  function positionHelpTooltip(clientX, clientY) {
    const offset = 14;
    let left = clientX + offset;
    let top = clientY + offset;

    const width = el.helpTooltip.offsetWidth || 320;
    const height = el.helpTooltip.offsetHeight || 120;
    const maxLeft = window.innerWidth - width - 8;
    const maxTop = window.innerHeight - height - 8;

    if (left > maxLeft) {
      left = Math.max(8, clientX - width - offset);
    }
    if (top > maxTop) {
      top = Math.max(8, clientY - height - offset);
    }

    el.helpTooltip.style.left = String(left) + 'px';
    el.helpTooltip.style.top = String(top) + 'px';
  }

  function hideHelpTooltip() {
    state.helpTarget = null;
    el.helpTooltip.classList.add('hidden');
  }

  async function reloadDocumentList() {
    const currentId = state.current ? Number(state.current.id || 0) : 0;
    const data = await api('list');
    state.docs = Array.isArray(data.items) ? data.items : [];

    if (currentId > 0 && !state.docs.some((row) => Number(row.id) === currentId)) {
      state.current = null;
      state.selection = null;
      setDirty(false);
    }

    renderDocList();
    renderDocMeta();
  }

  async function openDocument(id, askDirty) {
    if (askDirty && state.dirty) {
      const proceed = window.confirm('Ungespeicherte Änderungen verwerfen und Dokument wechseln?');
      if (!proceed) {
        return;
      }
    }

    const data = await api('get', { query: { id } });
    state.current = data.item || null;
    state.selection = null;
    state.treeExpanded = {
      base_device: Object.create(null),
      card: Object.create(null),
    };
    state.matrix.sourceCardId = '';
    state.matrix.targetCardId = '';
    setDirty(false);

    const payload = activePayload();
    ensurePayloadShape(payload);
    if (payload && payload.meta) {
      if (!payload.meta.title) {
        payload.meta.title = state.current.title || '';
      }
    }

    renderAll();
    setStatus('Dokument geladen.');
  }

  async function createDocument() {
    if (state.dirty) {
      const proceed = window.confirm('Ungespeicherte Änderungen verwerfen und neues Dokument anlegen?');
      if (!proceed) {
        return;
      }
    }

    const now = new Date();
    const suggestedTitle = 'Nexus Konfiguration ' + now.toISOString().slice(0, 10);
    const data = await api('create', {
      method: 'POST',
      body: { title: suggestedTitle },
    });

    await reloadDocumentList();
    if (data.id) {
      await openDocument(Number(data.id), false);
    }
    setStatus('Neues Dokument angelegt.');
  }

  async function saveDocument() {
    if (!state.current) {
      return;
    }

    const payload = activePayload();
    if (!payload) {
      return;
    }
    ensurePayloadShape(payload);

    const title = String(state.current.title || '').trim() || 'Nexus Konfiguration';
    payload.meta = payload.meta || {};
    payload.meta.title = title;

    const data = await api('save', {
      method: 'POST',
      body: {
        id: Number(state.current.id),
        version: Number(state.current.version || 0),
        title,
        payload,
      },
    });

    state.current.version = Number(data.version || state.current.version || 1);
    setDirty(false);
    await reloadDocumentList();
    setStatus('Dokument gespeichert.');
    renderDocMeta();
  }

  async function deleteDocument() {
    if (!state.current) {
      return;
    }

    const ok = window.confirm('Dokument wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.');
    if (!ok) {
      return;
    }

    await api('delete', {
      method: 'POST',
      body: { id: Number(state.current.id) },
    });

    state.current = null;
    state.selection = null;
    setDirty(false);

    await reloadDocumentList();
    if (state.docs.length > 0) {
      await openDocument(Number(state.docs[0].id), false);
    } else {
      renderAll();
    }

    setStatus('Dokument gelöscht.');
  }

  function onEntityListClick(ev) {
    const target = ev.target;

    const toggleBtn = target.closest('[data-tree-toggle-type]');
    if (toggleBtn) {
      const type = String(toggleBtn.dataset.treeToggleType || '');
      const id = String(toggleBtn.dataset.treeToggleId || '');
      if (type && id) {
        const bucket = state.treeExpanded[type] || null;
        if (bucket) {
          bucket[id] = !bucket[id];
          renderEntityLists();
        }
      }
      return;
    }

    const removeBtn = target.closest('[data-remove-type]');
    if (removeBtn) {
      ev.stopPropagation();
      const type = String(removeBtn.dataset.removeType || '');
      const id = String(removeBtn.dataset.removeId || '');
      removeEntity(type, id);
      return;
    }

    const row = target.closest('button[data-entity-type]');
    if (!row) {
      return;
    }

    state.selection = {
      type: String(row.dataset.entityType || ''),
      id: String(row.dataset.entityId || ''),
    };
    renderEntityLists();
    renderDetails();
  }

  function addBaseDevice() {
    const payload = activePayload();
    if (!payload) {
      return;
    }

    payload.base_devices.push({
      id: nextId('bd'),
      name: 'Neues Basisgerät',
      room: '',
      sort_order: payload.base_devices.length + 1,
      note: '',
    });

    state.selection = {
      type: 'base_device',
      id: payload.base_devices[payload.base_devices.length - 1].id,
    };

    setDirty(true);
    renderEntityLists();
    renderDetails();
  }

  function addCard() {
    const payload = activePayload();
    if (!payload) {
      return;
    }

    if (payload.base_devices.length === 0) {
      setStatus('Bitte zuerst mindestens ein Basisgerät anlegen.', true);
      return;
    }

    const preferredBaseDeviceId = selectedEntityId('base_device') || payload.base_devices[0].id;

    payload.cards.push({
      id: nextId('card'),
      base_device_id: preferredBaseDeviceId,
      name: 'Neue Karte',
      kind: '',
      sort_order: payload.cards.length + 1,
      note: '',
      defaults: {
        input_count: 0,
        output_count: 0,
        input_prefix: '',
        output_prefix: '',
        input_numeric_start: null,
        output_numeric_start: null,
        auto_link_mode: 'none',
        auto_link_pairs: [],
      },
    });

    state.selection = {
      type: 'card',
      id: payload.cards[payload.cards.length - 1].id,
    };

    setDirty(true);
    renderEntityLists();
    renderDetails();
  }

  function addPort() {
    const payload = activePayload();
    if (!payload) {
      return;
    }

    if (payload.cards.length === 0) {
      setStatus('Bitte zuerst mindestens eine Karte anlegen.', true);
      return;
    }

    const preferredCardId = selectedEntityId('card') || payload.cards[0].id;
    const card = payload.cards.find((row) => row.id === preferredCardId) || payload.cards[0];

    const direction = 'output';
    const maxIndex = payload.ports
      .filter((row) => row.card_id === card.id && row.direction === direction)
      .reduce((acc, row) => Math.max(acc, Number(row.index || 0)), 0);

    payload.ports.push({
      id: nextId('port'),
      card_id: card.id,
      base_device_id: card.base_device_id,
      direction,
      index: maxIndex + 1,
      numeric_id: null,
      name: 'Neuer Port',
      label: '',
      group: '',
      note: '',
      tags: [],
      is_virtual: false,
      is_locked: false,
    });

    state.selection = {
      type: 'port',
      id: payload.ports[payload.ports.length - 1].id,
    };

    setDirty(true);
    renderEntityLists();
    renderDetails();
  }

  function addPatch() {
    const payload = activePayload();
    if (!payload) {
      return;
    }

    ensurePayloadShape(payload);
    const outputPorts = payload.ports.filter((row) => row.direction === 'output');
    const inputPorts = payload.ports.filter((row) => row.direction === 'input');
    if (outputPorts.length === 0 || inputPorts.length === 0) {
      setStatus('Für einen Patch werden mindestens ein Output und ein Input benötigt.', true);
      return;
    }

    const patch = {
      id: nextId('patch'),
      source_port_id: outputPorts[0].id,
      target_port_id: inputPorts[0].id,
      patch_type: 'crosspoint',
      state: 'disabled',
      note: '',
      created_at: isoNow(),
      updated_at: isoNow(),
      updated_by: {
        user_id: Number((state.user && state.user.id) || 0),
        username: String((state.user && state.user.username) || ''),
      },
    };

    payload.patches.push(patch);
    state.selection = { type: 'patch', id: patch.id };
    setDirty(true);
    renderMatrixSection();
    renderDetails();
    setStatus('Neuer Patch angelegt (initial deaktiviert).');
  }

  function removeEntity(type, id) {
    const payload = activePayload();
    if (!payload) {
      return;
    }

    if (!window.confirm('Eintrag wirklich löschen?')) {
      return;
    }

    if (type === 'base_device') {
      if (payload.cards.some((row) => row.base_device_id === id)) {
        setStatus('Basisgerät kann nicht gelöscht werden, solange Karten referenzieren.', true);
        return;
      }
      payload.base_devices = payload.base_devices.filter((row) => row.id !== id);
    } else if (type === 'card') {
      if (payload.ports.some((row) => row.card_id === id)) {
        setStatus('Karte kann nicht gelöscht werden, solange Ports referenzieren.', true);
        return;
      }
      payload.cards = payload.cards.filter((row) => row.id !== id);
    } else if (type === 'port') {
      const inUse = (payload.patches || []).some((row) => row.source_port_id === id || row.target_port_id === id);
      if (inUse) {
        setStatus('Port kann nicht gelöscht werden, solange Patches referenzieren.', true);
        return;
      }
      payload.ports = payload.ports.filter((row) => row.id !== id);
    }

    if (state.selection && state.selection.type === type && state.selection.id === id) {
      state.selection = null;
    }

    setDirty(true);
    renderEntityLists();
    renderDetails();
  }

  function selectedEntityId(type) {
    if (!state.selection || state.selection.type !== type) {
      return '';
    }
    return state.selection.id;
  }

  function applyDetailForm() {
    const payload = activePayload();
    if (!payload || !state.selection) {
      return;
    }

    const formData = new FormData(el.detailForm);

    if (state.selection.type === 'base_device') {
      const row = payload.base_devices.find((x) => x.id === state.selection.id);
      if (!row) {
        return;
      }

      const nextIdValue = String(formData.get('id') || '').trim();
      if (!nextIdValue) {
        setStatus('ID darf nicht leer sein.', true);
        return;
      }
      if (nextIdValue !== row.id && payload.base_devices.some((x) => x.id === nextIdValue)) {
        setStatus('Basisgerät-ID ist bereits vergeben.', true);
        return;
      }

      const oldId = row.id;
      row.id = nextIdValue;
      row.name = String(formData.get('name') || '').trim();
      row.room = String(formData.get('room') || '').trim();
      row.sort_order = positiveInt(formData.get('sort_order'), row.sort_order || 1);
      row.note = String(formData.get('note') || '').trim();

      if (oldId !== row.id) {
        payload.cards.forEach((card) => {
          if (card.base_device_id === oldId) {
            card.base_device_id = row.id;
          }
        });
        payload.ports.forEach((port) => {
          if (port.base_device_id === oldId) {
            port.base_device_id = row.id;
          }
        });
      }

      state.selection.id = row.id;
    } else if (state.selection.type === 'card') {
      const row = payload.cards.find((x) => x.id === state.selection.id);
      if (!row) {
        return;
      }

      const currentCardId = row.id;

      const nextIdValue = String(formData.get('id') || '').trim();
      if (!nextIdValue) {
        setStatus('ID darf nicht leer sein.', true);
        return;
      }
      if (nextIdValue !== row.id && payload.cards.some((x) => x.id === nextIdValue)) {
        setStatus('Karten-ID ist bereits vergeben.', true);
        return;
      }

      const nextBaseDeviceId = String(formData.get('base_device_id') || '').trim();
      if (!payload.base_devices.some((x) => x.id === nextBaseDeviceId)) {
        setStatus('Basisgerät für Karte ist ungültig.', true);
        return;
      }

      const nextDefaults = {
        input_count: nonNegativeInt(formData.get('defaults_input_count'), row.defaults && row.defaults.input_count ? row.defaults.input_count : 0),
        output_count: nonNegativeInt(formData.get('defaults_output_count'), row.defaults && row.defaults.output_count ? row.defaults.output_count : 0),
        input_prefix: String(formData.get('defaults_input_prefix') || '').trim(),
        output_prefix: String(formData.get('defaults_output_prefix') || '').trim(),
        input_numeric_start: nullableInt(formData.get('defaults_input_numeric_start')),
        output_numeric_start: nullableInt(formData.get('defaults_output_numeric_start')),
        auto_link_mode: normalizeAutoLinkMode(String(formData.get('defaults_auto_link_mode') || 'none')),
        auto_link_pairs: parseIntList(String(formData.get('defaults_auto_link_pairs') || '')),
      };

      const syncCheck = validateCardPortSync(payload, currentCardId, nextDefaults);
      if (!syncCheck.ok) {
        setStatus(syncCheck.message, true);
        return;
      }

      const oldId = row.id;
      row.id = nextIdValue;
      row.base_device_id = nextBaseDeviceId;
      row.name = String(formData.get('name') || '').trim();
      row.kind = String(formData.get('kind') || '').trim();
      row.sort_order = positiveInt(formData.get('sort_order'), row.sort_order || 1);
      row.note = String(formData.get('note') || '').trim();

      row.defaults = nextDefaults;

      payload.ports.forEach((port) => {
        if (port.card_id === oldId) {
          port.card_id = row.id;
        }
        if (port.card_id === row.id) {
          port.base_device_id = row.base_device_id;
        }
      });

      applyCardPortSync(payload, row);

      state.selection.id = row.id;
    } else if (state.selection.type === 'port') {
      const row = payload.ports.find((x) => x.id === state.selection.id);
      if (!row) {
        return;
      }

      const nextIdValue = String(formData.get('id') || '').trim();
      if (!nextIdValue) {
        setStatus('ID darf nicht leer sein.', true);
        return;
      }
      if (nextIdValue !== row.id && payload.ports.some((x) => x.id === nextIdValue)) {
        setStatus('Port-ID ist bereits vergeben.', true);
        return;
      }

      const nextCardId = String(formData.get('card_id') || '').trim();
      const card = payload.cards.find((x) => x.id === nextCardId);
      if (!card) {
        setStatus('Karte für Port ist ungültig.', true);
        return;
      }

      const nextDirection = String(formData.get('direction') || '').trim();
      if (!(nextDirection === 'input' || nextDirection === 'output')) {
        setStatus('Port-Richtung ist ungültig.', true);
        return;
      }

      const oldId = row.id;
      row.id = nextIdValue;
      row.card_id = card.id;
      row.base_device_id = card.base_device_id;
      row.direction = nextDirection;
      row.index = positiveInt(formData.get('index'), row.index || 1);
      row.numeric_id = nullableInt(formData.get('numeric_id'));
      row.name = String(formData.get('name') || '').trim();
      row.label = String(formData.get('label') || '').trim();
      row.group = String(formData.get('group') || '').trim();
      row.note = String(formData.get('note') || '').trim();
      row.tags = parseStringList(String(formData.get('tags') || ''));
      row.is_virtual = formData.get('is_virtual') === '1';
      row.is_locked = formData.get('is_locked') === '1';

      if (oldId !== row.id && Array.isArray(payload.patches)) {
        payload.patches.forEach((patch) => {
          if (patch.source_port_id === oldId) {
            patch.source_port_id = row.id;
          }
          if (patch.target_port_id === oldId) {
            patch.target_port_id = row.id;
          }
        });
      }

      state.selection.id = row.id;
    } else if (state.selection.type === 'patch') {
      const row = (payload.patches || []).find((x) => x.id === state.selection.id);
      if (!row) {
        return;
      }

      const sourcePortId = String(formData.get('source_port_id') || '').trim();
      const targetPortId = String(formData.get('target_port_id') || '').trim();
      const sourcePort = payload.ports.find((x) => x.id === sourcePortId);
      const targetPort = payload.ports.find((x) => x.id === targetPortId);
      if (!sourcePort || sourcePort.direction !== 'output') {
        setStatus('Patch-Quelle muss ein Output-Port sein.', true);
        return;
      }
      if (!targetPort || targetPort.direction !== 'input') {
        setStatus('Patch-Ziel muss ein Input-Port sein.', true);
        return;
      }

      const nextPatchType = normalizePatchType(String(formData.get('patch_type') || 'crosspoint'));
      const nextState = normalizePatchState(String(formData.get('state') || 'active'));

      row.source_port_id = sourcePortId;
      row.target_port_id = targetPortId;
      row.patch_type = nextPatchType;
      row.state = nextState;
      row.note = String(formData.get('note') || '').trim();
      row.updated_at = isoNow();
      row.updated_by = {
        user_id: Number((state.user && state.user.id) || 0),
        username: String((state.user && state.user.username) || ''),
      };

      if (nextState === 'active') {
        deactivateOtherActivePatchesForTarget(payload, row.target_port_id, row.id);
        deactivateOtherActivePairPatches(payload, row.source_port_id, row.target_port_id, row.id);
      }
    }

    setDirty(true);
    renderAll();
    setStatus('Änderungen übernommen.');
  }

  function renderAll() {
    renderDocList();
    renderDocMeta();
    renderEntityLists();
    renderMatrixSection();
    renderDetails();
  }

  function renderDocList() {
    const currentId = state.current ? Number(state.current.id || 0) : 0;

    if (!state.docs.length) {
      el.docList.innerHTML = '<div class="pm-empty-list">Noch keine Dokumente vorhanden.</div>';
      return;
    }

    const html = state.docs.map((row) => {
      const id = Number(row.id || 0);
      const title = escapeHtml(String(row.title || 'Unbenannt'));
      const active = id === currentId ? ' active' : '';
      const version = Number(row.version || 1);
      const updatedBy = escapeHtml(String(row.updated_by_username || 'n/a'));
      const updatedAt = escapeHtml(formatDateTime(row.updated_at));

      return [
        '<button class="pm-item' + active + '" type="button" data-doc-id="' + id + '" data-help-title="Dokument" data-help="Öffnet dieses Dokument und lädt alle zugehörigen Daten.">',
        '  <span class="pm-item-title"><span class="pm-item-name">' + title + '</span><span class="chip">v' + version + '</span></span>',
        '  <span class="pm-item-sub">' + updatedAt + ' · ' + updatedBy + '</span>',
        '</button>',
      ].join('');
    }).join('');

    el.docList.innerHTML = html;
  }

  function renderDocMeta() {
    const hasDoc = Boolean(state.current);

    el.docTitle.disabled = !hasDoc;
    el.metaLocation.disabled = !hasDoc;
    el.metaProject.disabled = !hasDoc;
    el.metaNotes.disabled = !hasDoc;
    el.btnDelete.disabled = !hasDoc;
    el.btnAddBaseDevice.disabled = !hasDoc;
    el.btnAddCard.disabled = !hasDoc;
    el.btnNewPatch.disabled = !hasDoc;
    el.portSearch.disabled = !hasDoc;
    el.portDirectionFilter.disabled = !hasDoc;
    el.matrixSourceCard.disabled = !hasDoc;
    el.matrixTargetCard.disabled = !hasDoc;
    el.matrixStateFilter.disabled = !hasDoc;
    el.btnSave.disabled = !hasDoc || !state.dirty;
    el.matrixStateFilter.value = state.matrix.stateFilter;

    if (!hasDoc) {
      el.docTitle.value = '';
      el.docMeta.textContent = 'Kein Dokument geöffnet';
      el.metaLocation.value = '';
      el.metaProject.value = '';
      el.metaNotes.value = '';
      el.matrixLegend.textContent = '';
      el.matrixWrap.innerHTML = '<div class="pm-empty-list">Keine Matrixdaten.</div>';
      if (el.patchList) {
        el.patchList.innerHTML = '<div class="pm-empty-list">Keine Patches.</div>';
      }
      return;
    }

    const payload = activePayload();
    const meta = (payload && payload.meta) ? payload.meta : {};

    el.docTitle.value = String(state.current.title || meta.title || '');
    el.metaLocation.value = String(meta.location || '');
    el.metaProject.value = String(meta.show_or_project || '');
    el.metaNotes.value = String(meta.notes || '');

    const version = Number(state.current.version || 1);
    const updatedAt = formatDateTime(state.current.updated_at);
    const updatedBy = String(state.current.updated_by_username || '-');
    el.docMeta.textContent = 'ID ' + state.current.id + ' · v' + version + ' · ' + updatedAt + ' · ' + updatedBy;
  }

  function renderEntityLists() {
    const payload = activePayload();
    if (!payload) {
      el.treeView.innerHTML = '<div class="pm-empty-list">Keine Daten.</div>';
      return;
    }

    renderTreeView(payload);
  }

  function renderTreeView(payload) {
    const cardsByDevice = Object.create(null);
    const portsByCard = Object.create(null);
    const search = String(el.portSearch.value || '').trim().toLowerCase();
    const filterDirection = String(el.portDirectionFilter.value || 'all');

    payload.cards.forEach((card) => {
      if (!cardsByDevice[card.base_device_id]) {
        cardsByDevice[card.base_device_id] = [];
      }
      cardsByDevice[card.base_device_id].push(card);
    });

    payload.ports.forEach((port) => {
      if (!portsByCard[port.card_id]) {
        portsByCard[port.card_id] = [];
      }
      portsByCard[port.card_id].push(port);
    });

    const devices = payload.base_devices.slice().sort(sortByOrderThenName);
    if (!devices.length) {
      el.treeView.innerHTML = '<div class="pm-empty-list">Keine Basisgeräte vorhanden.</div>';
      return;
    }

    const html = devices.map((device) => {
      const cards = (cardsByDevice[device.id] || []).slice().sort(sortByOrderThenName);
      const isDeviceExpanded = Boolean(state.treeExpanded.base_device[device.id]);
      const deviceActive = isSelection('base_device', device.id) ? ' active' : '';

      const cardHtml = cards.map((card) => {
        const ports = (portsByCard[card.id] || []).slice().sort(sortPorts);
        const filteredPorts = ports.filter((port) => {
          if (filterDirection !== 'all' && port.direction !== filterDirection) {
            return false;
          }
          if (!search) {
            return true;
          }
          const hay = [
            card.name,
            card.id,
            port.id,
            port.name,
            port.label,
            port.group,
            port.note,
            port.direction,
          ].join(' ').toLowerCase();
          return hay.includes(search);
        });

        const cardMatches = !search || String(card.name || '').toLowerCase().includes(search) || String(card.id || '').toLowerCase().includes(search);
        if (search && !cardMatches && filteredPorts.length === 0) {
          return '';
        }

        const isCardExpanded = Boolean(state.treeExpanded.card[card.id]);
        const cardActive = isSelection('card', card.id) ? ' active' : '';

        const portHtml = filteredPorts.map((port) => {
          const portActive = isSelection('port', port.id) ? ' active' : '';
          const dirShort = port.direction === 'input' ? 'IN' : 'OUT';
          return [
            '<div class="pm-tree-node">',
            '  <button class="pm-tree-row pm-tree-port' + portActive + '" type="button" data-entity-type="port" data-entity-id="' + escapeHtml(port.id) + '" data-help-title="Port" data-help="Öffnet die Detailansicht dieses Ports.">',
            '    <span class="pm-tree-toggle" aria-hidden="true">•</span>',
            '    <span class="pm-tree-kind pm-tree-kind-port">Port</span>',
            '    <span class="pm-tree-title">' + escapeHtml(port.name || port.id) + '</span>',
            '    <span class="pm-tree-meta">' + dirShort + ' #' + Number(port.index || 0) + '</span>',
            '    <span class="pm-tree-actions"><span class="pm-remove" data-remove-type="port" data-remove-id="' + escapeHtml(port.id) + '">Löschen</span></span>',
            '  </button>',
            '</div>',
          ].join('');
        }).join('');

        return [
          '<div class="pm-tree-node">',
          '  <button class="pm-tree-row pm-tree-card' + cardActive + '" type="button" data-entity-type="card" data-entity-id="' + escapeHtml(card.id) + '" data-help-title="Karte" data-help="Öffnet die Detailansicht dieser Karte.">',
          '    <span class="pm-tree-toggle" data-tree-toggle-type="card" data-tree-toggle-id="' + escapeHtml(card.id) + '">' + (isCardExpanded ? '▾' : '▸') + '</span>',
          '    <span class="pm-tree-kind pm-tree-kind-card">Karte</span>',
          '    <span class="pm-tree-title">' + escapeHtml(card.name || card.id) + '</span>',
          '    <span class="pm-tree-meta">' + filteredPorts.length + ' Ports</span>',
          '    <span class="pm-tree-actions"><span class="pm-remove" data-remove-type="card" data-remove-id="' + escapeHtml(card.id) + '">Löschen</span></span>',
          '  </button>',
          '  <div class="pm-tree-children' + (isCardExpanded ? '' : ' hidden') + '">',
          portHtml || '<div class="pm-empty-list">Keine Ports im aktuellen Filter.</div>',
          '  </div>',
          '</div>',
        ].join('');
      }).join('');

      return [
        '<div class="pm-tree-node">',
        '  <button class="pm-tree-row pm-tree-device' + deviceActive + '" type="button" data-entity-type="base_device" data-entity-id="' + escapeHtml(device.id) + '" data-help-title="Basisgerät" data-help="Öffnet die Detailansicht dieses Basisgeräts.">',
        '    <span class="pm-tree-toggle" data-tree-toggle-type="base_device" data-tree-toggle-id="' + escapeHtml(device.id) + '">' + (isDeviceExpanded ? '▾' : '▸') + '</span>',
        '    <span class="pm-tree-kind pm-tree-kind-device">Gerät</span>',
        '    <span class="pm-tree-title">' + escapeHtml(device.name || device.id) + '</span>',
        '    <span class="pm-tree-meta">' + cards.length + ' Karten</span>',
        '    <span class="pm-tree-actions"><span class="pm-remove" data-remove-type="base_device" data-remove-id="' + escapeHtml(device.id) + '">Löschen</span></span>',
        '  </button>',
        '  <div class="pm-tree-children' + (isDeviceExpanded ? '' : ' hidden') + '">',
        cardHtml || '<div class="pm-empty-list">Keine Karten vorhanden.</div>',
        '  </div>',
        '</div>',
      ].join('');
    }).join('');

    el.treeView.innerHTML = html;
  }

  function renderMatrixSection() {
    const payload = activePayload();
    if (!payload) {
      return;
    }

    ensurePayloadShape(payload);
    syncMatrixFilters(payload);
    renderMatrixFilterOptions(payload);
    renderMatrixTable(payload);
  }

  function syncMatrixFilters(payload) {
    const cards = payload.cards || [];
    const outputCards = cards.filter((card) => payload.ports.some((port) => port.card_id === card.id && port.direction === 'output'));
    const inputCards = cards.filter((card) => payload.ports.some((port) => port.card_id === card.id && port.direction === 'input'));

    if (state.matrix.sourceCardId && !outputCards.some((card) => card.id === state.matrix.sourceCardId)) {
      state.matrix.sourceCardId = '';
    }

    if (state.matrix.targetCardId && !inputCards.some((card) => card.id === state.matrix.targetCardId)) {
      state.matrix.targetCardId = '';
    }

    if (!(state.matrix.stateFilter === 'all' || state.matrix.stateFilter === 'active')) {
      state.matrix.stateFilter = 'active';
    }
  }

  function renderMatrixFilterOptions(payload) {
    const cards = payload.cards || [];
    const outputCards = cards.filter((card) => payload.ports.some((port) => port.card_id === card.id && port.direction === 'output'));
    const inputCards = cards.filter((card) => payload.ports.some((port) => port.card_id === card.id && port.direction === 'input'));

    const sourceOptions = ['<option value="">Alle Karten mit Outputs</option>'].concat(
      outputCards.map((card) => '<option value="' + escapeHtml(card.id) + '">' + escapeHtml(card.name || card.id) + '</option>')
    );
    const targetOptions = ['<option value="">Alle Karten mit Inputs</option>'].concat(
      inputCards.map((card) => '<option value="' + escapeHtml(card.id) + '">' + escapeHtml(card.name || card.id) + '</option>')
    );

    el.matrixSourceCard.innerHTML = sourceOptions.join('');
    el.matrixTargetCard.innerHTML = targetOptions.join('');
    el.matrixSourceCard.value = state.matrix.sourceCardId;
    el.matrixTargetCard.value = state.matrix.targetCardId;
    el.matrixStateFilter.value = state.matrix.stateFilter;
  }

  function renderMatrixTable(payload) {
    const ports = payload.ports || [];
    let outputPorts = ports.filter((port) => port.direction === 'output');
    let inputPorts = ports.filter((port) => port.direction === 'input');

    if (state.matrix.sourceCardId) {
      outputPorts = outputPorts.filter((port) => port.card_id === state.matrix.sourceCardId);
    }
    if (state.matrix.targetCardId) {
      inputPorts = inputPorts.filter((port) => port.card_id === state.matrix.targetCardId);
    }

    outputPorts.sort(sortPorts);
    inputPorts.sort(sortPorts);

    const patches = Array.isArray(payload.patches) ? payload.patches : [];
    const allCellPatchesByPair = mapPatchesByPair(patches);
    const activePatchByPair = mapActivePatchByPair(patches);
    const activePatchByTarget = mapActivePatchByTarget(patches);

    const outputLabel = outputPorts.length + ' Outputs';
    const inputLabel = inputPorts.length + ' Inputs';
    el.matrixLegend.textContent = outputLabel + ' (horizontal) x ' + inputLabel + ' (vertikal) · Klick setzt Verbindung, erneuter Klick löst sie wieder.';

    const cellFontSize = 12;
    const cellSafeZone = 18;
    const cellSize = cellFontSize + (cellSafeZone * 2);
    el.matrixWrap.style.setProperty('--pm-cell-font-size', String(cellFontSize) + 'px');
    el.matrixWrap.style.setProperty('--pm-cell-safe-zone', String(cellSafeZone) + 'px');
    el.matrixWrap.style.setProperty('--pm-cell-size', String(cellSize) + 'px');

    if (outputPorts.length === 0 || inputPorts.length === 0) {
      el.matrixWrap.style.setProperty('--pm-header-height', '180px');
      el.matrixWrap.style.setProperty('--pm-row-header-width', '220px');
      el.matrixWrap.innerHTML = '<div class="pm-empty-list">Keine Matrix darstellbar. Filter oder Portdaten prüfen.</div>';
      return;
    }

    const maxOutputLabelWidth = outputPorts.reduce((max, port) => {
      return Math.max(max, measureTextWidth(String(port.name || port.id || ''), cellFontSize, 700));
    }, 0);
    const maxInputLabelWidth = inputPorts.reduce((max, port) => {
      return Math.max(max, measureTextWidth(String(port.name || port.id || ''), cellFontSize, 700));
    }, 0);
    const headerHeight = Math.max(cellSize + 42, Math.min(560, Math.ceil(maxOutputLabelWidth + (cellSafeZone * 2) + 24)));
    const rowHeaderWidth = Math.max(170, Math.min(480, Math.ceil(maxInputLabelWidth + (cellSafeZone * 2) + 46)));
    el.matrixWrap.style.setProperty('--pm-header-height', String(headerHeight) + 'px');
    el.matrixWrap.style.setProperty('--pm-row-header-width', String(rowHeaderWidth) + 'px');

    const headCells = outputPorts.map((port) => {
      return [
        '<th class="pm-matrix-col-head" title="' + escapeHtml(portDisplayName(port)) + '">',
        '  <div class="pm-matrix-col-head-inner"><span class="pm-matrix-col-label">' + escapeHtml(port.name || port.id) + '</span></div>',
        '</th>',
      ].join('');
    }).join('');

    const rows = inputPorts.map((inputPort) => {
      const cells = outputPorts.map((outputPort) => {
        const pairKey = pairKeyOf(outputPort.id, inputPort.id);
        const activePairPatch = activePatchByPair[pairKey] || null;
        const targetActivePatch = activePatchByTarget[inputPort.id] || null;
        const cellPatches = allCellPatchesByPair[pairKey] || [];
        const selectedPatchId = state.selection && state.selection.type === 'patch' ? state.selection.id : '';

        let label = '';
        let cellClass = 'empty';
        let title = 'Verbindung setzen';

        if (activePairPatch) {
          label = '✓';
          cellClass = 'active';
          title = 'Aktiver Patch: Klick löst die Verbindung';
        } else if (targetActivePatch) {
          title = 'Ziel bereits aktiv gepatcht von: ' + targetActivePatch.source_port_id;
        } else if (state.matrix.stateFilter === 'all' && cellPatches.length > 0) {
          title = 'Nur deaktivierte Patches vorhanden';
        }

        if (activePairPatch && activePairPatch.id === selectedPatchId) {
          cellClass += ' is-selected';
        }

        return [
          '<td>',
          '  <button class="pm-matrix-cell ' + cellClass + '" type="button"',
          '    data-cell-source="' + escapeHtml(outputPort.id) + '"',
          '    data-cell-target="' + escapeHtml(inputPort.id) + '"',
          '    data-help-title="Matrixzelle"',
          '    data-help="Klick setzt oder ersetzt die Verbindung vom Output (Spalte) zum Input (Zeile). Ein erneuter Klick löst die aktive Verbindung."',
          '    title="' + escapeHtml(title) + '">',
          '    <span class="pm-matrix-cell-indicator" aria-hidden="true"></span>',
          '    <span class="pm-matrix-cell-mark" aria-hidden="true">' + escapeHtml(label) + '</span>',
          '  </button>',
          '</td>',
        ].join('');
      }).join('');

      return [
        '<tr>',
        '  <th class="pm-matrix-row-head" title="' + escapeHtml(portDisplayName(inputPort)) + '"><span class="pm-matrix-row-label">' + escapeHtml(inputPort.name || inputPort.id) + '</span></th>',
        cells,
        '</tr>',
      ].join('');
    }).join('');

    el.matrixWrap.innerHTML = [
      '<table class="pm-matrix">',
      '  <thead>',
      '    <tr>',
      '      <th class="pm-matrix-corner"><span class="pm-corner-axis"><span class="pm-corner-axis-v">IN ↓</span><span class="pm-corner-axis-h">OUT →</span></span></th>',
      headCells,
      '    </tr>',
      '  </thead>',
      '  <tbody>',
      rows,
      '  </tbody>',
      '</table>',
    ].join('');
  }

  function renderPatchList(payload) {
    if (!el.patchList) {
      return;
    }

    const patches = Array.isArray(payload.patches) ? payload.patches : [];
    const portMap = mapById(payload.ports || []);

    let items = patches.slice();
    if (state.matrix.stateFilter === 'active') {
      items = items.filter((patch) => normalizePatchState(patch.state) === 'active');
    }
    if (state.matrix.sourceCardId) {
      items = items.filter((patch) => {
        const sourcePort = portMap[patch.source_port_id];
        return sourcePort && sourcePort.card_id === state.matrix.sourceCardId;
      });
    }
    if (state.matrix.targetCardId) {
      items = items.filter((patch) => {
        const targetPort = portMap[patch.target_port_id];
        return targetPort && targetPort.card_id === state.matrix.targetCardId;
      });
    }

    items.sort((a, b) => String(a.id || '').localeCompare(String(b.id || ''), 'de'));

    if (items.length === 0) {
      el.patchList.innerHTML = '<div class="pm-empty-list">Keine Patches im aktuellen Filter.</div>';
      return;
    }

    const html = items.map((patch) => {
      const sourceLabel = portMap[patch.source_port_id] ? portDisplayName(portMap[patch.source_port_id]) : patch.source_port_id;
      const targetLabel = portMap[patch.target_port_id] ? portDisplayName(portMap[patch.target_port_id]) : patch.target_port_id;
      const patchType = normalizePatchType(patch.patch_type);
      const patchState = normalizePatchState(patch.state);
      const activeClass = isSelection('patch', patch.id) ? ' active' : '';

      return [
        '<button class="pm-item' + activeClass + '" type="button" data-patch-id="' + escapeHtml(patch.id) + '" data-help-title="Patch" data-help="Öffnet diesen Patch in der Detailansicht zum Bearbeiten.">',
        '  <span class="pm-item-title"><span class="pm-item-name">' + escapeHtml(sourceLabel) + ' -> ' + escapeHtml(targetLabel) + '</span><span class="chip">' + escapeHtml(patchType) + '</span></span>',
        '  <span class="pm-item-sub">' + escapeHtml(patchState) + '</span>',
        '</button>',
      ].join('');
    }).join('');

    el.patchList.innerHTML = html;
  }

  function onMatrixCellClick(sourcePortId, targetPortId) {
    const payload = activePayload();
    if (!payload) {
      return;
    }

    ensurePayloadShape(payload);
    const sourcePort = payload.ports.find((port) => port.id === sourcePortId);
    const targetPort = payload.ports.find((port) => port.id === targetPortId);
    if (!sourcePort || sourcePort.direction !== 'output' || !targetPort || targetPort.direction !== 'input') {
      setStatus('Ungültige Matrixzelle.', true);
      return;
    }

    const patches = payload.patches;
    const activePairPatch = patches.find((patch) => {
      return normalizePatchState(patch.state) === 'active'
        && patch.source_port_id === sourcePortId
        && patch.target_port_id === targetPortId;
    });

    if (activePairPatch) {
      activePairPatch.state = 'disabled';
      activePairPatch.updated_at = isoNow();
      activePairPatch.updated_by = {
        user_id: Number((state.user && state.user.id) || 0),
        username: String((state.user && state.user.username) || ''),
      };

      if (state.selection && state.selection.type === 'patch' && state.selection.id === activePairPatch.id) {
        state.selection = null;
      }

      setDirty(true);
      renderAll();
      setStatus('Verbindung gelöst.');
      return;
    }

    const targetActivePatch = patches.find((patch) => {
      return normalizePatchState(patch.state) === 'active' && patch.target_port_id === targetPortId;
    });

    if (targetActivePatch && targetActivePatch.source_port_id !== sourcePortId) {
      const ok = window.confirm('Das Ziel ist bereits gepatcht. Bestehende aktive Verbindung ersetzen?');
      if (!ok) {
        return;
      }
      targetActivePatch.state = 'disabled';
      targetActivePatch.updated_at = isoNow();
      targetActivePatch.updated_by = {
        user_id: Number((state.user && state.user.id) || 0),
        username: String((state.user && state.user.username) || ''),
      };
    }

    const existingPairPatch = patches.find((patch) => {
      return patch.source_port_id === sourcePortId && patch.target_port_id === targetPortId;
    });

    if (existingPairPatch) {
      existingPairPatch.state = 'active';
      existingPairPatch.patch_type = normalizePatchType(existingPairPatch.patch_type);
      existingPairPatch.updated_at = isoNow();
      existingPairPatch.updated_by = {
        user_id: Number((state.user && state.user.id) || 0),
        username: String((state.user && state.user.username) || ''),
      };
      deactivateOtherActivePatchesForTarget(payload, targetPortId, existingPairPatch.id);
      deactivateOtherActivePairPatches(payload, sourcePortId, targetPortId, existingPairPatch.id);
      state.selection = { type: 'patch', id: existingPairPatch.id };
      setDirty(true);
      renderAll();
      setStatus('Patch aktiviert.');
      return;
    }

    const newPatch = {
      id: nextId('patch'),
      source_port_id: sourcePortId,
      target_port_id: targetPortId,
      patch_type: 'crosspoint',
      state: 'active',
      note: '',
      created_at: isoNow(),
      updated_at: isoNow(),
      updated_by: {
        user_id: Number((state.user && state.user.id) || 0),
        username: String((state.user && state.user.username) || ''),
      },
    };

    patches.push(newPatch);
    deactivateOtherActivePatchesForTarget(payload, targetPortId, newPatch.id);
    deactivateOtherActivePairPatches(payload, sourcePortId, targetPortId, newPatch.id);
    state.selection = { type: 'patch', id: newPatch.id };
    setDirty(true);
    renderAll();
    setStatus('Neue aktive Verbindung gesetzt.');
  }

  function renderDetails() {
    const payload = activePayload();
    el.btnDeletePatch.classList.add('hidden');

    if (!payload || !state.selection) {
      el.detailEmpty.classList.remove('hidden');
      el.detailForm.classList.add('hidden');
      el.detailFields.innerHTML = '';
      return;
    }

    if (state.selection.type === 'base_device') {
      const row = payload.base_devices.find((x) => x.id === state.selection.id);
      if (!row) {
        state.selection = null;
        renderDetails();
        return;
      }
      renderBaseDeviceDetails(row);
      return;
    }

    if (state.selection.type === 'card') {
      const row = payload.cards.find((x) => x.id === state.selection.id);
      if (!row) {
        state.selection = null;
        renderDetails();
        return;
      }
      renderCardDetails(row, payload.base_devices);
      return;
    }

    if (state.selection.type === 'port') {
      const row = payload.ports.find((x) => x.id === state.selection.id);
      if (!row) {
        state.selection = null;
        renderDetails();
        return;
      }
      renderPortDetails(row, payload.cards, payload.base_devices);
      return;
    }

    if (state.selection.type === 'patch') {
      const row = (payload.patches || []).find((x) => x.id === state.selection.id);
      if (!row) {
        state.selection = null;
        renderDetails();
        return;
      }
      renderPatchDetails(row, payload.ports);
      el.btnDeletePatch.classList.remove('hidden');
      return;
    }

    el.detailEmpty.classList.remove('hidden');
    el.detailForm.classList.add('hidden');
    el.detailFields.innerHTML = '';
  }

  function renderBaseDeviceDetails(row) {
    el.detailEmpty.classList.add('hidden');
    el.detailForm.classList.remove('hidden');

    el.detailFields.innerHTML = [
      '<div class="pm-detail-group">',
      '  <div class="pm-detail-title">Basisgerät</div>',
      '  <div class="pm-detail-grid">',
      fieldInput('ID', 'id', row.id),
      fieldInput('Name', 'name', row.name),
      fieldInput('Raum', 'room', row.room),
      fieldInput('Sortierung', 'sort_order', row.sort_order, 'number', '1'),
      '  </div>',
      fieldTextArea('Notiz', 'note', row.note, 3),
      '</div>',
    ].join('');
  }

  function renderCardDetails(row, baseDevices) {
    const defaults = row.defaults || {};

    el.detailEmpty.classList.add('hidden');
    el.detailForm.classList.remove('hidden');

    el.detailFields.innerHTML = [
      '<div class="pm-detail-group">',
      '  <div class="pm-detail-title">Karte</div>',
      '  <div class="pm-detail-grid">',
      fieldInput('ID', 'id', row.id),
      fieldSelect('Basisgerät', 'base_device_id', baseDevices.map((x) => ({ value: x.id, label: x.name || x.id })), row.base_device_id),
      fieldInput('Name', 'name', row.name),
      fieldInput('Typ/Kategorie', 'kind', row.kind),
      fieldInput('Sortierung', 'sort_order', row.sort_order, 'number', '1'),
      '  </div>',
      fieldTextArea('Notiz', 'note', row.note, 2),
      '</div>',
      '<div class="pm-detail-group">',
      '  <div class="pm-detail-title">Defaults</div>',
      '  <div class="pm-detail-grid">',
      fieldInput('Input Count', 'defaults_input_count', defaults.input_count, 'number', '0'),
      fieldInput('Output Count', 'defaults_output_count', defaults.output_count, 'number', '0'),
      fieldInput('Input Prefix', 'defaults_input_prefix', defaults.input_prefix || ''),
      fieldInput('Output Prefix', 'defaults_output_prefix', defaults.output_prefix || ''),
      fieldInput('Input Numeric Start', 'defaults_input_numeric_start', nullableToString(defaults.input_numeric_start), 'number', ''),
      fieldInput('Output Numeric Start', 'defaults_output_numeric_start', nullableToString(defaults.output_numeric_start), 'number', ''),
      fieldSelect('Auto Link Mode', 'defaults_auto_link_mode', [
        { value: 'none', label: 'none' },
        { value: 'all', label: 'all' },
        { value: 'custom', label: 'custom' },
      ], normalizeAutoLinkMode(defaults.auto_link_mode || 'none')),
      '  </div>',
      fieldInput('Auto Link Pairs (CSV)', 'defaults_auto_link_pairs', (defaults.auto_link_pairs || []).join(', ')),
      '</div>',
    ].join('');
  }

  function renderPortDetails(row, cards, baseDevices) {
    const card = cards.find((x) => x.id === row.card_id);
    const baseDevice = baseDevices.find((x) => x.id === (card ? card.base_device_id : row.base_device_id));

    el.detailEmpty.classList.add('hidden');
    el.detailForm.classList.remove('hidden');

    el.detailFields.innerHTML = [
      '<div class="pm-detail-group">',
      '  <div class="pm-detail-title">Port</div>',
      '  <div class="pm-detail-grid">',
      fieldInput('ID', 'id', row.id),
      fieldSelect('Karte', 'card_id', cards.map((x) => ({ value: x.id, label: x.name || x.id })), row.card_id),
      fieldInput('Basisgerät (aus Karte)', 'base_device_id_display', baseDevice ? (baseDevice.name || baseDevice.id) : row.base_device_id, 'text', '', true),
      fieldSelect('Richtung', 'direction', [
        { value: 'input', label: 'input' },
        { value: 'output', label: 'output' },
      ], row.direction),
      fieldInput('Index', 'index', row.index, 'number', '1'),
      fieldInput('Numeric ID', 'numeric_id', nullableToString(row.numeric_id), 'number', ''),
      fieldInput('Name', 'name', row.name),
      fieldInput('Label', 'label', row.label || ''),
      fieldInput('Gruppe', 'group', row.group || ''),
      '  </div>',
      fieldTextArea('Notiz', 'note', row.note || '', 2),
      fieldInput('Tags (CSV)', 'tags', (row.tags || []).join(', ')),
      '  <div class="pm-check-row">',
      checkField('Virtuell', 'is_virtual', row.is_virtual),
      checkField('Gesperrt', 'is_locked', row.is_locked),
      '  </div>',
      '</div>',
    ].join('');
  }

  function renderPatchDetails(row, ports) {
    const outputOptions = ports
      .filter((port) => port.direction === 'output')
      .sort(sortPorts)
      .map((port) => ({ value: port.id, label: portDisplayName(port) }));

    const inputOptions = ports
      .filter((port) => port.direction === 'input')
      .sort(sortPorts)
      .map((port) => ({ value: port.id, label: portDisplayName(port) }));

    el.detailEmpty.classList.add('hidden');
    el.detailForm.classList.remove('hidden');

    el.detailFields.innerHTML = [
      '<div class="pm-detail-group">',
      '  <div class="pm-detail-title">Patch</div>',
      '  <div class="pm-detail-grid">',
      fieldInput('ID', 'id_display', row.id, 'text', '', true),
      fieldSelect('Patch-Typ', 'patch_type', [
        { value: 'crosspoint', label: 'crosspoint' },
        { value: 'fixed', label: 'fixed' },
      ], normalizePatchType(row.patch_type)),
      fieldSelect('Status', 'state', [
        { value: 'active', label: 'active' },
        { value: 'disabled', label: 'disabled' },
      ], normalizePatchState(row.state)),
      fieldSelect('Quelle (Output)', 'source_port_id', outputOptions, row.source_port_id),
      fieldSelect('Ziel (Input)', 'target_port_id', inputOptions, row.target_port_id),
      '  </div>',
      fieldTextArea('Notiz', 'note', row.note || '', 3),
      '</div>',
    ].join('');
  }

  function fieldInput(label, name, value, type = 'text', min = '', disabled = false) {
    const attrs = [];
    attrs.push('type="' + escapeHtml(type) + '"');
    attrs.push('name="' + escapeHtml(name) + '"');
    attrs.push('value="' + escapeHtml(value === null || value === undefined ? '' : String(value)) + '"');
    if (min !== '') {
      attrs.push('min="' + escapeHtml(String(min)) + '"');
    }
    if (disabled) {
      attrs.push('disabled');
    }

    return [
      '<label class="pm-field">',
      '  <span class="label">' + escapeHtml(label) + '</span>',
      '  <input class="input" ' + attrs.join(' ') + '>',
      '</label>',
    ].join('');
  }

  function fieldTextArea(label, name, value, rows) {
    return [
      '<label class="pm-field">',
      '  <span class="label">' + escapeHtml(label) + '</span>',
      '  <textarea class="input pm-textarea" name="' + escapeHtml(name) + '" rows="' + Number(rows || 3) + '">' + escapeHtml(String(value || '')) + '</textarea>',
      '</label>',
    ].join('');
  }

  function fieldSelect(label, name, options, selected) {
    const optionHtml = options.map((opt) => {
      const value = String(opt.value || '');
      const text = String(opt.label || value);
      const sel = value === String(selected || '') ? ' selected' : '';
      return '<option value="' + escapeHtml(value) + '"' + sel + '>' + escapeHtml(text) + '</option>';
    }).join('');

    return [
      '<label class="pm-field">',
      '  <span class="label">' + escapeHtml(label) + '</span>',
      '  <select class="select" name="' + escapeHtml(name) + '">' + optionHtml + '</select>',
      '</label>',
    ].join('');
  }

  function checkField(label, name, checked) {
    return [
      '<label>',
      '  <input type="checkbox" name="' + escapeHtml(name) + '" value="1"' + (checked ? ' checked' : '') + '>',
      '  <span>' + escapeHtml(label) + '</span>',
      '</label>',
    ].join('');
  }

  function deleteSelectedPatch() {
    const payload = activePayload();
    if (!payload || !state.selection || state.selection.type !== 'patch') {
      return;
    }

    const patchId = state.selection.id;
    const row = (payload.patches || []).find((patch) => patch.id === patchId);
    if (!row) {
      return;
    }

    const ok = window.confirm('Patch wirklich löschen?');
    if (!ok) {
      return;
    }

    payload.patches = payload.patches.filter((patch) => patch.id !== patchId);
    state.selection = null;
    setDirty(true);
    renderAll();
    setStatus('Patch gelöscht.');
  }

  function ensurePayloadShape(payload) {
    if (!payload || typeof payload !== 'object') {
      return;
    }

    if (!Array.isArray(payload.base_devices)) {
      payload.base_devices = [];
    }
    if (!Array.isArray(payload.cards)) {
      payload.cards = [];
    }
    if (!Array.isArray(payload.ports)) {
      payload.ports = [];
    }
    payload.ports.forEach((port) => {
      if (typeof port.is_auto_generated !== 'boolean') {
        port.is_auto_generated = false;
      }
    });
    if (!Array.isArray(payload.patches)) {
      payload.patches = [];
    }
    if (!payload.meta || typeof payload.meta !== 'object') {
      payload.meta = {};
    }
  }

  function pairKeyOf(sourcePortId, targetPortId) {
    return String(sourcePortId) + '>' + String(targetPortId);
  }

  function mapPatchesByPair(patches) {
    const out = Object.create(null);
    (patches || []).forEach((patch) => {
      if (!patch || !patch.source_port_id || !patch.target_port_id) {
        return;
      }
      const key = pairKeyOf(patch.source_port_id, patch.target_port_id);
      if (!out[key]) {
        out[key] = [];
      }
      out[key].push(patch);
    });
    return out;
  }

  function mapActivePatchByPair(patches) {
    const out = Object.create(null);
    (patches || []).forEach((patch) => {
      if (!patch || !patch.source_port_id || !patch.target_port_id) {
        return;
      }
      if (normalizePatchState(patch.state) !== 'active') {
        return;
      }
      const key = pairKeyOf(patch.source_port_id, patch.target_port_id);
      if (!out[key]) {
        out[key] = patch;
      }
    });
    return out;
  }

  function mapActivePatchByTarget(patches) {
    const out = Object.create(null);
    (patches || []).forEach((patch) => {
      if (!patch || !patch.target_port_id) {
        return;
      }
      if (normalizePatchState(patch.state) !== 'active') {
        return;
      }
      if (!out[patch.target_port_id]) {
        out[patch.target_port_id] = patch;
      }
    });
    return out;
  }

  function deactivateOtherActivePatchesForTarget(payload, targetPortId, keepPatchId) {
    (payload.patches || []).forEach((patch) => {
      if (!patch || patch.id === keepPatchId) {
        return;
      }
      if (patch.target_port_id === targetPortId && normalizePatchState(patch.state) === 'active') {
        patch.state = 'disabled';
        patch.updated_at = isoNow();
        patch.updated_by = {
          user_id: Number((state.user && state.user.id) || 0),
          username: String((state.user && state.user.username) || ''),
        };
      }
    });
  }

  function deactivateOtherActivePairPatches(payload, sourcePortId, targetPortId, keepPatchId) {
    (payload.patches || []).forEach((patch) => {
      if (!patch || patch.id === keepPatchId) {
        return;
      }
      if (patch.source_port_id === sourcePortId
        && patch.target_port_id === targetPortId
        && normalizePatchState(patch.state) === 'active') {
        patch.state = 'disabled';
        patch.updated_at = isoNow();
        patch.updated_by = {
          user_id: Number((state.user && state.user.id) || 0),
          username: String((state.user && state.user.username) || ''),
        };
      }
    });
  }

  function portDisplayName(port) {
    const name = String(port.name || port.id || 'Port');
    const direction = port.direction === 'input' ? 'IN' : 'OUT';
    const index = Number(port.index || 0);
    if (index > 0) {
      return name + ' (' + direction + ' #' + index + ')';
    }
    return name + ' (' + direction + ')';
  }

  function isSelection(type, id) {
    return !!state.selection && state.selection.type === type && state.selection.id === id;
  }

  function mapById(items) {
    const out = Object.create(null);
    (items || []).forEach((item) => {
      if (!item || !item.id) {
        return;
      }
      out[item.id] = item;
    });
    return out;
  }

  function measureTextWidth(text, fontSizePx, fontWeight) {
    const value = String(text || '');
    if (!value) {
      return 0;
    }

    if (!matrixTextMeasureCtx) {
      const canvas = document.createElement('canvas');
      matrixTextMeasureCtx = canvas.getContext('2d');
    }

    const size = Number(fontSizePx || 12);
    if (!matrixTextMeasureCtx) {
      return value.length * (size * 0.62);
    }

    const weight = Number(fontWeight || 700);
    matrixTextMeasureCtx.font = String(weight) + ' ' + String(size) + 'px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
    return matrixTextMeasureCtx.measureText(value).width;
  }

  function sortByOrderThenName(a, b) {
    const aOrder = Number(a.sort_order || 0);
    const bOrder = Number(b.sort_order || 0);
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    return String(a.name || a.id).localeCompare(String(b.name || b.id), 'de');
  }

  function sortPorts(a, b) {
    // Sortiere nach numerischer ID (aufsteigend)
    const aNumId = a.numeric_id !== null && a.numeric_id !== undefined ? Number(a.numeric_id) : Infinity;
    const bNumId = b.numeric_id !== null && b.numeric_id !== undefined ? Number(b.numeric_id) : Infinity;
    
    if (aNumId !== bNumId) {
      return aNumId - bNumId;
    }

    // Fallback auf Kartensortierung, falls keine numeric_id
    const aCard = String(a.card_id || '');
    const bCard = String(b.card_id || '');
    if (aCard !== bCard) {
      return aCard.localeCompare(bCard, 'de');
    }

    const aDir = String(a.direction || '');
    const bDir = String(b.direction || '');
    if (aDir !== bDir) {
      return aDir.localeCompare(bDir, 'de');
    }

    const aIdx = Number(a.index || 0);
    const bIdx = Number(b.index || 0);
    if (aIdx !== bIdx) {
      return aIdx - bIdx;
    }

    return String(a.name || a.id).localeCompare(String(b.name || b.id), 'de');
  }

  function validateCardPortSync(payload, cardId, nextDefaults) {
    const patches = Array.isArray(payload.patches) ? payload.patches : [];

    const directions = ['input', 'output'];
    for (let i = 0; i < directions.length; i += 1) {
      const direction = directions[i];
      const targetCount = Number(nextDefaults[direction + '_count'] || 0);
      const ports = payload.ports
        .filter((port) => port.card_id === cardId && port.direction === direction)
        .slice()
        .sort((a, b) => Number(a.index || 0) - Number(b.index || 0));

      if (ports.length <= targetCount) {
        continue;
      }

      const toRemove = ports.slice(targetCount);
      const blockedPort = toRemove.find((port) => {
        return patches.some((patch) => patch.source_port_id === port.id || patch.target_port_id === port.id);
      });

      if (blockedPort) {
        return {
          ok: false,
          message: 'Portanzahl kann nicht reduziert werden: Port "' + String(blockedPort.name || blockedPort.id) + '" wird in Patches verwendet.',
        };
      }
    }

    return { ok: true, message: '' };
  }

  function applyCardPortSync(payload, card) {
    const defaults = card.defaults || {};
    syncPortsForDirection(payload, card, 'input', defaults.input_count, defaults.input_prefix, defaults.input_numeric_start);
    syncPortsForDirection(payload, card, 'output', defaults.output_count, defaults.output_prefix, defaults.output_numeric_start);
  }

  function syncPortsForDirection(payload, card, direction, targetCountRaw, prefixRaw, numericStart) {
    const targetCount = Number(targetCountRaw || 0);
    const prefix = String(prefixRaw || '').trim() || (direction === 'input' ? 'Input' : 'Output');

    const ports = payload.ports
      .filter((port) => port.card_id === card.id && port.direction === direction)
      .slice()
      .sort((a, b) => Number(a.index || 0) - Number(b.index || 0));

    const toRemove = ports.slice(targetCount);
    if (toRemove.length > 0) {
      const removeIds = Object.create(null);
      toRemove.forEach((port) => {
        removeIds[port.id] = true;
      });
      payload.ports = payload.ports.filter((port) => !removeIds[port.id]);
    }

    const keepPorts = ports.slice(0, targetCount);
    for (let idx = keepPorts.length; idx < targetCount; idx += 1) {
      const index = idx + 1;
      const created = {
        id: nextId('port'),
        card_id: card.id,
        base_device_id: card.base_device_id,
        direction,
        index,
        numeric_id: numericStart === null || numericStart === undefined ? null : Number(numericStart) + idx,
        name: formatAutoPortName(prefix, index),
        label: '',
        group: '',
        note: '',
        tags: [],
        is_virtual: false,
        is_locked: false,
        is_auto_generated: true,
      };
      payload.ports.push(created);
      keepPorts.push(created);
    }

    keepPorts.forEach((port, idx) => {
      const index = idx + 1;
      const isAutoGenerated = Boolean(port.is_auto_generated);
      port.card_id = card.id;
      port.base_device_id = card.base_device_id;
      port.direction = direction;
      port.index = index;

      if (isAutoGenerated) {
        port.name = formatAutoPortName(prefix, index);
        port.numeric_id = numericStart === null || numericStart === undefined ? null : Number(numericStart) + idx;
      }
    });
  }

  function formatAutoPortName(prefix, index) {
    return String(prefix || 'Port') + ' ' + String(index).padStart(2, '0');
  }

  function nextId(prefix) {
    const seed = Math.random().toString(36).slice(2, 9);
    return prefix + '_' + Date.now().toString(36) + '_' + seed;
  }

  function positiveInt(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1) {
      return Number(fallback || 1);
    }
    return Math.floor(n);
  }

  function nonNegativeInt(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      return Number(fallback || 0);
    }
    return Math.floor(n);
  }

  function nullableInt(value) {
    if (value === null || value === undefined) {
      return null;
    }
    const raw = String(value).trim();
    if (raw === '') {
      return null;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      return null;
    }
    return Math.floor(n);
  }

  function parseIntList(csv) {
    if (!csv) {
      return [];
    }
    const out = [];
    String(csv).split(',').forEach((part) => {
      const n = Number(String(part).trim());
      if (Number.isFinite(n) && n > 0) {
        out.push(Math.floor(n));
      }
    });
    return Array.from(new Set(out)).sort((a, b) => a - b);
  }

  function parseStringList(csv) {
    if (!csv) {
      return [];
    }
    const out = [];
    String(csv).split(',').forEach((part) => {
      const val = String(part).trim();
      if (val !== '') {
        out.push(val);
      }
    });
    return Array.from(new Set(out));
  }

  function normalizeAutoLinkMode(value) {
    const v = String(value || '').toLowerCase().trim();
    if (v === 'all' || v === 'custom') {
      return v;
    }
    return 'none';
  }

  function normalizePatchType(value) {
    const v = String(value || '').toLowerCase().trim();
    if (v === 'fixed' || v === 'crosspoint') {
      return v;
    }
    return 'crosspoint';
  }

  function normalizePatchState(value) {
    const v = String(value || '').toLowerCase().trim();
    if (v === 'disabled') {
      return 'disabled';
    }
    return 'active';
  }

  function isoNow() {
    return new Date().toISOString();
  }

  function nullableToString(value) {
    return value === null || value === undefined ? '' : String(value);
  }

  function formatDateTime(value) {
    if (!value) {
      return 'n/a';
    }
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    return date.toLocaleString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatValidationDetails(details) {
    if (!Array.isArray(details) || details.length === 0) {
      return '';
    }
    const preview = details.slice(0, 3).map((row) => {
      const path = row && row.path ? row.path : 'payload';
      const message = row && row.message ? row.message : 'invalid';
      return path + ': ' + message;
    });
    return preview.join(' | ');
  }

  function handleError(error) {
    console.error(error);

    const payload = error && error.payload ? error.payload : null;
    if (error && error.message === 'version_conflict' && payload) {
      setStatus('Versionskonflikt: Dokument wurde zwischenzeitlich geändert.', true);
      reloadDocumentList().catch(() => {});
      return;
    }

    if (payload && error && error.message === 'validation_error') {
      const details = formatValidationDetails(payload.details);
      setStatus('Validierungsfehler. ' + details, true);
      return;
    }

    setStatus('Fehler: ' + String(error && error.message ? error.message : error), true);
  }
})();
