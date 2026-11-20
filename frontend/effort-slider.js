function __agyEffortMotion() {
  const storage=rd().core.storageService;
  const [choice,setChoice]=D.useState(()=>storage.get('antigravity-custom.effort-motion',null));
  const [reduced,setReduced]=D.useState(()=>matchMedia('(prefers-reduced-motion:reduce)').matches);
  D.useEffect(()=>{const media=matchMedia('(prefers-reduced-motion:reduce)');const update=()=>setReduced(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  const enabled=choice==='on'||(!choice&&!reduced);
  return [enabled,async()=>{const value=enabled?'off':'on';storage.store('antigravity-custom.effort-motion',value);await storage.flush();setChoice(value);}];
}
function __agyEffortControl() {
  const {selectedModel, effortIndex, setSelectedModel, bestOfNConfig} = p6();
  const group = selectedModel && V_c(selectedModel, effortIndex);
  const [open, setOpen] = D.useState(false);
  const [draft, setDraft] = D.useState(null);
  const [motion,toggleMotion] = __agyEffortMotion();
  D.useEffect(() => {setDraft(null);}, [selectedModel?.label]);
  if (!group || bestOfNConfig?.isBestOfNEnabled) return null;
  const names = {low:'Low',medium:'Medium',high:'High',xhigh:'XHigh',max:'Max',ultra:'Ultra'};
  const colors = {low:'#60a5fa',medium:'#6383ff',high:'#7468ff',xhigh:'#9b61ff',max:'#c34be8',ultra:'#ed64df'};
  const selected = W_c(effortIndex, selectedModel, group.base);
  const current = draft ?? group.efforts.indexOf(selected);
  const effort = group.efforts[current];
  const commit = value => {
    const model = group.byEffort.get(group.efforts[value]);
    if (model && !model.disabled) setSelectedModel(model);
  };
  const label = window.__agyUiLanguage === 'en' ? 'Thinking effort' : '思考强度';
  return D.createElement(wW, {open,onOpenChange:setOpen},
    D.createElement(xW, {asChild:true},
      D.createElement('button', {type:'button', 'data-testid':'thinking-effort-trigger',
        'aria-label':`${label}：${names[selected]}`, className:'agy-effort-trigger'},
        names[selected], D.createElement(Nq,{name:'keyboard_arrow_down',size:14}))),
    D.createElement(yW, {side:'top',align:'center',className:'agy-effort-panel',
      'data-effort':effort,'data-motion':motion?'on':'off',style:{'--agy-accent':colors[effort]}},
      D.createElement('div', {className:'agy-effort-heading'},
        D.createElement('button',{type:'button',className:'agy-effort-bolt',onClick:toggleMotion,'aria-pressed':motion,
          'aria-label':window.__agyUiLanguage==='en'?'Ultra particle animation':'Ultra 粒子动画',
          title:window.__agyUiLanguage==='en'?'Toggle Ultra particle animation':'开关 Ultra 粒子动画'},D.createElement(Nq,{name:'bolt',size:15})),
        D.createElement('span', {'aria-live':'polite'}, names[effort]),
        D.createElement('button', {type:'button','aria-label':window.__agyUiLanguage==='en'?'Reset effort':'重置思考强度',
          onClick:()=>{const value=group.efforts.indexOf(group.byEffort.has('medium')?'medium':group.efforts[0]);setDraft(value);commit(value);},
          className:'agy-effort-reset'},D.createElement(Nq,{name:'restart_alt',size:15}))),
      D.createElement('button', {type:'button',className:'agy-effort-model',
        onClick:()=>{setOpen(false);requestAnimationFrame(()=>document.querySelector('[data-testid="model-selector-trigger"]')?.click());}},
        D.createElement('span',null,group.base),D.createElement(Nq,{name:'keyboard_arrow_down',size:14})),
      D.createElement('div', {className:'agy-effort-track',style:{'--agy-ratio':current/(group.efforts.length-1)}},
        D.createElement('div', {className:'agy-effort-fill','aria-hidden':true}),
        D.createElement('div', {className:'agy-effort-ticks','aria-hidden':true},
          group.efforts.map((value,index)=>D.createElement('i',{key:value,'data-active':index<=current}))),
        open && motion && effort==='ultra' && D.createElement('div',{className:'agy-effort-particles','aria-hidden':true},
          Array.from({length:14},(_,index)=>D.createElement('i',{key:index,style:{
            '--agy-lane':`${12+(index*37)%77}%`,'--agy-duration':`${380+(index*73)%260}ms`,
            '--agy-delay':`${-index*89}ms`,'--agy-length':`${3+(index*7)%14}px`}}))),
        D.createElement('input', {type:'range',min:0,max:group.efforts.length-1,step:1,value:current,
          'aria-label':label,'aria-valuetext':names[effort],'data-testid':'thinking-effort-slider',
          onChange:event=>setDraft(Number(event.target.value)),
          onPointerUp:event=>commit(Number(event.currentTarget.value)),
          onKeyUp:event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))commit(Number(event.currentTarget.value));}}))));
}
