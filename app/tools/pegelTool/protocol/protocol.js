/* Phase 4: protocol data and completeness checks. No DIN conformity decision.
 * Pending: original DIN 15905-5:2022-07 section 5.6 cross-check.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PegelToolProtocol = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 1;
  const FIELD_RULES = Object.freeze([
    ['eventName','Veranstaltungsname','pflicht'],
    ['datumMessung','Messdatum','pflicht'],
    ['organisator','Veranstalter / Organisation','pflicht'],
    ['location','Veranstaltungsort','pflicht'],
    ['ortAdresse','Anschrift des Veranstaltungsorts','pflicht'],
    ['messungVon','Messperson / Firma','pflicht'],
    ['messposition','Tatsächlicher Messort','pflicht'],
    ['messort','Maßgeblicher Immissionsort','pflicht'],
    ['messortTyp','Messung am Immissionsort oder Ersatzmessort','pflicht'],
    ['kalibratorModell','Kalibrator-Typ','pflicht'],
    ['kalibratorSN','Kalibrator-Seriennummer','pflicht'],
    ['kalVorBestaetigt','Funktionsprüfung vor der Messung durchgeführt','pflicht'],
    ['kalNachBestaetigt','Funktionsprüfung nach der Messung durchgeführt','pflicht'],
    ['berichtName','Protokollverfasser','pflicht'],
    ['berichtDatum','Datum der Protokollerstellung','pflicht'],
    ['berichtsort','Ort der Protokollerstellung','pflicht'],
    ['ersatzMessort','Beschreibung Ersatzmessort','bedingt'],
    ['paAnordnung','Aufstellung der Beschallungsanlage','optional'],
    ['paZusatz','Zusätzliche Lautsprecher / Sonderaufbau','optional'],
    ['abweichungBeschreibung','Abweichungen / besondere Ereignisse','optional'],
    ['beschreibung','Beschreibung der Veranstaltung','optional'],
    ['umwelt','Umgebungsbedingungen','optional'],
    ['foh','FOH-Techniker','optional'],
    ['lautestePosition','Lauteste Position (Altfeld)','optional']
  ].map(function (d) {return Object.freeze({id:d[0], label:d[1], category:d[2]});}));

  const FIELD_IDS = Object.freeze(FIELD_RULES.map(function (d) {return d.id;}));
  const trim = function (v) {return (v === undefined || v === null ? '' : String(v)).trim();};
  const number = function (v) {
    const s=trim(v);
    if (!s || !/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(s)) return null;
    const n=Number(s.replace(',','.'));
    return Number.isFinite(n) ? n : null;
  };
  const validDate = function (v) {
    const s=trim(v);
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s)) return false;
    const d=new Date(s+'T12:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10)===s;
  };
  const validDateTime = function (v) {
    const s=trim(v);
    const m=/^([0-9]{4}-[0-9]{2}-[0-9]{2})T([0-9]{2}):([0-9]{2})(?::([0-9]{2}))?$/.exec(s);
    return !!m && validDate(m[1]) && Number(m[2])<24 && Number(m[3])<60 &&
      (m[4]===undefined || Number(m[4])<60);
  };
  const condition = function (rule, form) {
    if(rule.id === 'ersatzMessort') return trim(form.messortTyp)==='ersatz';
    return rule.category === 'pflicht';
  };
  const issue = function (code, message, field) {return {code:code, message:message, field:field || null};};
  function validate(data) {
    const form=data && data.form || {};
    const origins=data && data.origins || {};
    const model=data && data.importModel || null;
    const legacy=data && data.legacyProtocol || {};
    const evaluation=data && data.evaluation || null;
    const pa=Array.isArray(data && data.paItems) ? data.paItems : [];
    const fields=[];
    const formIssues=[];
    FIELD_RULES.forEach(function (rule) {
      const required=condition(rule, form);
      const value=trim(form[rule.id]);
      const active=rule.category !== 'bedingt' || required;
      let valid=!required || value.length>0;
      if (required && ['kalVorBestaetigt','kalNachBestaetigt'].includes(rule.id)) valid=value === 'ja';
      if (required && rule.id === 'messortTyp') valid=['direkt','ersatz'].includes(value);
      if (required && ['datumMessung','berichtDatum'].includes(rule.id)) valid=validDate(value);
      if (required && rule.id === 'ortAdresse' && value.length<6) valid=false;
      if (required && rule.id === 'location' && value === 'Eigene Angabe' && !trim(form.ortAdresse)) valid=false;
      if (required && !valid) formIssues.push(issue('FIELD_MISSING_OR_INVALID', rule.label+' fehlt oder ist unplausibel.',rule.id));
      fields.push({id:rule.id, category:rule.category, active:active, required:required, valid:valid,
        origin:trim(origins[rule.id]) || 'unbekannt'});
    });
    if (trim(form.messortTyp)==='ersatz' && trim(form.messposition)===trim(form.messort) &&
        trim(form.messort)) {
      formIssues.push(issue('REPLACEMENT_UNCLEAR',
        'Ersatzmessort und maßgeblicher Immissionsort müssen nachvollziehbar unterschieden werden.','messort'));
    }
    if ((!pa.length && !trim(form.paZusatz)) || !pa.every(function(it) {
      const name=trim(it.type)==='custom'?trim(it.customType):trim(it.type);
      return !!name && Number.isInteger(Number(it.qty)) && Number(it.qty)>0;
    })) formIssues.push(issue('PA_NOT_DOCUMENTED',
      'Lautsprechergruppen auswählen oder den Sonderaufbau beschreiben.','paZusatz'));

    const unresolvedPA=Array.isArray(data && data.paSelectionIssues) ? data.paSelectionIssues : [];
    for(const message of unresolvedPA){
      if(typeof message==='string' && message.trim())
        formIssues.push(issue('PA_GROUP_QUANTITY_MISSING',message,'paContainer'));
    }

    const evidenceIssues=[];
    if (!model || !Array.isArray(model.samples) || !model.samples.length)
      evidenceIssues.push(issue('LOG_MISSING','Ein nachvollziehbares Importmodell mit Messdaten fehlt.'));
    if (!model || !model.instrument || !trim(model.instrument.deviceModel) || !trim(model.instrument.serial))
      evidenceIssues.push(issue('METER_MISSING','Messgerät inklusive Typ und Seriennummer nicht nachgewiesen.'));
    if (!model || !model.instrument || !model.instrument.microphone ||
        !trim(model.instrument.microphone.type) || !trim(model.instrument.microphone.serial))
      evidenceIssues.push(issue('MIC_MISSING','Messmikrofon inklusive Typ und Seriennummer nicht nachgewiesen.'));
    if (!model || !model.measurement || !trim(model.measurement.start) || !trim(model.measurement.end))
      evidenceIssues.push(issue('MEASUREMENT_TIME_MISSING','Messbeginn und Messende nicht aus belegter Quelle bekannt.'));
    if (!evaluation || !Array.isArray(evaluation.blocks) || !evaluation.blocks.length)
      evidenceIssues.push(issue('BLOCKS_MISSING','Keine auswertbaren Beurteilungszeiträume nachgewiesen.'));
    else if (evaluation.blocks.some(function (b) {return b.dataQuality !== 'complete';}))
      evidenceIssues.push(issue('BLOCKS_INCOMPLETE','Mindestens ein Beurteilungszeitraum hat Datenlücken oder Zeitkonflikte.'));
    // A non-critical device summary warning must not invalidate measured interval data.
    // Rejected imports and genuine interval defects are still blocked by parser/evaluation.
    if (model?.quality?.status === 'rejected' || (model?.quality?.errors || []).length)
      evidenceIssues.push(issue('IMPORT_QUALITY','Der Import enthält entscheidende Fehler.'));
    if (!evaluation || !['verified','operator-approved'].includes(evaluation.assumptions?.timestampAnchorEvidence))
      evidenceIssues.push(issue('TIMESTAMP_UNVERIFIED','Zeitstempel-Semantik für die Auswertung nicht bestätigt.'));
    if (trim(form.messortTyp)==='direkt' && model &&
      ['k1','k2'].some(function (kind) {
        return model.corrections && model.corrections[kind] &&
          Number.isFinite(model.corrections[kind].valueDb) && model.corrections[kind].valueDb !== 0;
      }))
      evidenceIssues.push(issue('DIRECT_CORRECTION_CONFLICT',
        'Direktmessort gewählt, aber im Log sind ungleich Null gesetzte Korrekturwerte enthalten. Anwendung klären.'));
    if (trim(form.messortTyp)==='ersatz' && model) {
      [['k1','laeqDt'],['k2','lcpeak']].forEach(function (pair) {
        const kind=pair[0], key=pair[1], correction=model.corrections && model.corrections[kind];
        const column=model.columns && model.columns[key];
        if (!correction || !Number.isFinite(correction.valueDb) || !column ||
            ![true,false].includes(column.correctionApplied))
          evidenceIssues.push(issue('CORRECTION_UNRESOLVED',kind+': Messwert/Korrekturherkunft oder angewendeter Wert nicht geklärt.'));
      });
    }
    // Checkbox attestations are not equivalent to a calibrated meter reading.
    // Retain original time/level evidence from older projects if present.
    for(const pair of [['Vor','vor'],['Nach','nach']]){
      const tag=pair[0],pos=pair[1],at=legacy['kal'+tag+'Zeit'],level=legacy['kal'+tag+'Wert'];
      if(!validDateTime(at) || number(level) === null)
        evidenceIssues.push(issue('CALIBRATION_'+pos.toUpperCase()+'_EVIDENCE_MISSING',
          'Funktionsprüfung '+pos+' der Messung bestätigt; Zeitpunkt und Anzeigenwert nicht nachgewiesen.'));
    }
    if(trim(legacy.messortLAeq) && trim(legacy.messortLCpeak) &&
        trim(legacy.messortLAeq)!==trim(legacy.messortLCpeak))
      evidenceIssues.push(issue('LEGACY_ASSESSMENT_PLACES_DIFFER',
        'Altprojekt enthält unterschiedliche maßgebliche Immissionsorte für LAeq und LCpeak; nicht automatisch zusammengeführt.'));
    for(const kind of ['k1','k2']){
      const correction=model?.corrections?.[kind];
      if(correction && Number.isFinite(correction.valueDb) && correction.valueDb!==0 &&
          !trim(legacy[kind+'Ermittlung']))
        evidenceIssues.push(issue('CORRECTION_METHOD_NOT_DOCUMENTED',
          kind+': Herkunft und Bestimmung des angewendeten Korrekturwertes nicht dokumentiert.'));
    }
    const documentationComplete=formIssues.length === 0;
    return {
      version:VERSION,
      documentationComplete:documentationComplete,
      evidenceComplete:evidenceIssues.length === 0,
      reportFullyChecked:documentationComplete && evidenceIssues.length === 0 &&
        ['within-limits','exceeded'].includes(evaluation?.overall?.measurementStatus),
      normativeStatus:'not-assessable',
      measurementStatus:evaluation?.overall?.measurementStatus || 'not-assessable',
      normEvidence:'Fachlich durch den Betreiber am 16.11.2026 freigegeben',
      fields:fields,
      formIssues:formIssues,
      evidenceIssues:evidenceIssues,
      status:documentationComplete ? 'Angaben vollständig erfasst' : 'Protokollangaben unvollständig'
    };
  }
  function buildRecord(data) {
    const form=data && data.form || {};
    const origins=data && data.origins || {};
    const legacy=data && data.legacyProtocol || {};
    const model=data && data.importModel || null;
    const evaluation=data && data.evaluation || null;
    const values={};
    FIELD_IDS.forEach(function (id) { values[id]=trim(form[id]); });
    const review=validate(data);
    return {
      schemaVersion:VERSION,
      source:'pegelTool-Phase4',
      normVersion:'DIN 15905-5:2022-07',
      normReview:'operator-approved',
      values:values,
      origins:Object.assign({},origins),
      legacyProtocol:Object.assign({},legacy),
      paItems:Array.isArray(data && data.paItems) ? data.paItems.map(function (x) {return Object.assign({},x);}) : [],
      paGroups:Array.isArray(data && data.paGroups) ? data.paGroups.map(function(group){
        return {id:String(group.id||''),label:String(group.label||''),
          items:Array.isArray(group.items)?group.items.map(function(it){return Object.assign({},it);}):[],
          unresolved:Array.isArray(group.unresolved)?group.unresolved.slice():[]};
      }) : [],
      instrument:model && model.instrument || null,
      measurement:model && model.measurement || null,
      sampleCount:model && Array.isArray(model.samples) ? model.samples.length : null,
      importQuality:model && model.quality || null,
      calibration:{
        device:{model:values.kalibratorModell, serial:values.kalibratorSN},
        before:{confirmed:values.kalVorBestaetigt==='ja',at:trim(legacy.kalVorZeit)||null,
          displayedDb:number(legacy.kalVorWert),origin:trim(legacy.kalVorWert)?'legacy-unverified':'unbekannt'},
        after:{confirmed:values.kalNachBestaetigt==='ja',at:trim(legacy.kalNachZeit)||null,
          displayedDb:number(legacy.kalNachWert),origin:trim(legacy.kalNachWert)?'legacy-unverified':'unbekannt'},
        verifiedByStandard:null
      },
      places:{
        measurement:values.messposition,
        assessment:values.messort,
        assessmentLAeq:values.messort,
        assessmentLCpeak:values.messort,
        legacyAssessmentLAeq:trim(legacy.messortLAeq)||null,
        legacyAssessmentLCpeak:trim(legacy.messortLCpeak)||null,
        substitute:values.messortTyp === 'ersatz' ? values.ersatzMessort : null
      },
      corrections:{
        k1:{device:model && model.corrections && model.corrections.k1 || null, determination:trim(legacy.k1Ermittlung),
          column:model && model.columns && model.columns.laeqDt || null},
        k2:{device:model && model.corrections && model.corrections.k2 || null, determination:trim(legacy.k2Ermittlung),
          column:model && model.columns && model.columns.lcpeak || null}
      },
      assessment:{
        periods:evaluation && Array.isArray(evaluation.blocks) ? evaluation.blocks : [],
        overall:evaluation && evaluation.overall || null,
        quality:evaluation && evaluation.quality || null,
        assumptions:evaluation && evaluation.assumptions || null,
        normativeStatus:'not-assessable',
        measurementStatus:evaluation?.overall?.measurementStatus || 'not-assessable'
      },
      review:review
    };
  }
  return Object.freeze({VERSION, FIELD_IDS, FIELD_RULES, number, validate, buildRecord});
});