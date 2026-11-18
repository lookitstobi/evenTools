'use strict';
// Phase 6 UI/controller tests. No DIN-compliance claims.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../../..');
const UI=require(path.join(ROOT,'app/tools/pegelTool/ui/workflow.js'));
const HTML=fs.readFileSync(path.join(ROOT,'app/tools/pegelTool/index.html'),'utf8');
const imported=(overrides={})=>({
  importModel:{samples:[{line:1}],quality:{status:'usable',errors:[],warnings:[]}},
  evaluation:{blocks:[{dataQuality:'complete'}],quality:{warnings:[]}},
  review:{documentationComplete:false,evidenceComplete:false,reportFullyChecked:false,formIssues:[],evidenceIssues:[]},
  canExport:true, logFileName:'messung.txt',...overrides
});
test('six ordered steps match the approved Phase-6 workflow',()=>{
  assert.deepEqual(UI.STEPS.map(x=>x.id),
    ['import','quality','setup','assessment','protocol','export']);
});
test('no imported measurement is not assessed',()=>{
  assert.equal(UI.assessmentStatus({}), 'Noch nicht geprüft');
  assert.equal(UI.summarize({}).steps.export, 'Noch nicht verfügbar');
});
test('imported values alone never imply DIN compliance, even far below limits',()=>{
  const s=imported();
  s.evaluation.overall={laeqMaxDb:70,lcpeakMaxDb:90};
  assert.equal(UI.assessmentStatus(s),'Nicht beurteilbar');
  assert.equal(UI.summarize(s).normNotice,'');
});
test('an open original-norm gate blocks positive and negative DIN judgements',()=>{
  for(const hypothetical of ['compliant','exceeded']) {
    const s=imported({record:{normReview:'not-verified',assessment:{normativeStatus:hypothetical}}});
    s.review={documentationComplete:true,evidenceComplete:true,reportFullyChecked:true};
    assert.equal(UI.assessmentStatus(s),'Nicht beurteilbar');
  }
});
test('measured status is independent of formal documentation completeness',()=>{
  const s=imported({record:{normReview:'verified',assessment:{measurementStatus:'within-limits'}}});
  s.review={documentationComplete:true,evidenceComplete:true,reportFullyChecked:true};
  assert.equal(UI.assessmentStatus(s),'Keine Überschreitung in auswertbaren Messdaten');
  s.record.assessment.measurementStatus='exceeded';
  assert.equal(UI.assessmentStatus(s),'Grenzwert überschritten');
  s.review.evidenceComplete=false;
  assert.equal(UI.assessmentStatus(s),'Grenzwert überschritten'); // documentation separate
});
test('import errors outrank technical issues, which outrank field omissions',()=>{
  const s=imported();
  s.importModel.quality.errors=[{code:'BROKEN',message:'Dateiformat fehlerhaft'}];
  s.importModel.quality.warnings=[{code:'WARN',message:'Zusatzwarnung'}];
  s.review.evidenceIssues=[{code:'METER_MISSING',message:'Gerät unklar'}];
  s.review.formIssues=[{code:'FIELD',message:'Name fehlt'}];
  const issues=UI.collectIssues(s);
  assert.equal(issues[0].source,'Importfehler');
  assert.equal(issues[1].source,'Messnachweis');
  assert.equal(issues.at(-1).source,'Protokollangabe');
  assert.equal(UI.summarize(s).steps.quality,'Importfehler');
});
test('rejected imports remain prominent without replacing the previous loaded dataset',()=>{
  const s=imported({lastImportAttempt:{errors:[{code:'REJECTED',message:'Neues Log abgewiesen'}]}});
  const old=JSON.stringify(s.importModel);
  const result=UI.summarize(s);
  assert.equal(result.steps.quality,'Importfehler');
  assert.equal(result.issues[0].source,'Letzter Importversuch');
  assert.equal(result.status,'Nicht beurteilbar');
  assert.equal(JSON.stringify(s.importModel),old);
});
test('missing half-hour blocks and unproven fields remain visible',()=>{
  const s=imported({evaluation:{blocks:[{dataQuality:'incomplete'}],quality:{warnings:[]}}});
  s.review.formIssues=[{code:'FIELD',message:'Ort fehlt'}];
  s.review.evidenceIssues=[{code:'BLOCKS_INCOMPLETE',message:'Zeitblock unvollständig'}];
  const result=UI.summarize(s);
  assert.equal(result.status,'Nicht beurteilbar');
  assert.equal(result.steps.assessment,'Datenlücken prüfen');
  assert.equal(result.steps.protocol,'Nachweise offen');
  assert.equal(result.missingEvidence,1);
});
test('existing HTML sections, scripts and project actions are retained',()=>{
  for(const name of ['metrics','blocks','charts','log','review','preview',
    'eventAndEvidence','description','signature','pa','corrections','deviceEvidence']){
    assert.match(HTML,new RegExp('data-workflow-section="'+name+'"'));
  }
  for(const id of ['fileInput','btnImport','btnSaveState','btnLoadState',
    'btnRecover','btnExportHtml','btnPdfTemplate','phase3Tabelle',
    'protocolReview','phase5ReportPreview','messort','kalVorBestaetigt','kalNachBestaetigt','paZusatz']){
    assert.match(HTML,new RegExp('id="'+id+'"'));
  }
  assert.match(HTML,/file=ui\/workflow\.js/);
  assert.match(HTML,/workflowController\.refresh\(\)/);
  assert.doesNotMatch(HTML,/workflowController\.go\('quality'\)/);
  assert.match(HTML,/chartLAeq\.resize\(\)/);
});
function fakeDom(){
  const lookup=new Map(), sections=new Map();
  function make(tag='div',id=''){
    const attributes={},events={},classes=new Set();
    const el={tagName:tag.toUpperCase(),id,className:'',value:'',textContent:'',
      hidden:false,disabled:false,children:[],dataset:{},parent:null,
      classList:{add(x){classes.add(x);},toggle(x,on){if(on)classes.add(x);else classes.delete(x);},
        contains(x){return classes.has(x);}},
      setAttribute(k,v){attributes[k]=v;},getAttribute(k){return attributes[k];},
      removeAttribute(k){delete attributes[k];},
      append(...nodes){nodes.forEach(n=>{if(n.parent)n.parent.children=n.parent.children.filter(x=>x!==n);n.parent=el;el.children.push(n);});},
      appendChild(n){el.append(n);return n;},
      replaceChildren(...nodes){el.children=[];el.append(...nodes);},
      addEventListener(name,cb){events[name]=cb;},
      click(){el.clicks=(el.clicks||0)+1;events.click?.();},
      remove(){if(el.parent)el.parent.children=el.parent.children.filter(x=>x!==el);},
      scrollIntoView(){},
      querySelector(selector){
        const found=/data-workflow-section="([^"]+)"/.exec(selector);
        return found ? sections.get(found[1]) || null : null;
      },
      querySelectorAll(selector){
        if(selector==='.workflow-panel')return el.children.filter(n=>n.className==='workflow-panel');
        if(selector==='.workflow-group')return el.children.filter(n=>n.className.includes('workflow-group'));
        return [];
      }
      
    };
    if(id)lookup.set(id,el);
    return el;
  }
  const main=make('div','main'),header=make('header','header'),body=make('body','body');
  const left=make('div','leftColumn'),right=make('div','rightColumn');
  body.append(header,main);main.append(left,right);
  for(const id of ['metrics','blocks','charts','log','review','preview','eventAndEvidence',
    'description','signature','pa','corrections','deviceEvidence'])sections.set(id,make('div',id+'Section'));
  for(const id of ['btnImport','btnLoadState','btnSaveState','btnExportHtml','btnPdfTemplate','btnRecover'])
    make('button',id);
  body.insertBefore=(e,target)=>{
    const pos=body.children.indexOf(target);body.children.splice(pos,0,e);e.parent=body;
  };
  return {doc:{body,getElementById:id=>lookup.get(id) || null,
    querySelector:selector=>selector==='header.header' ? header :
      selector==='.workflow-shell' ? body.children.find(n=>n.className==='workflow-shell') || null :
      null,createElement:tag=>make(tag)},
    main,body,lookup};
}
test('single-page layout retains every section without tab navigation',()=>{
  const x=fakeDom(),snapshot=imported();
  const ctrl=UI.mount({document:x.doc,getSnapshot:()=>snapshot});
  assert.ok(ctrl);
  assert.equal(ctrl.currentStep(),'all');
  assert.equal(x.body.children.filter(n=>n.className==='workflow-shell').length,1);
  assert.equal(x.main.children.filter(n=>n.className==='workflow-panel').length,0);
  assert.equal(x.main.children.filter(n=>n.className.includes('workflow-group')).length,5);
  assert.equal(ctrl.go('setup'),true);
  assert.equal(ctrl.go('quality'),true);
  assert.equal(ctrl.go('assessment'),true);
  assert.equal(ctrl.go('protocol'),true);
  assert.equal(ctrl.go('export'),true);
  assert.equal(ctrl.go('wrong-step'),false);
  assert.equal(x.main.children.some(n=>n.id==='leftColumn'),false);
  assert.equal(x.main.children[0].id,'chartsSection');
  assert.ok(!x.main.children.slice(1).some(n=>n===x.main.children[0]));
});
test('compact status and XL3 short info contain no global priority issue list',()=>{
  const x=fakeDom(),snapshot=imported();
  snapshot.review.formIssues=[{message:'Angabe fehlt'}];
  const ctrl=UI.mount({document:x.doc,getSnapshot:()=>snapshot});
  assert.ok(ctrl);
  const shell=x.body.children[1];
  assert.equal(shell.children[0].children[0].textContent,'—');
  assert.equal(shell.children[0].children.length,1);
  assert.equal(shell.children[1].className,'workflow-shortinfo');
  assert.equal(shell.children[1].children[1].children.length,6);
  assert.equal(shell.children[1].children[1].children[4].children[0].textContent,'LAeq,30min (Maximum)');
  assert.equal(shell.children[1].children[1].children[5].children[0].textContent,'LCpeak (Maximum)');
});
test('Kurzinfo uses only the two approved measured statuses and never invents a clearance',()=>{
  const x=fakeDom(),snapshot=imported();
  snapshot.evaluation.overall={comparisonLAeq:'at-or-below',comparisonLCpeak:'at-or-below'};
  const ctrl=UI.mount({document:x.doc,getSnapshot:()=>snapshot});
  const status=x.body.children[1].children[0].children[0];
  assert.equal(status.textContent,'Keine Überschreitung');
  assert.equal(status.dataset.state,'ok');
  snapshot.evaluation.overall.comparisonLCpeak='above';
  ctrl.refresh();
  assert.equal(status.textContent,'Grenzwerte überschritten');
  assert.equal(status.dataset.state,'bad');
  snapshot.evaluation.overall.comparisonLAeq='not-assessable';
  snapshot.evaluation.overall.comparisonLCpeak='at-or-below';
  ctrl.refresh();
  assert.equal(status.textContent,'—');
  assert.equal(status.dataset.state,'empty');
});
test('collapsed sections retain subtle warning flags driven by actual missing fields',()=>{
  const x=fakeDom(),snapshot=imported();
  snapshot.review.formIssues=[{field:'eventName',message:'Name fehlt'},{field:'messposition',message:'Position fehlt'}];
  const ctrl=UI.mount({document:x.doc,getSnapshot:()=>snapshot});
  const group=id=>x.main.children.find(node=>node.id==='workflow-group-'+id);
  const alert=id=>group(id).children[0].children[1];
  assert.equal(alert('setup').hidden,false);
  assert.equal(alert('assessment').hidden,false);
  assert.equal(alert('quality').hidden,true);
  group('setup').open=false;ctrl.refresh();
  assert.equal(group('setup').open,false);
  assert.equal(alert('setup').hidden,false);
  snapshot.review.formIssues=[];
  ctrl.refresh();
  assert.equal(alert('setup').hidden,true);
});

test('Kurzinfo uses fixed 30-minute assessment maxima (not rolling charts)',()=>{
  const x=fakeDom(),snapshot=imported();
  snapshot.evaluation.overall={laeqMaxDb:97.25,lcpeakMaxDb:123.8};
  UI.mount({document:x.doc,getSnapshot:()=>snapshot});
  const values=x.body.children[1].children[1].children[1].children;
  assert.equal(values[4].children[1].textContent,'97,3 dB(A)');
  assert.equal(values[5].children[1].textContent,'123,8 dB(C)');
  snapshot.evaluation.overall={laeqMaxDb:null,lcpeakMaxDb:undefined};
  const ctrl=UI.mount({document:x.doc,getSnapshot:()=>snapshot});
  // No result is represented by a dash, never by invented 0 dB.
  const latest=x.body.children[1].children[1].children[1].children;
  assert.equal(latest[4].children[1].textContent,'—');
  assert.equal(latest[5].children[1].textContent,'—');
  assert.ok(ctrl);
});
test('no positive tabindex remains in the HTML',()=>{
  assert.doesNotMatch(HTML,/tabindex="\\d+"/);
  assert.match(HTML,/workflow-single-page/);
  assert.doesNotMatch(HTML,/id="lautestePosition"/);
  assert.ok(HTML.indexOf('id="beschreibung"')>HTML.indexOf('id="eventName"'));
  assert.ok(HTML.indexOf('id="beschreibung"')<HTML.indexOf('id="datumMessung"'));
  assert.ok(HTML.indexOf('id="foh"')>HTML.indexOf('id="messungVon"'));
  assert.match(HTML,/data-workflow-section="deviceEvidence"/);
});
test('navigation and status updates do not modify acoustic measurements',()=>{
  const x=fakeDom(),snapshot=imported(),before=JSON.stringify(snapshot);
  const ctrl=UI.mount({document:x.doc,getSnapshot:()=>snapshot});
  ctrl.go('export');ctrl.go('quality');ctrl.refresh();
  assert.equal(JSON.stringify(snapshot),before);
  assert.equal(UI.summarize(snapshot).status,'Nicht beurteilbar');
});

test('rehydration keeps only one shell and one set of groups',()=>{
  const x=fakeDom(),snapshot=imported();
  UI.mount({document:x.doc,getSnapshot:()=>snapshot});
  UI.mount({document:x.doc,getSnapshot:()=>snapshot});
  assert.equal(x.body.children.filter(n=>n.className==='workflow-shell').length,1);
  assert.equal(x.main.children.filter(n=>n.className.includes('workflow-group')).length,5);
  assert.equal(x.main.children.filter(n=>n.id==='chartsSection').length,1);
});
