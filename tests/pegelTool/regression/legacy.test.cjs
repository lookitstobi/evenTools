'use strict';
// Phase 1: Legacy behavior capture. This is NOT a DIN compliance test.
// Node.js >= 18, zero npm dependencies.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../../..');
const APP_PATH = path.join(ROOT, 'app/tools/pegelTool/index.html');
const FIX = path.join(ROOT, 'tests/pegelTool/fixtures');
const EXPECTED = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/pegelTool/expected/legacy-baseline.json'), 'utf8'));
const APP = fs.readFileSync(APP_PATH, 'utf8');
const START_MARKER = '\n<script>\n';
const END_MARKER = "\nel('btnExportHtml').addEventListener";
const start = APP.indexOf(START_MARKER);
const end = APP.indexOf(END_MARKER, start);
assert.ok(start >= 0 && end > start, 'Legacy inline script boundaries changed; update Phase-1 harness explicitly');
const inlineCode = APP.slice(start + START_MARKER.length, end);

function createHarness() {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, {
        id, value: '', textContent: '', innerHTML: '', style: {}, rows: [],
        classList: {
          add(...names) { names.forEach(n => classes.add(n)); },
          remove(...names) { names.forEach(n => classes.delete(n)); },
          contains(name) { return classes.has(name); }
        },
        addEventListener() {},
        appendChild(child) { this.rows.push(child); },
        querySelector() { return null; }
      });
    }
    return elements.get(id);
  }
  const document = {
    getElementById: element,
    querySelector: element,
    querySelectorAll(sel) {
      if (sel === '#pegelTabelle .status-bad') {
        return element('#pegelTabelle tbody').rows.filter(row => row.innerHTML.includes('status-bad'));
      }
      return [];
    },
    createElement(tag) { return element('new-' + tag + '-' + elements.size); },
    addEventListener() {}
  };
  const storage = new Map();
  const localStorage = {
    getItem: k => storage.get(k) || null,
    setItem: (k, v) => { storage.set(k, String(v)); }
  };
  const context = vm.createContext({
    document, window: {addEventListener() {}}, localStorage, console,
    setTimeout() { return 0; }, clearTimeout() {}, requestAnimationFrame() {}
  });
  vm.runInContext(inlineCode, context, {filename: 'pegelTool/index.html:inline', timeout: 5000});
  return {
    context, elements, document,
    run(source) { return vm.runInContext(source, context, {timeout: 5000}); },
    parse(text) {
      context.__auditInput = text;
      return JSON.parse(vm.runInContext(
        'parseHeaderAndMeta(__auditInput);' +
        'const __ts = parseBroadbandTimeSeries(__auditInput);' +
        'const __sum = parseBroadbandSummary(__auditInput);' +
        'JSON.stringify({ts:__ts, sm:__sum, samples, summary, header, parsedColumns});',
        context, {timeout: 10000}
      ));
    }
  };
}
function read(name) { return fs.readFileSync(path.join(FIX, name + '.txt'), 'utf8'); }
function parsed(name) { return createHarness().parse(read(name)); }
function approx(actual, expected, tolerance = 1e-8) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual-expected)<tolerance,
    'Expected ' + expected + ' +/- ' + tolerance + ', got ' + actual);
}

test('fixture: valid log and legacy summary values are reproducible', () => {
  const x=parsed('valid-with-summary'), y=EXPECTED.cases['valid-with-summary'];
  assert.equal(x.ts.ok, true);
  assert.equal(x.samples.length, y.samples);
  assert.equal(x.samples[0].LAeq_dt, y.laeq_dt_first);
  approx(x.samples[1].LAeq_g5, y.laeq_g5_second);
  assert.equal(x.summary.laeq_g30, y.summary_laeq_g30);
  assert.equal(x.summary.lcpeak_max, y.summary_lcpeak);
  assert.equal(x.header.k1, y.k1); assert.equal(x.header.k2, y.k2);
});

test('legacy behavior: imported LAeq_g5 is overwritten by derived 5-second series', () => {
  const x=parsed('valid-with-summary');
  assert.notEqual(x.samples[1].LAeq_g5, 100);
  approx(x.samples[1].LAeq_g5, 97.40362689494243);
});

test('legacy behavior: missing LAeq_g30 is kept null even though import succeeds', () => {
  const x=parsed('missing-g30');
  assert.equal(x.ts.ok, true);
  assert.equal(x.samples[0].LAeq_g30, null);
});

test('legacy behavior: duplicate timestamps and a time gap are retained', () => {
  const x=parsed('duplicates-and-gap');
  assert.equal(x.samples.length, 3);
  assert.equal(x.samples[0].time, x.samples[1].time);
  assert.equal(x.samples[2].time, '20:01:00');
});

test('legacy behavior: midnight date rollover retained without validation', () => {
  const x=parsed('over-midnight');
  assert.equal(x.samples[0].date + ' ' + x.samples[0].time, '2026-11-16 23:59:59');
  assert.equal(x.samples[1].date + ' ' + x.samples[1].time, '2026-11-17 00:00:00');
});

test('legacy behavior: mismatching summary column layout yields wrong peak', () => {
  const x=parsed('summary-layout-mismatch');
  assert.equal(x.ts.ok, true);
  assert.equal(x.sm.ok, true);
  assert.equal(x.summary.lcpeak_max, 101);
  // The synthetic summary stores peak 132 at index 3, while parser reads index 5.
  assert.notEqual(x.summary.lcpeak_max, 132);
});

test('legacy behavior: invalid interval silently defaults to one second', () => {
  const x=parsed('invalid-interval');
  assert.equal(x.header.logIntervalSec, 1);
});

test('invalid log is rejected, all-missing log has no samples', () => {
  assert.equal(parsed('invalid-not-xl3').ts.ok, false);
  const missing=parsed('only-missing-values');
  assert.equal(missing.ts.ok, true);
  assert.equal(missing.samples.length, 0);
});

test('Phase 3 safety: legacy UI cannot turn green without verified assessment data', () => {
  const h=createHarness();
  h.run('logLoaded=true; updateComplianceStatus();');
  assert.equal(h.document.getElementById('complianceDot').classList.contains('status-warn'), true);
});

test('legacy UI marks LAeq_g5 >99 as a bad result even when LAeq_g30 <=99', () => {
  const h=createHarness();
  h.run("addRow('LAeq_g30', 98, 99); addRow('LAeq_g5', 100, 99); addRow('LCpeak (max)', 120, 135);");
  const html=h.document.querySelector('#pegelTabelle tbody').rows.map(x=>x.innerHTML);
  assert.equal(html.filter(s=>s.includes('status-bad')).length, 1);
  assert.ok(html.some(s=>s.includes('LAeq_g5')&&s.includes('NICHT OK')));
});

test('legacy JSON and embedded HTML state extraction remain parseable', () => {
  const h=createHarness();
  const raw={schemaVersion:1, sourceApp:'pegelTool',form:{eventName:'Synthetic test'}};
  h.context.__stateJson=JSON.stringify(raw);
  const direct=JSON.parse(h.run("JSON.stringify(parseStateFromText('state.nti.json', __stateJson))"));
  assert.equal(direct.form.eventName,'Synthetic test');
  h.context.__htmlState='<script>window.__SAVED_STATE__ = '+JSON.stringify(raw)+';</script>';
  const embedded=JSON.parse(h.run("JSON.stringify(parseStateFromText('state.html', __htmlState))"));
  assert.equal(embedded.form.eventName,'Synthetic test');
});

test('legacy state schema and form roundtrip (logic-only, no browser storage)', () => {
  const h=createHarness();
  h.document.getElementById('eventName').value='Test Event';
  const result=JSON.parse(h.run('JSON.stringify(normalizeState(buildStateObject()))'));
  assert.equal(result.schemaVersion,2); // v1 import is migrated to the current project schema
  assert.equal(result.form.eventName,'Test Event');
  assert.ok(Array.isArray(result.samples));
});

test('archived repository log: real-device parsing baseline (read-only)', () => {
  const p=path.join(ROOT,'archive/housekeeping_2026-04-28/2025-03-14_SLM_001_Log.txt');
  const x=createHarness().parse(fs.readFileSync(p,'utf8'));
  const y=EXPECTED.cases['archived-real-log'];
  assert.equal(x.ts.ok,true); assert.equal(x.sm.ok,true);
  assert.equal(x.samples.length,y.samples);
  assert.equal(x.summary.laeq_total,y.laeq_total);
  assert.equal(x.summary.lcpeak_max,y.lcpeak_max);
  assert.equal(x.summary.laeq_g30,y.laeq_g30);
  assert.equal(x.header.logIntervalSec,y.interval_sec);
});

test('PDF paths and vendor assets remain present (static contract only)', () => {
  for (const file of ['vendor/chart.umd.min.js','vendor/jspdf.umd.min.js','vendor/pdf-lib.min.js']) {
    assert.ok(fs.existsSync(path.join(ROOT,'app/tools/pegelTool',file)),file);
  }
  assert.match(APP, /async function generateTemplatePDF\(/);
  assert.match(APP, /async function generateLegacyPDF\(/);
  assert.match(APP, /pdf_template_api\.php\?action=get_active_template/);
  assert.match(APP, /function saveStateFile\(/);
  assert.match(APP, /function exportHTML\(/);
});
