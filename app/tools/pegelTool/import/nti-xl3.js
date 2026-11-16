/* pegelTool Phase 2: deterministic, DOM-free NTi XL3 importer.
 * Not a DIN 15905-5 evaluation. No measurement correction is calculated here.
 * CommonJS and browser global; no dependencies.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PegelToolImport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MODEL_VERSION = 1;
  const KEYS = ['laeqDt', 'laeqG30', 'laeqG5', 'lcpeak', 'lafmax'];
  const ALIASES = {
    date: ['date', 'yyyymmdd'],
    time: ['time', 'hhmmss'],
    timer: ['timer'],
    laeqDt: ['laeqdtk1', 'laeqdt', 'laeqk1', 'laeq'],
    laeqG30: ['laeqg30k1', 'laeqg30', 'g30'],
    laeqG5: ['laeqg5k1', 'laeqg5'],
    lcpeak: ['lcpkmaxdtk2', 'lcpkmaxdt', 'lcpkmax', 'lcpeak', 'lcpk'],
    lafmax: ['lafmaxdtk1', 'lafmaxdt', 'lafmax']
  };

  function emptyModel(fileName) {
    return {
      schemaVersion: MODEL_VERSION,
      kind: 'nti-xl3-broadband',
      source: {fileName: String(fileName || ''), timeBasis: 'local-wall-clock', rawTextStoredSeparately: true},
      event: {name: null, venue: null, date: null},
      measurement: {start: null, end: null, intervalText: null, intervalSeconds: null, timeZone: null},
      instrument: {deviceModel: null, serial: null, firmware: null, microphone: {type: null, serial: null, calibrationInfo: null, sensitivity: null}},
      places: {measurement: null, assessmentLAeq: null, assessmentLCpeak: null},
      calibration: {before: null, after: null, device: null, status: 'not-documented'},
      corrections: {
        k1: {valueDb: null, valueSource: 'missing', appliedInLog: 'unknown', determination: null},
        k2: {valueDb: null, valueSource: 'missing', appliedInLog: 'unknown', determination: null}
      },
      columns: {},
      samples: [],
      summary: {present: false, verified: false, sourceLine: null, fields: {}, candidateFields: {}, reason: null},
      timeBlocks: [], // Phase 3 (normative calculation) is deliberately not implemented here.
      quality: {status: 'rejected', warnings: [], errors: []}
    };
  }

  function number(raw) {
    if (raw == null) return null;
    let s = String(raw).trim();
    if (!s || /^[-–—]+(?:\/[-–—]+)?$/.test(s)) return null;
    // Strict decimal/grouping handling: 1.234,5 / 1,234.5 / 98,5 / 98.5.
    if (/^[+-]?\d{1,3}(?:\.\d{3})+,\d+$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^[+-]?\d{1,3}(?:,\d{3})+\.\d+$/.test(s)) s = s.replace(/,/g, '');
    else if (/^[+-]?\d+(?:[.,]\d+)?$/.test(s)) s = s.replace(',', '.');
    else return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function interval(raw) {
    if (raw == null || !String(raw).trim()) return null;
    const s = String(raw).trim();
    if (/^\d+(?:[.,]\d+)?$/.test(s)) {
      const n = number(s);
      return n > 0 ? n : null;
    }
    const parts = s.split(':');
    if (parts.length !== 2 && parts.length !== 3) return null;
    if (parts.slice(0, -1).some(p => !/^\d+$/.test(p)) || !/^\d+(?:[.,]\d+)?$/.test(parts[parts.length - 1])) return null;
    const v = parts.map(number);
    if (v.slice(1).some(n => n < 0 || n >= 60)) return null;
    const sec = parts.length === 3 ? v[0] * 3600 + v[1] * 60 + v[2] : v[0] * 60 + v[1];
    return sec > 0 ? sec : null;
  }

  function timestamp(date, time) {
    const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
    const tm = /^(\d{2}):(\d{2}):(\d{2})(?:[.,](\d+))?$/.exec(String(time || ''));
    if (!dm || !tm) return null;
    const [year, month, day] = dm.slice(1).map(Number);
    const [hour, minute, second] = tm.slice(1, 4).map(Number);
    const ms = Math.round(Number('0.' + (tm[4] || '0')) * 1000);
    if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59 || ms > 999) return null;
    const epoch = Date.UTC(year, month - 1, day, hour, minute, second, ms);
    const valid = new Date(epoch);
    if (valid.getUTCFullYear() !== year || valid.getUTCMonth() + 1 !== month || valid.getUTCDate() !== day) return null;
    // Epoch is used ONLY to compare wall-clock intervals. No timezone is assumed.
    return epoch;
  }

  function cols(line) {
    const labels = String(line || '').trim().split(/\s+/).filter(Boolean);
    const normalized = labels.map(x => x.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const mapping = {};
    for (const [field, aliases] of Object.entries(ALIASES)) {
      const i = aliases.map(a => normalized.indexOf(a)).find(idx => idx >= 0);
      if (i !== undefined) mapping[field] = i;
    }
    return {labels, mapping};
  }

  function parse(text, options) {
    const opts = options || {};
    const model = emptyModel(opts.fileName);
    const q = model.quality;
    const lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
    function warn(code, message, line, extra) {
      q.warnings.push(Object.assign({code, severity: 'warning', message, line: line || null}, extra || {}));
    }
    function fail(code, message, line) {
      q.errors.push({code, severity: 'error', message, line: line || null});
    }
    function matchingValue(key) {
      const re = new RegExp('^\\s*' + key + '\\s*:\\s*(.*?)\\s*$', 'i');
      for (let i = 0; i < lines.length; i++) {
        const match = re.exec(lines[i]);
        if (match) return {value: match[1], line: i + 1};
      }
      return null;
    }
    const device = matchingValue('Device Info');
    if (device) {
      const chunks = device.value.split(',').map(x => x.trim());
      model.instrument.deviceModel = chunks[0] || null;
      const sn = /(?:SNo\.?|S\/N|SN)\s*([^\s,]+)/i.exec(device.value);
      const fw = /\bFW\s*([^\s,]+)/i.exec(device.value);
      model.instrument.serial = sn ? sn[1] : null;
      model.instrument.firmware = fw ? fw[1] : null;
    }
    const mic = matchingValue('Mic Type');
    if (mic) {
      model.instrument.microphone.type = mic.value.split(',')[0].trim() || null;
      const sn = /(?:SNo\.?|S\/N|SN)\s*([^\s,]+)/i.exec(mic.value);
      const cal = /\bCalibrated\s+(.+)$/i.exec(mic.value);
      model.instrument.microphone.serial = sn ? sn[1] : null;
      model.instrument.microphone.calibrationInfo = cal ? cal[1] : null;
    }
    model.instrument.microphone.sensitivity = matchingValue('Mic Sensitivity')?.value || null;
    model.measurement.timeZone = matchingValue('Time Zone')?.value || null;
    const headerStart = matchingValue('Start');
    const headerEnd = matchingValue('End');
    model.measurement.start = headerStart ? headerStart.value.replace(/,/g, ' ').trim() : null;
    model.measurement.end = headerEnd ? headerEnd.value.replace(/,/g, ' ').trim() : null;
    const logInterval = matchingValue('Log-Interval') || matchingValue('Log Interval');
    model.measurement.intervalText = logInterval?.value || null;
    model.measurement.intervalSeconds = interval(logInterval?.value);
    if (model.measurement.intervalSeconds == null) fail('INVALID_INTERVAL', 'Kein gültiges positives Log-Intervall; keine Zeitabdeckung berechenbar.', logInterval?.line);
    for (const name of ['k1', 'k2']) {
      const kv = matchingValue(name);
      const raw = kv?.value || '';
      const m = /[+-]?\d+(?:[.,]\d+)?/.exec(raw);
      const value = m ? number(m[0]) : null;
      model.corrections[name].valueDb = value;
      model.corrections[name].valueSource = value != null ? 'device-header' : 'missing';
      if (kv && value == null) warn('INVALID_CORRECTION', name + ' im Kopf nicht numerisch lesbar.', kv.line);
    }
    const marker = lines.findIndex(x => x.trim().toLowerCase() === '# broadband log results');
    if (marker < 0) fail('MISSING_LOG_BLOCK', 'Broadband-Log-Block nicht gefunden.');
    let headerIndex = -1, firstData = -1;
    if (marker >= 0) {
      for (let i = marker + 1; i < lines.length; i++) {
        const t = lines[i].trim();
        if (t.startsWith('#')) break;
        if (!t || t.startsWith('[')) continue;
        if (/^\d{4}-\d{2}-\d{2}\s/.test(t)) {firstData = i; break;}
        if (/\b(?:Date|YYYY-MM-DD)\b/i.test(t) && /\bTime\b/i.test(t)) headerIndex = i;
      }
    }
    if (headerIndex < 0) fail('MISSING_COLUMNS', 'Kein eindeutiger Date/Time-Spaltenkopf.', marker + 1);
    if (firstData < 0) fail('NO_SAMPLE_ROWS', 'Keine Zeitreihendaten gefunden.', marker + 1);
    const c = headerIndex < 0 ? {labels: [], mapping: {}} : cols(lines[headerIndex]);
    if (c.mapping.date == null || c.mapping.time == null) fail('MISSING_TIME_COLUMNS', 'Date und Time müssen eindeutig zuordenbar sein.', headerIndex + 1);
    if (c.mapping.laeqDt == null && c.mapping.laeqG30 == null && c.mapping.lcpeak == null) fail('MISSING_MEASUREMENT_COLUMNS', 'Keine der unterstützten Pegelspalten erkannt.', headerIndex + 1);
    for (const [field, index] of Object.entries(c.mapping)) {
      if (['date','time','timer'].includes(field)) continue;
      const label = c.labels[index];
      const correctionKey = field === 'lcpeak' ? 'k2' : 'k1';
      const correctionApplied = /\+k[12]\b/i.test(label) ? true : (/\bk[12]\b/i.test(label) ? null : false);
      model.columns[field] = {source: 'device-time-series', column: label, columnIndex: index, headerLine: headerIndex + 1, correctionKey, correctionApplied};
    }
    for (const correctionName of ['k1','k2']) {
      const related = Object.values(model.columns).filter(x => x.correctionKey === correctionName);
      const states = new Set(related.map(x => String(x.correctionApplied)));
      model.corrections[correctionName].appliedInLog =
        states.size === 1 ? (states.has('true') ? 'yes' : states.has('false') ? 'no' : 'unknown') :
        states.size > 1 ? 'mixed' : 'unknown';
      if (related.some(x => x.correctionApplied === true) && model.corrections[correctionName].valueDb == null)
        warn('UNKNOWN_CORRECTION_VALUE', correctionName + ' laut Spaltenkopf bereits eingerechnet, Headerwert fehlt.', headerIndex + 1);
      if (states.has('true') && states.has('false'))
        warn('MIXED_CORRECTION_COLUMNS', correctionName + ' in einigen Spalten eingerechnet, in anderen nicht.', headerIndex + 1);
    }
    if (firstData >= 0) {
      let missingValues = 0, firstMissing = null, invalidRows = 0;
      for (let i = firstData; i < lines.length; i++) {
        const raw = lines[i].trim();
        if (raw.startsWith('#')) break;
        if (!raw || raw.startsWith('[')) continue;
        const cells = raw.split(/\s+/);
        const d = cells[c.mapping.date], t = cells[c.mapping.time];
        const epoch = timestamp(d, t);
        if (epoch == null) {
          invalidRows++;
          if (invalidRows <= 3) warn('INVALID_TIMESTAMP', 'Unlesbarer Datum-/Zeitstempel; Zeile nicht übernommen.', i + 1);
          continue;
        }
        const values = {};
        for (const key of KEYS) {
          const index = c.mapping[key];
          const value = index == null ? null : number(cells[index]);
          values[key] = value;
          if (index != null && value == null) {
            missingValues++;
            if (firstMissing == null) firstMissing = i + 1;
          }
        }
        model.samples.push({
          sourceLine: i + 1, date: d, time: t,
          localTimestamp: d + 'T' + t, localEpochMs: epoch, values
        });
      }
      if (invalidRows > 3) warn('INVALID_TIMESTAMP_COUNT', invalidRows + ' ungültige Zeitstempel insgesamt.');
      if (missingValues) warn('MISSING_VALUES', missingValues + ' fehlende/ungültige Messwertzellen, unverändert als null erhalten.', firstMissing, {count: missingValues});
    }
    if (!model.samples.length) fail('NO_VALID_SAMPLES', 'Keine gültigen Zeitreihenzeilen vorhanden.');
    if (model.samples.length && !model.samples.some(x => KEYS.some(key => x.values[key] != null)))
      fail('NO_MEASUREMENT_VALUES', 'Keine verwertbaren Pegelwerte vorhanden; Zeitstempel allein genügen nicht.');
    if (model.samples.length) {
      if (!model.measurement.start) model.measurement.start = model.samples[0].date + ' ' + model.samples[0].time;
      if (!model.measurement.end) {
        const last = model.samples[model.samples.length - 1];
        model.measurement.end = last.date + ' ' + last.time;
      }
      const expectedMs = model.measurement.intervalSeconds == null ? null : model.measurement.intervalSeconds * 1000;
      for (let i = 1; i < model.samples.length; i++) {
        const a = model.samples[i - 1], b = model.samples[i];
        const delta = b.localEpochMs - a.localEpochMs;
        if (delta === 0) warn('DUPLICATE_TIMESTAMP', 'Doppelter Zeitstempel; nicht zusammengeführt.', b.sourceLine, {sampleIndex: i});
        else if (delta < 0) warn('TIME_REVERSAL', 'Zeit läuft rückwärts; Reihenfolge unverändert.', b.sourceLine, {sampleIndex: i, deltaMs: delta});
        else if (expectedMs != null && delta > expectedMs * 1.5)
          warn('TIME_GAP', 'Zeitlücke von ' + delta/1000 + ' s bei nominell ' + expectedMs/1000 + ' s.', b.sourceLine, {sampleIndex: i, deltaMs: delta});
        else if (expectedMs != null && delta < expectedMs * 0.5)
          warn('IRREGULAR_INTERVAL', 'Zeitabstand kleiner als nominelles Intervall.', b.sourceLine, {sampleIndex: i, deltaMs: delta});
      }
      for (const key of ['laeqDt','lcpeak']) {
        if (!model.samples.some(x => x.values[key] != null)) warn('MISSING_METRIC', key + ': Keine gültigen Messwerte vorhanden.');
      }
    }
    // A summary without its OWN column header cannot be trusted, even if its cell
    // count happens to equal the time-series count. Never silently reuse indexes.
    const summaryMarker = lines.findIndex(x => x.trim().toLowerCase() === '# broadband log results over whole log period');
    if (summaryMarker >= 0) {
      const s = model.summary;
      s.present = true;
      let sc = null;
      for (let i = summaryMarker + 1; i < lines.length; i++) {
        const raw = lines[i].trim();
        if (!raw) continue;
        if (raw.startsWith('#')) break;
        if (/\bDate\b/i.test(raw) && /\bTime\b/i.test(raw)) { sc = cols(raw); continue; }
        if (raw.startsWith('[')) continue;
        if (!/^\d{4}-\d{2}-\d{2}\s/.test(raw)) continue;
        s.sourceLine = i + 1;
        const cells = raw.split(/\s+/);
        if (!sc || sc.mapping.date == null || sc.mapping.time == null) {
          s.reason = 'Eigener Summary-Spaltenkopf fehlt; Positionen sind nicht belegbar.';
          s.candidateFields = {rawCells: cells}; // uninterpreted, not reportable
          warn('SUMMARY_LAYOUT_UNVERIFIED', s.reason, i + 1);
          break;
        }
        if (cells.length < sc.labels.length) {
          s.reason = 'Summary-Daten haben weniger Felder als ihr Spaltenkopf.';
          warn('SUMMARY_TRUNCATED', s.reason, i + 1);
          break;
        }
        s.verified = true;
        for (const key of KEYS) {
          const idx = sc.mapping[key];
          if (idx == null) continue;
          s.fields[key] = {
            value: number(cells[idx]),
            origin: {kind: 'device-summary', line: i + 1, column: sc.labels[idx],
              correctionKey: key === 'lcpeak' ? 'k2' : 'k1',
              correctionApplied: /\+k[12]\b/i.test(sc.labels[idx])}
          };
        }
        break;
      }
      if (!s.sourceLine) warn('SUMMARY_EMPTY', 'Summary-Marker vorhanden, aber keine Summary-Datenzeile.');
    }
    q.status = q.errors.length ? 'rejected' : q.warnings.length ? 'restricted' : 'usable';
    return {ok: !q.errors.length, schemaVersion: MODEL_VERSION, model, warnings: q.warnings, errors: q.errors};
  }

  function toLegacy(model) {
    if (!model || model.schemaVersion !== MODEL_VERSION) throw new Error('Nicht unterstützte Importmodell-Version.');
    const i = model.instrument, m = model.measurement, s = model.summary;
    const header = {
      deviceModel: i.deviceModel || '', deviceSN: i.serial || '', firmware: i.firmware || '',
      micType: i.microphone.type || '', micSN: i.microphone.serial || '',
      micCal: i.microphone.calibrationInfo || '', micSens: i.microphone.sensitivity || '',
      k1: model.corrections.k1.valueDb == null ? '' : String(model.corrections.k1.valueDb),
      k2: model.corrections.k2.valueDb == null ? '' : String(model.corrections.k2.valueDb),
      kset: '', start: m.start || '', end: m.end || '',
      logIntervalText: m.intervalText || '', logIntervalSec: m.intervalSeconds
    };
    const samples = model.samples.map(s => ({
      date: s.date, time: s.time, LAeq_dt: s.values.laeqDt, LAeq_g30: s.values.laeqG30,
      LAeq_g5: s.values.laeqG5, LCpk: s.values.lcpeak, LAFmax: s.values.lafmax
    }));
    const fields = s.verified ? s.fields : {};
    const summary = {
      source: s.verified ? '# Broadband Log Results over whole log period (verified)' : '',
      laeq_total: fields.laeqDt?.value ?? null,
      laeq_g30: fields.laeqG30?.value ?? null,
      laeq_g5: fields.laeqG5?.value ?? null,
      lcpeak_max: fields.lcpeak?.value ?? null,
      lafmax_dt: fields.lafmax?.value ?? null
    };
    return {header, samples, summary};
  }
  return Object.freeze({MODEL_VERSION, parse, toLegacy, number, interval, timestamp, emptyModel});
});
