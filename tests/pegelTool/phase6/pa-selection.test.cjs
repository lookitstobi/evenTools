'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const PA=require('../../../app/tools/pegelTool/ui/pa-selection.js');

const state=(location,selected,counts={})=>({schemaVersion:1,location,selected,counts});

test('AKS: both flown Kara arrays and center have their own groups',()=>{
  const items=PA.itemsFor(state(PA.AKS,['main','center']));
  assert.deepEqual(items,[{type:PA.TYPE.kara,customType:'',qty:32}]);
  const labels=PA.summaryFor(state(PA.AKS,['main','center'])).map(x=>x.label);
  assert.ok(labels[0].includes('2 × 12'));
  assert.ok(labels[1].includes('8 Kara II'));
});
test('AKS: four symmetric frontfill pairs and independent center 5',()=>{
  const groups=PA.CONFIG[PA.AKS];
  assert.equal(groups.filter(g=>g.id.startsWith('ff')).length,5);
  const pair=groups.find(g=>g.id==='ff19');
  assert.equal(pair.nodes.length,2);
  assert.equal(pair.nodes[0].label,'1');
  assert.equal(pair.nodes[1].label,'9');
  const items=PA.itemsFor(state(PA.AKS,['ff19','ff28','ff37','ff46','ff5']));
  assert.equal(items.find(x=>x.type===PA.TYPE.fill).qty,9);
});
test('AKS: sidefill A10 quantities are required, not assumed',()=>{
  let s=state(PA.AKS,['sideLarge','sideSmall']);
  assert.equal(PA.unresolvedFor(s).length,4);
  assert.equal(PA.itemsFor(s).find(x=>x.type===PA.TYPE.ks).qty,6);
  s=state(PA.AKS,['sideLarge'],{largeFocus:2,largeWide:1});
  assert.equal(PA.unresolvedFor(s).length,0);
  assert.deepEqual(PA.itemsFor(s),[
    {type:PA.TYPE.ks,customType:'',qty:4},
    {type:PA.TYPE.focus,customType:'',qty:2},
    {type:PA.TYPE.wide,customType:'',qty:1}
  ]);
});
test('Pavillon: main Focus/Wide need real unit counts; other groups are fixed',()=>{
  let s=state(PA.PAV,['main','subs','center','ff17','ff35','ff2','ff4','ff6']);
  assert.equal(PA.unresolvedFor(s).length,2);
  assert.equal(PA.itemsFor(s).find(x=>x.type===PA.TYPE.ks).qty,4);
  assert.equal(PA.itemsFor(s).find(x=>x.type===PA.TYPE.fill).qty,7);
  s=state(PA.PAV,['main','center'],{mainFocus:'4',mainWide:'2'});
  assert.equal(PA.unresolvedFor(s).length,0);
  assert.equal(PA.itemsFor(s).find(x=>x.type===PA.TYPE.wide).qty,3);
});
test('non-integer, zero or negative quantities never become actual speakers',()=>{
  const s=state(PA.PAV,['main'],{mainFocus:0,mainWide:'2.5'});
  assert.deepEqual(PA.itemsFor(s),[]);
  assert.equal(PA.unresolvedFor(s).length,2);
});
test('unknown venue or group cannot silently generate speakers',()=>{
  assert.deepEqual(PA.itemsFor(state('Eigene Angabe',['main'])),[]);
  assert.deepEqual(PA.itemsFor(state(PA.AKS,['unknown'])),[]);
  assert.deepEqual(PA.summaryFor(state(PA.AKS,[])),[]);
});
