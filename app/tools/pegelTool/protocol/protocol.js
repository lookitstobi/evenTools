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
    ['ortBestaetigt','Veranstaltungsort vor Ort bestätigt','pflicht'],
    ['messungVon','Messperson / Firma','pflicht'],
    ['messposition','Tatsächlicher Messort','pflicht'],
    ['messortLAeq','Maßgeblicher Immissionsort LAeq','pflicht'],
    ['messortLCpeak','Maßgeblicher Immissionsort LCpeak','pflicht'],
    ['messortTyp','Messung am Immissionsort oder Ersatzmessort','pflicht'],
    ['kalibratorModell','Kalibrator-Typ','pflicht'],
    ['kalibratorSN','Kalibrator-Seriennummer','pflicht'],
    ['kalVorZeit','Funktionsprüfung vor Messung: Zeitpunkt','pflicht'],
    ['kalVorWert','Funktionsprüfung vor Messung: Anzeigenwert','pflicht'],
    ['kalNachZeit','Funktionsprüfung nach Messung: Zeitpunkt','pflicht'],
    ['kalNachWert','Funktionsprüfung nach Messung: Anzeigenwert','pflicht'],
    ['paAnordnung','Aufstellung der Beschallungsanlage','pflicht'],
    ['paBestaetigt','Beschallungsaufbau kontrolliert','pflicht'],
    ['abweichungVorhanden','Abweichungen dokumentiert?','pflicht'],
    ['berichtName','Protokollverfasser','pflicht'],
    ['berichtDatum','Datum der Protokollerstellung','pflicht'],
    ['berichtsort','Ort der Protokollerstellung','pflicht'],
    ['ersatzMessort','Beschreibung Ersatzmessort','bedingt'],
    ['k1Ermittlung','Bestimmung von k1','bedingt'],
    ['k2Ermittlung','Bestimmung von k2','bedingt'],
    ['abweichungBeschreibung','Beschreibung / Begründung der Abweichungen','bedingt'],
    ['altBestaetigt','Übernommene Altangaben überprüft','bedingt'],
    ['beschreibung','Beschreibung der Veranstaltung','optional'],
    ['veranstaltungsBeginn','Veranstaltungsbeginn','optional'],
    ['veranstaltungsEnde','Veranstaltungsende','optional'],
    ['umwelt','Umgebungsbedingungen','optional'],
    ['foh','FOH-Techniker','optional'],
    ['lautestePosition','Bisherige Ortsangabe (Altprojekt)','optional']
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
  const condition = function (rule, form, origins, model) {
    if (rule.id === 'altBestaetigt') return Object.values(origins || {}).some(function (v) {return v === 'legacy-unverified';});
    if (rule.id === 'ersatzMessort') return trim(form.messortTyp) === 'ersatz';
    if (rule.id === 'k1Ermittlung' || rule.id === 'k2Ermittlung') {
      if (trim(form.messortTyp) === 'ersatz') return true;
      const kind = rule.id.slice(0,2);
      const correction = model && model.corrections && model.corrections[kind];
      return !!correction && Number.isFinite(correction.valueDb) && correction.valueDb !== 0;
    }
    if (rule.id === 'abweichungBeschreibung') return trim(form.abweichungVorhanden) === 'ja';
    return rule.category === 'pflicht';
  };
  const issue = function (code, message, field) {return {code:code, message:message, field:field || null};};
  function validate(data) {
    const form=data && data.form || {};
    const origins=data && data.origins || {};
    const model=data && data.importModel || null;
    const evaluation=data && data.evaluation || null;
    const pa=Array.isArray(data && data.paItems) ? data.paItems : [];
    const fields=[];
    const formIssues=[];
    FIELD_RULES.forEach(function (rule) {
      const required=condition(rule, form, origins, model);
      const value=trim(form[rule.id]);
      const active=rule.category !== 'bedingt' || required;
      let valid=!required || value.length>0;
      if (required && ['ortBestaetigt','paBestaetigt','altBestaetigt'].includes(rule.id)) valid=value === 'ja';
      if (required && rule.id === 'abweichungVorhanden') valid=['ja','nein'].includes(value);
      if (required && rule.id === 'messortTyp') valid=['direkt','ersatz'].includes(value);
      if (required && ['kalVorWert','kalNachWert'].includes(rule.id)) valid=number(value) !== null;
      if (required && ['datumMessung','berichtDatum'].includes(rule.id)) valid=validDate(value);
      if (required && ['kalVorZeit','kalNachZeit'].includes(rule.id)) valid=validDateTime(value);
      if (required && rule.id === 'ortAdresse' && value.length<6) valid=false;
      if (required && rule.id === 'location' && value === 'Eigene Angabe' && !trim(form.ortAdresse)) valid=false;
      if (required && !valid) formIssues.push(issue('FIELD_MISSING_OR_INVALID', rule.label+' fehlt oder ist unplausibel.',rule.id));
      fields.push({id:rule.id, category:rule.category, active:active, required:required, valid:valid,
        origin:trim(origins[rule.id]) || 'unbekannt'});
    });
    if (validDateTime(form.kalVorZeit) && validDateTime(form.kalNachZeit) &&
        trim(form.kalNachZeit)<trim(form.kalVorZeit))
      formIssues.push(issue('CALIBRATION_TIME_ORDER','Prüfung nach der Messung liegt vor der Eingangsprüfung.','kalNachZeit'));
    if (trim(form.messortTyp)==='ersatz' && trim(form.messposition) === trim(form.messortLAeq) &&
        trim(form.messposition) === trim(form.messortLCpeak)) {
      formIssues.push(issue('REPLACEMENT_UNCLEAR','Ersatzmessort gewählt, aber alle Messorte sind identisch. Bitte klären.','messortTyp'));
    }
    if (!pa.length || !pa.every(function (it) {
      const name=trim(it.type)==='custom' ? trim(it.customType) : trim(it.type);
      return name && Number.isInteger(Number(it.qty)) && Number(it.qty)>0;
    })) formIssues.push(issue('PA_NOT_DOCUMENTED','PA-Komponenten und positive ganzzahlige Stückzahlen dokumentieren.','paContainer'));

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
    if (model && model.quality && model.quality.status !== 'usable')
      evidenceIssues.push(issue('IMPORT_QUALITY','Importqualität nicht uneingeschränkt verwendbar.'));
    if (!evaluation || evaluation.timestampAnchorEvidence !== 'verified')
      evidenceIssues.push(issue('TIMESTAMP_UNVERIFIED','Zeitstempel-Semantik des XL3 ist noch nicht belegt.'));
    if (model && !trim(model.measurement && model.measurement.timeZone))
      evidenceIssues.push(issue('TIMEZONE_UNVERIFIED','Messzeit-Zeitzone bzw. Offset nicht belegt.'));
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
    if (!model || !model.calibration || model.calibration.status !== 'verified')
      evidenceIssues.push(issue('CALIBRATION_NOT_VERIFIED','Dokumentierte Funktionsprüfung ist erfasst, aber nicht unabhängig verifiziert.'));
    const documentationComplete=formIssues.length === 0;
    return {
      version:VERSION,
      documentationComplete:documentationComplete,
      evidenceComplete:evidenceIssues.length === 0,
      reportFullyChecked:false,
      normativeStatus:'not-assessable',
      normEvidence:'DIN 15905-5:2022-07 Originalnorm/Protokollabschnitt nicht abgeglichen',
      fields:fields,
      formIssues:formIssues,
      evidenceIssues:evidenceIssues,
      status:documentationComplete ? 'Angaben vollständig erfasst (vorläufig)' : 'Protokollangaben unvollständig'
    };
  }
  function buildRecord(data) {
    const form=data && data.form || {};
    const origins=data && data.origins || {};
    const model=data && data.importModel || null;
    const evaluation=data && data.evaluation || null;
    const values={};
    FIELD_IDS.forEach(function (id) { values[id]=trim(form[id]); });
    const review=validate(data);
    return {
      schemaVersion:VERSION,
      source:'pegelTool-Phase4',
      normVersion:'DIN 15905-5:2022-07',
      normReview:'not-verified',
      values:values,
      origins:Object.assign({},origins),
      paItems:Array.isArray(data && data.paItems) ? data.paItems.map(function (x) {return Object.assign({},x);}) : [],
      instrument:model && model.instrument || null,
      measurement:model && model.measurement || null,
      sampleCount:model && Array.isArray(model.samples) ? model.samples.length : null,
      importQuality:model && model.quality || null,
      calibration:{
        device:{model:values.kalibratorModell, serial:values.kalibratorSN},
        before:{at:values.kalVorZeit, displayedDb:number(values.kalVorWert), origin:trim(origins.kalVorWert) || 'unbekannt'},
        after:{at:values.kalNachZeit, displayedDb:number(values.kalNachWert), origin:trim(origins.kalNachWert) || 'unbekannt'},
        verifiedByStandard:false
      },
      places:{
        measurement:values.messposition,
        assessmentLAeq:values.messortLAeq,
        assessmentLCpeak:values.messortLCpeak,
        substitute:values.messortTyp === 'ersatz' ? values.ersatzMessort : null
      },
      corrections:{
        k1:{device:model && model.corrections && model.corrections.k1 || null, determination:values.k1Ermittlung,
          column:model && model.columns && model.columns.laeqDt || null},
        k2:{device:model && model.corrections && model.corrections.k2 || null, determination:values.k2Ermittlung,
          column:model && model.columns && model.columns.lcpeak || null}
      },
      assessment:{
        periods:evaluation && Array.isArray(evaluation.blocks) ? evaluation.blocks : [],
        overall:evaluation && evaluation.overall || null,
        quality:evaluation && evaluation.quality || null,
        assumptions:evaluation && evaluation.assumptions || null,
        normativeStatus:'not-assessable'
      },
      review:review
    };
  }
  return Object.freeze({VERSION, FIELD_IDS, FIELD_RULES, number, validate, buildRecord});
});