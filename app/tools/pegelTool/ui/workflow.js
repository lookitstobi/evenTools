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
    {id:'export', title:'Export', description:'Vorläufigen technischen Bericht oder Projektstand speichern.'}
  ]);
  const allowed = new Set(STEPS.map(s=>s.id));
  const arr = x => Array.isArray(x) ? x : [];
  function assessmentStatus(snapshot) {
    const s=snapshot || {}, record=s.record || {}, review=s.review || {},
      model=s.importModel, assessment=record.assessment || {};
    if (!model || !arr(model.samples).length) return 'Noch nicht geprüft';
    // All conditions must be present. A numeric comparison by itself is NEVER an approval.
    const eligible=record.normReview === 'verified' && review.reportFullyChecked === true &&
      review.documentationComplete === true && review.evidenceComplete === true;
    if (!eligible) return 'Nicht beurteilbar';
    if (assessment.normativeStatus === 'exceeded') return 'Grenzwert überschritten';
    if (assessment.normativeStatus === 'compliant') return 'Grenzwert eingehalten';
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
        blocks.some(b=>b.dataQuality !== 'complete') ? 'Datenlücken prüfen' : 'Technisch berechnet',
      protocol: !review ? 'Noch offen' : formIssues.length || evidenceIssues.length ?
        'Nachweise offen' : 'Erfasst (vorläufig)',
      export: s.canExport ? 'Vorläufig verfügbar' : 'Noch nicht verfügbar'
    };
    return {status,steps,issues:collectIssues(s),
      hasImport:!!model,canExport:!!s.canExport,
      blockCount:blocks.length,missingForm:formIssues.length,missingEvidence:evidenceIssues.length,
      // The unresolved original-norm check is always visible regardless of field completeness.
      normNotice:'Originalnorm DIN 15905-5:2022-07 noch nicht abschließend abgeglichen. Keine DIN-Konformitätsbescheinigung.'};
  }
  function mount(opts) {
    const doc=opts && opts.document, getSnapshot=opts && opts.getSnapshot;
    if (!doc || typeof getSnapshot !== 'function') return null;
    const main=doc.getElementById('main'), header=doc.querySelector('header.header');
    if(!main || !header || !doc.body) return null;
    // HTML project exports serialize the currently mounted DOM. A second load
    // must rebuild controls/listeners, not leave two navigation shells behind.
    const staleShell=doc.querySelector('.workflow-shell');
    const stalePanels=Array.from(main.querySelectorAll('.workflow-panel'));
    const sectionNames=['metrics','blocks','charts','log','review','preview',
      'eventAndEvidence','description','signature','pa','corrections'];
    const sections={};
    for (const name of sectionNames) {
      sections[name]=main.querySelector('[data-workflow-section="'+name+'"]');
      if(!sections[name]) return null; // Keep the original UI usable on partial deployments.
    }
    const make=(tag,cls,value)=>{
      const e=doc.createElement(tag);
      if(cls) e.className=cls;
      if(value!==undefined) e.textContent=value;
      return e;
    };
    const shell=make('div','workflow-shell');
    const nav=make('nav','workflow-nav');
    nav.setAttribute('aria-label','Bearbeitungsschritte');
    const overview=make('section','workflow-overview');
    overview.setAttribute('aria-live','polite');
    const status=make('strong','workflow-overall-status');
    const note=make('p','workflow-norm-note');
    const issueHeading=make('p','workflow-issue-heading');
    const issueList=make('ul','workflow-issues');
    overview.append(status,note,issueHeading,issueList);
    shell.append(nav,overview);
    doc.body.insertBefore(shell,main);
    const panelMap={},navMap={};
    function action(label,handler,secondary) {
      const btn=make('button',secondary ? 'secondary' : '',label);
      btn.type='button';btn.addEventListener('click',handler);return btn;
    }
    function paragraph(text,cls) {return make('p',cls || 'workflow-description',text);}
    const owners={
      import:[],
      quality:['log'],
      setup:['eventAndEvidence','pa','corrections'],
      assessment:['blocks','metrics','charts'],
      protocol:['review','description','signature','preview'],
      export:[]
    };
    const fragments={};
    for(const step of STEPS) {
      const b=make('button','workflow-tab');
      b.type='button'; b.setAttribute('aria-controls','workflow-panel-'+step.id);
      b.setAttribute('aria-label',step.title);
      const title=make('span','workflow-tab-title',(STEPS.indexOf(step)+1)+'. '+step.title);
      const sub=make('small','workflow-tab-status','Noch offen');
      b.append(title,sub);
      b.addEventListener('click',()=>go(step.id));
      nav.appendChild(b); navMap[step.id]={button:b,status:sub};

      const panel=make('section','workflow-panel');
      panel.id='workflow-panel-'+step.id;
      panel.setAttribute('aria-label',step.title);
      panel.hidden=true;
      const heading=make('div','workflow-panel-heading');
      heading.append(make('h2','',step.title),paragraph(step.description));
      panel.appendChild(heading);
      if(step.id==='import') {
        const card=make('div','section workflow-intro');
        card.append(paragraph('Importiere ein NTi-XL3-Log oder öffne ein gespeichertes Projekt. Der Import ersetzt den aktuellen Datensatz erst bei erfolgreicher Prüfung.'));
        const actions=make('div','workflow-actions');
        actions.append(action('XL3-Log auswählen',()=>doc.getElementById('btnImport')?.click()),
          action('Projektdatei öffnen',()=>doc.getElementById('btnLoadState')?.click(),true),
          action('Letzte Sitzung laden',()=>doc.getElementById('btnRecover')?.click(),true));
        card.appendChild(actions); panel.appendChild(card);
        fragments.importText=paragraph('Noch keine Messdaten geladen.','workflow-inline-status');
        panel.appendChild(fragments.importText);
      }
      if(step.id==='quality') {
        const card=make('div','section workflow-quality-card');
        card.append(make('h3','','Import- und Datenqualität'));
        fragments.qualityText=paragraph('Noch keine Messdaten geladen.','workflow-inline-status');
        card.appendChild(fragments.qualityText); panel.appendChild(card);
      }
      if(step.id==='assessment') {
        panel.append(paragraph('Die 30-Minuten-Auswertung ist technisch vorläufig. Die nachfolgenden gleitenden Werte und Diagramme dienen ausschließlich der Zusatzanalyse.','workflow-notice'));
      }
      if(step.id==='export') {
        const card=make('div','section');
        card.append(make('h3','','Vorläufiges Messprotokoll'));
        card.append(paragraph('Der PDF-Inhalt entspricht der Vorschau unter „Protokoll“. Offene Daten- und Normnachweise werden im Bericht aufgeführt.','workflow-description'));
        fragments.exportText=paragraph('Ohne überprüfbaren Import noch kein PDF möglich.','workflow-inline-status');
        const actions=make('div','workflow-actions');
        fragments.exportButton=action('Messbericht als PDF exportieren',()=>doc.getElementById('btnPdfTemplate')?.click());
        actions.append(fragments.exportButton,
          action('Projekt speichern (JSON)',()=>doc.getElementById('btnSaveState')?.click(),true),
          action('Projekt speichern (HTML)',()=>doc.getElementById('btnExportHtml')?.click(),true));
        card.append(fragments.exportText,actions);
        panel.appendChild(card);
      }
      for(const name of owners[step.id]) panel.appendChild(sections[name]);
      const footer=make('div','workflow-footer');
      const index=STEPS.indexOf(step);
      if(index>0) footer.appendChild(action('Zurück: '+STEPS[index-1].title,()=>go(STEPS[index-1].id),true));
      if(index<STEPS.length-1) footer.appendChild(action('Weiter: '+STEPS[index+1].title,()=>go(STEPS[index+1].id)));
      panel.appendChild(footer);
      panelMap[step.id]=panel;main.appendChild(panel);
    }
    // Sections are now in their new owners. Old exported shells/panels are safe to remove.
    for(const old of stalePanels) old.remove();
    if(staleShell) staleShell.remove();
    // Remove obsolete two-column wrappers only after all sections were moved.
    for(const id of ['leftColumn','rightColumn']) doc.getElementById(id)?.remove();
    main.classList.add('workflow-main');
    let current='import';
    function go(id) {
      if(!allowed.has(id)) return false;
      current=id;
      for(const step of STEPS) {
        const selected=step.id===id;
        panelMap[step.id].hidden=!selected;
        navMap[step.id].button.classList.toggle('is-active',selected);
        if(selected) navMap[step.id].button.setAttribute('aria-current','step');
        else navMap[step.id].button.removeAttribute('aria-current');
      }
      if(typeof opts.onActivate==='function') opts.onActivate(id);
      if(shell.scrollIntoView) shell.scrollIntoView({behavior:'auto',block:'start'});
      return true;
    }
    function refresh() {
      const currentSnapshot=getSnapshot(),summary=summarize(currentSnapshot);
      status.textContent='Beurteilungsstatus: '+summary.status;
      status.dataset.state=summary.status==='Noch nicht geprüft' ? 'empty' :
        summary.status==='Nicht beurteilbar' ? 'unknown' :
        summary.status==='Grenzwert überschritten' ? 'bad' : 'ok';
      note.textContent=summary.normNotice;
      issueHeading.textContent=summary.issues.length ?
        'Priorisierte Prüfhinweise ('+summary.issues.length+'):' : 'Keine zusätzlichen technischen Prüfhinweise.';
      issueList.replaceChildren();
      for(const issue of summary.issues.slice(0,5)) {
        const li=make('li','',''+issue.source+': '+issue.message);
        issueList.appendChild(li);
      }
      if(summary.issues.length>5) issueList.appendChild(make('li','',
        '… weitere '+(summary.issues.length-5)+' Hinweise unter Datenprüfung / Protokoll.'));
      for(const step of STEPS) navMap[step.id].status.textContent=summary.steps[step.id];
      fragments.importText.textContent=summary.hasImport ?
        'Messdaten sind geladen. Unter „Datenprüfung“ den Importstatus und die Rohdatenangaben kontrollieren.' :
        'Noch keine Messdaten geladen. PDF und Bewertung bleiben bis zum Import gesperrt.';
      const retryErrors=arr(currentSnapshot.lastImportAttempt && currentSnapshot.lastImportAttempt.errors);
      const loadedText=summary.hasImport ?
        'Datei: '+(currentSnapshot.logFileName || 'Name nicht bekannt')+
        ' · '+summary.blockCount+' technische Zeitblöcke · '+summary.missingEvidence+
        ' offene Messnachweise · '+summary.missingForm+' offene Protokollangaben.' :
        'Bitte zuerst ein XL3-Log importieren oder ein Projekt öffnen.';
      fragments.qualityText.textContent=retryErrors.length ?
        'Letzter Importversuch abgewiesen ('+retryErrors.length+' Fehler). Vorherige Messdaten bleiben erhalten. '+loadedText :
        loadedText;
      fragments.exportButton.disabled=!summary.canExport;
      fragments.exportText.textContent=summary.canExport ?
        'Technischer PDF-Export verfügbar – weiterhin keine bestätigte DIN-Konformität.' :
        'PDF noch nicht verfügbar: Import, Bewertung oder PDF-Modul fehlen.';
      return summary;
    }
    go('import');refresh();
    return Object.freeze({go,refresh,currentStep:()=>current});
  }
  return Object.freeze({STEPS,assessmentStatus,collectIssues,summarize,mount});
});
