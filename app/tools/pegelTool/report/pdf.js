/* pegelTool report PDF - restrained A4 layout based exclusively on the report model.
 * Visual changes must not modify measurements, assessments, origins or warnings.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PegelToolReportPdf = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function printable(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/[\u2012\u2013\u2014\u2212]/g, '-')
      .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
      .replace(/\u2026/g, '...').replace(/\u2022/g, '-')
      .replace(/[\u00ad\u200b-\u200d\uFEFF]/g, '')
      .replace(/[\u0000-\u0008\u000b\u000e-\u001f]/g, ' ');
  }

  function create(report, JsPdf) {
    if (!report || !Array.isArray(report.sections) || !Array.isArray(report.blocks) ||
        !Array.isArray(report.issues))
      throw new Error('Berichtsdaten aus Phase 5 fehlen oder sind beschädigt.');
    if (typeof JsPdf !== 'function') throw new Error('jsPDF ist nicht verfügbar.');

    const doc = new JsPdf({unit:'mm',format:'a4',compress:true});
    const W=210, H=297, L=16, R=16, CW=W-L-R, BOTTOM=276;
    const C={
      ink:[30,43,57], muted:[100,113,125], blue:[43,86,117],
      amber:[160,93,46], pale:[244,247,249], paleBlue:[236,243,248],
      paleWarn:[252,246,237], rule:[215,224,230], white:[255,255,255]
    };
    let y=16, sectionIndex=0, rowIndex=0;

    const color=(kind='ink')=>doc.setTextColor(...C[kind]);
    const fill=(kind)=>doc.setFillColor(...C[kind]);
    const rule=(kind='rule')=>doc.setDrawColor(...C[kind]);
    function font(size=9,style='normal',tone='ink') {
      doc.setFont('helvetica',style);
      doc.setFontSize(size);
      color(tone);
    }
    function lines(value,width,size=9,style='normal') {
      font(size,style);
      return doc.splitTextToSize(printable(value),width);
    }
    function txt(value,x,at,size=9,style='normal',tone='ink',options) {
      font(size,style,tone);
      doc.text(printable(value),x,at,options);
    }
    function page() {
      doc.addPage();
      y=25;
      txt('PEGELTOOL  /  MESSDOKUMENTATION',L,14,7.3,'bold','muted');
      rule(); doc.line(L,17,W-R,17);
    }
    function ensure(height) {if(y+height>BOTTOM) page();}
    function paragraph(value,size=8.5,leading=4.15,after=3,tone='ink') {
      const arr=lines(value,CW,size);
      arr.forEach(s=>{ensure(leading+1);txt(s,L,y+3.2,size,'normal',tone);y+=leading;});
      y+=after;
    }

    function titlePage() {
      fill('blue'); doc.rect(L,y,2.3,25,'F');
      txt('PEGELTOOL  /  MESSDOKUMENTATION',L+7,y+4,7.8,'bold','blue');
      txt('Schallpegel-Messprotokoll',L+7,y+15,18.2,'bold');
      txt(report.subtitle,L+7,y+22,8.2,'normal','muted');
      y+=32;
      txt('pegelTool '+report.toolVersion+'   |   '+report.normVersion+'   |   Normenprüfung: '+report.normStatus,
        L,y,7.7,'normal','muted');
      y+=5;
      rule();doc.line(L,y,W-R,y);y+=7;

      const statusLines=lines(report.status,CW-17,11.2,'bold');
      const warningLines=lines(report.warning,CW-17,8.2);
      const note='UNVOLLSTÄNDIG / NICHT NORMATIV FREIGEGEBEN - NICHT ALS DIN-NACHWEIS VERWENDEN';
      const noteLines=!report.reportFullyChecked ? lines(note,CW-17,7.5,'bold') : [];
      const boxH=12+statusLines.length*5.25+warningLines.length*4.1+
        (noteLines.length ? noteLines.length*3.75+4 : 0)+6;
      ensure(boxH+4);
      fill(report.reportFullyChecked ? 'paleBlue' : 'paleWarn');
      doc.rect(L,y,CW,boxH,'F');
      fill(report.reportFullyChecked ? 'blue' : 'amber');
      doc.rect(L,y,2.3,boxH,'F');
      txt('PRÜFSTATUS',L+7,y+7,7.1,'bold',report.reportFullyChecked ? 'blue' : 'amber');
      let at=y+13;
      statusLines.forEach(s=>{txt(s,L+7,at,11.2,'bold');at+=5.25;});
      at+=2.2;
      warningLines.forEach(s=>{txt(s,L+7,at,8.2);at+=4.1;});
      if(noteLines.length){
        at+=3.2;
        noteLines.forEach(s=>{txt(s,L+7,at,7.5,'bold','amber');at+=3.75;});
      }
      y+=boxH+8;
    }

    function metricOverview() {
      const summary=(report.sections.find(s=>s.title==='Auswertung und Berichtsabschluss')||{}).rows||[];
      const get=(key)=>{const r=summary.find(x=>x.label.startsWith(key));return r ? printable(r.value) : 'Nicht angegeben';};
      const entries=[
        ['LAeq-Blockmaximum',get('Höchster berechenbarer LAeq')],
        ['LCpeak-Blockmaximum',get('Höchster berechenbarer LCpeak')],
        ['30-Minuten-Blöcke',String(report.blocks.length)]
      ];
      ensure(38);
      txt('MESSWERTE IM ÜBERBLICK',L,y+1,7.3,'bold','muted');y+=5;
      const gap=4, tileW=(CW-2*gap)/3;
      entries.forEach((entry,i)=>{
        const x=L+i*(tileW+gap);
        fill('pale');doc.rect(x,y,tileW,24,'F');
        fill('blue');doc.rect(x,y,13,1.1,'F');
        txt(entry[0],x+3,y+6.6,7.0,'normal','muted');
        const size=entry[1].length>18 ? 10 : 13;
        txt(entry[1],x+3,y+17.7,size,'bold');
      });
      y+=28;
      txt('Informative Übersicht; keine eigenständige normative Grenzwertentscheidung.',L,y,7.1,'normal','muted');
      y+=7;
    }

    function section(title) {
      const titleLines=lines(title,CW-17,10.5,'bold');
      const needed=8+titleLines.length*4.8;
      ensure(needed+5);
      y+=4;
      fill('blue');doc.rect(L,y,2,6.7,'F');
      txt(String(++sectionIndex).padStart(2,'0'),L+5,y+5.2,7.5,'bold','blue');
      titleLines.forEach((s,i)=>txt(s,L+16,y+5.3+i*4.8,10.5,'bold'));
      y+=7.5+titleLines.length*4.8;
      rule();doc.line(L,y-1,W-R,y-1);y+=3;
    }

    function kv(label,value,source) {
      const keyWidth=55, valueWidth=CW-keyWidth-7;
      const a=lines(label,keyWidth-3,7.8,'bold');
      const b=lines(value,valueWidth-2,8.5);
      const src=source ? lines('Quelle: '+source,valueWidth-2,7.1) : [];
      const right=[...b.map(t=>({t,size:8.5,tone:'ink'})),
                   ...src.map(t=>({t,size:7.1,tone:'muted'}))];
      const count=Math.max(a.length,right.length,1);
      let pos=0;
      while(pos<count) {
        if(y+10>BOTTOM) page();
        const fit=Math.max(1,Math.floor((BOTTOM-y-5)/4.25));
        const take=Math.min(fit,count-pos);
        const h=take*4.25+3.3;
        if(rowIndex%2===0) {fill('pale');doc.rect(L,y,CW,h,'F');}
        for(let i=0;i<take;i++){
          const idx=pos+i, at=y+4.3+i*4.25;
          if(a[idx]) txt(a[idx],L+2,at,7.8,'bold','muted');
          if(right[idx]) txt(right[idx].t,L+keyWidth+3,at,right[idx].size,'normal',right[idx].tone);
        }
        y+=h;pos+=take;
        if(pos<count) page();
      }
      rowIndex++;
    }

    function tableHead() {
      ensure(15);
      fill('blue');doc.rect(L,y,CW,10,'F');
      const titles=[['ZEITRAUM',2],['ABDECKUNG',52],['LAeq 30 MIN',85],
        ['LCpeak',116],['DATENLAGE',143]];
      titles.forEach(t=>txt(t[0],L+t[1],y+6.3,7.0,'bold','white'));
      y+=10;
    }

    function tableRow(b,index) {
      const xs=[2,52,85,116,143], widths=[48,30,28,25,32];
      const cells=[
        [...lines(b.from,widths[0],7.3),...lines(b.to,widths[0],7.3)],
        lines(b.coverage,widths[1],7.3),
        lines(b.laeq,widths[2],8.2,'bold'),
        lines(b.lcpeak,widths[3],8.2,'bold'),
        lines(b.quality,widths[4],7.5)
      ];
      const n=Math.max(2,...cells.map(x=>x.length));
      const h=3.8*n+4.5;
      if(y+h+6>BOTTOM){page();tableHead();}
      const bg=index%2===0 ? 'pale' : 'white';
      fill(bg);doc.rect(L,y,CW,h,'F');
      cells.forEach((arr,ci)=>{
        arr.forEach((s,k)=>{
          const emph=ci===2||ci===3, tone=ci===4?'muted':'ink';
          txt(s,L+xs[ci],y+5+k*3.8,emph?8.2:ci===4?7.5:7.3,emph?'bold':'normal',tone);
        });
      });
      y+=h;
      // Every source reference is retained, including arbitrarily long log-line lists.
      const sources=lines(b.source,CW-8,6.9);
      for(let i=0;i<sources.length;i++){
        if(y+5>BOTTOM) {page();tableHead();}
        fill(bg);doc.rect(L,y,CW,4.0,'F');
        txt(sources[i],L+3,y+2.8,6.9,'normal','muted');
        y+=4.0;
      }
      rule();doc.line(L,y+0.2,W-R,y+0.2);y+=1.3;
    }

    function issues() {
      section('Prüfhinweise ('+report.issues.length+')');
      if(!report.issues.length){
        paragraph('Keine zusätzlichen technischen Hinweise erfasst. Die DIN-Freigabe ist dennoch ausstehend.',8.5);
        return;
      }
      // Group identical sources instead of repeating the same scope in every line.
      // Scope, code and the original unabridged message are all retained.
      const groups=new Map();
      report.issues.forEach(item=>{
        if(!groups.has(item.scope)) groups.set(item.scope,[]);
        groups.get(item.scope).push(item);
      });
      for(const [scope,items] of groups){
        ensure(13);
        y+=3;
        fill('paleBlue');doc.rect(L,y,CW,7,'F');
        txt(scope.toUpperCase()+'   /   '+items.length+' Hinweise',L+3,y+4.9,7.9,'bold','blue');
        y+=9;
        for(let i=0;i<items.length;i++){
          const item=items[i];
          const textLines=lines('['+item.code+']  '+item.message,CW-8,7.8);
          const height=textLines.length*3.95+2.2;
          if(y+height>BOTTOM) page();
          if(i%2===0){fill('pale');doc.rect(L,y,CW,Math.min(height,BOTTOM-y),'F');}
          for(const s of textLines){
            ensure(4.2);
            txt(s,L+3,y+3.0,7.8);
            y+=3.95;
          }
          y+=2.2;
        }
        y+=2;
      }
    }

    doc.setProperties({
      title:'Schallpegel-Messprotokoll (vorläufig)',
      subject:printable(report.normVersion+' - '+report.status),
      author:'pegelTool '+report.toolVersion,
      keywords:'Schallpegel, Messprotokoll, nicht beurteilbar'
    });

    titlePage();
    metricOverview();
    for(const s of report.sections){
      section(s.title);
      for(const r of s.rows) kv(r.label,r.value,r.source);
      y+=2;
    }

    section('30-Minuten-Beurteilungsblöcke ('+report.blocks.length+')');
    paragraph('Auswertung als technische Arbeitsannahme; keine verbindliche DIN-Bewertung. "Technisch vollständig" bezeichnet ausschließlich die Datenabdeckung.',8.0,4.0,4,'muted');
    tableHead();
    report.blocks.forEach((b,i)=>tableRow(b,i));

    issues();
    section('Zusätzliche Visualisierungen');
    paragraph('Die Diagramme und gleitenden LAeq_g5-/LAeq_g30-Anzeigen der Anwendung sind informativ. Sie bilden keine eigenständigen normativen Grenzwertentscheidungen.',8.5);

    section('Berichtsabschluss');
    paragraph('Unterschriftsbereich (nicht unterschrieben; keine automatische Bestätigung)',8.2,4.1,6,'muted');
    ensure(34);
    rule();doc.line(L,y+19,L+81,y+19);doc.line(L+96,y+19,W-R,y+19);
    txt('Ort, Datum',L,y+24,7.6,'normal','muted');
    txt('Name und Unterschrift',L+96,y+24,7.6,'normal','muted');
    y+=31;

    const pages=doc.internal.getNumberOfPages();
    for(let i=1;i<=pages;i++){
      doc.setPage(i);
      rule();doc.line(L,282,W-R,282);
      txt('pegelTool '+report.toolVersion+'  |  '+report.normVersion,L,288,7.0,'normal','muted');
      txt('Seite '+i+'/'+pages,W-R,288,7.0,'bold','muted',{align:'right'});
    }
    return doc;
  }
  return Object.freeze({create,printable});
});
