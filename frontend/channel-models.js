function __agyChannelModelsProvider(catalog) {
  const values=Object.fromEntries(catalog.models.map(model=>[model.label,model.modelInfo]));
  window.__agyChannelModels=new Map(catalog.models.map(model=>[model.label,{base:model.base,effort:model.effort}]));
  window.__agyChannelEfforts=new Map(catalog.models.filter(model=>model.effort).map(model=>[model.label,{base:model.base,effort:model.effort}]));
  return {getState:()=>({customModels:values}),onDidChange:()=>({dispose(){}}),pushUpdate(){throw new Error('Manage aggregated models in Settings → Model connection.');}};
}
function __agyChannelModelItems({models,onEdit}) {
  const {selectedModel,effortIndex,setSelectedModel,bestOfNConfig}=p6();
  const seen=new Set();
  return models.map(model=>{
    const meta=window.__agyChannelModels?.get(model.label);
    if(!meta||bestOfNConfig?.isBestOfNEnabled)return D.createElement(d0c,{key:model.label,model,onEdit});
    if(seen.has(meta.base))return null;
    seen.add(meta.base);
    const group=effortIndex.get(meta.base);
    const effort=group&&W_c(effortIndex,selectedModel,meta.base);
    const choice=group?.get(effort)??model;
    const selected=window.__agyChannelModels?.get(selectedModel?.label)?.base===meta.base;
    return D.createElement(zW,{key:meta.base,'data-testid':'model-selector-custom-item','data-model-label':meta.base,'data-route-label':choice.label,
      selected,disabled:choice.disabled??false,onClick:()=>setSelectedModel(choice)},
      D.createElement('span',{className:'min-w-0 flex-1 truncate text-sm text-left'},meta.base),
      effort&&D.createElement('span',{className:'ml-3 shrink-0 text-xs text-muted-foreground'},R_c[effort]));
  });
}
function __agyCustomModelsTitle(models) {
  const channels=models.some(model=>window.__agyChannelModels?.has(model.label));
  return window.__agyUiLanguage==='en'?(channels?'API models':'Custom'):(channels?'渠道模型':'自定义');
}
