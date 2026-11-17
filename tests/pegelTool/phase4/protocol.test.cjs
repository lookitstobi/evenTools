'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const protocol=require('../../../app/tools/pegelTool/protocol/protocol.js');

const completeForm={
  eventName:'Probe', datumMessung:'2026-11-16', organisator:'Testveranstalter / Anschrift',
  location:'Eigene Angabe', ortAdresse:'Musterstraße 1, 45127 Essen',
  ortBestaetigt:'ja', messungVon:'Messperson / Auftraggeber',
  messposition:'FOH', messortLAeq:'Bühnenrand, Mitte', messortLCpeak:'Bühnenrand, links',
  messortTyp:'direkt', kalibratorModell:'Kalibrator Typ X', kalibratorSN:'CAL123',
  kalVorZeit:'2026-11-16T18:00', kalVorWert:'94,0',
  kalNachZeit:'2026-11-16T20:30', kalNachWert:'94.1',
  paAnordnung:'Haupt-PA L/R; Fills an Bühnenkante',
  paBestaetigt:'ja', abweichungVorhanden:'nein',
  berichtName:'Testperson', berichtDatum:'2026-11-16', berichtsort:'Essen'
};
const model={
  schemaVersion:1,
  samples:[{values:{laeqDt:95,lcpeak:120}, date:'20261116', time:'180001'}],
  instrument:{deviceModel:'XL3',serial:'TEST-1',microphone:{type:'M2230',serial:'M-1'}},
  measurement:{start:'2026-11-16 18:00',end:'2026-11-16 20:00',timeZone:'Europe/Berlin'},
  calibration:{status:'verified'},
  quality:{status:'usable'},
  columns:{
    laeqDt:{correctionApplied:true, column:'LAeq_dt+k1'},
    lcpeak:{correctionApplied:false,column:'LCpeak'}
  },
  corrections:{k1:{valueDb:0,valueSource:'device-header'},k2:{valueDb:0,valueSource:'device-header'}}
};
const evaluation={
  blocks:[{start:'2026-11-16T18:00',end:'2026-11-16T18:30',dataQuality:'complete',
    laeq30Db:95,lcpeakMaxDb:120}],
  overall:{normativeStatus:'not-assessable',totalBlocks:1},
  assumptions:{timestampAnchorEvidence:'verified'}
};
const paItems=[{type:'custom',customType:'Musterlautsprecher',qty:2}];
function input(changes={}) {
  return {form:{...completeForm,...(changes.form || {})},
    origins:{...(changes.origins||{})},paItems:changes.paItems===undefined?paItems:changes.paItems,
    paSelectionIssues:changes.paSelectionIssues||[],paGroups:changes.paGroups||[],
    importModel:changes.importModel===undefined?model:changes.importModel,
    evaluation:changes.evaluation===undefined?evaluation:changes.evaluation};
}
function hasIssue(arr,code){return arr.some(v=>v.code===code);}

test('Pflichtfelder sauber erfasst, aber nie normative Freigabe ohne Originalnorm',()=>{
  const r=protocol.validate(input());
  assert.equal(r.documentationComplete,true);
  assert.equal(r.evidenceComplete,true);
  assert.equal(r.reportFullyChecked,false);
  assert.equal(r.normativeStatus,'not-assessable');
  assert.equal(r.status,'Angaben vollständig erfasst');
});
test('Fehlende Pflichteingaben und Kennzeichnung bleiben sichtbar',()=>{
  const r=protocol.validate(input({form:{eventName:'',messortLCpeak:'',ortBestaetigt:''}}));
  assert.equal(r.documentationComplete,false);
  for(const id of ['eventName','messortLCpeak','ortBestaetigt']){
    assert.ok(r.formIssues.some(x=>x.field===id));
  }
  assert.equal(r.fields.find(x=>x.id==='eventName').category,'pflicht');
  assert.equal(r.fields.find(x=>x.id==='ersatzMessort').required,false);
});
test('Ersatzmessort aktiviert bedingte Nachweise inklusive k1 und k2',()=>{
  const r=protocol.validate(input({form:{messortTyp:'ersatz'}}));
  for(const id of ['ersatzMessort','k1Ermittlung','k2Ermittlung']) assert.ok(r.formIssues.some(x=>x.field===id));
  assert.equal(r.fields.find(x=>x.id==='k1Ermittlung').required,true);
});
test('Ersatzmessort: Korrekturspaltenherkunft und Gerätewerte müssen gesichert sein',()=>{
  const incomplete=structuredClone(model);
  incomplete.columns.lcpeak.correctionApplied=null;
  incomplete.corrections.k1.valueDb=null;
  const r=protocol.validate(input({form:{messortTyp:'ersatz',ersatzMessort:'Erhöhter FOH',
    k1Ermittlung:'Vergleichsmessung mit Referenz',k2Ermittlung:'Messortvergleich'},
    importModel:incomplete}));
  assert.ok(hasIssue(r.evidenceIssues,'CORRECTION_UNRESOLVED'));
  assert.equal(r.reportFullyChecked,false);
});
test('Abweichungen nur bei Ja erläuterungspflichtig',()=>{
  const r=protocol.validate(input({form:{abweichungVorhanden:'ja',abweichungBeschreibung:''}}));
  assert.ok(r.formIssues.some(x=>x.field==='abweichungBeschreibung'));
});
test('Altprojekt-Angaben erfordern aktive Bestätigung',()=>{
  const r=protocol.validate(input({origins:{organisator:'legacy-unverified'}}));
  assert.ok(r.formIssues.some(x=>x.field==='altBestaetigt'));
  assert.equal(protocol.validate(input({origins:{organisator:'legacy-unverified'},
    form:{altBestaetigt:'ja'}})).documentationComplete,true);
});
test('Selektierte PA-Gruppen brauchen ihre tatsächlich bekannten Stückzahlen',()=>{
  const noCounts=protocol.validate(input({
    paSelectionIssues:['Main PA: A10 Focus · Anzahl fehlt.'],
    paItems:[{type:'L-ACOUSTIC KS21',qty:4}]
  }));
  assert.ok(hasIssue(noCounts.formIssues,'PA_GROUP_QUANTITY_MISSING'));
  assert.equal(noCounts.documentationComplete,false);
  const groups=[{id:'center',label:'Center – 8 Kara II',
    items:[{type:'L-ACOUSTIC KARA II',qty:8}],unresolved:[]}];
  const record=protocol.buildRecord(input({paSelectionIssues:[],paGroups:groups,
    paItems:[{type:'L-ACOUSTIC KARA II',qty:8}]}));
  assert.equal(record.paGroups.length,1);
  assert.equal(record.paGroups[0].items[0].qty,8);
  assert.equal(record.review.documentationComplete,true);
});
test('Keine pauschalen PA-Presets als Nachweise, keine ungültigen Mengen',()=>{
  const r=protocol.validate(input({form:{paBestaetigt:''},paItems:[{type:'custom',customType:'',qty:0}]}));
  assert.ok(r.formIssues.some(x=>x.field==='paBestaetigt'));
  assert.ok(hasIssue(r.formIssues,'PA_NOT_DOCUMENTED'));
});
test('Kalibratorwerte numerisch mit Dezimalpunkt/komma, fehlend nicht zu Null',()=>{
  assert.equal(protocol.number('94,1'),94.1);
  assert.equal(protocol.number(''),null);
  assert.equal(protocol.number('NaN'),null);
  assert.equal(protocol.number('93,5,5'),null);
  assert.equal(protocol.validate(input({form:{kalNachWert:'abc'}})).documentationComplete,false);
});
test('Technische Unvollständigkeit und fehlende Rohdaten sperren den Belegstatus',()=>{
  const r=protocol.validate(input({importModel:null,evaluation:null}));
  assert.equal(r.documentationComplete,true);
  assert.equal(r.evidenceComplete,false);
  assert.ok(hasIssue(r.evidenceIssues,'LOG_MISSING'));
  assert.ok(hasIssue(r.evidenceIssues,'BLOCKS_MISSING'));
});
test('Direktmessung mit nichtnull-Korrektur wird ausdrücklich geklärt',()=>{
  const corrected=structuredClone(model);
  corrected.corrections.k1.valueDb=1.4;
  corrected.corrections.k2.valueDb=-1.0;
  const r=protocol.validate(input({importModel:corrected}));
  assert.ok(r.formIssues.some(x=>x.field==='k1Ermittlung'));
  assert.ok(r.formIssues.some(x=>x.field==='k2Ermittlung'));
  assert.ok(hasIssue(r.evidenceIssues,'DIRECT_CORRECTION_CONFLICT'));
});
test('Zeitpunkt und Reihenfolge der Kalibrierung werden geprüft',()=>{
  const r=protocol.validate(input({form:{kalVorZeit:'2026-02-30T18:00',
    kalNachZeit:'2026-11-16T13:00',datumMessung:'2026-13-16'}}));
  assert.ok(r.formIssues.some(x=>x.field==='kalVorZeit'));
  assert.ok(r.formIssues.some(x=>x.field==='datumMessung'));
  const reversed=protocol.validate(input({form:{kalVorZeit:'2026-11-16T20:00',
    kalNachZeit:'2026-11-16T19:00'}}));
  assert.ok(hasIssue(reversed.formIssues,'CALIBRATION_TIME_ORDER'));
});
test('Lückenhafte Bewertungsblöcke sind keine gültigen Prüfnachweise',()=>{
  const r=protocol.validate(input({evaluation:{...evaluation,
    blocks:[{...evaluation.blocks[0],dataQuality:'incomplete'}]}}));
  assert.ok(hasIssue(r.evidenceIssues,'BLOCKS_INCOMPLETE'));
});
test('Berichtsdatenmodell erhält Quellen, Blöcke, getrennte Orte und Korrekturen',()=>{
  const record=protocol.buildRecord(input({origins:{datumMessung:'device-header'}}));
  assert.equal(record.schemaVersion,1);
  assert.equal(record.origins.datumMessung,'device-header');
  assert.equal(record.places.assessmentLAeq,completeForm.messortLAeq);
  assert.equal(record.places.assessmentLCpeak,completeForm.messortLCpeak);
  assert.equal(record.corrections.k1.device.valueDb,0);
  assert.equal(record.calibration.before.displayedDb,94);
  assert.equal(record.calibration.after.displayedDb,94.1);
  assert.equal(record.assessment.periods.length,1);
  assert.equal(record.review.reportFullyChecked,false);
});
test('Integration: neue Formularfelder, Quelle, Speicherstatus und gesperrter PDF-Pfad',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../../../app/tools/pegelTool/index.html'),'utf8');
  assert.match(html,/file=protocol\/protocol\.js/);
  for(const id of ['ortBestaetigt','paBestaetigt','kalVorZeit','kalVorWert',
    'kalNachZeit','kalNachWert','messortLAeq','messortLCpeak','messortTyp',
    'ersatzMessort','k1Ermittlung','k2Ermittlung'])
    assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(html,/protocolMeta: \{ schemaVersion: 1, origins:/);
  assert.match(html,/getProtocolReportData\(\)/);
  assert.match(html,/setPdfButtonsDisabled\(true\)/);
  assert.doesNotMatch(html,/<input id="kalibratorModell" value=/);
  assert.doesNotMatch(html,/<input id="umwelt" value=/);
  assert.doesNotMatch(html,/Geschäftsführer: Fritz/);
});

test('Unverifizierte Gerätezusammenfassung blockiert korrekte Zeitintervalle nicht',()=>{
  const m=structuredClone(model);
  m.quality={status:'restricted',errors:[],warnings:[{code:'SUMMARY_LAYOUT_UNVERIFIED',message:'Summary nicht zuordenbar'}]};
  const result=protocol.validate(input({importModel:m}));
  assert.equal(result.evidenceComplete,true);
  assert.ok(!hasIssue(result.evidenceIssues,'IMPORT_QUALITY'));
});
