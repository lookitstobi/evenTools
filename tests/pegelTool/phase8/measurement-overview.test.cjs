'use strict';
// Regression tests for the practical measurement overview decision (2026-11-18).
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../../..');
const Engine=require(path.join(ROOT,'app/tools/pegelTool/evaluation/engine.js'));
const Import=require(path.join(ROOT,'app/tools/pegelTool/import/nti-xl3.js'));
const Protocol=require(path.join(ROOT,'app/tools/pegelTool/protocol/protocol.js'));
const Report=require(path.join(ROOT,'app/tools/pegelTool/report/report.js'));
const T=x=>Import.timestamp(x.slice(0,10),x.slice(11));
const entry=(a,b,la,pk)=>({startMs:T(a),endMs:T(b),laeqDb:la,lcpeakDb:pk});
const almost=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<0.001, String(a)+' != '+String(b));

test('Two complete periods produce independent technical threshold comparisons',()=>{
  const r=Engine.buildBlocks([
    entry('2026-11-18T20:00:00','2026-11-18T20:30:00',87.24,119.10),
    entry('2026-11-18T20:30:00','2026-11-18T21:00:00',83.84,117.70)
  ]);
  almost(r.overall.laeqMaxDb,87.24);
  almost(r.overall.lcpeakMaxDb,119.1);
  assert.equal(r.overall.completeBlocks,2);
  assert.equal(r.overall.measurementStatus,'within-limits');
  assert.equal(r.overall.laeqExceededCount,0);
  assert.equal(r.overall.lcpeakExceededCount,0);
});

test('Partial first/last periods preserve time-specific LAeq and observed LCpeak',()=>{
  const r=Engine.buildBlocks([
    entry('2026-11-18T20:02:12','2026-11-18T20:30:00',88,136),
    entry('2026-11-18T20:30:00','2026-11-18T21:00:00',85,121),
    entry('2026-11-18T21:00:00','2026-11-18T21:20:50',82,130)
  ]);
  assert.deepEqual(r.blocks.map(b=>b.coveredSeconds),[1668,1800,1250]);
  assert.deepEqual(r.blocks.map(b=>b.dataCoverageState),['partial-edge','full','partial-edge']);
  assert.deepEqual(r.blocks.map(b=>b.laeq30Db),[null,85,null]);
  assert.deepEqual(r.blocks.map(b=>b.laeqPartialDb),[88,null,82]);
  assert.deepEqual(r.blocks.map(b=>b.lcpeakObservedDb),[136,121,130]);
  assert.equal(r.overall.lcpeakMaxDb,136);
  assert.equal(r.overall.lcpeakExceededCount,1);
  assert.equal(r.overall.lcpeakExceededIntervals[0].start,'2026-11-18T20:02:12');
  assert.equal(r.overall.measurementStatus,'exceeded');
  assert.equal(r.overall.laeqExceededCount,0);
});

test('LAeq exceedance counts assessed half-hours, not instantaneous seconds',()=>{
  const r=Engine.buildBlocks([
    entry('2026-11-18T20:00:00','2026-11-18T20:30:00',99.01,120),
    entry('2026-11-18T20:30:00','2026-11-18T21:00:00',99,135)
  ]);
  assert.equal(r.overall.laeqExceededCount,1);
  assert.deepEqual(r.overall.laeqExceededBlocks.map(b=>b.start),['2026-11-18T20:00:00']);
  assert.equal(r.overall.lcpeakExceededCount,0);
  assert.equal(r.blocks[1].comparisonLAeq,'at-or-below');
  assert.equal(r.blocks[1].comparisonLCpeakObserved,'at-or-below');
});

test('Internal gap does not become silence or prevent valid LCpeak evidence',()=>{
  const r=Engine.buildBlocks([
    entry('2026-11-18T20:00:00','2026-11-18T20:10:00',90,136),
    entry('2026-11-18T20:10:20','2026-11-18T20:30:00',90,120)
  ]);
  assert.equal(r.blocks[0].unknownSeconds,20);
  assert.equal(r.blocks[0].laeq30Db,null);
  assert.equal(r.blocks[0].dataCoverageState,'gap');
  assert.equal(r.overall.hasMeasurementGaps,true);
  assert.equal(r.overall.measurementStatus,'exceeded');
  assert.equal(r.overall.lcpeakExceededCount,1);
});

test('Ambiguous overlap cannot become a conclusive positive or duplicated peak event',()=>{
  const r=Engine.buildBlocks([
    entry('2026-11-18T20:00:00','2026-11-18T20:30:00',90,120),
    entry('2026-11-18T20:00:00','2026-11-18T20:00:01',90,140)
  ]);
  assert.equal(r.blocks[0].dataCoverageState,'conflict');
  assert.equal(r.overall.lcpeakExceededCount,0);
  assert.equal(r.overall.measurementStatus,'not-assessable');
});

test('Energetic LAeq and strict greater-than threshold',()=>{
  const r=Engine.buildBlocks([
    entry('2026-11-18T20:00:00','2026-11-18T20:15:00',80,135),
    entry('2026-11-18T20:15:00','2026-11-18T20:30:00',90,135)
  ]);
  almost(r.blocks[0].laeq30Db,87.40362689494243);
  assert.equal(r.overall.lcpeakExceededCount,0);
});

test('kset date automatically transfers from XL3 header to legacy/UI and report model',()=>{
  const source=fs.readFileSync(path.join(ROOT,'tests/pegelTool/fixtures/valid-with-summary.txt'),'utf8');
  const text=source.replace('k2: +2,0 dB','k2: +2,0 dB\nkset date: 2026-11-15 14:41');
  const parsed=Import.parse(text,{fileName:'synthetic-kset.txt'});
  assert.equal(parsed.ok,true);
  assert.equal(parsed.model.measurement.ksetDate,'2026-11-15 14:41');
  assert.equal(Import.toLegacy(parsed.model).header.kset,'2026-11-15 14:41');
  const roundtrip=JSON.parse(JSON.stringify(parsed.model));
  assert.equal(roundtrip.measurement.ksetDate,'2026-11-15 14:41');
  const e=Engine.evaluateModel(roundtrip,{timestampAnchor:'end',timestampAnchorEvidence:'operator-approved'});
  const record=Protocol.buildRecord({form:{},importModel:roundtrip,evaluation:e});
  const report=Report.build(record,{sourceFileName:'synthetic-kset.txt'});
  assert.equal(report.sections.flatMap(x=>x.rows).find(x=>x.label==='kset date (XL3)').value,'2026-11-15 14:41');
  assert.equal(report.status,'Grenzwert überschritten');
  assert.match(Report.renderHtml(report),/2026-11-15 14:41/);
  const {jsPDF}=require(path.join(ROOT,'app/tools/pegelTool/vendor/jspdf.umd.min.js'));
  assert.equal(Buffer.from(require(path.join(ROOT,'app/tools/pegelTool/report/pdf.js')).create(report,jsPDF).output('arraybuffer')).subarray(0,5).toString('ascii'),'%PDF-');
});

test('Device evidence warnings do not suppress a technically observed threshold breach',()=>{
  const source=fs.readFileSync(path.join(ROOT,'tests/pegelTool/fixtures/valid-with-summary.txt'),'utf8');
  const m=Import.parse(source).model;
  const e=Engine.evaluateModel(m,{timestampAnchor:'end',timestampAnchorEvidence:'assumed'});
  assert.equal(e.overall.comparisonLCpeak,'above');
  assert.equal(e.overall.measurementStatus,'exceeded');
  assert.equal(e.overall.lcpeakExceededCount,1);
  const report=Report.build(Protocol.buildRecord({form:{},importModel:m,evaluation:e}));
  assert.equal(report.status,'Grenzwert überschritten');
  assert.equal(report.documentationComplete,false);
});

test('New interface is wired to actual technical fields rather than documentation gate',()=>{
  const html=fs.readFileSync(path.join(ROOT,'app/tools/pegelTool/index.html'),'utf8');
  assert.match(html,/block\.laeq30Db \?\? block\.laeqPartialDb/);
  assert.match(html,/block\.lcpeakObservedDb/);
  assert.match(html,/overall\.laeqExceededCount/);
  assert.match(html,/overall\.lcpeakExceededCount/);
  assert.match(html,/setVal\('kset', header\.kset/);
  assert.doesNotMatch(html,/const complete=overall\.measurementStatus !== 'not-assessable'/);
});
