/* pegelTool Phase 6: progressive UI around existing import, evaluation and report modules.
 * This module never computes acoustic values or grants DIN conformity.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PegelToolWorkflow = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STEPS = Object.freeze([
    {id:'import', title:'Import', description:'XL3-Datei oder vorhandenes Projekt öffnen.'},
    {id:'quality', title:'Datenprüfung', description:'Messdaten, Gerätedaten und Importhinweise nachvollziehen.'},
    {id:'setup', title:'Messaufbau / Korrekturen', description:'Veranstaltung, Messstellen, PA, k1/k2 und Kalibrierung dokumentieren.'},
    {id:'assessment', title:'Bewertung', description:'Feste Halbstundenblöcke prüfen; Zusatzanalyse getrennt ansehen.'},
    {id:'protocol', title:'Protokoll', description:'Fehlende Nachweise ergänzen und den Bericht kontrollieren.'},
    {id:'export', title:'Export', description:'Messbericht oder Projektstand speichern.'}
  ]);
  const allowed = new Set(STEPS.map(s=>s.id));
  const arr = x => Array.isArray(x) ? x : [];
  function assessmentStatus(snapshot) {
    const s=snapshot || {}, record=s.record || {},
      model=s.importModel, assessment=record.assessment || {},
      overall=s.evaluation?.overall || {};
    if (!model || !arr(model.samples).length) return 'Noch nicht geprüft';
    const result=overall.measurementStatus || assessment.measurementStatus;
    if (result === 'exceeded') return 'Grenzwert überschritten';
    if (result === 'within-limits') return 'Keine Überschreitung in auswertbaren Messdaten';
    if (result === 'partial') return 'Nur teilweise auswertbar';
    return 'Nicht beurteilbar';
  }
  function collectIssues(snapshot) {
    const s=snapshot || {}, model=s.importModel || {}, quality=model.quality || {},
      review=s.review || {}, evaluation=s.evaluation || {}, q=evaluation.quality || {};
    const retryErrors=arr(s.lastImportAttempt && s.lastImportAttempt.errors)
      .filter(i=>i && i.message).map(i=>({source:'Letzter Importversuch',message:String(i.message),
        code:String(i.code || 'IMPORT_REJECTED'),step:'quality',priority:-1}));
    if (!s.importModel) return retryErrors.concat([
      {source:'Import',message:'Noch kein nachvollziehbarer XL3-Datensatz geladen.',step:'import',priority:0}]);
    const all=retryErrors.slice();
    const add=(list,source,step,priority)=>arr(list).forEach(i=>{
      if (!i || !i.message) return;
      all.push({source,message:String(i.message),code:String(i.code || ''),step,priority});
    });
    add(quality.errors,'Importfehler','quality',0);
    add(quality.warnings,'Importhinweis','quality',2);
    add(q.warnings,'Zeit-/Rechenhinweis','assessment',1);
    add(review.evidenceIssues,'Messnachweis','quality',1);
    add(review.formIssues,'Protokollangabe','setup',2);
    const seen=new Set();
    return all.sort((a,b)=>a.priority-b.priority).filter(i=>{
      const key=i.code+'|'+i.message;
      if(seen.has(key)) return false;
      seen.add(key);return true;
    });
  }
  function summarize(snapshot) {
    const s=snapshot || {}, model=s.importModel || null, evaluation=s.evaluation || null,
      review=s.review || null, status=assessmentStatus(s);
    const blocks=arr(evaluation && evaluation.blocks);
    const formIssues=arr(review && review.formIssues);
    const evidenceIssues=arr(review && review.evidenceIssues);
    const errors=arr(model && model.quality && model.quality.errors);
    const warnings=arr(model && model.quality && model.quality.warnings);
    const lastImportErrors=arr(s.lastImportAttempt && s.lastImportAttempt.errors);
    const steps={
      import: model ? 'Messdaten geladen' : 'Noch offen',
      quality: lastImportErrors.length || errors.length ? 'Importfehler' : !model ? 'Wartet auf Import' :
        warnings.length || evidenceIssues.length ? 'Prüfhinweise' : 'Daten vorhanden',
      setup: !review ? 'Noch offen' : formIssues.length ? formIssues.length+' Angaben offen' : 'Angaben erfasst',
      assessment: !blocks.length ? 'Noch nicht geprüft' :
        blocks.some(b=>b.dataCoverageState === 'gap' || b.dataCoverageState === 'conflict' ||
          (!b.dataCoverageState && b.dataQuality !== 'complete')) ? 'Datenlücken prüfen' :
          blocks.some(b=>b.dataCoverageState === 'partial-edge') ? 'Teilzeitblöcke ausgewertet' : 'Technisch berechnet',
      protocol: !review ? 'Noch offen' : formIssues.length || evidenceIssues.length ?
        'Nachweise offen' : 'Angaben erfasst',
      export: s.canExport ? 'Verfügbar' : 'Noch nicht verfügbar'
    };
    return {status,steps,issues:collectIssues(s),
      hasImport:!!model,canExport:!!s.canExport,
      blockCount:blocks.length,missingForm:formIssues.length,missingEvidence:evidenceIssues.length,
      normNotice:''};
  }
  // One continuous workspace. go() scrolls to a section rather than hiding panels.
  function mount(opts) {
    const doc=opts && opts.document, getSnapshot=opts && opts.getSnapshot;
    if (!doc || typeof getSnapshot !== 'function') return null;
    const main=doc.getElementById('main'),header=doc.querySelector('header.header');
    if(!main || !header || !doc.body) return null;
    const names=['eventAndEvidence','description','signature','pa','corrections',
      'log','deviceEvidence','review','blocks','metrics','charts','preview'];
    const sections={};
    for(const name of names) {
      sections[name]=main.querySelector('[data-workflow-section="'+name+'"]');
      if(!sections[name]) return null;
    }
    const make=(tag,cls,value)=>{
      const e=doc.createElement(tag);
      if(cls)e.className=cls;
      if(value!==undefined)e.textContent=value;
      return e;
    };
    // Exported standalone HTML may contain the previously mounted workflow shell.
    const staleShell=doc.querySelector('.workflow-shell');
    const oldPanels=Array.from(main.querySelectorAll('.workflow-panel'));
    const oldGroups=Array.from(main.querySelectorAll('.workflow-group'));
    // Scrub any residual Phase-6 navigation before an XL3 file is loaded too.
    const oldNavigation=typeof doc.querySelectorAll==='function'
      ? Array.from(doc.querySelectorAll('.workflow-nav,.workflow-tab,.workflow-footer')) : [];
    const shell=make('div','workflow-shell');
    const overview=make('section','workflow-overview');
    overview.setAttribute('aria-live','polite');
    const status=make('strong','workflow-overall-status');
    overview.append(status);
    const short=make('section','workflow-shortinfo');
    const shortTitle=make('h3','workflow-shortinfo-title','Messdaten und Ergebnisse');
    const shortValues=make('div','workflow-shortinfo-values');
    const shortFields=[
      ['Messbeginn','start'],['Messende','end'],
      ['k1','k1'],['k2','k2'],
      ['LAeq,30min (Maximum)','laeq'],['LCpeak (Maximum)','lcpeak']
    ];
    const shortNodes={};
    for(const pair of shortFields){
      const item=make('div','workflow-shortinfo-item');
      item.appendChild(make('span','workflow-shortinfo-label',pair[0]));
      const value=make('strong','workflow-shortinfo-value','—');
      item.appendChild(value);
      shortValues.appendChild(item);shortNodes[pair[1]]=value;
    }
    short.append(shortTitle,shortValues);
    shell.append(overview,short);
    doc.body.insertBefore(shell,main);
    // Charts remain in #main so saved standalone HTML can rehydrate them.
    // Move the existing chart node, never clone its canvases or their state.
    main.appendChild(sections.charts);
    const groups=[
      {id:'setup',title:'01 · Veranstaltung und Personal',sections:['eventAndEvidence','description']},
      {id:'quality',title:'02 · Beschallung und Messbedingungen',sections:['pa','corrections']},
      {id:'assessment',title:'03 · Messwerte und XL3-Gerätedaten',sections:['blocks','metrics','log','deviceEvidence']},
      {id:'protocol',title:'04 · Prüfung und Protokoll',sections:['review','preview']}
    ];
    const groupsById={},alerts={};
    function createCollapsibleGroup(id,title,extraClass=''){
      const part=make('details','workflow-group'+(extraClass?' '+extraClass:''));
      part.id='workflow-group-'+id;
      part.open=true; // Only the nested PDF preview and parser details start closed.
      const heading=make('summary','workflow-group-heading');
      heading.appendChild(make('h2','workflow-group-title',title));
      const alert=make('span','workflow-group-alert','!');
      alert.setAttribute('aria-label','Angaben fehlen');
      alert.title='Erforderliche Angaben fehlen';
      alert.hidden=true;
      heading.appendChild(alert);
      part.appendChild(heading);
      alerts[id]=alert;
      return part;
    }
    for(const group of groups){
      const part=createCollapsibleGroup(group.id,group.title);
      for(const name of group.sections)part.appendChild(sections[name]);
      groupsById[group.id]=part;
      main.appendChild(part);
    }
    const exportArea=createCollapsibleGroup('export','05 · Unterschrift und Export','workflow-export');
    const exportText=make('p','workflow-inline-status','Ohne überprüfbaren Import noch kein PDF möglich.');
    const actions=make('div','workflow-actions');
    function action(label,target,secondary){
      const btn=make('button',secondary?'secondary':'',label);
      btn.type='button';
      btn.addEventListener('click',()=>doc.getElementById(target)?.click());
      return btn;
    }
    const exportButton=action('Messbericht als PDF exportieren','btnPdfTemplate');
    actions.append(exportButton,
      action('Projekt speichern (JSON)','btnSaveState',true),
      action('Projekt speichern (HTML)','btnExportHtml',true));

    exportArea.appendChild(sections.signature);
    exportArea.append(exportText,actions);
    groupsById.export=exportArea;
    main.appendChild(exportArea);
    // Skip automatic and standard preset values in the regular entry flow.
    // They remain mouse-editable, including venue and address exceptions.
    const presetFields=new Set(['datumMessung','location','ortAdresse','umwelt',
      'organisator','kalibratorModell','kalibratorSN','berichtsort','berichtDatum']);
    const allFields=Array.from(main.querySelectorAll('input,select,textarea'));
    for(const field of allFields){
      if(presetFields.has(field.id) || field.hasAttribute('readonly') || field.readOnly || field.disabled){
        field.tabIndex=-1;
      }else if(field.hasAttribute('tabindex')){
        field.removeAttribute('tabindex');
      }
    }
    for(const old of oldPanels)old.remove();
    for(const old of oldGroups)old.remove();
    for(const old of oldNavigation)old.remove();
    if(staleShell)staleShell.remove();
    for(const id of ['leftColumn','rightColumn'])doc.getElementById(id)?.remove();
    main.classList.add('workflow-main','workflow-single-page');
    function go(id){
      const mapped=id==='import'?'setup':id;
      if(!groupsById[mapped])return false;
      const target=groupsById[mapped];
      target.open=true;
      if(typeof opts.onActivate==='function')opts.onActivate(mapped);
      if(target.scrollIntoView)target.scrollIntoView({behavior:'auto',block:'start'});
      return true;
    }
    function refresh(){
      const snapshot=getSnapshot(),summary=summarize(snapshot);
      const overall=snapshot.evaluation?.overall || {};
      const laeq=overall.comparisonLAeq,peak=overall.comparisonLCpeak;
      const hasExceedance=laeq==='above'||peak==='above';
      const bothAssessed=laeq==='at-or-below'&&peak==='at-or-below';
      status.textContent=hasExceedance?'Grenzwerte überschritten':bothAssessed?'Keine Überschreitung':'—';
      const model=snapshot.importModel || {};
      const measurement=model.measurement || {}, corrections=model.corrections || {};
      const dateText=value=>value ? String(value).replace('T',' ') : '—';
      shortNodes.start.textContent=dateText(measurement.start);
      shortNodes.end.textContent=dateText(measurement.end);
      const fmtDb=x=>Number.isFinite(x?.valueDb)
        ? x.valueDb.toFixed(1).replace('.',',')+' dB' : '—';
      shortNodes.k1.textContent=fmtDb(corrections.k1);
      shortNodes.k2.textContent=fmtDb(corrections.k2);
      // Use fixed 30-minute interval assessments, not the informational
      // rolling traces and not a zero fallback when no block was assessed.
      const fmtLevel=(value,unit)=>Number.isFinite(value)
        ? value.toFixed(1).replace('.',',')+' '+unit : '—';
      shortNodes.laeq.textContent=fmtLevel(overall.laeqMaxDb,'dB(A)');
      shortNodes.lcpeak.textContent=fmtLevel(overall.lcpeakMaxDb,'dB(C)');
      status.dataset.state=hasExceedance?'bad':bothAssessed?'ok':'empty';
      const review=snapshot.review||{};
      const issues=Array.isArray(review.formIssues)?review.formIssues:[];
      const evidence=Array.isArray(review.evidenceIssues)?review.evidenceIssues:[];
      const fields=new Set(issues.map(item=>item.field).filter(Boolean));
      const any=(...ids)=>ids.some(id=>fields.has(id));
      const missing={
        setup:any('eventName','datumMessung','location','ortAdresse','organisator','messungVon'),
        quality:any('paContainer','paAnordnung','paZusatz','ersatzMessort')||
          issues.some(item=>String(item.code||'').startsWith('PA_')),
        assessment:any('messposition','messort','messortTyp','kalibratorModell',
          'kalibratorSN','kalVorBestaetigt','kalNachBestaetigt')||
          evidence.some(item=>/METER_|MIC_|CALIBRATION_|LOG_MISSING|MEASUREMENT_TIME_MISSING/.test(item.code||'')),
        protocol:issues.length>0||evidence.length>0,
        export:any('berichtName','berichtDatum','berichtsort')
      };
      for(const [id,alert] of Object.entries(alerts))alert.hidden=!missing[id];
      exportButton.disabled=!summary.canExport;
      exportText.textContent=summary.canExport?'PDF-Export verfügbar.':
        'PDF noch nicht verfügbar: Import, Bewertung oder PDF-Modul fehlen.';
      return summary;
    }
    refresh();
    return Object.freeze({go,refresh,currentStep:()=> 'all'});
  }
  return Object.freeze({STEPS,assessmentStatus,collectIssues,summarize,mount});
});
