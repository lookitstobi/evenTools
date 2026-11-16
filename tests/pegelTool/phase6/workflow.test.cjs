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
  assert.match(UI.summarize(s).normNotice,/keine DIN-Konformitätsbescheinigung/i);
});
test('an open original-norm gate blocks positive and negative DIN judgements',()=>{
  for(const hypothetical of ['compliant','exceeded']) {
    const s=imported({record:{normReview:'not-verified',assessment:{normativeStatus:hypothetical}}});
    s.review={documentationComplete:true,evidenceComplete:true,reportFullyChecked:true};
    assert.equal(UI.assessmentStatus(s),'Nicht beurteilbar');
  }
});
test('hypothetical fully verified future status maps only from an authorised result',()=>{
  const s=imported({record:{normReview:'verified',assessment:{normativeStatus:'compliant'}}});
  s.review={documentationComplete:true,evidenceComplete:true,reportFullyChecked:true};
  assert.equal(UI.assessmentStatus(s),'Grenzwert eingehalten');
  s.record.assessment.normativeStatus='exceeded';
  assert.equal(UI.assessmentStatus(s),'Grenzwert überschritten');
  s.review.evidenceComplete=false;
  assert.equal(UI.assessmentStatus(s),'Nicht beurteilbar');
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
    'eventAndEvidence','description','signature','pa','corrections']){
    assert.match(HTML,new RegExp('data-workflow-section="'+name+'"'));
  }
  for(const id of ['fileInput','btnImport','btnSaveState','btnLoadState',
    'btnRecover','btnExportHtml','btnPdfTemplate','phase3Tabelle',
    'protocolReview','phase5ReportPreview','k1Ermittlung','k2Ermittlung']){
    assert.match(HTML,new RegExp('id="'+id+'"'));
  }
  assert.match(HTML,/file=ui\/workflow\.js/);
  assert.match(HTML,/workflowController\.refresh\(\)/);
  assert.match(HTML,/workflowController\.go\('quality'\)/);
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
      append(...nodes){nodes.forEach(n=>{n.parent=el;el.children.push(n);});},
      appendChild(n){el.append(n);return n;},
      replaceChildren(...nodes){el.children=[];el.append(...nodes);},
      addEventListener(name,cb){events[name]=cb;},
      click(){el.clicks=(el.clicks||0)+1;events.click?.();},
      remove(){if(el.parent)el.parent.children=el.parent.children.filter(x=>x!==el);},
      scrollIntoView(){},
      querySelector(selector){
        const found=/data-workflow-section="([^"]+)"/.exec(selector);
        return found ? sections.get(found[1]) || null : null;
      }
    };
    if(id)lookup.set(id,el);
    return el;
  }
  const main=make('div','main'),header=make('header','header'),body=make('body','body');
  const left=make('div','leftColumn'),right=make('div','rightColumn');
  body.append(header,main);main.append(left,right);
  for(const id of ['metrics','blocks','charts','log','review','preview','eventAndEvidence',
    'description','signature','pa','corrections'])sections.set(id,make('div',id+'Section'));
  for(const id of ['btnImport','btnLoadState','btnSaveState','btnExportHtml','btnPdfTemplate','btnRecover'])
    make('button',id);
  body.insertBefore=(e,target)=>{
    const pos=body.children.indexOf(target);body.children.splice(pos,0,e);e.parent=body;
  };
  return {doc:{body,getElementById:id=>lookup.get(id) || null,
    querySelector:selector=>selector==='header.header' ? header:null,createElement:tag=>make(tag)},
    main,body,lookup};
}
test('guided panels move original sections without dropping any and remain keyboard buttons',()=>{
  const x=fakeDom(), snapshot=imported();
  const ctrl=UI.mount({document:x.doc,getSnapshot:()=>snapshot});
  assert.ok(ctrl);
  const panels=x.main.children.filter(n=>n.className==='workflow-panel');
  assert.equal(panels.length,6);
  assert.equal(ctrl.currentStep(),'import');
  assert.equal(panels[0].hidden,false);
  assert.equal(panels[3].hidden,true);
  const tabs=x.body.children[1].children[0];
  assert.equal(tabs.tagName,'NAV');
  assert.equal(tabs.children.length,6);
  tabs.children[3].click();
  assert.equal(ctrl.currentStep(),'assessment');
  assert.equal(panels[0].hidden,true);
  assert.equal(panels[3].hidden,false);
  assert.equal(tabs.children[3].getAttribute('aria-current'),'step');
  assert.equal(ctrl.go('wrong-step'),false);
  assert.equal(ctrl.currentStep(),'assessment');
  assert.equal(x.main.children.some(n=>n.id==='leftColumn'),false);
  const allSections=panels.flatMap(p=>p.children).filter(n=>n.id?.endsWith('Section'));
  assert.equal(allSections.length,11);
});
test('navigation and status updates do not modify acoustic measurements',()=>{
  const x=fakeDom(),snapshot=imported(),before=JSON.stringify(snapshot);
  const ctrl=UI.mount({document:x.doc,getSnapshot:()=>snapshot});
  ctrl.go('export');ctrl.go('quality');ctrl.refresh();
  assert.equal(JSON.stringify(snapshot),before);
  assert.equal(UI.summarize(snapshot).status,'Nicht beurteilbar');
});
