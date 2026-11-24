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
  location:'Eigene Angabe',ortAdresse:'Teststraße 3, 45127 Essen',
  messungVon:'Testteam',messposition:'FOH',messort:'Publikum Mitte',
  messortTyp:'ersatz',ersatzMessort:'FOH',paAnordnung:'2 Hauptlautsprecher links/rechts',
  paZusatz:'1 Zusatzlautsprecher',
  kalibratorModell:'Testkalibrator',kalibratorSN:'CAL-01',
  kalVorBestaetigt:'ja',kalNachBestaetigt:'ja',
  berichtName:'Testperson',berichtDatum:'2026-11-16',berichtsort:'Essen'
};
const oldProof={
  kalVorZeit:'2026-11-16T18:00',kalVorWert:'94,0',
  kalNachZeit:'2026-11-16T20:00',kalNachWert:'94,1',
  k1Ermittlung:'Vergleichsmessung',k2Ermittlung:'Referenzmessung'
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
    paItems:changes.paItems || [{type:'custom',customType:'Musterlautsprecher',qty:2}],
    paGroups:changes.paGroups || [],
    legacyProtocol:changes.legacyProtocol===undefined?oldProof:changes.legacyProtocol,
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
  rect(){return this;}roundedRect(){return this;}circle(){return this;}line(){return this;}
  setLineWidth(){return this;}setLineDashPattern(){return this;}
  getTextWidth(value){return String(value).length*1.25;}
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
  text(value,x,y){assert.ok(y<292, 'PDF-Text außerhalb des A4-Seitenbereichs');this.pages[this.current].push(String(value));return this;}
  addPage(){this.pages.push([]);this.current=this.pages.length-1;return this;}
  setPage(number){this.current=number-1;return this;}
  output(){return this.pages.map(p=>p.join('\n')).join('\n===NEW PAGE===\n');}
}

test('PDF-Berichtsmodell nennt nur ausgewählte Lautsprechergruppen und ihre Mengen',()=>{
  const groups=[
    {id:'main',label:'Main PA L/R – 2 × 12 Kara II',
      items:[{type:'L-ACOUSTIC KARA II',qty:24}],unresolved:[]},
    {id:'ff19',label:'Frontfill 1 + 9',
      items:[{type:'L-ACOUSTIC 5XT',qty:2}],unresolved:[]}
  ];
  const report=makeReport({
    paGroups:groups,
    paItems:[{type:'L-ACOUSTIC KARA II',qty:24},{type:'L-ACOUSTIC 5XT',qty:2}]
  });
  const pa=report.sections.flatMap(section=>section.rows).find(row=>row.label==='Ausgewählte Lautsprechergruppen');
  assert.match(pa.value,/Main PA L\/R/);
  assert.match(pa.value,/Frontfill 1 \+ 9/);
  assert.match(pa.value,/24 × L-ACOUSTIC KARA II/);
  assert.match(pa.value,/2 × L-ACOUSTIC 5XT/);
  assert.doesNotMatch(pa.value,/KS21/);
});
test('Bericht zeigt gemeinsame Messstelle und Sonderaufbau ohne gestrichene UI-Fragen',()=>{
  const rows=makeReport().sections.flatMap(x=>x.rows);
  assert.ok(rows.some(x=>x.label==='Maßgeblicher Immissionsort' && x.value==='Publikum Mitte'));
  assert.ok(rows.some(x=>x.label==='Zusätzliche Lautsprecher / Sonderaufbau' && x.value==='1 Zusatzlautsprecher'));
  assert.ok(rows.some(x=>x.label==='Funktionsprüfung vor Messung' && x.value==='Bestätigt'));
  assert.equal(rows.some(x=>x.label==='Ort vor Ort geprüft'),false);
  assert.equal(rows.some(x=>x.label==='PA-Aufstellung geprüft'),false);
  assert.equal(rows.some(x=>x.label==='Abweichungen'),false);
  assert.equal(rows.some(x=>x.label==='Veranstaltungsbeginn'),false);
});
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
  const report=makeReport({form:{organisator:'',kalNachBestaetigt:''},model:null,evaluation:null});
  assert.equal(report.documentationComplete,false);
  assert.equal(report.evidenceComplete,false);
  assert.ok(report.issues.some(x=>x.code==='LOG_MISSING'));
  assert.ok(report.issues.some(x=>x.code==='FIELD_MISSING_OR_INVALID'));
  assert.equal(report.blocks.length,0);
  assert.ok(report.sections.flatMap(x=>x.rows).some(x=>x.label==='Funktionsprüfung nach Messung' && x.value==='Nicht bestätigt'));
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
test('Kompaktes PDF enthält zwei Seiten, Messwerte, Diagramme und aktuelle Preview-Felder',()=>{
  const r=makeReport();
  const doc=pdf.create(r,FakePDF,{chartSamples:[{time:'18:00:00',LAeq_g30:85,LC:110},{time:'18:30:00',LAeq_g30:86,LC:125}]});
  const text=doc.output().replace(/\r?\n/g,'');
  for(const key of ['Testkonzert','Testveranstalter','NTI-01','97,25','124,8','CAL-01','01  Pegelverlauf','02  Spitzenpegel','XL3_Archiv.txt','Publikum Mitte','Bestätigt','Digitale Signatur','Schallpegel-Messprotokoll','Veranstaltung und Messorte','Beschallungsanlage','Messsystem','Protokollabschluss','Musterlautsprecher','1 Zusatzlautsprecher'])
    assert.ok(text.includes(key),'Fehlt im PDF: '+key);
  assert.equal(doc.pages.length,2);
  assert.match(text,/Keine Grenzwertüberschreitung in den auswertbaren Messwerten/);
  assert.match(text,/keine DIN-Konformitätsbescheinigung/i);
  assert.equal(doc.props.author,'pegelTool '+r.toolVersion);
});
test('Kompaktes PDF zeigt Teilzeit und LCpeak-Überschreitung auch im Randblock',()=>{
  const r=makeReport({evaluation:{...evaluation,blocks:[{...incompleteBlock,dataCoverageState:'partial-edge',laeqPartialDb:95,lcpeakObservedDb:137}]}});
  const text=pdf.create(r,FakePDF).output();
  assert.match(text,/95,0\*/);
  assert.match(text,/137,0/);
  assert.match(text,/Grenzwert in erfassten Daten überschritten/);
});
test('Fehlender LCpeak ergibt keine grüne Gesamtentwarnung',()=>{
  const r=makeReport({evaluation:{...evaluation,blocks:[{...completeBlock,dataQuality:'incomplete',lcpeakMaxDb:null}]}});
  const text=pdf.create(r,FakePDF).output();
  assert.match(text,/Nur teilweise auswertbar/);
  assert.doesNotMatch(text,/Keine Grenzwertüberschreitung in den auswertbaren Messwerten/);
});
test('PDF-Aufbau verändert das gemeinsame Berichtsmodell nicht',()=>{
  const r=makeReport(), before=JSON.stringify(r);
  pdf.create(r,FakePDF);
  assert.equal(JSON.stringify(r),before);
});
test('Lange Messungen bleiben auf zwei Seiten und Tabellenkürzung ist sichtbar',()=>{
  const r=makeReport();
  r.blocks=Array.from({length:120},(_,i)=>({...r.blocks[0],index:i+1}));
  const doc=pdf.create(r,FakePDF);
  assert.equal(doc.pages.length,2);
  assert.match(doc.output(),/Auswahl von 12 \/ 120/);
  assert.match(doc.output(),/Seite 1 \/ 2/);
  assert.match(doc.output(),/Seite 2 \/ 2/);
});
test('Lange Rohdatenreferenzen blähen die kompakte Druckansicht nicht auf',()=>{
  const r=makeReport();
  r.blocks=[{...r.blocks[0],source:Array.from({length:950},(_,i)=>String(i+1)).join(', ')}];
  const doc=pdf.create(r,FakePDF);
  assert.equal(doc.pages.length,2);
  assert.match(doc.output(),/Original-Log separat archivieren/);
});
test('PDF-Eintrag für fehlende Werte wird nie implizit als 0,0 dB dargestellt',()=>{
  const r=makeReport({evaluation:{blocks:[incompleteBlock],overall:{laeqMaxDb:null,lcpeakMaxDb:null}}});
  assert.ok(!pdf.create(r,FakePDF).output().includes('0,0 dB'));
});
test('PDF-Renderer gibt bei unbrauchbaren Daten konkrete Fehler aus',()=>{
  assert.throws(()=>pdf.create(null,FakePDF),/Berichtsdaten/);
  assert.throws(()=>pdf.create(makeReport(),null),/jsPDF/);
});

test('Echter lokaler jsPDF-Export erzeugt zwei signierbare PDF-Seiten',async()=>{
  const {jsPDF}=require('../../../app/tools/pegelTool/vendor/jspdf.umd.min.js');
  assert.equal(typeof jsPDF,'function');
  const report=makeReport();
  report.blocks=Array.from({length:45},(_,i)=>({...report.blocks[i%2],index:i+1}));
  const doc=pdf.create(report,jsPDF);
  assert.equal(doc.internal.getNumberOfPages(),2);
  const bytes=Buffer.from(doc.output('arraybuffer'));
  assert.equal(bytes.subarray(0,5).toString('ascii'),'%PDF-');
  assert.ok(bytes.length>1000);
  assert.ok(bytes.toString('latin1').includes('%%EOF'));
  const lib=require('../../../app/tools/pegelTool/vendor/pdf-lib.min.js');
  const signedReady=await pdf.withSignature(doc,lib);
  const parsed=await lib.PDFDocument.load(signedReady);
  const signature=parsed.getForm().getSignature('Digitale_Signatur');
  assert.equal(parsed.getPageCount(),2);
  assert.equal(signature.getName(),'Digitale_Signatur');
  assert.equal(signature.acroField.getWidgets().length,1);
});

test('Integration: ein Exportpfad, Bildschirmbericht, keine alten Generatoren',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../../../app/tools/pegelTool/index.html'),'utf8');
  assert.match(html,/file=report\/report\.js/);
  assert.match(html,/file=report\/pdf\.js/);
  assert.match(html,/id="reportPreviewContent"/);
  assert.match(html,/getPhase5Report\(\)/);
  assert.match(html,/renderReportPreview\(\)/);
  assert.match(html,/backend\.create\(report,JsPdf,\{chartSamples\}\)/);
  assert.match(html,/triggerDownload\(blob,filename,false\)/);
  assert.doesNotMatch(html,/function generateLegacyPDF/);
  assert.doesNotMatch(html,/function generateTemplatePDF/);
  assert.doesNotMatch(html,/id="btnPdf"/);
});


test('PDF project attachment: lossless roundtrip, opt-out, signature and invalid JSON',async()=>{
  const lib=require('../../../app/tools/pegelTool/vendor/pdf-lib.min.js');
  const pdfModule=require('../../../app/tools/pegelTool/report/pdf.js');
  const createBase=async()=>{
    const pdf=await lib.PDFDocument.create();
    pdf.addPage();pdf.addPage();
    const bytes=await pdf.save();
    return {output:()=>bytes};
  };
  const project={sourceApp:'pegelTool',schemaVersion:2,form:{eventName:'Grüße 🎵'},
    logLoaded:true,samples:[{level:99.1}],logText:'Original\r\nÖ'};
  const bytes=await pdfModule.withSignature(await createBase(),lib,project);
  assert.deepEqual(await pdfModule.extractProject(bytes,lib),project);
  const signedReady=await lib.PDFDocument.load(bytes);
  assert.ok(signedReady.getForm().getFields().some(f=>f.getName()==='Digitale_Signatur'));
  const plain=await pdfModule.withSignature(await createBase(),lib);
  await assert.rejects(pdfModule.extractProject(plain,lib),/keine eingebettete/);
  const invalid=await lib.PDFDocument.create();invalid.addPage();
  await invalid.attach(new TextEncoder().encode('not json'),'pegelTool.project.json',{mimeType:'application/json'});
  await assert.rejects(pdfModule.extractProject(await invalid.save(),lib),/gültiges UTF-8-JSON/);
  const wrong=await pdfModule.withSignature(await createBase(),lib,{...project,sourceApp:'other'});
  await assert.rejects(pdfModule.extractProject(wrong,lib),/Kein vollständiger/);
});
