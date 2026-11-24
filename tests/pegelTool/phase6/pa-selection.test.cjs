'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const PA=require('../../../app/tools/pegelTool/ui/pa-selection.js');

const state=(location,selected,variants={})=>({schemaVersion:2,location,selected,variants});
const qty=(items,type)=>items.find(x=>x.type===type)?.qty||0;

test('AKS preset: 2 × 12 Kara, each side 4 KS21 + Focus + Wide, 7 frontfills',()=>{
  const preset=PA.presetFor(PA.AKS);
  assert.equal(preset.schemaVersion,3);
  assert.deepEqual(preset.variants,{sideL:'ks4',sideR:'ks4'});
  assert.deepEqual(preset.selected,['mainL','mainR','sideL','sideR','ff28','ff37','ff46','ff5']);
  const items=PA.itemsFor(preset);
  assert.equal(qty(items,PA.TYPE.kara),24);
  assert.equal(qty(items,PA.TYPE.ks),8);
  assert.equal(qty(items,PA.TYPE.focus),2);
  assert.equal(qty(items,PA.TYPE.wide),2);
  assert.equal(qty(items,PA.TYPE.fill),7);
  assert.equal(PA.unresolvedFor(preset).length,0);
});
test('Pavillon preset: per-side 2 KS21, 2 Focus, 1 Wide, plus 1 Wide center and 5 frontfills',()=>{
  const preset=PA.presetFor(PA.PAV);
  assert.deepEqual(preset.selected,['mainL','mainR','center','ff17','ff35','ff4']);
  const items=PA.itemsFor(preset);
  assert.equal(qty(items,PA.TYPE.ks),4);
  assert.equal(qty(items,PA.TYPE.focus),4);
  assert.equal(qty(items,PA.TYPE.wide),3);
  assert.equal(qty(items,PA.TYPE.fill),5);
  assert.equal(qty(items,PA.TYPE.kara),0);
  assert.deepEqual(PA.unresolvedFor(preset),[]);
});
test('AKS: left and right main hangs can be chosen independently; center is optional',()=>{
  const items=PA.itemsFor(state(PA.AKS,['mainL','center']));
  assert.equal(qty(items,PA.TYPE.kara),20);
  const noCenter=PA.presetFor(PA.AKS);
  assert.equal(PA.summaryFor(noCenter).some(x=>x.id==='center'),false);
  const labels=PA.summaryFor(state(PA.AKS,['mainL','mainR','center'])).map(x=>x.label);
  assert.match(labels[0],/links – 12/);
  assert.match(labels[1],/rechts – 12/);
  assert.match(labels[2],/Center-Cluster/);
});
test('AKS sidefill: legacy alternatives retain their exact default counts',()=>{
  assert.deepEqual(PA.SIDE_OPTIONS.map(x=>x.id),['ks2','ks4','focus','wide']);
  const all=[
    {id:'ks2',ks:2,focus:1,wide:1},
    {id:'ks4',ks:4,focus:1,wide:1},
    {id:'focus',ks:0,focus:1,wide:0},
    {id:'wide',ks:0,focus:0,wide:1}
  ];
  for(const chosen of all){
    const s=state(PA.AKS,['sideL'],{sideL:chosen.id});
    const items=PA.itemsFor(s);
    assert.equal(qty(items,PA.TYPE.ks),chosen.ks);
    assert.equal(qty(items,PA.TYPE.focus),chosen.focus);
    assert.equal(qty(items,PA.TYPE.wide),chosen.wide);
    assert.deepEqual(PA.unresolvedFor(s),[]);
  }
});
test('AKS: each side can use a different sidefill variant',()=>{
  const s=state(PA.AKS,['sideL','sideR'],{sideL:'ks4',sideR:'wide'});
  const items=PA.itemsFor(s);
  assert.equal(qty(items,PA.TYPE.ks),4);
  assert.equal(qty(items,PA.TYPE.focus),1);
  assert.equal(qty(items,PA.TYPE.wide),2);
  const summaries=PA.summaryFor(s);
  assert.equal(summaries.length,2);
  assert.match(summaries[0].label,/4 × KS21/);
  assert.match(summaries[1].label,/1 × A10 Wide/);
});
test('Unspecified/invalid sidefill choices never generate made-up loudspeakers',()=>{
  const missing=state(PA.AKS,['sideL'],{});
  assert.deepEqual(PA.itemsFor(missing),[]);
  assert.equal(PA.unresolvedFor(missing).length,1);
  const invalid=state(PA.AKS,['sideL'],{sideL:'ks17'});
  assert.deepEqual(PA.itemsFor(invalid),[]);
  assert.equal(PA.unresolvedFor(invalid).length,1);
});
test('Frontfill paired selection and counts remain independent of presets',()=>{
  const aks=PA.CONFIG[PA.AKS],pair=aks.find(x=>x.id==='ff19');
  assert.equal(pair.nodes.length,2);
  assert.deepEqual(pair.nodes.map(x=>x.label),['1','9']);
  assert.equal(qty(PA.itemsFor(state(PA.AKS,['ff19','ff28','ff37','ff46','ff5'])),PA.TYPE.fill),9);
  assert.equal(qty(PA.itemsFor(state(PA.PAV,['ff17','ff35','ff2','ff4','ff6'])),PA.TYPE.fill),7);
});
test('Unknown location/IDs cannot generate speaker quantities',()=>{
  assert.deepEqual(PA.itemsFor(state('Eigene Angabe',['mainL'])),[]);
  assert.deepEqual(PA.itemsFor(state(PA.AKS,['unknown'])),[]);
  assert.deepEqual(PA.summaryFor(state(PA.AKS,[])),[]);
  assert.deepEqual(PA.presetFor('Eigene Angabe').selected,[]);
});

test('Sidefill quantities independently override all three types, even with legacy single-type variants',()=>{
  const s={...state(PA.AKS,['sideL','sideR'],{sideL:'focus',sideR:'ks4'}),schemaVersion:3,
    quantities:{sideL:{[PA.TYPE.ks]:3,[PA.TYPE.focus]:0,[PA.TYPE.wide]:2}}};
  const items=PA.itemsFor(s);
  assert.equal(qty(items,PA.TYPE.ks),7);
  assert.equal(qty(items,PA.TYPE.focus),1);
  assert.equal(qty(items,PA.TYPE.wide),3);
  assert.deepEqual(PA.unresolvedFor(s),[]);
  assert.deepEqual(PA.summaryFor(s)[0].items,[{type:PA.TYPE.ks,qty:3},{type:PA.TYPE.wide,qty:2}]);
});
