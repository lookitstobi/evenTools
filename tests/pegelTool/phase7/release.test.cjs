'use strict';
// Phase 7: release regressions and cross-module reference cases.
// Numerical comparisons are TECHNICAL ONLY; the authorised DIN 15905-5:2022-07
// has not been reconciled. No test here establishes a normative pass/fail.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../../..');
const Import=require('../../../app/tools/pegelTool/import/nti-xl3.js');
const Engine=require('../../../app/tools/pegelTool/evaluation/engine.js');
const Protocol=require('../../../app/tools/pegelTool/protocol/protocol.js');
const Report=require('../../../app/tools/pegelTool/report/report.js');
const PDF=require('../../../app/tools/pegelTool/report/pdf.js');
const {jsPDF}=require('../../../app/tools/pegelTool/vendor/jspdf.umd.min.js');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/technical-reference.json'),'utf8'));
const epoch=s=>Import.timestamp(s.slice(0,10),s.slice(11,19));
const near=(actual,expected,what)=>assert.ok(typeof actual==='number'
  && Math.abs(actual-expected)<0.000001,what+': '+actual+' != '+expected);
const sources=n=>fs.readFileSync(path.join(ROOT,'tests/pegelTool/fixtures',n+'.txt'),'utf8');
function makeModel({laeq=97,peak=132,appliedLAeq=true,appliedPeak=true,k1=0,k2=0,g5=111}={}){
  const m=Import.emptyModel('synthetic.txt');
  m.quality.status='usable';
  m.measurement.intervalSeconds=1800;
  m.measurement.timeZone='Europe/Berlin';
  m.columns={laeqDt:{correctionApplied:appliedLAeq,column:'LAeq_dt'},
    lcpeak:{correctionApplied:appliedPeak,column:'LCpeak'}};
  m.corrections.k1={valueDb:k1,valueSource:k1===null?'missing':'manual',determination:'Test'};
  m.corrections.k2={valueDb:k2,valueSource:k2===null?'missing':'manual',determination:'Test'};
  m.places={assessmentLAeq:'Hörerraum Mitte',assessmentLCpeak:'Hörerraum links',measurement:'FOH'};
  m.calibration.status='verified';
  m.samples=[{sourceLine:12,localEpochMs:epoch('2026-11-16T20:00:00'),
    values:{laeqDt:laeq,lcpeak:peak,laeqG5:g5,laeqG30:100}}];
  return m;
}
test('all reference fixtures have stable, unique case IDs and explicit expected values',()=>{
  assert.equal(fixture.schemaVersion,1);
  assert.ok(fixture.cases.length>=12);
  assert.equal(new Set(fixture.cases.map(c=>c.id)).size,fixture.cases.length);
  for(const c of fixture.cases) {
    assert.ok(c.base && Array.isArray(c.intervals)&&Array.isArray(c.expected),c.id);
  }
});
for(const ref of fixture.cases){
  test('REF '+ref.id+' – independently specified 30-minute technical result',()=>{
    const first=epoch(ref.base);
    assert.ok(Number.isFinite(first));
    const samples=ref.intervals.map(([offset,seconds,la,pk],i)=>({
      startMs:first+offset*1000,endMs:first+(offset+seconds)*1000,
      laeqDb:la,lcpeakDb:pk,sourceLine:i+10
    }));
    const original=JSON.stringify(samples);
    const result=Engine.buildBlocks(samples);
    assert.equal(JSON.stringify(samples),original,'raw intervals may not be mutated');
    assert.equal(result.blocks.length,ref.expected.length);
    assert.equal(result.normativeStatus,'not-assessable');
    assert.equal(result.overall.normativeStatus,'not-assessable');
    if(ref.quality)assert.equal(result.quality.status,ref.quality);
    result.blocks.forEach((b,i)=>{
      const [quality,seconds,la,pk,compareLA,comparePeak]=ref.expected[i];
      assert.equal(b.dataQuality,quality,'block '+i+' data quality');
      near(b.coveredSeconds,seconds,'block '+i+' covered seconds');
      if(la===null)assert.equal(b.laeq30Db,null);else near(b.laeq30Db,la,'block '+i+' LAeq');
      if(pk===null)assert.equal(b.lcpeakMaxDb,null);else near(b.lcpeakMaxDb,pk,'block '+i+' LCpeak');
      assert.equal(b.comparisonLAeq,compareLA);
      assert.equal(b.comparisonLCpeak,comparePeak);
      assert.equal(b.normativeStatus,'not-assessable');
    });
    if(ref.id==='MIDNIGHT'){
      assert.equal(result.blocks[0].start,'2026-11-16T23:30:00');
      assert.equal(result.blocks[1].start,'2026-11-17T00:00:00');
    }
    if(ref.id==='CROSSING_BOUNDARY')
      assert.ok(result.blocks.every(b=>b.warnings.some(w=>w.code==='BOUNDARY_CROSSING')));
    if(ref.id==='DUPLICATE_OVERLAP')
      assert.ok(result.blocks[0].warnings.some(w=>w.code==='OVERLAPPING_SAMPLES'));
    if(ref.id==='MISSING_120S')
      near(result.blocks[0].unknownSeconds,120,'missing seconds');
  });
}
test('k1/k2 are applied exactly once – origin already corrected versus raw',()=>{
  const pre=Engine.evaluateModel(makeModel({laeq:97,peak:132,k1:3,k2:-2}),{
    timestampAnchor:'start',timestampAnchorEvidence:'verified'});
  const raw=Engine.evaluateModel(makeModel({laeq:94,peak:134,k1:3,k2:-2,
    appliedLAeq:false,appliedPeak:false}),{
    timestampAnchor:'start',timestampAnchorEvidence:'verified'});
  assert.equal(pre.blocks.length,1);
  near(pre.blocks[0].laeq30Db,97,'precorrected LAeq');
  near(pre.blocks[0].lcpeakMaxDb,132,'precorrected LCpeak');
  near(raw.blocks[0].laeq30Db,97,'raw corrected LAeq');
  near(raw.blocks[0].lcpeakMaxDb,132,'raw corrected LCpeak');
  assert.equal(pre.normativeStatus,'not-assessable');
  assert.equal(raw.normativeStatus,'not-assessable');
});
test('missing correction or unknown correction origin is not silently interpreted as zero',()=>{
  const missing=Engine.evaluateModel(makeModel({k1:null,appliedLAeq:false}),{timestampAnchor:'start'});
  assert.equal(missing.blocks[0].laeq30Db,null);
  assert.ok(missing.quality.warnings.some(x=>x.code==='CORRECTION_VALUE_MISSING'));
  const unknown=Engine.evaluateModel(makeModel({appliedPeak:null}),{timestampAnchor:'start'});
  assert.equal(unknown.blocks[0].lcpeakMaxDb,null);
  assert.ok(unknown.quality.warnings.some(x=>x.code==='CORRECTION_ORIGIN_UNKNOWN'));
  assert.equal(unknown.overall.normativeStatus,'not-assessable');
});
test('g5 above 99 never substitutes for the independently evaluated 30-minute LAeq',()=>{
  const m=makeModel({laeq:97,peak:132,g5:115});
  const result=Engine.evaluateModel(m,{timestampAnchor:'start',timestampAnchorEvidence:'verified'});
  near(result.blocks[0].laeq30Db,97,'corrected LAeq');
  assert.equal(result.blocks[0].comparisonLAeq,'at-or-below');
  assert.equal(result.blocks[0].normativeStatus,'not-assessable');
  assert.equal(m.samples[0].values.laeqG5,115);
});
test('unverified timestamp anchor prevents positive assessment even with complete energy data',()=>{
  const m=makeModel();
  m.calibration.status='not-documented';
  const r=Engine.evaluateModel(m,{timestampAnchor:'start',timestampAnchorEvidence:'assumed'});
  near(r.blocks[0].coveredSeconds,1800,'coverage');
  assert.ok(r.quality.warnings.some(x=>x.code==='TIME_BASIS_UNVERIFIED'));
  assert.ok(!r.quality.warnings.some(x=>x.code==='CALIBRATION_UNVERIFIED'));
  assert.equal(r.quality.status,'restricted');
  assert.equal(r.normativeStatus,'not-assessable');
});
test('import summary of unmatched layout is never used as an independently verified maximum',()=>{
  const parsed=Import.parse(sources('summary-layout-mismatch'),{fileName:'summary-layout-mismatch.txt'});
  assert.equal(parsed.ok,true);
  assert.equal(parsed.model.summary.verified,false);
  assert.ok(parsed.warnings.some(x=>x.code==='SUMMARY_LAYOUT_UNVERIFIED'));
  assert.equal(Import.toLegacy(parsed.model).summary.lcpeak_max,null);
});
test('faulty and duplicate imported timestamps remain visible in full pipeline',()=>{
  const parsed=Import.parse(sources('duplicates-and-gap'),{fileName:'duplicates-and-gap.txt'});
  assert.equal(parsed.ok,true);
  const e=Engine.evaluateModel(parsed.model,{timestampAnchor:'end',timestampAnchorEvidence:'assumed'});
  assert.ok(e.quality.warnings.some(x=>x.code==='IMPORT_DUPLICATE_TIMESTAMP'));
  assert.ok(e.quality.warnings.some(x=>x.code==='IMPORT_TIME_GAP'));
  assert.equal(e.normativeStatus,'not-assessable');
});
test('import → calculate → protocol → report → JSON roundtrip → report → PDF stays traceable',()=>{
  const source=sources('valid-with-summary');
  const parsed=Import.parse(source,{fileName:'XL3_synthetic.txt'});
  assert.equal(parsed.ok,true);
  const evaluation=Engine.evaluateModel(parsed.model,{timestampAnchor:'end',timestampAnchorEvidence:'assumed'});
  const input={form:{eventName:'Regression',datumMessung:'2026-11-16',
      organisator:'Beispiel',messposition:'FOH',messortLAeq:'Publikum Mitte',
      messortLCpeak:'Publikum links'},
    origins:{eventName:'user-input'},paItems:[],importModel:parsed.model,evaluation};
  const record=Protocol.buildRecord(input);
  assert.equal(record.normReview,'operator-approved');
  const before=Report.build(record,{sourceFileName:'XL3_synthetic.txt'});
  assert.equal(before.blocks.length,evaluation.blocks.length);
  assert.equal(before.reportFullyChecked,false);
  assert.equal(before.status,'Grenzwert überschritten');
  assert.ok(before.blocks.some(b=>b.laeq==='Nicht ermittelt'));
  const saved=JSON.stringify({schemaVersion:2,importModel:parsed.model,
    evaluation,form:input.form,origins:input.origins,paItems:input.paItems,sourceFileName:'XL3_synthetic.txt'});
  const restored=JSON.parse(saved);
  const rerecord=Protocol.buildRecord({form:restored.form,origins:restored.origins,
    paItems:restored.paItems,importModel:restored.importModel,evaluation:restored.evaluation});
  const after=Report.build(rerecord,{sourceFileName:restored.sourceFileName});
  assert.deepEqual(after,before);
  const pdfDoc=PDF.create(after,jsPDF);
  const bytes=Buffer.from(pdfDoc.output('arraybuffer'));
  assert.equal(bytes.subarray(0,5).toString('ascii'),'%PDF-');
  assert.ok(bytes.includes(Buffer.from('%%EOF')));
  assert.equal(after.blocks.length,before.blocks.length);
  assert.match(Report.renderHtml(after),/Grenzwert überschritten/i);
});
test('real archived XL3 file can generate an honest provisional report',()=>{
  const archive=path.join(ROOT,'archive/housekeeping_2026-04-28/2025-03-14_SLM_001_Log.txt');
  const parsed=Import.parse(fs.readFileSync(archive,'utf8'),{fileName:path.basename(archive)});
  assert.equal(parsed.ok,true);
  assert.equal(parsed.model.samples.length,8441);
  const evaluated=Engine.evaluateModel(parsed.model,{timestampAnchor:'end',timestampAnchorEvidence:'assumed'});
  assert.ok(evaluated.blocks.length>0);
  assert.equal(evaluated.normativeStatus,'not-assessable');
  const record=Protocol.buildRecord({form:{},importModel:parsed.model,evaluation:evaluated});
  const report=Report.build(record,{sourceFileName:path.basename(archive)});
  assert.equal(report.blocks.length,evaluated.blocks.length);
  assert.equal(report.reportFullyChecked,false);
  assert.equal(report.sourceLog,path.basename(archive));
  assert.match(report.status,/NICHT BEURTEILBAR/);
});
test('unknown 120-minute decision stays unavailable and does not enable a 120-minute test result',()=>{
  assert.equal(typeof Engine.evaluate120Minutes,'undefined');
  assert.equal(typeof Engine.LIMIT_LAEQ_DB,'number');
  assert.equal(Engine.threshold(null,Engine.LIMIT_LAEQ_DB),'unknown');
});

test('operator-approved measurement status distinguishes complete blocks and actual exceedance',()=>{
  const base=epoch('2026-11-16T18:00:00');
  const sample=(la,pk)=>({startMs:base,endMs:base+1800000,laeqDb:la,lcpeakDb:pk});
  assert.equal(Engine.buildBlocks([sample(98,134)]).overall.measurementStatus,'within-limits');
  assert.equal(Engine.buildBlocks([sample(99,135)]).overall.measurementStatus,'within-limits');
  assert.equal(Engine.buildBlocks([sample(100,134)]).overall.measurementStatus,'exceeded');
  assert.equal(Engine.buildBlocks([sample(98,136)]).overall.measurementStatus,'exceeded');
  assert.equal(Engine.buildBlocks([{...sample(98,134),endMs:base+1200000}]).overall.measurementStatus,'not-assessable');
});
test('missing form fields remain visible without any blanket release disclaimer',()=>{
  const model=makeModel();
  const evaluation=Engine.evaluateModel(model,{timestampAnchor:'start',timestampAnchorEvidence:'operator-approved'});
  assert.equal(evaluation.overall.measurementStatus,'within-limits');
  const record=Protocol.buildRecord({form:{},importModel:model,evaluation});
  const report=Report.build(record,{sourceFileName:'synthetic.txt'});
  const html=Report.renderHtml(report);
  assert.doesNotMatch(html,/vorläufig|normfreigabe|normenabgleich|konformitätsbescheinigung/i);
  assert.match(html,/Nicht beurteilbar/i);
  assert.ok(report.issues.some(x=>x.code==='FIELD_MISSING_OR_INVALID'));
});
