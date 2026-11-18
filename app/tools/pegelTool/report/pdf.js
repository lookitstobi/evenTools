/* Compact two-page A4 PDF report.
 * Layout based on the 2026-11-18 pegelTool mockup. Numeric input is the
 * canonical report model and original chart samples; no recalc of sound
 * levels from rounded display strings and no DIN compliance certificate.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.PegelToolReportPdf=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const COLOR={
    navy:[21,35,53],navy2:[36,55,75],text:[24,38,56],muted:[102,117,136],
    pale:[245,247,250],border:[223,230,236],white:[255,255,255],
    cyan:[2,142,160],blue:[78,120,159],yellow:[249,211,58],
    amber:[166,111,13],green:[20,127,99],greenBg:[234,247,240],
    red:[174,54,62],redBg:[255,237,238],warnBg:[255,243,217]
  };
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  const clean=v=>String(v===undefined||v===null?'':v).replace(/[\u0000-\u001f]/g,' ').trim();
  const printable=v=>clean(v).replace(/[\u2012-\u2015\u2212]/g,'-')
    .replace(/\u2026/g,'...').replace(/\u2022/g,'-')
    .replace(/[\u200b-\u200d\uFEFF]/g,'');
  const valid=v=>v!==null&&v!==undefined&&clean(v)!==''&&!/^(Nicht angegeben|Nicht ermittelt|Keine Zeilennachweise|---)$/i.test(clean(v));
  const euro=v=>finite(v)?v.toFixed(2).replace('.',','):'-';
  const one=v=>finite(v)?v.toFixed(1).replace('.',','):'-';
  const short=v=>valid(v)?printable(v):'Nicht dokumentiert';
  function get(report,label){
    for(const sec of report.sections||[]) for(const r of sec.rows||[])
      if(r.label===label)return r.value;
    return '';
  }
  function create(report,JsPdf,opts){
    if(!report||!Array.isArray(report.sections)||!Array.isArray(report.blocks))
      throw new Error('Berichtsdaten fehlen.');
    if(typeof JsPdf!=='function')throw new Error('jsPDF ist nicht verfügbar.');
    const doc=new JsPdf({unit:'mm',format:'a4',compress:true});
    const charts=Array.isArray(opts&&opts.chartSamples)?opts.chartSamples:[];
    const W=210,H=297,M=13,CW=184;
    const RGB=c=>doc.setFillColor(...c);
    const stroke=c=>doc.setDrawColor(...c);
    const ink=c=>doc.setTextColor(...c);
    const font=(size=9,bold=false)=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);};
    function label(text,x,y,size=8,color=COLOR.text,bold=false,align){
      font(size,bold);ink(color);doc.text(printable(text),x,y,align?{align}:undefined);
    }
    function box(x,y,w,h,color,r=0,border){
      RGB(color);if(border)stroke(border);
      if(r)doc.roundedRect(x,y,w,h,r,r,border?'FD':'F');
      else doc.rect(x,y,w,h,border?'FD':'F');
    }
    function hair(x1,y1,x2,y2,color=COLOR.border,width=.22){
      stroke(color);doc.setLineWidth(width);doc.line(x1,y1,x2,y2);
    }
    function fit(value,width,size=8,bold=false){
      font(size,bold);let s=short(value);
      if(doc.getTextWidth(s)<=width)return s;
      while(s.length>1 && doc.getTextWidth(s+'...')>width)s=s.slice(0,-1);
      return s+'...';
    }
    function wrapped(value,width,size=7.9,maxLines=2){
      font(size);
      const lines=doc.splitTextToSize(short(value),width);
      const a=lines.slice(0,maxLines);
      if(lines.length>maxLines){
        let s=a[a.length-1];
        while(s.length>1&&doc.getTextWidth(s+'...')>width)s=s.slice(0,-1);
        a[a.length-1]=s+'...';
      }
      return a;
    }
    function footer(pg){
      hair(M,285,W-M,285);
      label('pegelTool '+short(report.toolVersion)+'  |  Technische Messwertübersicht',M,289,6.4,COLOR.muted);
      label('Seite '+pg+' / 2',W-M,289,6.4,COLOR.muted,false,'right');
    }
    const rawPeriods=report.blocks.map(b=>b.raw||{});
    const complete=rawPeriods.filter(b=>b.dataQuality==='complete'&&finite(b.laeq30Db));
    const laeMax=complete.length?Math.max(...complete.map(b=>b.laeq30Db)):null;
    const allPeak=rawPeriods.map(b=>finite(b.lcpeakObservedDb)?b.lcpeakObservedDb:b.lcpeakMaxDb).filter(finite);
    const lcMax=allPeak.length?Math.max(...allPeak):null;
    const anyExceed=(finite(laeMax)&&laeMax>99)||(finite(lcMax)&&lcMax>135);
    const partial=rawPeriods.filter(b=>b.dataQuality!=='complete').length;
    const status=anyExceed?'Grenzwert in erfassten Daten überschritten':
      complete.length||allPeak.length?'Keine Überschreitung in auswertbaren Messwerten':
      'Keine ausreichend auswertbaren Messwerte';
    const statusColor=anyExceed?COLOR.red:complete.length||allPeak.length?COLOR.green:COLOR.amber;
    const statusBg=anyExceed?COLOR.redBg:complete.length||allPeak.length?COLOR.greenBg:COLOR.warnBg;
    const venue=short(get(report,'Veranstaltungsort'));
    const date=short(get(report,'Messdatum'));
    const eventName=short(get(report,'Veranstaltung'));

    doc.setProperties({title:'Schallpegel-Messprotokoll',subject:short(report.normVersion),
      author:'pegelTool '+short(report.toolVersion),keywords:'Schallpegel, Messprotokoll, LAeq, LCpeak'});

    // PAGE ONE - rapid overview
    box(0,0,W,34,COLOR.navy);
    box(M,11,2.2,15,COLOR.yellow,1);
    label('PEGELTOOL / MESSPROTOKOLL',M+7,11,8.3,[177,192,204],true);
    label('Schallpegelmessung',M+7,21.3,19.5,COLOR.white,true);
    label(short(report.normVersion)+'  |  Technische Messwertübersicht',M+7,28,7.5,[202,217,229]);
    label('PDF / A4',W-M,11,7.0,COLOR.yellow,true,'right');

    label('VERANSTALTUNG / MESSORT',M,41.5,6.9,COLOR.muted,true);
    label(fit(eventName,CW,13.2,true),M,49.5,13.2,COLOR.navy,true);
    label(fit(venue+'  |  '+date,CW,8.4),M,56.6,8.4,COLOR.muted);
    hair(M,60,W-M,60);

    const kY=64,kH=35,kG=3.6,kW=(CW-2*kG)/3;
    for(let i=0;i<3;i++) box(M+i*(kW+kG),kY,kW,kH,COLOR.pale,2);
    box(M,kY,1.2,kH,COLOR.cyan);
    box(M+kW+kG,kY,1.2,kH,COLOR.cyan);
    box(M+2*(kW+kG),kY,1.2,kH,COLOR.yellow);
    label('LAeq, 30 min / MAX',M+4,kY+8,6.7,COLOR.muted,true);
    label('LCpeak / MAX',M+kW+kG+4,kY+8,6.7,COLOR.muted,true);
    label('DATENABDECKUNG',M+2*(kW+kG)+4,kY+8,6.7,COLOR.muted,true);
    label(euro(laeMax),M+4,kY+21.5,18,COLOR.navy,true);
    label('dB(A)',M+38,kY+21.5,7.4,COLOR.muted,true);
    label('99 dB(A) Vergleichswert',M+4,kY+30,6.5,COLOR.muted);
    label(one(lcMax),M+kW+kG+4,kY+21.5,18,COLOR.navy,true);
    label('dB(C)',M+kW+kG+43,kY+21.5,7.4,COLOR.muted,true);
    label('135 dB(C) Vergleichswert',M+kW+kG+4,kY+30,6.5,COLOR.muted);
    label(complete.length+' / '+report.blocks.length,M+2*(kW+kG)+4,kY+21.5,18,COLOR.navy,true);
    label('vollständige Zeitblöcke',M+2*(kW+kG)+4,kY+28,6.4,COLOR.text);
    label(partial+' unvollständig/Teilzeit',M+2*(kW+kG)+4,kY+33,6.2,COLOR.muted);

    box(M,103,CW,16,statusBg,2);
    box(M+4,108,4.8,4.8,statusColor,2.4);
    label(fit(status,CW-18,9.1,true),M+12,109.5,9.1,statusColor,true);
    label('Nur erfasste Messdaten; keine DIN-Konformitätsbescheinigung.',M+12,115.2,6.8,COLOR.muted);

    function drawChart(x,y,w,h,title,subtitle,key,ymin,ymax,limit,color){
      box(x,y,w,h,COLOR.white,2,COLOR.border);
      label(title,x+5,y+9,10,COLOR.navy,true);
      label(fit(subtitle,w-10,7),x+5,y+14,7,COLOR.muted);
      const px=x+14,py=y+20,pw=w-20,ph=h-27;
      box(px,py,pw,ph,COLOR.pale);
      for(let t=Math.ceil(ymin/10)*10;t<=ymax;t+=10){
        const yy=py+ph-(t-ymin)/(ymax-ymin)*ph;
        hair(px,yy,px+pw,yy,[229,235,240],.12);
        label(String(t),px-2,yy+.75,6,COLOR.muted,false,'right');
      }
      const threshold=py+ph-(limit-ymin)/(ymax-ymin)*ph;
      stroke(COLOR.amber);doc.setLineWidth(.43);doc.setLineDashPattern([2,1.8],0);
      doc.line(px,threshold,px+pw,threshold);doc.setLineDashPattern([],0);
      label(limit+' dB',px+pw-1,threshold-1.4,6.3,COLOR.amber,true,'right');
      const times=[0,.25,.5,.75,1];
      times.forEach(fr=>{
        const idx=Math.round(fr*Math.max(0,charts.length-1));
        const s=charts[idx]||{};
        if(!s.time)return;
        const xx=px+fr*pw;
        label(clean(s.time).slice(0,5),xx,py+ph+4.3,6.1,COLOR.muted,false,'center');
      });
      let prev=null,highest=null;
      const n=Math.min(charts.length,900);
      for(let i=0;i<n;i++){
        const z=charts[Math.min(charts.length-1,Math.floor(i*charts.length/n))]||{};
        const v=z[key];
        if(!finite(v)){prev=null;continue;}
        const xx=px+(i/Math.max(1,n-1))*pw;
        const yy=py+ph-Math.max(0,Math.min(1,(v-ymin)/(ymax-ymin)))*ph;
        if(prev){
          stroke(color);doc.setLineWidth(.3);doc.line(prev.x,prev.y,xx,yy);
        }
        prev={x:xx,y:yy};
        if(!highest||v>highest.v)highest={v,x:xx,y:yy};
      }
      if(highest){
        RGB(COLOR.white);stroke(color);doc.setLineWidth(.48);
        doc.circle(highest.x,highest.y,1.2,'FD');
        const lx=Math.min(highest.x+3,px+pw-19);
        label(one(highest.v)+' dB',lx,Math.max(py+3,highest.y-2.3),6.3,color,true);
      }
      if(!charts.length) label('Keine Diagrammdaten für den Export verfügbar.',x+w/2,y+h/2,8,COLOR.muted,false,'center');
    }
    drawChart(M,123,CW,68,'01  Pegelverlauf LAeq,g30',
      'Gleitender 30-Minuten-Pegel - informativ - XL3-Gerätedaten','LAeq_g30',40,105,99,COLOR.cyan);
    drawChart(M,196,CW,67,'02  Spitzenpegel LCpeak',
      'C-bewertete Spitzenwerte der aufgezeichneten Intervalle','LC',60,140,135,COLOR.blue);
    label('Diagramme sind Zusatzanalysen; die festen Beurteilungsblöcke stehen auf Seite 2.',M,270,7,COLOR.muted);
    label('Fehlende Messzeiten werden nicht rechnerisch ergänzt. Original-Log separat archivieren.',M,275,7,COLOR.muted);
    footer(1);

    // PAGE TWO - timed assessment and documentation
    doc.addPage();
    box(0,0,W,27,COLOR.navy);
    box(M,8,2,12,COLOR.yellow,.8);
    label('MESSDATEN UND NACHWEISE',M+6,15.5,14.5,COLOR.white,true);
    label(fit(date+'  |  '+get(report,'Messgerät'),CW-6,7),M+6,22,7,[206,220,229]);
    label('A4 / 2 SEITEN',W-M,11,7,COLOR.yellow,true,'right');
    label('30-MINUTEN-BEURTEILUNGSZEITRÄUME',M,36,9.8,COLOR.navy,true);
    label(complete.length+' vollständig / '+partial+' unvollständig',W-M,36,7.5,COLOR.muted,false,'right');

    // Maximum twelve shown on paper; always expose truncation instead of
    // silently suggesting a complete table for longer recordings.
    const cap=12;
    let chosen=report.blocks.map((b,i)=>({b,i}));
    if(chosen.length>cap){
      const weight=({b,i})=>{
        const r=b.raw||{};
        return (r.dataQuality==='complete'?0:60)+
          (finite(r.laeq30Db)&&r.laeq30Db>99?150:0)+
          (finite(r.lcpeakObservedDb)&&r.lcpeakObservedDb>135?150:0)+
          (finite(r.laeq30Db)?r.laeq30Db/2:0)+
          (finite(r.lcpeakObservedDb)?r.lcpeakObservedDb/3:0)+
          (i===0||i===report.blocks.length-1?80:0);
      };
      chosen=chosen.sort((a,b)=>weight(b)-weight(a)).slice(0,cap).sort((a,b)=>a.i-b.i);
    }
    const tY=41,tH=6.8;
    box(M,tY,CW,7,COLOR.navy2,1.5);
    [['ZEITRAUM',M+3],['ABDECKUNG',M+52],['LAeq',M+91],['LCpeak',M+128],['STATUS',M+157]]
      .forEach(([t,x])=>label(t,x,tY+4.7,6.4,COLOR.white,true));
    chosen.forEach(({b,i},j)=>{
      const y=tY+7+j*tH;
      box(M,y,CW,tH,j%2?COLOR.pale:COLOR.white);
      const r=b.raw||{};
      const m1=clean(b.from).match(/(\d{2}:\d{2})/);
      const m2=clean(b.to).match(/(\d{2}:\d{2})/);
      label((m1?m1[1]:'--:--')+'-'+(m2?m2[1]:'--:--'),M+3,y+4.7,7.5,COLOR.navy,true);
      const cov=finite(r.coveredSeconds)?Math.round(r.coveredSeconds)+' / '+Math.round(r.expectedSeconds||1800)+' s':short(b.coverage);
      label(fit(cov,35,7),M+52,y+4.7,7,COLOR.text);
      const full=r.dataQuality==='complete',val=full?r.laeq30Db:r.laeqObservedDb;
      label(finite(val)?one(val)+(full?'':' *'):'-',M+91,y+4.7,7.8,COLOR.navy,true);
      const peak=finite(r.lcpeakObservedDb)?r.lcpeakObservedDb:r.lcpeakMaxDb;
      label(one(peak),M+128,y+4.7,7.8,COLOR.navy,true);
      const over=(full&&finite(val)&&val>99)||(finite(peak)&&peak>135);
      const state=over?'Überschritten':full?'Unter Grenze':r.dataQuality==='conflict'?'Zeitkonflikt':'Teilzeit';
      label(state,M+157,y+4.7,6.8,over?COLOR.red:full?COLOR.green:COLOR.amber,true);
    });
    const last=tY+7+chosen.length*tH;
    hair(M,last,W-M,last);
    if(report.blocks.length>chosen.length)
      label('Auswahl von '+chosen.length+' / '+report.blocks.length+' Zeitfenstern (auffällige/teilweise erfasste priorisiert). Vollständige Daten im Projekt/XL3-Report.',M,last+5.3,6.4,COLOR.amber);
    else
      label('* LAeq über erfasste Teilzeit, kein vollständiger LAeq,30min. LCpeak = Maximum des erfassten Intervalls.',M,last+5.3,6.3,COLOR.muted);
    label('Vergleichswerte: 99 dB(A) LAeq,30min und 135 dB(C) LCpeak; geräteseitige k1/k2-Korrekturen nicht doppeln.',M,last+9.8,6.3,COLOR.muted);

    const panelY=Math.max(136,last+13);
    const panelBottom=242;
    const panelH=panelBottom-panelY;
    const panelW=(CW-4)/2;
    box(M,panelY,panelW,panelH,COLOR.white,2,COLOR.border);
    box(M+panelW+4,panelY,panelW,panelH,COLOR.white,2,COLOR.border);
    function field(x,y,title,value,width,maxLines=1){
      label(title.toUpperCase(),x,y,5.9,COLOR.muted,true);
      const ls=wrapped(value,width,7.4,maxLines);
      ls.forEach((s,i)=>label(s,x,y+4.5+i*4,7.4,COLOR.text));
      return y+8.5+(ls.length-1)*4;
    }
    const L=M+4,R=M+panelW+8,F=panelW-8;
    label('01  VERANSTALTUNG UND MESSORT',L,panelY+7,8.1,COLOR.navy,true);
    hair(L,panelY+9,L+F,panelY+9);
    let a=panelY+15;
    a=field(L,a,'Veranstalter',get(report,'Veranstalter / Anschrift'),F,2);
    a=field(L,a,'Ort / Anschrift',venue+' / '+get(report,'Anschrift / Ortsangabe'),F,2);
    a=field(L,a,'Messperson',get(report,'Messperson'),F);
    a=field(L,a,'Messposition',get(report,'Tatsächlicher Messort'),F,2);
    a=field(L,a,'Maßg. Immissionsort LAeq',get(report,'Maßgeblicher Immissionsort LAeq'),F,2);
    a=field(L,a,'Maßg. Immissionsort LCpeak',get(report,'Maßgeblicher Immissionsort LCpeak'),F,2);

    label('02  MESSGERÄT UND KORREKTUREN',R,panelY+7,8.1,COLOR.navy,true);
    hair(R,panelY+9,R+F,panelY+9);
    let b=panelY+15;
    b=field(R,b,'Messgerät / Seriennr.',get(report,'Messgerät')+' / '+get(report,'Messgerät-Seriennummer'),F);
    b=field(R,b,'Mikrofon / Seriennr.',get(report,'Messmikrofon')+' / '+get(report,'Mikrofon-Seriennummer'),F);
    b=field(R,b,'Messbeginn - Messende',get(report,'Messbeginn laut Log')+' bis '+get(report,'Messende laut Log'),F,2);
    b=field(R,b,'Korrekturen',get(report,'k1 – LAeq')+' / '+get(report,'k2 – LCpeak'),F);
    b=field(R,b,'Korrekturstatus','k1: '+get(report,'k1 – im Gerätelog angewandt?')+'; k2: '+get(report,'k2 – im Gerätelog angewandt?'),F,2);
    b=field(R,b,'Ermittlung k1/k2',get(report,'k1 – Herkunft / Ermittlung')+' / '+get(report,'k2 – Herkunft / Ermittlung'),F,2);
    b=field(R,b,'Kalibrator',get(report,'Kalibrator')+' / '+get(report,'Kalibrator-Seriennummer'),F);
    b=field(R,b,'Prüfung vor/nach',get(report,'Vor der Messung – Anzeige')+' / '+get(report,'Nach der Messung – Anzeige'),F);
    if(a>panelBottom-2||b>panelBottom-2)
      label('Weitere Formularangaben und Nachweise sind im gespeicherten Projekt enthalten.',M,panelBottom+2,6,COLOR.amber);

    box(M,246,CW,17,COLOR.pale,2);
    label('BESCHALLUNGSANLAGE',M+4,251.5,6.3,COLOR.muted,true);
    label(fit(get(report,'PA-Komponenten'),CW-8,8),M+4,257.2,8,COLOR.navy,true);
    label('Protokolllage: '+(report.documentationComplete?'vollständig':'offene Angaben')+
      '  |  Technische Nachweise: '+(report.evidenceComplete?'vorhanden':'teilweise offen')+
      '  |  Hinweise: '+(Array.isArray(report.issues)?report.issues.length:0),M,269,7,COLOR.muted);
    label('Quelle: '+fit(report.sourceLog,CW-26,6.3),M,273.2,6.3,COLOR.muted);
    label(fit('Bericht: '+get(report,'Berichtsort')+', '+get(report,'Berichtsdatum')+'  |  '+get(report,'Erstellt von'),135,7.4),M,278,7.4,COLOR.text);
    label('Unterschrift: __________________',W-M,278,7.4,COLOR.text,false,'right');
    footer(2);
    return doc;
  }
  return Object.freeze({create,printable});
});