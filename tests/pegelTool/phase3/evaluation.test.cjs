'use strict';
// Phase 3: independently specified technical reference cases.
// The authorised DIN 15905-5:2022-07 text is still outstanding;
// numerical threshold comparisons are NOT normative pass/fail decisions.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Engine = require('../../../app/tools/pegelTool/evaluation/engine.js');
const Importer = require('../../../app/tools/pegelTool/import/nti-xl3.js');
const T = s => Importer.timestamp(s.slice(0, 10), s.slice(11));
const slot = (from, to, laeqDb, lcpeakDb = 120, sourceLine = 1) =>
  ({startMs:T(from), endMs:T(to), laeqDb, lcpeakDb, sourceLine});
const nearly = (actual, expected, delta = 0.0002) =>
  assert.ok(actual != null && Math.abs(actual - expected) < delta,
    'expected ' + expected + ', received ' + actual);
const calculate = xs => Engine.buildBlocks(xs);
const full = (db = 90, peak = 120) =>
  [slot('2026-11-16T20:00:00','2026-11-16T20:30:00',db,peak)];
function model(stamps, options = {}) {
  const m = Importer.emptyModel('test.txt');
  m.quality.status = 'usable';
  m.measurement.intervalSeconds = options.intervalSeconds || 1;
  m.measurement.timeZone = options.timeZone || 'Europe/Berlin';
  m.columns = {
    laeqDt: {correctionApplied: options.k1Applied ?? true, correctionKey:'k1', column: 'LAeq_dt+k1'},
    lcpeak: {correctionApplied: options.k2Applied ?? true, correctionKey:'k2', column: 'LCPKmax_dt+k2'}
  };
  m.corrections.k1.valueDb = options.k1 ?? 5;
  m.corrections.k1.valueSource = 'device-header';
  m.corrections.k2.valueDb = options.k2 ?? -3;
  m.corrections.k2.valueSource = 'device-header';
  m.samples = stamps.map((item,i) => ({
    localEpochMs:T(item.t), sourceLine:i+10,
    values: {laeqDt:item.la, lcpeak:item.pk, laeqG30:item.g30 ?? null, laeqG5:item.g5 ?? null}
  }));
  return m;
}
test('R01: energetic equal-weight averaging, not arithmetic averaging', () => {
  const r = calculate([
    slot('2026-11-16T20:00:00','2026-11-16T20:15:00',90),
    slot('2026-11-16T20:15:00','2026-11-16T20:30:00',100)
  ]);
  nearly(r.blocks[0].laeq30Db,97.40362689494243);
  assert.equal(r.blocks[0].dataQuality,'complete');
  assert.equal(r.blocks[0].normativeStatus,'not-assessable');
});
test('R02: 600s at 90 dB plus 1200s at 96 dB', () => {
  const r = calculate([
    slot('2026-11-16T20:00:00','2026-11-16T20:10:00',90),
    slot('2026-11-16T20:10:00','2026-11-16T20:30:00',96)
  ]);
  nearly(r.blocks[0].laeq30Db,94.7529);
});
test('R03: missing second half does not count as silent/zero energy', () => {
  const r=calculate([slot('2026-11-16T20:00:00','2026-11-16T20:15:00',100)]);
  assert.equal(r.blocks[0].coveredSeconds,900);
  assert.equal(r.blocks[0].unknownSeconds,900);
  assert.equal(r.blocks[0].laeqObservedDb,100);
  assert.equal(r.blocks[0].laeq30Db,null);
  assert.equal(r.blocks[0].comparisonLAeq,'unknown');
});
test('T01: two independent half-hour windows and no gliding mixing', () => {
  const r=calculate([
    slot('2026-11-16T20:00:00','2026-11-16T20:30:00',97),
    slot('2026-11-16T20:30:00','2026-11-16T21:00:00',101)
  ]);
  assert.equal(r.blocks.length,2);
  assert.deepEqual(r.blocks.map(b=>b.coveredSeconds),[1800,1800]);
  assert.deepEqual(r.blocks.map(b=>b.comparisonLAeq),['at-or-below','above']);
});
test('T03, T06: partial first/last windows stay unassessable', () => {
  const intervals=[];
  for(let ms=T('2026-11-16T20:07:00');ms<T('2026-11-16T21:12:00');ms+=60000)
    intervals.push({startMs:ms,endMs:ms+60000,laeqDb:90,lcpeakDb:120});
  const r=calculate(intervals);
  assert.deepEqual(r.blocks.map(x=>x.coveredSeconds),[1380,1800,720]);
  assert.deepEqual(r.blocks.map(x=>x.dataQuality),['incomplete','complete','incomplete']);
  assert.deepEqual(r.blocks.map(x=>x.laeq30Db),[null,90,null]);
});
test('T07: 120-second gap identified rather than filled', () => {
  const r=calculate([
    slot('2026-11-16T20:00:00','2026-11-16T20:10:00',90),
    slot('2026-11-16T20:12:00','2026-11-16T20:30:00',96)
  ]);
  assert.equal(r.blocks[0].unknownSeconds,120);
  assert.equal(r.blocks[0].laeq30Db,null);
  assert.equal(r.blocks[0].dataQuality,'incomplete');
});
test('T09: fully recorded quieter interval is valid evidence, not a missing interval', () => {
  const r=calculate([
    slot('2026-11-16T20:00:00','2026-11-16T20:10:00',90),
    slot('2026-11-16T20:10:00','2026-11-16T20:20:00',60),
    slot('2026-11-16T20:20:00','2026-11-16T20:30:00',90)
  ]);
  assert.equal(r.blocks[0].coveredSeconds,1800);
  assert.notEqual(r.blocks[0].laeq30Db,null);
});
test('T10: invalid level is not converted to 0 dB', () => {
  const r=calculate([
    slot('2026-11-16T20:00:00','2026-11-16T20:10:00',90),
    slot('2026-11-16T20:10:00','2026-11-16T20:12:00',null),
    slot('2026-11-16T20:12:00','2026-11-16T20:30:00',90)
  ]);
  assert.equal(r.blocks[0].coveredSeconds,1800);
  assert.equal(r.blocks[0].validLaeqSeconds,1680);
  assert.equal(r.blocks[0].invalidLaeqSeconds,120);
  assert.equal(r.blocks[0].laeq30Db,null);
});
test('T11: midnight correctly produces three date-labelled windows', () => {
  const r=calculate([slot('2026-11-16T23:45:00','2026-11-17T00:45:00',90)]);
  assert.equal(r.blocks.length,3);
  assert.deepEqual(r.blocks.map(b=>b.coveredSeconds),[900,1800,900]);
  assert.equal(r.blocks[1].start,'2026-11-17T00:00:00');
});
test('T12: 4-second cross-boundary interval is split for time, never for energy', () => {
  const r=calculate([slot('2026-11-16T20:29:58','2026-11-16T20:30:02',100,140)]);
  assert.equal(r.blocks.length,2);
  assert.deepEqual(r.blocks.map(b=>b.coveredSeconds),[2,2]);
  assert.deepEqual(r.blocks.map(b=>b.crossingBoundarySeconds),[2,2]);
  assert.equal(r.blocks[0].laeqObservedDb,null);
  assert.equal(r.blocks[1].lcpeakObservedDb,null);
  assert.equal(r.blocks[0].dataQuality,'conflict');
});
test('T15/T16: overlap counted once in coverage, conflicts cannot pass', () => {
  const r=calculate([
    ...full(98,130),
    slot('2026-11-16T20:00:00','2026-11-16T20:00:01',105,145)
  ]);
  assert.equal(r.blocks[0].coveredSeconds,1800);
  assert.equal(r.blocks[0].overlapSeconds,1);
  assert.equal(r.blocks[0].laeq30Db,null);
  assert.equal(r.blocks[0].lcpeakMaxDb,null);
  assert.equal(r.blocks[0].dataQuality,'conflict');
});
test('LCpeak uses highest actual interval peak, never averages peaks', () => {
  const r=calculate([
    slot('2026-11-16T20:00:00','2026-11-16T20:10:00',90,120,15),
    slot('2026-11-16T20:10:00','2026-11-16T20:30:00',90,140,16)
  ]);
  assert.equal(r.blocks[0].lcpeakMaxDb,140);
  assert.equal(r.blocks[0].lcpeakSourceLine,16);
  assert.equal(r.blocks[0].comparisonLCpeak,'above');
});
test('limits compare strictly greater (equal is not above), but DIN status stays blocked', () => {
  for (const v of [98.99,99,99.01]) {
    const r=calculate(full(v,135));
    assert.equal(r.blocks[0].comparisonLAeq, v>99?'above':'at-or-below');
    assert.equal(r.blocks[0].comparisonLCpeak,'at-or-below');
    assert.equal(r.normativeStatus,'not-assessable');
  }
});
test('model: label +k already includes correction, no double addition', () => {
  const r=Engine.evaluateModel(model([{t:'2026-11-16T20:30:00',la:98,pk:134}]),
    {timestampAnchor:'end',timestampAnchorEvidence:'assumed'});
  assert.equal(r.blocks[0].laeqObservedDb,98);
  assert.equal(r.blocks[0].lcpeakObservedDb,134);
  assert.equal(r.blocks[0].coveredSeconds,1);
  assert.equal(r.blocks[0].end,'2026-11-16T20:30:00');
  assert.equal(r.overall.normativeStatus,'not-assessable');
});
test('model: uncorrected level adds k1/k2 once and preserves source data', () => {
  const m=model([{t:'2026-11-16T20:00:00',la:98,pk:134}],{k1Applied:false,k2Applied:false,k1:2,k2:-1});
  const r=Engine.evaluateModel(m,{timestampAnchor:'start'});
  assert.equal(r.blocks[0].laeqObservedDb,100);
  assert.equal(r.blocks[0].lcpeakObservedDb,133);
  assert.equal(m.samples[0].values.laeqDt,98);
  assert.equal(m.samples[0].values.lcpeak,134);
});
test('model: missing or unclear correction cannot produce a computed corrected value', () => {
  const m=model([{t:'2026-11-16T20:00:00',la:98,pk:134}],{k1Applied:false,k2Applied:false});
  m.corrections.k1.valueDb=null;
  m.columns.lcpeak.correctionApplied=null;
  const r=Engine.evaluateModel(m,{timestampAnchor:'start'});
  assert.equal(r.blocks[0].laeqObservedDb,null);
  assert.equal(r.blocks[0].lcpeakObservedDb,null);
  assert.ok(r.quality.warnings.some(w=>w.code==='CORRECTION_VALUE_MISSING'));
  assert.ok(r.quality.warnings.some(w=>w.code==='CORRECTION_ORIGIN_UNKNOWN'));
});
test('model: LAeq_g30 and LAeq_g5 are not substitutes for LAeq interval values', () => {
  const m=model([{t:'2026-11-16T20:00:00',la:null,pk:120,g30:130,g5:140}]);
  const r=Engine.evaluateModel(m,{timestampAnchor:'start'});
  assert.equal(r.blocks[0].laeqObservedDb,null);
  assert.equal(r.blocks[0].laeq30Db,null);
});
test('model: g5 above 99 cannot independently violate the technical block threshold', () => {
  const m=model([{t:'2026-11-16T20:00:00',la:98,pk:120,g5:110}]);
  const r=Engine.evaluateModel(m,{timestampAnchor:'start'});
  assert.equal(r.blocks[0].comparisonLAeq,'unknown'); // incomplete block
  assert.equal(r.blocks[0].laeqObservedDb,98);
});
test('model: unknown anchor is not guessed, time still unassessable', () => {
  const r=Engine.evaluateModel(model([{t:'2026-11-16T20:00:00',la:99,pk:135}]));
  assert.deepEqual(r.blocks,[]);
  assert.ok(r.quality.warnings.some(w=>w.code==='TIMESTAMP_ANCHOR_MISSING'));
});
test('model: DST fallback 02:30 without UTC offset is explicitly flagged', () => {
  const r=Engine.evaluateModel(model([{t:'2026-10-25T02:30:00',la:90,pk:120}]),{timestampAnchor:'start'});
  assert.ok(r.quality.warnings.some(w=>w.code==='DST_AMBIGUOUS'));
  assert.equal(r.normativeStatus,'not-assessable');
});
test('model: real XL3 archive can be evaluated only provisionally', () => {
  const file=path.resolve(__dirname,'../../../archive/housekeeping_2026-04-28/2025-03-14_SLM_001_Log.txt');
  const parsed=Importer.parse(fs.readFileSync(file,'utf8'));
  assert.equal(parsed.ok,true);
  const r=Engine.evaluateModel(parsed.model,{timestampAnchor:'end',timestampAnchorEvidence:'assumed'});
  assert.ok(r.blocks.length>0);
  assert.equal(r.overall.normativeStatus,'not-assessable');
  assert.ok(r.quality.warnings.some(w=>w.code==='TIME_BASIS_UNVERIFIED'));
  assert.ok(r.blocks.every(b=>b.normativeStatus==='not-assessable'));
});
test('120-minute variant is not exposed without the original-norm decision', () => {
  assert.equal(typeof Engine.evaluate120Minutes,'undefined');
});
