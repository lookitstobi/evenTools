'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const protocol=require('../../../app/tools/pegelTool/protocol/protocol.js');
const form={
  eventName:'Probe',datumMessung:'2026-11-16',organisator:'Testveranstalter / Anschrift',
  location:'Eigene Angabe',ortAdresse:'Musterstraße 1, 45127 Essen',
  messungVon:'Messperson',messposition:'FOH',messort:'Publikum Mitte',
  messortTyp:'direkt',kalibratorModell:'Kalibrator Typ X',kalibratorSN:'CAL123',
  kalVorBestaetigt:'ja',kalNachBestaetigt:'ja',paAnordnung:'Haupt-PA L/R',
  berichtName:'Testperson',berichtDatum:'2026-11-16',berichtsort:'Essen'
};
const model={
  schemaVersion:1,
  samples:[{values:{laeqDt:95,lcpeak:120},date:'20261116',time:'180001'}],
  instrument:{deviceModel:'XL3',serial:'TEST-1',microphone:{type:'M2230',serial:'M-1'}},
  measurement:{start:'2026-11-16 18:00',end:'2026-11-16 20:00',timeZone:'Europe/Berlin'},
  quality:{status:'usable'},
  columns:{laeqDt:{correctionApplied:true,column:'LAeq_dt+k1'},
    lcpeak:{correctionApplied:false,column:'LCpeak'}},
  corrections:{k1:{valueDb:0,valueSource:'device-header'},k2:{valueDb:0,valueSource:'device-header'}}
};
const evaluation={
  blocks:[{start:'2026-11-16T18:00',end:'2026-11-16T18:30',dataQuality:'complete',
    laeq30Db:95,lcpeakMaxDb:120}],
  overall:{measurementStatus:'within-limits',normativeStatus:'not-assessable',totalBlocks:1},
  assumptions:{timestampAnchorEvidence:'verified'}
};
const paItems=[{type:'custom',customType:'Musterlautsprecher',qty:2}];
function input(change={}){
  return {form:{...form,...(change.form||{})},origins:change.origins||{},
    paItems:change.paItems===undefined?paItems:change.paItems,
    paSelectionIssues:change.paSelectionIssues||[],
    legacyProtocol:change.legacyProtocol||{},
    importModel:change.importModel===undefined?model:change.importModel,
    evaluation:change.evaluation===undefined?evaluation:change.evaluation};
}
function hasIssue(list,code){return list.some(x=>x.code===code);}
test('Sollformular enthaelt ein gemeinsames Immissionsortfeld und zwei Checkboxen',()=>{
  const ids=protocol.FIELD_IDS;
  for(const id of ['messort','kalVorBestaetigt','kalNachBestaetigt','paZusatz'])assert.ok(ids.includes(id));
  for(const id of ['messortLAeq','messortLCpeak','kalVorZeit','kalVorWert','kalNachZeit',
    'kalNachWert','ortBestaetigt','paBestaetigt','k1Ermittlung','k2Ermittlung',
    'abweichungVorhanden','altBestaetigt','veranstaltungsBeginn','veranstaltungsEnde','lautestePosition'])
    assert.ok(!ids.includes(id),id+' darf nicht als Eingabefeld zurueckkehren');
});
test('Abgelegtes Alt-Feld lautestePosition wird nicht in Werte oder Immissionsort uebernommen',()=>{
  const record=protocol.buildRecord(input({form:{lautestePosition:'Altes Feld aus Projekt'}}));
  assert.equal(record.values.messort,'Publikum Mitte');
  assert.ok(!Object.prototype.hasOwnProperty.call(record.values,'lautestePosition'));
});
test('Vollstaendige Eingaben koennen ohne Anzeige-Nachweise nicht als voll geprueft gelten',()=>{
  const r=protocol.validate(input());
  assert.equal(r.documentationComplete,true);
  assert.equal(r.evidenceComplete,false);
  assert.equal(r.reportFullyChecked,false);
  assert.ok(hasIssue(r.evidenceIssues,'CALIBRATION_VOR_EVIDENCE_MISSING'));
  assert.ok(hasIssue(r.evidenceIssues,'CALIBRATION_NACH_EVIDENCE_MISSING'));
});
test('Beide Bestätigungen sind Pflicht, keine Daten werden erraten',()=>{
  const r=protocol.validate(input({form:{kalVorBestaetigt:'',kalNachBestaetigt:'nein',messort:''}}));
  assert.equal(r.documentationComplete,false);
  for(const id of ['kalVorBestaetigt','kalNachBestaetigt','messort'])
    assert.ok(r.formIssues.some(x=>x.field===id));
});
test('Alte Funktionspruefungsbelege bleiben als gesonderte Originalangaben nutzbar',()=>{
  const legacy={kalVorZeit:'2026-11-16T17:59',kalVorWert:'94,0',
    kalNachZeit:'2026-11-16T20:30',kalNachWert:'94.1'};
  const r=protocol.validate(input({legacyProtocol:legacy}));
  assert.equal(r.documentationComplete,true);
  assert.equal(r.evidenceComplete,true);
  assert.equal(r.reportFullyChecked,true);
  const record=protocol.buildRecord(input({legacyProtocol:legacy}));
  assert.equal(record.calibration.before.confirmed,true);
  assert.equal(record.calibration.before.displayedDb,94);
  assert.equal(record.calibration.after.displayedDb,94.1);
  assert.equal(record.calibration.before.at,'2026-11-16T17:59');
  assert.deepEqual(record.legacyProtocol,legacy);
});
test('Unterschiedliche Alt-Immissionsorte bleiben erkennbar',()=>{
  const legacy={messortLAeq:'Reihe 1',messortLCpeak:'Balkon'};
  const r=protocol.validate(input({legacyProtocol:legacy}));
  assert.equal(r.evidenceComplete,false);
  assert.ok(hasIssue(r.evidenceIssues,'LEGACY_ASSESSMENT_PLACES_DIFFER'));
  const record=protocol.buildRecord(input({legacyProtocol:legacy}));
  assert.equal(record.places.assessment,'Publikum Mitte');
  assert.equal(record.places.legacyAssessmentLAeq,'Reihe 1');
  assert.equal(record.places.legacyAssessmentLCpeak,'Balkon');
});
test('Ersatzmessort verwendet die Messposition und darf nicht identisch zum Immissionsort sein',()=>{
  const r=protocol.validate(input({form:{messortTyp:'ersatz',ersatzMessort:'',messposition:'Publikum Mitte'}}));
  assert.ok(!r.formIssues.some(x=>x.field==='ersatzMessort'));
  const data=input({form:{messortTyp:'ersatz',messposition:'FOH',ersatzMessort:''}});
  assert.equal(protocol.buildRecord(data).places.substitute,'FOH');
  assert.ok(!protocol.FIELD_IDS.includes('ersatzMessort'));
  assert.ok(hasIssue(r.formIssues,'REPLACEMENT_UNCLEAR'));
});
test('Eigene Veranstaltungsorte akzeptieren ausschließlich den textlich beschriebenen PA-Sonderaufbau',()=>{
  const r=protocol.validate(input({paItems:[],form:{paZusatz:'2 x geflogene Lautsprecher, 1 Sub'}}));
  assert.ok(!hasIssue(r.formIssues,'PA_NOT_DOCUMENTED'));
  const empty=protocol.validate(input({paItems:[],form:{paZusatz:''}}));
  assert.ok(hasIssue(empty.formIssues,'PA_NOT_DOCUMENTED'));
});
test('Nicht aufgelöste Sidefill-Varianten bleiben Fehler',()=>{
  const r=protocol.validate(input({paSelectionIssues:['Sidefill links: Variante fehlt']}));
  assert.ok(hasIssue(r.formIssues,'PA_GROUP_QUANTITY_MISSING'));
});
test('Korrekturen bleiben einmalig, ungeklaerte Herkunft bleibt als Nachweisproblem',()=>{
  const imported=structuredClone(model);
  imported.corrections.k1.valueDb=-11.7;
  imported.corrections.k2.valueDb=-8.1;
  const r=protocol.validate(input({form:{messortTyp:'ersatz',ersatzMessort:'FOH'},
    importModel:imported}));
  assert.ok(hasIssue(r.evidenceIssues,'CORRECTION_METHOD_NOT_DOCUMENTED'));
  const withEvidence=protocol.validate(input({form:{messortTyp:'ersatz',ersatzMessort:'FOH'},
    importModel:imported,legacyProtocol:{k1Ermittlung:'Vergleichsmessung',k2Ermittlung:'Vergleichsmessung'}}));
  assert.ok(!hasIssue(withEvidence.evidenceIssues,'CORRECTION_METHOD_NOT_DOCUMENTED'));
});
test('Geräte- und Importfehler bleiben unabhaengig von UI-Feldern beurteilungsrelevant',()=>{
  const r=protocol.validate(input({importModel:null,evaluation:null}));
  assert.equal(r.evidenceComplete,false);
  assert.ok(hasIssue(r.evidenceIssues,'LOG_MISSING'));
  assert.ok(hasIssue(r.evidenceIssues,'METER_MISSING'));
});
test('Ungültiges Datum und defekte PA-Positionen werden abgelehnt',()=>{
  const r=protocol.validate(input({form:{datumMessung:'2026-02-30'},
    paItems:[{type:'custom',customType:'',qty:0}]}));
  assert.ok(r.formIssues.some(x=>x.field==='datumMessung'));
  assert.ok(hasIssue(r.formIssues,'PA_NOT_DOCUMENTED'));
});
