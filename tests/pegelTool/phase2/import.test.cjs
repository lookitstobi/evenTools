'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const importXL3 = require('../../../app/tools/pegelTool/import/nti-xl3.js');
const FIX = path.resolve(__dirname, '../fixtures');
const log = n => fs.readFileSync(path.join(FIX, n + '.txt'), 'utf8');
const run = n => importXL3.parse(log(n), {fileName:n+'.txt'});
const codes = x => x.warnings.map(y=>y.code);

test('module has no DOM, imports reordered columns, decimals, and retains device-g5', () => {
  const r = run('valid-with-summary');
  assert.equal(r.ok, true);
  assert.equal(r.model.samples.length, 4);
  assert.equal(r.model.samples[1].values.laeqG5, 100);
  assert.equal(r.model.samples[1].values.laeqDt, 100);
  assert.equal(r.model.samples[1].values.lcpeak, 124);
  assert.equal(r.model.columns.laeqDt.correctionApplied,true);
  assert.equal(r.model.columns.lcpeak.correctionApplied,true);
  assert.equal(r.model.corrections.k1.valueDb,-3);
  assert.equal(r.model.corrections.k1.appliedInLog,'yes');
  assert.equal(importXL3.toLegacy(r.model).samples[1].LAeq_g5,100);
  assert.ok(codes(r).includes('SUMMARY_LAYOUT_UNVERIFIED'));
  assert.equal(importXL3.toLegacy(r.model).summary.lcpeak_max,null);
});
test('layout-mismatched summary is not misidentified or reported as a trustworthy peak', () => {
  const r=run('summary-layout-mismatch');
  assert.equal(r.ok,true);
  assert.equal(r.model.summary.verified,false);
  assert.ok(codes(r).includes('SUMMARY_LAYOUT_UNVERIFIED'));
  assert.equal(importXL3.toLegacy(r.model).summary.lcpeak_max,null);
  assert.equal(r.model.samples[0].values.lcpeak,125);
});
test('duplicate timestamps, gaps and source line numbers are preserved', () => {
  const r=run('duplicates-and-gap');
  assert.equal(r.ok,true);
  assert.equal(r.model.samples.length,3);
  assert.ok(codes(r).includes('DUPLICATE_TIMESTAMP'));
  assert.ok(codes(r).includes('TIME_GAP'));
  assert.ok(r.model.samples[0].sourceLine>0);
});
test('crossing midnight does not trigger false reverse-time', () => {
  const r=run('over-midnight');
  assert.equal(r.ok,true);
  assert.equal(r.model.samples[1].localEpochMs-r.model.samples[0].localEpochMs,1000);
  assert.ok(!codes(r).includes('TIME_REVERSAL'));
});
test('invalid interval blocks usable import instead of defaulting to 1s', () => {
  const r=run('invalid-interval');
  assert.equal(r.ok,false);
  assert.equal(r.model.measurement.intervalSeconds,null);
  assert.ok(r.errors.some(x=>x.code==='INVALID_INTERVAL'));
});
test('no supported block and all missing values are rejected', () => {
  assert.equal(run('invalid-not-xl3').ok,false);
  assert.equal(run('only-missing-values').ok,false);
});
test('valid explicit summary has independent columns and is traceable', () => {
  const text=log('valid-with-summary').replace(
    '# Broadband Log Results over whole log period\n',
    '# Broadband Log Results over whole log period\nDate Time Timer LAeq_dt+k1 LCPKmax_dt+k2 LAeq_g30+k1\n'
  ).replace(
    '2026-11-16 20:00:01 00:00:04,0 136,0 97,0 94,0 100,0 100,0',
    '2026-11-16 20:00:01 00:00:04,0 94,0 136,0 100,0'
  );
  const r=importXL3.parse(text);
  assert.equal(r.ok,true);
  assert.equal(r.model.summary.verified,true);
  assert.equal(r.model.summary.fields.lcpeak.value,136);
  assert.equal(r.model.summary.fields.lcpeak.origin.kind,'device-summary');
  assert.equal(importXL3.toLegacy(r.model).summary.lcpeak_max,136);
});
test('decimal, interval and timestamp validation are deterministic', () => {
  assert.equal(importXL3.number('98,7'),98.7);
  assert.equal(importXL3.number('98.7'),98.7);
  assert.equal(importXL3.number('---'),null);
  assert.equal(importXL3.number('garbage'),null);
  assert.equal(importXL3.interval('00:00:00,5'),0.5);
  assert.equal(importXL3.interval('99:99:99'),null);
  assert.equal(importXL3.timestamp('2026-02-30','12:00:00'),null);
});
test('time reversal and missing correction values produce explicit quality notices', () => {
  const text=log('valid-with-summary')
    .replace('Log-Interval: 00:00:01,0','Log-Interval: 00:00:02,0')
    .replace('k1: -3,0 dB','k1: not specified')
    .replace('2026-11-16 20:00:00','2026-11-16 19:59:57');
  const r=importXL3.parse(text);
  assert.equal(r.ok,true);
  assert.ok(codes(r).includes('TIME_REVERSAL'));
  assert.ok(codes(r).includes('UNKNOWN_CORRECTION_VALUE'));
  assert.equal(r.model.measurement.intervalSeconds,2);
  assert.equal(r.model.corrections.k1.valueDb,null);
});
test('archived XL3 fixture imports without copying its measurement data', () => {
  const file=path.resolve(__dirname,'../../../archive/housekeeping_2026-04-28/2025-03-14_SLM_001_Log.txt');
  const r=importXL3.parse(fs.readFileSync(file,'utf8'));
  assert.equal(r.ok,true,JSON.stringify(r.errors));
  assert.equal(r.model.samples.length,8441);
  assert.equal(r.model.instrument.deviceModel,'XL3');
  assert.equal(r.model.measurement.intervalSeconds,1);
  assert.equal(r.model.corrections.k1.appliedInLog,'yes');
  assert.equal(r.model.summary.verified,false);
  assert.ok(codes(r).includes('SUMMARY_LAYOUT_UNVERIFIED'));
});
