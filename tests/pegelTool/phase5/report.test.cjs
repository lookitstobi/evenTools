'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const protocol=require('../../../app/tools/pegelTool/protocol/protocol.js');
const reportModule=require('../../../app/tools/pegelTool/report/report.js');
const pdf=require('../../../app/tools/pegelTool/report/pdf.js');

const form={
  eventName:'Testkonzert',datumMessung:'2026-11-16',organisator:'Testveranstalter',
  location:'Eigene Angabe',ortAdresse:'Teststraße 3, 45127 Essen',ortBestaetigt:'ja',
  messungVon:'Testteam',messposition:'FOH',messortLAeq:'Publikum Mitte',messortLCpeak:'Publikum Links',
  messortTyp:'ersatz',ersatzMessort:'FOH',k1Ermittlung:'Vergleichsmessung',
  k2Ermittlung:'Referenzmessung',paAnordnung:'2 Hauptlautsprecher links/rechts',
  paBestaetigt:'ja',kalibratorModell:'Testkalibrator',kalibratorSN:'CAL-01',
  kalVorZeit:'2026-11-16T18:00',kalVorWert:'94,0',
  kalNachZeit:'2026-11-16T20:00',kalNachWert:'94,1',
  abweichungVorhanden:'nein',berichtName:'Testperson',
  berichtDatum:'2026-11-16',berichtsort:'Essen'
};
const model={
  samples:[{sourceLine:20},{sourceLine:21},{sourceLine:22},{sourceLine:23}],
  instrument:{deviceModel:'XL3',serial:'NTI-01',firmware:'1.0',
    microphone:{type:'M2230',serial:'MIC-42'}},
  measurement:{start:'2026-11-16 18:00',end:'2026-11-16 19:00',
    intervalSeconds:1,timeZone:'Europe/Berlin'},
  calibration:{status:'unverified'},
  quality:{status:'restricted',warnings:[{code:'TIME_GAP',message:'Intervall fehlt'}]},
  columns:{
    laeqDt:{column:'LAeq_dt+k1',correctionApplied:true},
    lcpeak:{column:'LCpeak',correctionApplied:false}
  },
  corrections:{
    k1:{valueDb:1.5,valueSource:'device-header'},
    k2:{valueDb:-0.5,valueSource:'device-header'}
  }
};
const completeBlock={
  start:'2026-11-16T18:00:00',end:'2026-11-16T18:30:00',
  coveredSeconds:1800,expectedSeconds:1800,laeq30Db:97.25,lcpeakMaxDb:124.8,
  dataQuality:'complete',sourceLines:[20,21,22,23],lcpeakSourceLine:23,warnings:[]
};
const incompleteBlock={
  start:'2026-11-16T18:30:00',end:'2026-11-16T19:00:00',
  coveredSeconds:1700,expectedSeconds:1800,laeq30Db:null,lcpeakMaxDb:null,
  dataQuality:'incomplete',sourceLines:[],lcpeakSourceLine:null,
  warnings:[{code:'INCOMPLETE_BLOCK',message:'100 Sekunden fehlen'}]
};
const evaluation={
  blocks:[completeBlock,incompleteBlock],
  overall:{laeqMaxDb:97.25,lcpeakMaxDb:124.8,totalBlocks:2,completeBlocks:1,normativeStatus:'not-assessable'},
  quality:{status:'restricted',warnings:[{code:'TIME_BASIS_UNVERIFIED',message:'Anker ungeprüft'}]},
  assumptions:{timestampAnchor:'end',timestampAnchorEvidence:'assumed'},
  timestampAnchorEvidence:'assumed'
};
function makeRecord(changes={}) {
  return protocol.buildRecord({
    form:{...form,...(changes.form||{})},
    origins:{eventName:'user-input',...(changes.origins||{})},
    paItems:[{type:'custom',customType:'Musterlautsprecher',qty:2}],
    importModel:changes.model===undefined ? structuredClone(model) : changes.model,
    evaluation:changes.evaluation===undefined ? structuredClone(evaluation) : changes.evaluation
  });
}
function makeReport(changes){return reportModule.build(makeRecord(changes),{sourceFileName:'XL3_Archiv.txt'});}

class FakePDF {
  constructor() {this.pages=[[]];this.current=0;this.props={};this.internal={getNumberOfPages:()=>this.pages.length};}
  setProperties(p){this.props=p;return this;}
  setFont(){return this;}setFontSize(){return this;}setTextColor(){return this;}
  setDrawColor(){return this;}setFillColor(){return this;}
  rect(){return this;}line(){return this;}
  splitTextToSize(text,width){
    const max=Math.max(8,Math.floor(width/2.2));
    const out=[];
    for(const logical of String(text).split('\n')){
      if(!logical){out.push('');continue;}
      let rest=logical;
      while(rest.length>max){out.push(rest.slice(0,max));rest=rest.slice(max);}
      out.push(rest);
    }
    return out;
  }
  text(value){this.pages[this.current].push(String(value));return this;}
  addPage(){this.pages.push([]);this.current=this.pages.length-1;return this;}
  setPage(number){this.current=number-1;return this;}
  output(){return this.pages.map(p=>p.join('\n')).join('\n===NEW PAGE===\n');}
}

test('Bericht übernimmt feste Zeitblöcke und enthält keine normative Freigabe',()=>{
  const report=makeReport();
  assert.equal(report.blocks.length,2);
  assert.equal(report.status.includes('NICHT BEURTEILBAR'),true);
  assert.equal(report.reportFullyChecked,false);
  assert.equal(report.normVersion,'DIN 15905-5:2022-07');
  assert.equal(report.blocks[0].laeq,'97,3 dB');
  assert.equal(report.blocks[1].laeq,'Nicht ermittelt');
  assert.equal(report.blocks[1].lcpeak,'Nicht ermittelt');
});
test('Herkunft und Ursprungszeilen bleiben im gemeinsamen Modell',()=>{
  const report=makeReport();
  assert.match(report.blocks[0].source,/20-23/);
  assert.match(report.blocks[0].source,/LCpeak-Zeile: 23/);
  const allRows=report.sections.flatMap(x=>x.rows);
  assert.ok(allRows.some(x=>x.value==='XL3_Archiv.txt'));
  assert.ok(allRows.some(x=>x.value==='Geräteheader')===false); // values and source are separate
  assert.ok(allRows.some(x=>x.label==='Veranstaltung' && x.source==='Manuelle Angabe'));
  assert.ok(allRows.some(x=>x.label==='k1 – im Gerätelog angewandt?' && x.value.startsWith('Ja')));
  assert.ok(allRows.some(x=>x.label==='k2 – im Gerätelog angewandt?' && x.value.startsWith('Nein')));
});
test('Fehlende Pflichtfelder und Messdaten bleiben explizit sichtbar',()=>{
  const report=makeReport({form:{organisator:'',kalNachWert:''},model:null,evaluation:null});
  assert.equal(report.documentationComplete,false);
  assert.equal(report.evidenceComplete,false);
  assert.ok(report.issues.some(x=>x.code==='LOG_MISSING'));
  assert.ok(report.issues.some(x=>x.code==='FIELD_MISSING_OR_INVALID'));
  assert.equal(report.blocks.length,0);
  assert.ok(report.sections.flatMap(x=>x.rows).some(x=>x.label==='Nach der Messung – Anzeige' && x.value==='Nicht ermittelt'));
});
test('Bericht ist bei identischen Eingaben reproduzierbar',()=>{
  assert.deepEqual(makeReport(),makeReport());
});
test('0 dB Messwert ist nicht gleich fehlender Messwert',()=>{
  assert.equal(reportModule.db(0),'0,0 dB');
  assert.equal(reportModule.db(null),'Nicht ermittelt');
  assert.equal(reportModule.db(undefined),'Nicht ermittelt');
  assert.equal(reportModule.db(NaN),'Nicht ermittelt');
});
test('Rohdatenzeilen werden ohne Verlust zu Bereichen verdichtet',()=>{
  assert.equal(reportModule.fileLines([9,1,3,2,2,8,15]),'1-3, 8-9, 15');
  assert.equal(reportModule.fileLines([]),'Keine Zeilennachweise');
});
test('HTML-Bericht escaped Benutzereingaben und Warntexte',()=>{
  const r=makeReport({form:{eventName:'<img src=x onerror=alert(1)>'}});
  const html=reportModule.renderHtml(r);
  assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html,/<img src=x/);
  assert.match(html,/Nicht beurteilbar/i);
  assert.match(html,/100 Sekunden fehlen/);
  assert.match(html,/20-23/);
});
test('PDF enthält dieselben Abschnittswerte, Hinweise und Beurteilungszeiträume',()=>{
  const r=makeReport();
  const doc=pdf.create(r,FakePDF);
  const text=doc.output();
  for(const key of ['Testkonzert','Testveranstalter','NTI-01','97,3 dB','124,8 dB',
    'Nicht ermittelt','18:30:00','20-23','CAL-01','TIME_BASIS_UNVERIFIED'])
    assert.ok(text.includes(key), 'Fehlt im PDF: '+key);
  assert.match(text,/NICHT BEURTEILBAR/);
  assert.match(text,/nicht unterschrieben/);
  assert.doesNotMatch(text,/Grenzwert eingehalten/i);
  assert.equal(doc.props.author,'pegelTool '+r.toolVersion);
});
test('PDF-Aufbau verändert das gemeinsame Berichtsmodell nicht',()=>{
  const r=makeReport(), before=JSON.stringify(r);
  pdf.create(r,FakePDF);
  assert.equal(JSON.stringify(r),before);
});
test('Vollständige lange Blocktabelle erzeugt mehrere nummerierte PDF-Seiten',()=>{
  const r=makeReport();
  r.blocks=Array.from({length:120},(_,i)=>({...r.blocks[0],index:i+1}));
  const doc=pdf.create(r,FakePDF);
  const rendered=doc.output();
  assert.ok(doc.pages.length>3);
  assert.match(rendered,/Seite 1\//);
  assert.match(rendered,new RegExp('Seite '+doc.pages.length+'/'+doc.pages.length));
  assert.equal((rendered.match(/20-23/g)||[]).length>=120,true);
});
test('PDF-Eintrag für fehlende Werte wird nie implizit als 0,0 dB dargestellt',()=>{
  const r=makeReport({evaluation:{blocks:[incompleteBlock],overall:{laeqMaxDb:null,lcpeakMaxDb:null}}});
  assert.ok(!pdf.create(r,FakePDF).output().includes('0,0 dB'));
});
test('PDF-Renderer gibt bei unbrauchbaren Daten konkrete Fehler aus',()=>{
  assert.throws(()=>pdf.create(null,FakePDF),/Berichtsdaten/);
  assert.throws(()=>pdf.create(makeReport(),null),/jsPDF/);
});
test('Integration: ein Exportpfad, Bildschirmbericht, keine alten Generatoren',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../../../app/tools/pegelTool/index.html'),'utf8');
  assert.match(html,/file=report\/report\.js/);
  assert.match(html,/file=report\/pdf\.js/);
  assert.match(html,/id="reportPreviewContent"/);
  assert.match(html,/getPhase5Report\(\)/);
  assert.match(html,/renderReportPreview\(\)/);
  assert.match(html,/PegelToolReportPdf\.create|backend\.create\(report,JsPdf\)/);
  assert.match(html,/triggerDownload\(blob,filename,false\)/);
  assert.doesNotMatch(html,/function generateLegacyPDF/);
  assert.doesNotMatch(html,/function generateTemplatePDF/);
  assert.doesNotMatch(html,/id="btnPdf"/);
});
