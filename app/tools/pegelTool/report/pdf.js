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
  const short=v=>valid(v)?printable(v):'—';
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
    const W=210,H=297,M=14,CW=182;
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
      hair(M,285,W-M,285,[170,182,193],.18);
      label('pegelTool '+short(report.toolVersion)+'  |  Schallpegel-Messprotokoll  |  '+date,M,290,6.4,COLOR.muted);
      label('Seite '+pg+' / 2',W-M,289,6.4,COLOR.muted,false,'right');
    }
    const rawPeriods=report.blocks.map(b=>b.raw||{});
    const complete=rawPeriods.filter(b=>b.dataQuality==='complete'&&finite(b.laeq30Db));
    const fullLAeq=rawPeriods.map(b=>b.laeq30Db).filter(finite);
    const laeMax=fullLAeq.length?Math.max(...fullLAeq):null;
    const allPeak=rawPeriods.map(b=>finite(b.lcpeakObservedDb)?b.lcpeakObservedDb:b.lcpeakMaxDb).filter(finite);
    const lcMax=allPeak.length?Math.max(...allPeak):null;
    const anyExceed=(finite(laeMax)&&laeMax>99)||(finite(lcMax)&&lcMax>135);
    const partial=rawPeriods.filter(b=>b.dataQuality!=='complete').length;
    const status=anyExceed?'Grenzwert in erfassten Daten überschritten':
      fullLAeq.length&&allPeak.length?'Keine Grenzwertüberschreitung in den auswertbaren Messwerten':
      fullLAeq.length||allPeak.length?'Nur teilweise auswertbar - eine Messgröße fehlt':
      'Keine ausreichend auswertbaren Messwerte';
    const statusColor=anyExceed?COLOR.red:fullLAeq.length&&allPeak.length?COLOR.green:COLOR.amber;
    const statusBg=anyExceed?COLOR.redBg:fullLAeq.length&&allPeak.length?COLOR.greenBg:COLOR.warnBg;
    const venue=short(get(report,'Veranstaltungsort'));
    const date=formatDate(get(report,'Messdatum'));
    const eventName=short(get(report,'Veranstaltung'));

    doc.setProperties({title:'Schallpegel-Messprotokoll',subject:short(report.normVersion),
      author:'pegelTool '+short(report.toolVersion),keywords:'Schallpegel, Messprotokoll, LAeq, LCpeak'});

    function formatDate(v){
      const m=clean(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m?m[3]+'.'+m[2]+'.'+m[1]:short(v);
    }
    function time(v){
      const m=clean(v).match(/\b\d{2}:\d{2}(?::\d{2})?\b/);
      return m?m[0]:'—';
    }
    const startTime=get(report,'Messbeginn laut Log'),endTime=get(report,'Messende laut Log');
    const timeRange=time(startTime)+'–'+time(endTime);
    const gridColor=[170,182,193],stripe=[239,242,244];
    function heading(title,y,right){
      label(title,M,y,10.8,COLOR.text,true);
      if(right)label(fit(right,76,7),W-M,y,7,COLOR.muted,false,'right');
      hair(M,y+2,W-M,y+2,gridColor,.18);
    }
    function pairs(left,right,y,rowH=6.1,leftLabel=39,rightLabel=41,maxLines=1){
      const split=M+CW/2+1;
      let yy=y;
      for(let i=0;i<Math.max(left.length,right.length);i++){
        let n=1;
        for(const [pair,x,lw,w] of [[left[i],M,leftLabel,90],[right[i],split+4,rightLabel,86]]){
          if(!pair)continue;
          label(pair[0],x,yy,7.2,COLOR.muted,true);
          const ls=wrapped(pair[1],w-lw-3,7.25,maxLines);
          ls.forEach((v,j)=>label(v,x+lw,yy+j*3.15,7.25,COLOR.text));
          n=Math.max(n,ls.length);
        }
        yy+=Math.max(rowH,n*3.15+1.6);
      }
      hair(split,y-3,split,yy-2,COLOR.border,.16);
      return yy;
    }
    function numericRow(y,left,right,colorL=COLOR.text,colorR=COLOR.text){
      label(left[0],M,y,7.1,COLOR.muted);
      label(left[1],M+56,y,9.1,colorL,true);
      label(right[0],M+94,y,7.0,COLOR.muted);
      label(right[1],W-M,y,9.1,colorR,true,'right');
      hair(M,y+2.5,W-M,y+2.5,COLOR.border,.17);
    }
    const metrics=report.metrics||{};
    const countLA=finite(metrics.laeqExceededCount)?metrics.laeqExceededCount:rawPeriods.filter(b=>finite(b.laeq30Db)&&b.laeq30Db>99).length;
    const countLC=metrics.lcpeakExceededCount;
    const secondsLC=finite(metrics.lcpeakExceededSeconds)?metrics.lcpeakExceededSeconds:
      finite(countLC)&&finite(metrics.intervalSeconds)?countLC*metrics.intervalSeconds:null;
    const mins=s=>finite(s)?(s===0?'0':String(Number((s/60).toFixed(2))).replace('.',','))+' Min':'—';
    const level=(v,d,unit)=>finite(v)?(d===2?euro(v):one(v))+' '+unit:'—';
    const speakerItems=items=>(items||[]).filter(it=>it.qty>0).map(it=>it.qty+' × '+clean(it.type==='custom'?it.customType:it.type).replace(/^L-ACOUSTIC[S]?\s*/i,'')).join(' + ');
    function paRows(){
      const groups=report.paGroups||[], rows=[];
      const find=id=>groups.find(g=>g.id===id);
      const text=g=>g?speakerItems(g.items)||'Stückzahl offen':'';
      const pair=(title,l,r)=>{
        if(!l&&!r)return;
        const a=text(l),b=text(r);
        rows.push([title,l&&r&&a===b?'links / rechts: je '+a:[l?'L: '+a:'',r?'R: '+b:''].filter(Boolean).join(' | ')]);
      };
      pair('Main PA',find('mainL'),find('mainR'));
      if(find('center'))rows.push(['Center-Cluster',text(find('center'))]);
      pair('Sidefills L / R',find('sideL'),find('sideR'));
      const fills=groups.filter(g=>/^ff/.test(g.id));
      if(fills.length){
        const n=fills.flatMap(g=>g.items||[]).reduce((sum,it)=>sum+(it.qty||0),0);
        rows.push(['Frontfills',n+' × 5XT ('+fills.map(g=>g.label.split(' – ')[0].replace(/^Frontfill\s*/,'').replace(/\s+/g,'')).join(', ')+')']);
      }
      for(const g of groups.filter(g=>!['mainL','mainR','center','sideL','sideR'].includes(g.id)&&!/^ff/.test(g.id)))
        rows.push([g.label.split(' – ')[0],text(g)]);
      if(!groups.length&&valid(get(report,'PA-Komponenten')))rows.push(['PA-Komponenten',speakerItems(report.paItems)||get(report,'PA-Komponenten')]);
      const extras=(report.paItems||[]).filter(it=>it.type==='custom');
      if(groups.length&&extras.length)rows.push(['Weitere Komponenten',speakerItems(extras)]);
      if(valid(get(report,'Zusätzliche Lautsprecher / Sonderaufbau')))rows.push(['Zusatz',get(report,'Zusätzliche Lautsprecher / Sonderaufbau')]);
      if(!rows.length)rows.push(['Beschallungsanlage','—']);
      return rows;
    }
    // PAGE 1: white report header, dense data tables and two charts.
    label('Schallpegel-Messprotokoll',M,17,17,COLOR.text,true);
    label(short(report.normVersion)+' · Messdatenübersicht',W-M,17,6.8,COLOR.muted,false,'right');
    label(fit(date+'  |  '+venue,CW,8),M,24,8,COLOR.muted);
    box(M,28,CW,9,statusBg);
    box(M,28,1.5,9,statusColor);
    label(fit(status,CW-6,9.6,true),M+4,34.1,9.6,statusColor,true);
    heading('Veranstaltung und Messorte',44);
    const organizer=get(report,'Veranstalter / Anschrift');
    pairs([['Veranstaltung',eventName],['Veranstalter',String(organizer).split(/\r?\n/)[0]],['Veranstaltungsort',venue],
      ['VA-Beschreibung',get(report,'Veranstaltungsbeschreibung')],['Messperson',get(report,'Messperson')]],
      [['Messdatum',date],['Messzeit',timeRange],['Tatsächlicher Messort',get(report,'Tatsächlicher Messort')],
      ['Ort der lautesten Immission',get(report,'Maßgeblicher Immissionsort')],['Anschrift',get(report,'Anschrift / Ortsangabe')]],51,6.1,39,41,1);
    heading('Messwerte und Grenzwertvergleich',86);
    numericRow(93,['Max. LAeq,30min',level(laeMax,2,'dB(A)')],['Max. LCpeak',level(lcMax,1,'dB(C)')],
      finite(laeMax)?laeMax>99?COLOR.red:COLOR.green:COLOR.muted,finite(lcMax)?lcMax>135?COLOR.red:COLOR.green:COLOR.muted);
    numericRow(101,['LAeq: betroffene 30-Min.-Zeitfenster',mins(countLA*1800)],['LCpeak: erfasste Überschreitungsintervalle',mins(secondsLC)],
      countLA?COLOR.red:COLOR.green,finite(secondsLC)?secondsLC>0?COLOR.red:COLOR.green:COLOR.muted);
    numericRow(109,['30-Minuten-Zeitblöcke',String(rawPeriods.length)],['Vollständig erfasst',complete.length+' / '+rawPeriods.length]);
    numericRow(117,['LAeq-Vergleichswert','99 dB(A)'],['LCpeak-Vergleichswert','135 dB(C)']);
    label('Zeitangaben: betroffene 30-Minuten-Blöcke bzw. erfasste Logintervalle; keine Impulsdauer.',M,124,6.5,COLOR.muted);
    heading('Beschallungsanlage',134);
    const rows=paRows();
    const rowH=rows.length>4?Math.min(6,24/rows.length):6;
    rows.slice(0,8).forEach(([k,v],i)=>{
      label(k,M,141+i*rowH,7.3,COLOR.muted,true);
      label(fit(v,CW-43,7.4),M+42,141+i*rowH,7.4,COLOR.text);
    });
    if(rows.length>8)label('Weitere Komponenten im Projekt.',M,165,6.5,COLOR.muted);
    hair(M,162,W-M,162,gridColor,.18);
    function drawChart(y,h,title,subtitle,key,ymin,ymax,limit,color){
      label(title,M,y+5.5,9.1,COLOR.text,true);
      label(fit(subtitle,84,6.7),W-M,y+5.5,6.7,COLOR.muted,false,'right');
      const values=charts.map(s=>s[key]).filter(finite);
      if(values.length){ymin=Math.min(ymin,Math.floor(Math.min(...values)/20)*20);ymax=Math.max(ymax,Math.ceil(Math.max(...values)/20)*20);}
      const px=M+13,py=y+11,pw=CW-15,ph=h-17;
      for(let t=Math.ceil(ymin/20)*20;t<=ymax;t+=20){
        const yy=py+ph-(t-ymin)/(ymax-ymin)*ph;
        hair(px,yy,px+pw,yy,COLOR.border,.16);
        label(String(t),px-2,yy+.6,6.1,COLOR.muted,false,'right');
      }
      const threshold=py+ph-(limit-ymin)/(ymax-ymin)*ph;
      stroke(COLOR.muted);doc.setLineWidth(.2);doc.setLineDashPattern([1.2,1.2],0);
      doc.line(px,threshold,px+pw,threshold);doc.setLineDashPattern([],0);
      label(limit+' dB',px+pw,threshold-1.5,6.4,COLOR.muted,false,'right');
      const clock=s=>{const m=clean(s?.time).match(/(\d{2}):(\d{2})(?::(\d{2}))?/);return m?Number(m[1])*3600+Number(m[2])*60+Number(m[3]||0):null;};
      let offset=0,prevTime=null;
      const times=charts.map(s=>{const t=clock(s);if(t===null)return null;if(prevTime!==null&&t<prevTime-43200)offset+=86400;prevTime=t;return t+offset;});
      const first=times[0],last=times[times.length-1],timed=finite(first)&&finite(last)&&last>first;
      if(timed){
        const step=last-first>12*3600?4*3600:last-first>6*3600?2*3600:last-first<3600?900:3600;
        for(let t=Math.ceil(first/step)*step;t<=last;t+=step){
          const xx=px+(t-first)/(last-first)*pw;
          hair(xx,py,xx,py+ph,COLOR.border,.14);
          label(String(Math.floor(t/3600)%24).padStart(2,'0')+':'+String(Math.floor(t/60)%60).padStart(2,'0'),xx,py+ph+4,6.1,COLOR.muted,false,'center');
        }
      }
      let prev=null,highest=null;
      charts.forEach((z,i)=>{
        const v=z[key];if(!finite(v)){prev=null;return;}
        const fraction=timed&&finite(times[i])?(times[i]-first)/(last-first):i/Math.max(1,charts.length-1);
        const xx=px+fraction*pw,yy=py+ph-(v-ymin)/(ymax-ymin)*ph;
        if(prev){stroke(color);doc.setLineWidth(.19);doc.line(prev.x,prev.y,xx,yy);}
        prev={x:xx,y:yy};
        if(!highest||v>highest.v)highest={v,x:xx,y:yy};
      });
      if(highest){
        RGB(COLOR.white);stroke(color);doc.setLineWidth(.24);doc.circle(highest.x,highest.y,.6,'FD');
        label(one(highest.v)+' dB',Math.min(highest.x+3,px+pw-17),Math.max(py+2,highest.y-2),6.8,color,true);
      }else label('Keine Diagrammdaten verfügbar.',M+CW/2,py+ph/2,8,COLOR.muted,false,'center');
      hair(M,y+h,W-M,y+h,COLOR.border,.16);
    }
    drawChart(162,56,'01  Pegelverlauf LAeq,g30','Gleitender 30-Minuten-Pegel, informativ','LAeq_g30',40,100,99,[0,126,104]);
    drawChart(218,56,'02  Spitzenpegel LCpeak','C-bewerteter Spitzenwert pro Logintervall','LC',60,140,135,[52,108,150]);
    label('Original-Log separat archivieren; keine DIN-Konformitätsbescheinigung.',M,280,6.1,COLOR.muted);
    footer(1);

    // PAGE 2: time blocks, equipment, corrections and report completion.
    doc.addPage();
    label('Zeitblöcke und Messnachweise',M,17,16,COLOR.text,true);
    label(fit(date+'  |  '+get(report,'Messgerät')+' / '+get(report,'Messmikrofon'),83,6.8),W-M,17,6.8,COLOR.muted,false,'right');
    label('Messzeit '+timeRange+' · '+short(get(report,'Logintervall'))+'-Logintervall',M,24,8,COLOR.muted);
    hair(M,29,W-M,29,gridColor,.18);
    const edge=rawPeriods.filter(b=>b.dataCoverageState==='partial-edge').length;
    heading('30-Minuten-Beurteilungszeiträume',37,complete.length+' vollständig / '+edge+' Teilzeit'+(partial>edge?' / '+(partial-edge)+' weitere':''));
    const cap=12;
    let chosen=report.blocks.map((b,i)=>({b,i}));
    if(chosen.length>cap){
      const weight=({b,i})=>{const r=b.raw||{};return (r.dataQuality==='complete'?0:60)+(finite(r.laeq30Db)&&r.laeq30Db>99?150:0)+(finite(r.lcpeakObservedDb)&&r.lcpeakObservedDb>135?150:0)+(i===0||i===report.blocks.length-1?80:0);};
      chosen=chosen.sort((a,b)=>weight(b)-weight(a)).slice(0,cap).sort((a,b)=>a.i-b.i);
    }
    const tY=41,tH=chosen.length>9?6:8;
    const xs=[M+2,M+45,M+90,M+118,M+147];
    box(M,tY,CW,8,stripe);
    ['Zeitraum','Abdeckung','LAeq dB(A)','LCpeak dB(C)','Bewertung'].forEach((v,i)=>label(v,xs[i],tY+5.2,7.3,COLOR.muted,true));
    chosen.forEach(({b},i)=>{
      const y=tY+8+i*tH,r=b.raw||{};
      if(i%2)box(M,y,CW,tH,stripe);
      const day=clean(b.from).slice(0,10),next=clean(b.to).slice(0,10);
      const showDay=rawPeriods.some(p=>clean(p.start).slice(0,10)!==clean(startTime).slice(0,10));
      const tm=(showDay?formatDate(day).slice(0,6)+' ':'')+time(b.from).slice(0,5)+'–'+(showDay&&next!==day?formatDate(next).slice(0,6)+' ':'')+time(b.to).slice(0,5);
      label(fit(tm,41,7.4),xs[0],y+tH*.66,7.4,COLOR.text);
      const fmt=n=>Math.round(n).toLocaleString('de-DE');
      const cov=finite(r.coveredSeconds)?fmt(r.coveredSeconds)+' / '+fmt(r.expectedSeconds||1800)+' s':short(b.coverage);
      label(cov,xs[1],y+tH*.66,7.4,COLOR.text);
      const full=finite(r.laeq30Db),val=full?r.laeq30Db:(r.laeqPartialDb??r.laeqObservedDb);
      const peak=finite(r.lcpeakObservedDb)?r.lcpeakObservedDb:r.lcpeakMaxDb;
      label(finite(val)?full?euro(val):one(val)+'*':'—',xs[2],y+tH*.66,7.7,COLOR.text,true);
      label(one(peak),xs[3],y+tH*.66,7.7,COLOR.text,true);
      const over=(full&&val>99)||(finite(peak)&&peak>135);
      const state=over?'Überschritten':r.dataCoverageState==='conflict'||r.dataQuality==='conflict'?'Zeitkonflikt':r.dataCoverageState==='gap'?'Messlücke':full&&finite(peak)&&r.dataQuality==='complete'?'Unter Grenze':r.dataCoverageState==='partial-edge'?'Teilzeit':'Unvollständig';
      label(state,xs[4],y+tH*.66,7.1,over?COLOR.red:state==='Unter Grenze'?COLOR.green:COLOR.amber);
      hair(M,y+tH,W-M,y+tH,COLOR.border,.13);
    });
    const last=tY+8+chosen.length*tH;
    label('* LAeq der tatsächlich erfassten Teilzeit; kein vollständiger 30-Minuten-Mittelungspegel.',M,last+5,6.5,COLOR.muted);
    if(chosen.length<report.blocks.length)label('Auswahl von '+chosen.length+' / '+report.blocks.length+' Zeitfenstern; vollständige Tabelle im Projekt.',M,last+9,6.5,COLOR.amber);
    heading('Messsystem',139);
    pairs([['Messgerät',get(report,'Messgerät')+' · Seriennr. '+get(report,'Messgerät-Seriennummer')],
      ['Messmikrofon',get(report,'Messmikrofon')+' · Seriennr. '+get(report,'Mikrofon-Seriennummer')],
      ['Logdatei',report.sourceLog]],
      [['Kalibrator',get(report,'Kalibrator')],['Seriennummer',get(report,'Kalibrator-Seriennummer')],
      ['Firmware / Raster',get(report,'Firmware')+' / '+get(report,'Logintervall')]],146,7.2,39,35,2);
    function correction(key){
      const v=get(report,key+' – '+(key==='k1'?'LAeq':'LCpeak'));
      const state=get(report,key+' – im Gerätelog angewandt?');
      return short(v)+' · '+(state.startsWith('Ja')?'bereits im Gerätelog':state.startsWith('Nein')?'nicht im Gerätelog':'Anwendung ungeklärt');
    }
    heading('Korrekturen und Funktionsprüfung',174);
    pairs([['Korrektur LAeq (k1)',correction('k1')],['Korrektur LCpeak (k2)',correction('k2')]],
      [['Prüfung davor',get(report,'Funktionsprüfung vor Messung')],['Prüfung danach',get(report,'Funktionsprüfung nach Messung')]],181,8,51,37,2);
    heading('Protokollabschluss',204);
    const closing=[['Ort',get(report,'Berichtsort'),M,48],['Datum',formatDate(get(report,'Berichtsdatum')),M+58,40],['Name',get(report,'Erstellt von'),M+105,77]];
    closing.forEach(([k,v,x,w])=>{
      label(k,x,213,7.4,COLOR.muted,true);
      label(fit(v,w,8.3),x,221,8.3,COLOR.text);
      hair(x,224,x+w,224,gridColor,.18);
    });
    label('Digitale Signatur',M,234,9,COLOR.text,true);
    label('Signaturfeld für PDF-Signaturanwendungen',W-M,234,6.8,COLOR.muted,false,'right');
    box(M,239,CW,34,COLOR.white,.8,gridColor);
    label('Zum digitalen Signieren hier klicken / Signatur einfügen',M+5,246,7.3,COLOR.muted);
    footer(2);
    return doc;
  }
  // Append a real unsigned signature widget, not a text-input or simulated signature.
  async function withSignature(doc,lib){
    if(!lib?.PDFDocument)throw new Error('PDF-Signaturmodul nicht verfügbar.');
    const pdf=await lib.PDFDocument.load(doc.output('arraybuffer'));
    const page=pdf.getPages()[1],ctx=pdf.context;
    const mm=72/25.4;
    const widget=ctx.obj({
      Type:'Annot',Subtype:'Widget',FT:'Sig',
      T:lib.PDFString.of('Digitale_Signatur'),
      TU:lib.PDFHexString.fromText('Digitale Signatur des Protokollverfassers'),
      F:4,Rect:[14*mm,page.getHeight()-273*mm,196*mm,page.getHeight()-239*mm],
      P:page.ref,BS:{W:0}
    });
    const ref=ctx.register(widget);
    page.node.addAnnot(ref);
    const form=pdf.getForm();
    form.acroForm.addField(ref);
    form.acroForm.dict.set(lib.PDFName.of('SigFlags'),lib.PDFNumber.of(3));
    return pdf.save({updateFieldAppearances:false});
  }
  return Object.freeze({create,printable,withSignature});
});