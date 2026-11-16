/* Phase 5: one PDF backend for the canonical PegelToolReport presentation.
 * Uses jsPDF loaded by the application; no template fallback, no old "OK" logic.
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
      .replace(/[\u2012\u2013\u2014\u2212]/g,'-')
      .replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"')
      .replace(/\u2026/g,'...').replace(/\u2022/g,'-')
      .replace(/[\u200b-\u200d\uFEFF]/g,'')
      .replace(/[\u0000-\u0008\u000b\u000e-\u001f]/g,' ');
  }
  function create(report, JsPdf) {
    if (!report || !Array.isArray(report.sections) || !Array.isArray(report.blocks) ||
        !Array.isArray(report.issues))
      throw new Error('Berichtsdaten aus Phase 5 fehlen oder sind beschädigt.');
    if (typeof JsPdf !== 'function') throw new Error('jsPDF ist nicht verfügbar.');
    const doc=new JsPdf({unit:'mm',format:'a4',compress:true});
    const W=210,H=297,left=16,right=16,top=20,bottom=20,usable=W-left-right;
    let y=top;
    const split=(s,width,size)=>{
      doc.setFontSize(size);
      return doc.splitTextToSize(printable(s), width);
    };
    function addPage(){doc.addPage();y=top;}
    function ensure(h){if(y+h>H-bottom) addPage();}
    function renderLines(lines,x,size,leading) {
      doc.setFontSize(size);
      for (const raw of lines) {
        ensure(leading);
        doc.text(printable(raw),x,y);
        y+=leading;
      }
    }
    function paragraph(text,size=9,leading=4.3,spaceAfter=3) {
      doc.setFont('helvetica','normal');
      renderLines(split(text,usable,size),left,size,leading);
      y+=spaceAfter;
    }
    function heading(title) {
      ensure(13);
      y+=5;
      doc.setFont('helvetica','bold');
      renderLines(split(title,usable,11),left,11,5);
      doc.setDrawColor(175);
      doc.line(left,y,left+usable,y);y+=3;
    }
    function kv(label,value,source) {
      const kWidth=57, vWidth=usable-kWidth-4;
      const val=String(value) + (source ? ' [Quelle: '+source+']' : '');
      doc.setFont('helvetica','bold');
      const keys=split(label,kWidth,8);
      doc.setFont('helvetica','normal');
      const values=split(val,vWidth,8.6);
      const maxLines=Math.max(keys.length,values.length);
      const maxPerPage=Math.max(1,Math.floor((H-bottom-top)/4.25));
      let offset=0;
      while(offset<maxLines){
        if(y+4.25>H-bottom) addPage();
        const room=Math.max(1,Math.floor((H-bottom-y)/4.25));
        const count=Math.min(room,maxLines-offset,maxPerPage);
        for(let i=0;i<count;i++){
          const line=offset+i;
          if(keys[line]) {doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text(printable(keys[line]),left,y);}
          if(values[line]) {doc.setFont('helvetica','normal');doc.setFontSize(8.6);doc.text(printable(values[line]),left+kWidth+4,y);}
          y+=4.25;
        }
        offset+=count;
      }
      y+=1.3;
    }
    function drawTableHeader() {
      ensure(12);
      doc.setFillColor(232,235,240);
      doc.rect(left,y-3,usable,8,'F');
      doc.setFont('helvetica','bold');
      doc.setFontSize(7.5);
      [['Zeitraum',0],['Abdeckung',53],['LAeq 30min',82],['LCpeak',113],['Datenlage',143]].forEach(r=>{
        doc.text(r[0],left+r[1]+1,y+1.5);
      });
      y+=8;
    }
    function block(b) {
      const cols=[
        [b.from+' / '+b.to,52],
        [b.coverage,28],
        [b.laeq,30],
        [b.lcpeak,29],
        [b.quality,34]
      ];
      const xs=[0,53,82,113,143];
      const rendered=cols.map(c=>split(c[0],c[1]-1,7.2));
      const maxLines=Math.max(...rendered.map(x=>x.length));
      const source=split(b.source,usable-6,7.1);
      // Keep complete table row together where possible; addPage for longer rows.
      const height=3.6*maxLines + 3.4*source.length + 4;
      if(y+height>H-bottom) {addPage();drawTableHeader();}
      doc.setFont('helvetica','normal');
      doc.setFontSize(7.2);
      const start=y;
      for(let i=0;i<cols.length;i++){
        const x=left+xs[i]+1;
        for(let j=0;j<rendered[i].length;j++) doc.text(printable(rendered[i][j]),x,start+3.6*j);
      }
      y+=maxLines*3.6+1;
      doc.setFontSize(7.1);
      doc.setTextColor(90);
      for(const l of source){doc.text(printable(l),left+2,y);y+=3.4;}
      doc.setTextColor(0);
      y+=2.5;
      doc.setDrawColor(222);
      doc.line(left,y-1,left+usable,y-1);
    }

    doc.setProperties({
      title:'Schallpegel-Messprotokoll (vorläufig)',
      subject:report.normVersion+' - nicht beurteilbar',
      author:'pegelTool '+report.toolVersion,
      keywords:'Schallpegel, Messprotokoll, nicht beurteilbar'
    });
    doc.setFont('helvetica','bold');
    renderLines(split('Schallpegel-Messprotokoll',usable,17),left,17,7.5);
    y+=3;
    doc.setFont('helvetica','bold');
    renderLines(split(report.status,usable,12),left,12,6);
    y+=1;
    doc.setFont('helvetica','normal');
    paragraph(report.subtitle,9,4.5,1);
    paragraph('pegelTool '+report.toolVersion+' | Normbezug: '+report.normVersion+
      ' | Normenprüfung: '+report.normStatus,8,4.1,4);
    doc.setDrawColor(150);
    doc.rect(left,y,usable,1,'F');y+=7;
    paragraph(report.warning,9.5,4.8,3);
    if(!report.reportFullyChecked) {
      doc.setFont('helvetica','bold');
      paragraph('UNVOLLSTÄNDIG / NICHT NORMATIV FREIGEGEBEN - NICHT ALS DIN-NACHWEIS VERWENDEN',8.5,4.4,5);
    }
    for(const section of report.sections){
      heading(section.title);
      for(const r of section.rows) kv(r.label,r.value,r.source);
    }

    heading('30-Minuten-Beurteilungsblöcke ('+report.blocks.length+')');
    paragraph('Auswertung als technische Arbeitsannahme; keine verbindliche DIN-Bewertung. "Technisch vollständig" besagt nur, dass Messintervalle den Block abdecken.',8.5);
    drawTableHeader();
    for(const b of report.blocks) block(b);

    heading('Prüfhinweise ('+report.issues.length+')');
    if(!report.issues.length)
      paragraph('Keine zusätzlichen technischen Hinweise erfasst. Die DIN-Freigabe ist dennoch ausstehend.',8.5);
    for(const item of report.issues){
      paragraph('['+item.scope+' / '+item.code+'] '+item.message,8,3.8,1.8);
    }
    heading('Zusätzliche Visualisierungen');
    paragraph('Die Diagramme und gleitenden LAeq_g5-/LAeq_g30-Anzeigen der Anwendung sind informativ. Sie bilden keine eigenständigen normativen Grenzwertentscheidungen.',8.5);

    heading('Berichtsabschluss');
    paragraph('Unterschriftsfeld (nicht unterschrieben; keine automatische Bestätigung)',8);
    ensure(30);
    doc.setDrawColor(125);
    doc.rect(left,y,usable,22);
    y+=28;

    const pages=doc.internal.getNumberOfPages();
    for(let i=1;i<=pages;i++){
      doc.setPage(i);
      doc.setDrawColor(190);
      doc.line(left,H-14,W-right,H-14);
      doc.setTextColor(95);
      doc.setFont('helvetica','normal');
      doc.setFontSize(7);
      doc.text('pegelTool '+report.toolVersion+' | '+report.normVersion+
        ' | Nicht beurteilbar',left,H-10);
      doc.text('Seite '+i+'/'+pages,W-right,H-10,{align:'right'});
      doc.setTextColor(0);
    }
    return doc;
  }
  return Object.freeze({create,printable});
});
