'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../../..');
const PA=require(path.join(ROOT,'app/tools/pegelTool/ui/pa-selection.js'));
const source=()=>fs.readFileSync(path.join(ROOT,'app/tools/pegelTool/index.html'),'utf8');

test('PA presets retain the existing AKS speaker quantities in the versioned selection',()=>{
  const state=PA.presetFor(PA.AKS);
  assert.equal(state.schemaVersion,3);
  assert.deepEqual(state.quantities,{});
  assert.equal(PA.itemsFor(state).find(x=>x.type===PA.TYPE.kara).qty,24);
  assert.equal(PA.itemsFor(state).find(x=>x.type===PA.TYPE.ks).qty,8);
  assert.equal(PA.itemsFor(state).find(x=>x.type===PA.TYPE.fill).qty,7);
});

test('individual group count overrides change only their own group and report data',()=>{
  const state=PA.presetFor(PA.AKS);
  state.quantities.mainL={[PA.TYPE.kara]:10};
  state.quantities.sideL={[PA.TYPE.ks]:3,[PA.TYPE.focus]:2};
  const items=PA.itemsFor(state);
  assert.equal(items.find(x=>x.type===PA.TYPE.kara).qty,22);
  assert.equal(items.find(x=>x.type===PA.TYPE.ks).qty,7);
  assert.equal(items.find(x=>x.type===PA.TYPE.focus).qty,3);
  const summary=PA.summaryFor(state);
  assert.equal(summary.find(x=>x.id==='mainL').items[0].qty,10);
  assert.match(summary.find(x=>x.id==='mainL').label,/10 × KARA II/);
  assert.equal(summary.find(x=>x.id==='sideR').items.find(x=>x.type===PA.TYPE.ks).qty,4);
});

test('zero and untrusted overrides cannot silently generate invalid physical counts',()=>{
  const state=PA.presetFor(PA.AKS);
  state.quantities.mainL={[PA.TYPE.kara]:0};
  assert.match(PA.unresolvedFor(state).join(' '),/Alle Lautsprecheranzahlen sind 0/);
  assert.equal(PA.itemsFor(state).find(x=>x.type===PA.TYPE.kara).qty,12);
  state.quantities.mainL={[PA.TYPE.kara]:900};
  assert.equal(PA.itemsFor(state).find(x=>x.type===PA.TYPE.kara).qty,24);
  state.quantities.mainL={[PA.TYPE.kara]:2.5};
  assert.equal(PA.itemsFor(state).find(x=>x.type===PA.TYPE.kara).qty,24);
});

test('Pavillon presets remain intact and can be customized per component',()=>{
  const state=PA.presetFor(PA.PAV);
  assert.equal(PA.itemsFor(state).find(x=>x.type===PA.TYPE.ks).qty,4);
  state.quantities.mainL={[PA.TYPE.wide]:3};
  assert.equal(PA.itemsFor(state).find(x=>x.type===PA.TYPE.wide).qty,5);
  assert.equal(PA.summaryFor(state).find(x=>x.id==='mainR').items.find(x=>x.type===PA.TYPE.wide).qty,1);
});

test('the UI exposes both subpanels collapsed and moves evidence into section 03',()=>{
  const html=source();
  assert.match(html,/data-workflow-section="deviceEvidence"/);
  assert.match(html,/id="fullMeasurementDetails"/);
  assert.match(html,/id="phase5ReportPreview"/);
  assert.doesNotMatch(html,/pa-stage-marker/);
  assert.match(html,/values\.forEach\(\(value,index\)=>/);
  assert.match(html,/value==='Nicht überschritten'/);
  assert.match(html,/value==='Überschritten'/);
});
