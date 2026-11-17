/* Interactive PA selector for pegelTool. UI-only; no normative assertions.
 * The drawing is schematic, not an actual rigging plan.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.PegelToolPA=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const TYPE=Object.freeze({
    kara:'L-ACOUSTIC KARA II',ks:'L-ACOUSTIC KS21',
    focus:'L-ACOUSTIC A10 Focus',wide:'L-ACOUSTIC A10 Wide',
    fill:'L-ACOUSTIC 5XT'
  });
  const AKS='Philharmonie Essen, Alfried-Krupp-Saal';
  const PAV='Philharmonie Essen, Nationalbank-Pavillon';
  const n=(id,x,y,label,kind)=>({id,x,y,label,kind});
  const q=(key,label,type)=>({key,label,type});
  const g=(id,title,fixed,nodes,required)=>({id,title,fixed,nodes,required:required||[]});
  const akFF=[
    g('ff19','Frontfill 1 + 9',[[TYPE.fill,2]],[n('ff19',15,69,'1','fill'),n('ff19',85,69,'9','fill')]),
    g('ff28','Frontfill 2 + 8',[[TYPE.fill,2]],[n('ff28',24,69,'2','fill'),n('ff28',76,69,'8','fill')]),
    g('ff37','Frontfill 3 + 7',[[TYPE.fill,2]],[n('ff37',33,69,'3','fill'),n('ff37',67,69,'7','fill')]),
    g('ff46','Frontfill 4 + 6',[[TYPE.fill,2]],[n('ff46',42,69,'4','fill'),n('ff46',58,69,'6','fill')]),
    g('ff5','Frontfill 5',[[TYPE.fill,1]],[n('ff5',50,69,'5','fill')])
  ];
  const pvFF=[
    g('ff17','Frontfill 1 + 7',[[TYPE.fill,2]],[n('ff17',17,69,'1','fill'),n('ff17',83,69,'7','fill')]),
    g('ff35','Frontfill 3 + 5',[[TYPE.fill,2]],[n('ff35',39,69,'3','fill'),n('ff35',61,69,'5','fill')]),
    g('ff2','Frontfill 2',[[TYPE.fill,1]],[n('ff2',28,69,'2','fill')]),
    g('ff4','Frontfill 4',[[TYPE.fill,1]],[n('ff4',50,69,'4','fill')]),
    g('ff6','Frontfill 6',[[TYPE.fill,1]],[n('ff6',72,69,'6','fill')])
  ];
  const CONFIG=Object.freeze({
    [AKS]:[
      g('main','Main PA L/R – 2 × 12 Kara II',[[TYPE.kara,24]],
        [n('main',17,27,'L · 12','array'),n('main',83,27,'R · 12','array')]),
      g('center','Center-Cluster – 8 Kara II',[[TYPE.kara,8]],
        [n('center',50,22,'Center · 8','array')]),
      g('sideLarge','Sidefill groß – 4 KS21 + A10',[[TYPE.ks,4]],
        [n('sideLarge',8,44,'Side groß','sub')],
        [q('largeFocus','A10 Focus · Anzahl',TYPE.focus),q('largeWide','A10 Wide · Anzahl',TYPE.wide)]),
      g('sideSmall','Sidefill klein – 2 KS21 + A10',[[TYPE.ks,2]],
        [n('sideSmall',92,44,'Side klein','sub')],
        [q('smallFocus','A10 Focus · Anzahl',TYPE.focus),q('smallWide','A10 Wide · Anzahl',TYPE.wide)]),
      ...akFF
    ],
    [PAV]:[
      g('main','Main PA – A10 Focus / Wide',[],
        [n('main',18,29,'Main L','array'),n('main',82,29,'Main R','array')],
        [q('mainFocus','A10 Focus · Anzahl',TYPE.focus),q('mainWide','A10 Wide · Anzahl',TYPE.wide)]),
      g('subs','Subwoofer – 4 KS21',[[TYPE.ks,4]],
        [n('subs',14,48,'KS21','sub'),n('subs',86,48,'KS21','sub')]),
      g('center','Center – 1 A10 Wide',[[TYPE.wide,1]],
        [n('center',50,23,'Center','speaker')]),
      ...pvFF
    ]
  });
  const esc=(v)=>String(v).replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
  const positiveInt=v=>{
    const str=String(v==null?'':v).trim();
    if(!/^[1-9]\d*$/.test(str))return null;
    const n=Number(str);
    return Number.isSafeInteger(n)?n:null;
  };
  const groupsFor=location=>CONFIG[location]||[];
  function activeGroups(location,selected){
    const ids=new Set(Array.isArray(selected)?selected:[]);
    return groupsFor(location).filter(g=>ids.has(g.id));
  }
  function groupItems(group,counts){
    const items=group.fixed.map(pair=>({type:pair[0],qty:pair[1]}));
    for(const req of group.required){
      const qty=positiveInt(counts&&counts[req.key]);
      if(qty!==null)items.push({type:req.type,qty});
    }
    return items;
  }
  function itemsFor(state){
    const sums=new Map();
    const data=state||{};
    for(const group of activeGroups(data.location,data.selected)){
      for(const item of groupItems(group,data.counts)){
        sums.set(item.type,(sums.get(item.type)||0)+item.qty);
      }
    }
    return Array.from(sums,([type,qty])=>({type,customType:'',qty}));
  }
  function unresolvedFor(state){
    const data=state||{},missing=[];
    for(const group of activeGroups(data.location,data.selected)){
      for(const req of group.required){
        if(positiveInt(data.counts&&data.counts[req.key])===null)
          missing.push(group.title+': '+req.label+' fehlt.');
      }
    }
    return missing;
  }
  function summaryFor(state){
    const data=state||{};
    return activeGroups(data.location,data.selected).map(group=>({
      id:group.id,label:group.title,
      items:groupItems(group,data.counts),
      unresolved:group.required.filter(req=>positiveInt(data.counts&&data.counts[req.key])===null).map(req=>req.label)
    }));
  }
  function speakerSvg(kind){
    const base='<rect x="5" y="3" width="22" height="30" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/>';
    const circle='<circle cx="16" cy="21" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/>'+
      '<circle cx="16" cy="21" r="2" fill="currentColor"/>';
    const array=base+'<path d="M5 10h22M5 17h22M5 24h22" stroke="currentColor" stroke-width="1.4"/>';
    const unit=base+'<path d="M8 8h16" stroke="currentColor" stroke-width="1.2"/>'+circle;
    return '<svg class="pa-device-icon" viewBox="0 0 32 36" aria-hidden="true" focusable="false">'+
      (kind==='array'?array:unit)+'</svg>';
  }
  function mount(options){
    const root=options&&options.root;
    if(!root)return null;
    const onChange=typeof options.onChange==='function'?options.onChange:()=>{};
    let location=options.location||AKS;
    let selected=new Set(),counts={};
    const snapshot=()=>({schemaVersion:1,location,selected:[...selected],counts:{...counts}});
    function render(){
      const groups=groupsFor(location);
      if(!groups.length){
        root.innerHTML='<p class="pa-empty">Für diesen Veranstaltungsort gibt es keine hinterlegte Saalübersicht. Zusätzliche Lautsprecher unten manuell erfassen.</p>';
        return;
      }
      const nodes=groups.flatMap(group=>group.nodes.map(node=>
        '<button type="button" class="pa-node pa-node--'+node.kind+(selected.has(group.id)?' is-selected':'')+
        '" data-pa-group="'+esc(group.id)+'" style="left:'+node.x+'%;top:'+node.y+'%" aria-pressed="'+selected.has(group.id)+
        '" aria-label="'+esc(group.title)+' – '+esc(node.label)+'" title="'+esc(group.title)+'">'+
        speakerSvg(node.kind)+'<span class="pa-node-label">'+esc(node.label)+'</span></button>'
      )).join('');
      const rows=groups.map(group=>{
        const checked=selected.has(group.id),fields=group.required.map(req=>
          '<label class="pa-qty-label">'+esc(req.label)+
          '<input type="number" min="1" step="1" inputmode="numeric" data-pa-count="'+esc(req.key)+
          '" value="'+esc(counts[req.key]||'')+'" placeholder="Anzahl"'+(checked?'':' disabled')+'></label>'
        ).join('');
        return '<div class="pa-group-row"><button type="button" class="pa-group-toggle'+
          (checked?' is-selected':'')+'" data-pa-group="'+esc(group.id)+'" aria-pressed="'+checked+'">'+
          '<span class="pa-check">'+(checked?'✓':'')+'</span>'+esc(group.title)+'</button>'+
          (fields?'<div class="pa-qty-grid">'+fields+'</div>':'')+'</div>';
      }).join('');
      root.innerHTML='<div class="pa-picker"><div class="pa-plan">'+
        '<div class="pa-plan-heading">'+(location===AKS?'Alfried-Krupp-Saal':'Nationalbank-Pavillon')+
        '<span>Schematische Aufsicht · anklicken zum Auswählen</span></div>'+
        '<div class="pa-stage-plan"><div class="pa-stage-marker">BÜHNE</div>'+
        '<div class="pa-audience-marker">PUBLIKUM</div>'+nodes+'</div>'+
        '<div class="pa-plan-legend"><span><i></i>nicht gewählt</span><span><i class="active"></i>ausgewählt</span></div>'+
        '</div><div class="pa-options">'+
        '<div class="pa-options-heading">Lautsprechergruppen</div>'+
        '<p class="pa-options-help">Frontfills werden bei definierten Paaren gemeinsam geschaltet.</p>'+
        rows+'<div class="pa-unresolved" role="status" aria-live="polite"></div>'+
        '</div></div>';
      showUnresolved();
    }
    function showUnresolved(){
      const warning=root.querySelector('.pa-unresolved');
      if(!warning)return;
      const missing=unresolvedFor(snapshot());
      warning.textContent=missing.length?
        missing.length+' Stückzahlangabe(n) offen. Bitte die A10-Anzahlen ergänzen.':'';
      warning.hidden=!missing.length;
    }
    root.addEventListener('click',e=>{
      const btn=e.target.closest('[data-pa-group]');
      if(!btn||!root.contains(btn))return;
      const id=btn.getAttribute('data-pa-group');
      if(!groupsFor(location).some(group=>group.id===id))return;
      selected.has(id)?selected.delete(id):selected.add(id);
      render();
      const focus=root.querySelector('.pa-group-toggle[data-pa-group="'+id+'"]');
      if(focus)focus.focus({preventScroll:true});
      onChange();
    });
    root.addEventListener('input',e=>{
      const key=e.target&&e.target.getAttribute('data-pa-count');
      if(!key)return;
      if(!groupsFor(location).some(group=>group.required.some(req=>req.key===key)))return;
      counts[key]=e.target.value;
      showUnresolved();
      onChange();
    });
    function setLocation(next){
      location=String(next||'');
      selected=new Set();counts={};
      render();
    }
    function setState(saved){
      if(!saved||saved.schemaVersion!==1||saved.location!==location){
        selected=new Set();counts={};render();return false;
      }
      const ids=new Set(groupsFor(location).map(group=>group.id));
      selected=new Set(Array.isArray(saved.selected)?saved.selected.filter(id=>ids.has(id)):[]);
      const permitted=new Set(groupsFor(location).flatMap(group=>group.required.map(req=>req.key)));
      counts={};
      if(saved.counts&&typeof saved.counts==='object'){
        for(const key of permitted){
          if(Object.prototype.hasOwnProperty.call(saved.counts,key))
            counts[key]=String(saved.counts[key]);
        }
      }
      render();return true;
    }
    render();
    return Object.freeze({getState:snapshot,getItems:()=>itemsFor(snapshot()),
      getSummary:()=>summaryFor(snapshot()),getUnresolved:()=>unresolvedFor(snapshot()),
      setLocation,setState});
  }
  return Object.freeze({AKS,PAV,TYPE,CONFIG,itemsFor,unresolvedFor,summaryFor,mount});
});
