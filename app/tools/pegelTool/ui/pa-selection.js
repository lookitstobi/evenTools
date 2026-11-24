/* Interactive PA selection. A schematic drawing, not a rigging plan.
 * Quantities are editable for defined speaker types; legacy variants remain compatible.
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
  const g=(id,title,fixed,nodes,options)=>({id,title,fixed,nodes,options:options||[]});
  const variant=(id,label,items)=>({id,label,items});
  const SIDE_OPTIONS=Object.freeze([
    variant('ks2','2 × KS21 + 1 × A10 Focus + 1 × A10 Wide',
      [[TYPE.ks,2],[TYPE.focus,1],[TYPE.wide,1]]),
    variant('ks4','4 × KS21 + 1 × A10 Focus + 1 × A10 Wide',
      [[TYPE.ks,4],[TYPE.focus,1],[TYPE.wide,1]]),
    variant('focus','1 × A10 Focus',[[TYPE.focus,1]]),
    variant('wide','1 × A10 Wide',[[TYPE.wide,1]])
  ]);
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
      g('mainL','Main PA links – 12 × Kara II',[[TYPE.kara,12]],[n('mainL',17,27,'L · 12','array')]),
      g('mainR','Main PA rechts – 12 × Kara II',[[TYPE.kara,12]],[n('mainR',83,27,'R · 12','array')]),
      g('center','Center-Cluster – 8 × Kara II',[[TYPE.kara,8]],[n('center',50,22,'Center · 8','array')]),
      g('sideL','Sidefill links',[],[n('sideL',8,44,'Side L','sub')],SIDE_OPTIONS),
      g('sideR','Sidefill rechts',[],[n('sideR',92,44,'Side R','sub')],SIDE_OPTIONS),
      ...akFF
    ],
    [PAV]:[
      g('mainL','Main PA links – 2 × KS21 + 2 × A10 Focus + 1 × A10 Wide',
        [[TYPE.ks,2],[TYPE.focus,2],[TYPE.wide,1]],
        [n('mainL',18,29,'Main L','array'),n('mainL',14,48,'KS21 L','sub')]),
      g('mainR','Main PA rechts – 2 × KS21 + 2 × A10 Focus + 1 × A10 Wide',
        [[TYPE.ks,2],[TYPE.focus,2],[TYPE.wide,1]],
        [n('mainR',82,29,'Main R','array'),n('mainR',86,48,'KS21 R','sub')]),
      g('center','Center – 1 × A10 Wide',[[TYPE.wide,1]],
        [n('center',50,23,'Center','speaker')]),
      ...pvFF
    ]
  });
  // Frontfill positions are provisional presets: users can freely adjust them.
  // AKS: 2+8, 3+7, 4+6, 5 -> 7 speakers.
  // Pavillon: 1+7, 3+5, 4 -> 5 speakers.
  const PRESETS=Object.freeze({
    [AKS]:{selected:['mainL','mainR','sideL','sideR','ff28','ff37','ff46','ff5'],
      variants:{sideL:'ks4',sideR:'ks4'}},
    [PAV]:{selected:['mainL','mainR','center','ff17','ff35','ff4'],variants:{}}
  });
  const groupsFor=location=>CONFIG[location]||[];
  const presetFor=location=>{
    const preset=PRESETS[location]||{selected:[],variants:{}};
    return {schemaVersion:3,location,selected:[...preset.selected],variants:{...preset.variants},quantities:{}};
  };
  const esc=v=>String(v).replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
  function activeGroups(location,selected){
    const ids=new Set(Array.isArray(selected)?selected:[]);
    return groupsFor(location).filter(group=>ids.has(group.id));
  }
  function groupItems(group,variants,quantities){
    const choice=group.options.find(option=>option.id===(variants||{})[group.id]);
    const defaults=group.options.length?(choice?[TYPE.ks,TYPE.focus,TYPE.wide].map(type=>[type,choice.items.find(item=>item[0]===type)?.[1]||0]):[]):group.fixed;
    const custom=(quantities||{})[group.id]||{};
    return defaults.map(([type,qty])=>{
      const override=custom[type];
      return {type,qty:Number.isInteger(override)&&override>=0&&override<=200?override:qty};
    });
  }
  function groupTitle(group,variants,quantities){
    const base=group.title.split(' – ')[0];
    const items=groupItems(group,variants,quantities).filter(item=>item.qty>0);
    return base+(items.length?' – '+items.map(item=>item.qty+' × '+item.type.replace('L-ACOUSTIC ','')).join(' + '):'');
  }
  function itemsFor(state){
    const sums=new Map(),data=state||{};
    for(const group of activeGroups(data.location,data.selected)){
      for(const item of groupItems(group,data.variants,data.quantities)){
        if(item.qty>0)sums.set(item.type,(sums.get(item.type)||0)+item.qty);
      }
    }
    return Array.from(sums,([type,qty])=>({type,customType:'',qty}));
  }
  function unresolvedFor(state){
    const data=state||{},missing=[];
    for(const group of activeGroups(data.location,data.selected)){
      if(group.options.length && !group.options.some(opt=>opt.id===(data.variants||{})[group.id])){
        missing.push(group.title+': Sidefill-Variante fehlt.');
      }else if(!groupItems(group,data.variants,data.quantities).some(item=>item.qty>0)){
        missing.push(group.title+': Alle Lautsprecheranzahlen sind 0.');
      }
    }
    return missing;
  }
  function summaryFor(state){
    const data=state||{};
    return activeGroups(data.location,data.selected).map(group=>{
      const choice=group.options.find(opt=>opt.id===(data.variants||{})[group.id]);
      return {id:group.id,
        label:groupTitle(group,data.variants,data.quantities),
        items:groupItems(group,data.variants,data.quantities).filter(item=>item.qty>0),
        unresolved:group.options.length && !choice?['Sidefill-Variante']:[]};
    });
  }
  function speakerSvg(kind){
    const base='<rect x="5" y="3" width="22" height="30" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/>';
    const circle='<circle cx="16" cy="21" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/>'+
      '<circle cx="16" cy="21" r="2" fill="currentColor"/>';
    const array=base+'<path d="M5 10h22M5 17h22M5 24h22" stroke="currentColor" stroke-width="1.4"/>';
    return '<svg class="pa-device-icon" viewBox="0 0 32 36" aria-hidden="true" focusable="false">'+
      (kind==='array'?array:base+'<path d="M8 8h16" stroke="currentColor" stroke-width="1.2"/>'+circle)+'</svg>';
  }
  function mount(options){
    const root=options&&options.root;
    if(!root)return null;
    const onChange=typeof options.onChange==='function'?options.onChange:()=>{};
    let location=options.location||AKS;
    let selected=new Set(),variants={},quantities={};
    const snapshot=()=>({schemaVersion:3,location,selected:[...selected],variants:{...variants},
      quantities:Object.fromEntries(Object.entries(quantities).map(([id,counts])=>[id,{...counts}]))});
    function showUnresolved(){
      const warning=root.querySelector('.pa-unresolved');
      if(!warning)return;
      const missing=unresolvedFor(snapshot());
      warning.textContent=missing.join(' ');
      warning.hidden=!missing.length;
    }
    function render(){
      const groups=groupsFor(location);
      if(!groups.length){
        root.innerHTML='<p class="pa-empty">Für diesen Veranstaltungsort gibt es keine Saalübersicht. Zusätzliche Lautsprecher unten manuell erfassen.</p>';
        return;
      }
      const nodes=groups.flatMap(group=>group.nodes.map(node=>{
        const items=groupItems(group,variants,quantities);
        const count=items.reduce((total,item)=>total+item.qty,0);
        const label=/ · \d+$/.test(node.label)?node.label.replace(/ · \d+$/,' · '+count):node.label;
        return '<button type="button" tabindex="-1" class="pa-node pa-node--'+node.kind+(selected.has(group.id)?' is-selected':'')+
          '" data-pa-group="'+esc(group.id)+'" data-pa-x="'+node.x+'" data-pa-y="'+node.y+'" aria-pressed="'+selected.has(group.id)+
          '" aria-label="'+esc(groupTitle(group,variants,quantities))+' – '+esc(label)+'" title="'+esc(groupTitle(group,variants,quantities))+'">'+
          speakerSvg(node.kind)+'<span class="pa-node-label">'+esc(label)+'</span></button>';
      })).join('');
      const rows=groups.map(group=>{
        const checked=selected.has(group.id);
        const items=groupItems(group,variants,quantities);
        const fields=items.length?items:group.options.length?[TYPE.ks,TYPE.focus,TYPE.wide].map(type=>({type,qty:0})):[];
        const qtyFields=fields.map(item=>
          '<label class="pa-qty-label">'+esc(item.type.replace('L-ACOUSTIC ','') )+
          '<input type="number" tabindex="-1" min="0" max="200" step="1" value="'+item.qty+
          '" data-pa-qty-group="'+esc(group.id)+'" data-pa-qty-type="'+esc(item.type)+
          '" aria-label="'+esc(group.title+' – Anzahl '+item.type)+'"'+(checked?'':' disabled')+'></label>').join('');
        return '<div class="pa-group-row"><button type="button" tabindex="-1" class="pa-group-toggle'+
          (checked?' is-selected':'')+'" data-pa-group="'+esc(group.id)+'" aria-pressed="'+checked+'">'+
          '<span class="pa-check">'+(checked?'✓':'')+'</span><span class="pa-group-name">'+esc(groupTitle(group,variants,quantities))+'</span></button>'+
          '<div class="pa-qty-grid">'+qtyFields+'</div></div>';
      }).join('');
      root.innerHTML='<div class="pa-picker"><div class="pa-plan">'+
        '<div class="pa-plan-heading">'+(location===AKS?'Alfried-Krupp-Saal':'Nationalbank-Pavillon')+
        '<span>Schematische Aufsicht · anklicken zum Auswählen</span></div>'+
        '<div class="pa-stage-plan">'+
        '<div class="pa-audience-marker">PUBLIKUM</div>'+nodes+'</div>'+
        '<div class="pa-plan-legend"><span><i></i>nicht gewählt</span><span><i class="active"></i>ausgewählt</span></div>'+
        '</div><div class="pa-options">'+
        '<div class="pa-options-heading">Lautsprechergruppen</div>'+
        '<p class="pa-options-help">Seiten separat auswählbar; Frontfill-Paare werden gemeinsam geschaltet.</p>'+
        rows+'<div class="pa-unresolved" role="status" aria-live="polite"></div>'+
        '</div></div>';
      // Production CSP blocks parsed style attributes. Set individual CSSOM
      // properties on the new nodes instead; no CSP relaxation is necessary.
      for(const element of root.querySelectorAll('.pa-node')){
        element.style.left=element.dataset.paX+'%';
        element.style.top=element.dataset.paY+'%';
      }
      showUnresolved();
    }
    function resetToPreset(){
      const preset=presetFor(location);
      selected=new Set(preset.selected);
      variants={...preset.variants};
      quantities={};
      render();
    }
    root.addEventListener('click',e=>{
      const btn=e.target.closest('[data-pa-group]');
      if(!btn||!root.contains(btn))return;
      const id=btn.getAttribute('data-pa-group');
      if(!groupsFor(location).some(group=>group.id===id))return;
      selected.has(id)?selected.delete(id):selected.add(id);
      const group=groupsFor(location).find(g=>g.id===id);
      if(selected.has(id)&&group.options.length&&!variants[id])variants[id]='ks4';
      render();
      const focus=root.querySelector('.pa-group-toggle[data-pa-group="'+id+'"]');
      if(focus)focus.focus({preventScroll:true});
      onChange();
    });
    root.addEventListener('change',e=>{
      const field=e.target;
      const qtyGroup=field&&field.getAttribute('data-pa-qty-group');
      if(qtyGroup){
        const group=groupsFor(location).find(g=>g.id===qtyGroup);
        const type=field.getAttribute('data-pa-qty-type');
        const amount=Number(field.value);
        if(!group||!selected.has(qtyGroup)||
          !(group.options.length?[TYPE.ks,TYPE.focus,TYPE.wide].includes(type):groupItems(group,variants,quantities).some(item=>item.type===type))||
          !/^\d+$/.test(field.value.trim())||!Number.isInteger(amount)||amount<0||amount>200){
          field.setCustomValidity('Bitte eine ganze Zahl von 0 bis 200 eingeben.');
          field.reportValidity();return;
        }
        field.setCustomValidity('');
        if(group.options.length&&!variants[qtyGroup]){
          variants[qtyGroup]='ks4';
          quantities[qtyGroup]={[TYPE.ks]:0,[TYPE.focus]:0,[TYPE.wide]:0};
        }
        quantities[qtyGroup]={...(quantities[qtyGroup]||{}),[type]:amount};
        // Do not replace the active inputs on blur: native Tab/Shift+Tab must
        // reach the adjacent control instead of losing or restoring focus.
        const title=groupTitle(group,variants,quantities);
        const toggle=root.querySelector('.pa-group-toggle[data-pa-group="'+qtyGroup+'"] .pa-group-name');
        if(toggle)toggle.textContent=title;
        const count=groupItems(group,variants,quantities).reduce((sum,item)=>sum+item.qty,0);
        for(const node of root.querySelectorAll('.pa-node[data-pa-group="'+qtyGroup+'"]')){
          const label=node.querySelector('.pa-node-label');
          if(label)label.textContent=label.textContent.replace(/ · \d+$/,' · '+count);
          node.title=title;
          node.setAttribute('aria-label',title+' – '+(label?label.textContent:''));
        }
        showUnresolved();
        onChange();
      }
    });
    function setLocation(next){
      location=String(next||'');
      resetToPreset();
    }
    function setState(saved){
      if(!saved||![2,3].includes(saved.schemaVersion)||saved.location!==location){
        // Old 1.x graphical selections are not converted into potentially false
        // quantities. Caller restores old paItems separately as manual entries.
        selected=new Set();variants={};quantities={};render();return false;
      }
      const ids=new Set(groupsFor(location).map(group=>group.id));
      selected=new Set(Array.isArray(saved.selected)?saved.selected.filter(id=>ids.has(id)):[]);
      variants={};quantities={};
      for(const group of groupsFor(location)){
        if(group.options.length &&
          group.options.some(option=>option.id===(saved.variants||{})[group.id]))
          variants[group.id]=saved.variants[group.id];
        if(saved.schemaVersion===3 && saved.quantities &&
          saved.quantities[group.id] && typeof saved.quantities[group.id]==='object'){
          const allowedTypes=new Set(groupItems(group,variants,{}).map(item=>item.type));
          const counts={};
          for(const [type,amount] of Object.entries(saved.quantities[group.id])){
            if(allowedTypes.has(type)&&Number.isInteger(amount)&&amount>=0&&amount<=200)counts[type]=amount;
          }
          if(Object.keys(counts).length)quantities[group.id]=counts;
        }
      }
      render();return true;
    }
    resetToPreset();
    return Object.freeze({getState:snapshot,getItems:()=>itemsFor(snapshot()),
      getSummary:()=>summaryFor(snapshot()),getUnresolved:()=>unresolvedFor(snapshot()),
      setLocation,setState});
  }
  return Object.freeze({AKS,PAV,TYPE,CONFIG,SIDE_OPTIONS,PRESETS,presetFor,
    itemsFor,unresolvedFor,summaryFor,mount});
});
