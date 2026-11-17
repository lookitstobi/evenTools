/* Phase 5: canonical, deterministic report presentation from Phase 4 protocol record.
 * No independent calculations and no DIN conformity certification.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PegelToolReport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '1.0.0';
  const EMPTY = 'Nicht angegeben';
  const asText = v => (v === null || v === undefined || String(v).trim() === '') ? EMPTY : String(v).trim();
  const num = v => typeof v === 'number' && Number.isFinite(v) ? v : null;
  const db = v => num(v) === null ? 'Nicht ermittelt' : v.toFixed(1).replace('.', ',') + ' dB';
  const sec = v => num(v) === null ? 'Nicht ermittelt' : v.toFixed(0) + ' s';
  const origin = v => {
    const map = {'device-header':'Geräteheader','device-log':'Gerätelog','user-input':'Manuelle Angabe',
      'manual':'Manuelle Angabe','legacy-unverified':'Altprojekt – ungeprüft',
      'preset-unverified':'Voreinstellung – ungeprüft'};
    return map[v] || (v ? String(v) : 'Herkunft ungeklärt');
  };
  const row = (label,value,source) => ({label, value: asText(value), source: source ? origin(source) : ''});
  function fileLines(values) {
    if (!Array.isArray(values) || !values.length) return 'Keine Zeilennachweise';
    const all = [...new Set(values.filter(n => Number.isInteger(n) && n >= 1))].sort((a,b) => a-b);
    if (!all.length) return 'Keine Zeilennachweise';
    const parts = [];
    let first = all[0], last = all[0];
    for (let i=1; i<all.length; i++) {
      const n = all[i];
      if (n === last + 1) {last=n;continue;}
      parts.push(first === last ? String(first) : first + '-' + last);
      first=last=n;
    }
    parts.push(first === last ? String(first) : first + '-' + last);
    return parts.join(', ');
  }
  function asDate(value) {return asText(value).replace('T',' ');}
  function build(record, options) {
    if (!record || !record.review || !record.assessment)
      throw new Error('Berichtsdatenbestand aus Phase 4 fehlt.');
    const opts=options || {}, v=record.values || {}, o=record.origins || {};
    const meter=record.instrument || {}, microphone=meter.microphone || {};
    const measurement=record.measurement || {}, calibration=record.calibration || {};
    const before=calibration.before || {}, after=calibration.after || {};
    const places=record.places || {}, corr=record.corrections || {};
    const blocks=Array.isArray(record.assessment.periods) ? record.assessment.periods : [];
    const overall=record.assessment.overall || {};
    const checked=record.review.reportFullyChecked === true;
    const measured=record.assessment.measurementStatus || 'not-assessable';
    const resultStatus=measured === 'exceeded' && checked ? 'Grenzwert überschritten' :
      checked && measured === 'within-limits' ? 'Grenzwerte eingehalten' : 'NICHT BEURTEILBAR';
    const sections=[
      {title:'Veranstaltung und Verantwortliche',rows:[
        row('Veranstaltung',v.eventName,o.eventName), row('Messdatum',v.datumMessung,o.datumMessung),
        row('Veranstalter / Anschrift',v.organisator,o.organisator),
        row('Veranstaltungsort',v.location,o.location),row('Anschrift / Ortsangabe',v.ortAdresse,o.ortAdresse),
        row('Ort vor Ort geprüft',v.ortBestaetigt === 'ja' ? 'Manuell bestätigt' : 'Nicht bestätigt',o.ortBestaetigt),
        row('Messperson',v.messungVon,o.messungVon), row('Veranstaltungsbeschreibung',v.beschreibung,o.beschreibung),
        row('Veranstaltungsbeginn',v.veranstaltungsBeginn,o.veranstaltungsBeginn),
        row('Veranstaltungsende',v.veranstaltungsEnde,o.veranstaltungsEnde)]},
      {title:'Messverfahren und Datenbasis',rows:[
        row('Methode',num(record.sampleCount) !== null && record.sampleCount > 0 ? 'Importierter NTi-XL3-Logdatensatz; feste 30-Minuten-Blöcke zur vollen und halben Stunde' : 'Keine ausreichende importierte Messdatenbasis'),
        row('LAeq-Berechnung','10 log10(Summe aus Intervallzeit mal 10^(LAeq/10), geteilt durch die gesamte bewertbare Intervallzeit); nur bei vollständiger, widerspruchsfreier Blockabdeckung'),
        row('LCpeak-Berechnung','Höchster gültiger Intervall-Spitzenwert im Block, keine Mittelung'),
        row('Quell-Logdatei',opts.sourceFileName || 'Nicht vermerkt'),
        row('Messbeginn laut Log',measurement.start),row('Messende laut Log',measurement.end),
        row('Logintervall',num(measurement.intervalSeconds) === null ? EMPTY : measurement.intervalSeconds + ' s'),
        row('Zeitzone / Offset',measurement.timeZone),
        row('Zeitstempel-Anker',record.assessment.assumptions && record.assessment.assumptions.timestampAnchor),
        row('Zeitstempel-Nachweis',record.assessment.assumptions && record.assessment.assumptions.timestampAnchorEvidence),
        row('Messgerät',meter.deviceModel), row('Messgerät-Seriennummer',meter.serial),
        row('Firmware',meter.firmware),row('Messmikrofon',microphone.type),
        row('Mikrofon-Seriennummer',microphone.serial),
        row('Import-Datenqualität',record.importQuality && record.importQuality.status),
        row('Messreihen-Anzahl',num(record.sampleCount) === null ? EMPTY : String(record.sampleCount))]},
      {title:'Messstellen und Beschallungsanlage',rows:[
        row('Tatsächlicher Messort',places.measurement,o.messposition),
        row('Maßgeblicher Immissionsort LAeq',places.assessmentLAeq,o.messortLAeq),
        row('Maßgeblicher Immissionsort LCpeak',places.assessmentLCpeak,o.messortLCpeak),
        row('Messorttyp',v.messortTyp === 'ersatz' ? 'Ersatzmessort' : v.messortTyp === 'direkt' ? 'Direktmessung' : EMPTY,o.messortTyp),
        row('Ersatzmessort',places.substitute,o.ersatzMessort),
        row('PA-Aufstellung',v.paAnordnung,o.paAnordnung),
        row('Ausgewählte Lautsprechergruppen',(record.paGroups || []).map(group=>{
          const speakers=(group.items || []).map(it=>asText(it.qty)+' × '+asText(it.type)).join(', ');
          const missing=(group.unresolved || []).length ? ' [Stückzahlen offen: '+group.unresolved.join(', ')+']' : '';
          return group.label+': '+(speakers || 'Stückzahl nicht belegt')+missing;
        }).join('; ')),
        row('PA-Aufstellung geprüft',v.paBestaetigt === 'ja' ? 'Manuell bestätigt' : 'Nicht bestätigt',o.paBestaetigt),
        row('PA-Komponenten',(record.paItems || []).map(x =>
          ((x.type === 'custom' ? x.customType : x.type) || '?') + ' (' + asText(x.qty) + 'x)').join('; ')),
        row('Abweichungen',v.abweichungVorhanden === 'ja' ? 'Ja' : v.abweichungVorhanden === 'nein' ? 'Nein' : EMPTY,o.abweichungVorhanden),
        row('Abweichungsbegründung',v.abweichungBeschreibung,o.abweichungBeschreibung)]},
      {title:'Korrekturen und Funktionsprüfung',rows:[
        row('k1 – LAeq',db(corr.k1 && corr.k1.device && corr.k1.device.valueDb)),
        row('k1 – im Gerätelog angewandt?',correctionState(corr.k1)),
        row('k1 – Herkunft / Ermittlung',corr.k1 && corr.k1.determination,o.k1Ermittlung),
        row('k1 – Originalspalte',corr.k1 && corr.k1.column && corr.k1.column.column),
        row('k2 – LCpeak',db(corr.k2 && corr.k2.device && corr.k2.device.valueDb)),
        row('k2 – im Gerätelog angewandt?',correctionState(corr.k2)),
        row('k2 – Herkunft / Ermittlung',corr.k2 && corr.k2.determination,o.k2Ermittlung),
        row('k2 – Originalspalte',corr.k2 && corr.k2.column && corr.k2.column.column),
        row('Kalibrator',calibration.device && calibration.device.model),
        row('Kalibrator-Seriennummer',calibration.device && calibration.device.serial),
        row('Vor der Messung – Zeitpunkt',asDate(before.at),o.kalVorZeit),
        row('Vor der Messung – Anzeige',db(before.displayedDb),before.origin),
        row('Nach der Messung – Zeitpunkt',asDate(after.at),o.kalNachZeit),
        row('Nach der Messung – Anzeige',db(after.displayedDb),after.origin),
        row('Funktionsprüfung','Anzeige vor und nach der Messung dokumentiert')]},
      {title:'Auswertung und Berichtsabschluss',rows:[
        row('Maximaler LAeq,30min-Beurteilungspegel',db(overall.laeqMaxDb)),
        row('Maximaler LCpeak-Spitzenpegel',db(overall.lcpeakMaxDb)),
        row('30-Minuten-Blöcke',blocks.length),
        row('Vollständig erfasste Zeitblöcke',blocks.filter(b=>b.dataQuality === 'complete').length),
        row('Protokollangaben',record.review.documentationComplete ? 'Vollständig' : 'Unvollständig'),
        row('Mess- und Prüfnachweise',record.review.evidenceComplete ? 'Technische Mindestnachweise vorhanden' : 'Unvollständig / ungeklärt'),
        row('Erstellt von',v.berichtName,o.berichtName), row('Berichtsort',v.berichtsort,o.berichtsort),
        row('Berichtsdatum',v.berichtDatum,o.berichtDatum),
        row('Unterschrift','Unterschriftsfeld auf der letzten Seite')]}
    ];
    const blockRows=blocks.map((b,i)=>({
      index:i+1,from:asDate(b.start),to:asDate(b.end),
      coverage:sec(b.coveredSeconds) + ' / ' + sec(b.expectedSeconds),
      laeq:db(b.laeq30Db),lcpeak:db(b.lcpeakMaxDb),
      quality:b.dataQuality === 'complete' ? 'Vollständig' :
        b.dataQuality === 'conflict' ? 'Zeitkonflikt' : 'Unvollständig',
      source:'Logzeilen: ' + fileLines(b.sourceLines) +
        (Number.isInteger(b.lcpeakSourceLine) ? '; LCpeak-Zeile: ' + b.lcpeakSourceLine : ''),
      warnings:(b.warnings || []).map(w => w.code + ': ' + w.message),
      raw:b
    }));
    const issues=[];
    function push(scope, list) {
      (Array.isArray(list) ? list : []).forEach(x => {
        const code=asText(x.code), message=asText(x.message);
        issues.push({scope,code,message});
      });
    }
    push('Formular',record.review.formIssues);
    push('Prüfnachweis',record.review.evidenceIssues);
    push('Import',record.importQuality && record.importQuality.warnings);
    push('Berechnung',record.assessment.quality && record.assessment.quality.warnings);
    for (const b of blockRows) if(b.warnings.length)
      issues.push({scope:'Block '+b.index,code:'BLOCK_WARNING',
        message:b.warnings.join(' | ')});
    const result={
      schemaVersion:1,toolVersion:VERSION,
      normVersion:record.normVersion || 'DIN 15905-5:2022-07',
      normStatus:record.normReview || 'not-verified',
      status:resultStatus,
      subtitle:'Messprotokoll zur Auswertung von Schallpegelmessungen',
      warning:'',
      sections,blocks:blockRows,issues,
      documentationComplete:!!record.review.documentationComplete,
      evidenceComplete:!!record.review.evidenceComplete,
      reportFullyChecked:checked,
      assessmentStatus:record.assessment.normativeStatus || 'not-assessable',
      sourceLog:asText(opts.sourceFileName)
    };
    return result;
  }
  function correctionState(c) {
    const state=c && c.column && c.column.correctionApplied;
    return state === true ? 'Ja – nicht erneut addieren' :
      state === false ? 'Nein – softwareseitige Anwendung nur bei belegtem Wert' : 'Ungeklärt';
  }
  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function renderHtml(report) {
    if (!report) return '<p>Kein Bericht verfügbar.</p>';
    const html=['<div class="report-notice"><strong>',esc(report.status),'</strong></div><p class="small">pegelTool ',
      esc(report.toolVersion),' · ',esc(report.normVersion),'</p>'];
    for (const section of report.sections) {
      html.push('<h4>',esc(section.title),'</h4><dl class="report-fields">');
      for(const r of section.rows)
        html.push('<dt>',esc(r.label),'</dt><dd>',esc(r.value),
          r.source ? '<small> ['+esc(r.source)+']</small>' : '', '</dd>');
      html.push('</dl>');
    }
    html.push('<h4>Vollständige Zeitblocktabelle (',report.blocks.length,' Blöcke)</h4>',
'<div class="table-wrap"><table class="table"><thead><tr><th>Zeitraum</th>',
      '<th>Abdeckung</th><th>LAeq 30 min</th><th>LCpeak</th><th>Datenlage</th><th>Rohdatenbezug</th></tr></thead><tbody>');
    for (const b of report.blocks)
      html.push('<tr><td>',esc(b.from),' – ',esc(b.to),'</td><td>',esc(b.coverage),
        '</td><td>',esc(b.laeq),'</td><td>',esc(b.lcpeak),'</td><td>',esc(b.quality),
        '</td><td>',esc(b.source),'</td></tr>');
    html.push('</tbody></table></div><h4>Prüfhinweise (',report.issues.length,
      ')</h4><ul class="protocol-problems">');
    for(const issue of report.issues)
      html.push('<li><strong>',esc(issue.scope),': ',esc(issue.code),
        '</strong> – ',esc(issue.message),'</li>');
    if(!report.issues.length) html.push('<li>Keine zusätzlichen technischen Hinweise erfasst.</li>');
    html.push('</ul><p class="small">Diagramme und LAeq_g5/LAeq_g30-Anzeigen der App sind ergänzende Visualisierungen, keine zusätzlichen normativen Grenzwertentscheidungen.</p>');
    return html.join('');
  }
  return Object.freeze({VERSION,build,renderHtml,fileLines,db,esc});
});
