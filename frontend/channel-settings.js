function __agyChannelsText(english,chinese) {return window.__agyUiLanguage==='en'?english:chinese;}
function __agyChannelModelsProvider(catalog) {
  const values=Object.fromEntries(catalog.models.map(model=>[model.label,model.modelInfo]));
  window.__agyChannelEfforts=new Map(catalog.models.filter(model=>model.effort).map(model=>[model.label,{base:model.base,effort:model.effort}]));
  return {getState:()=>({customModels:values}),onDidChange:()=>({dispose(){}}),pushUpdate(){throw new Error('Manage aggregated models in Settings → Channels.');}};
}
function __agyChannelSettings() {
  const h=D.createElement,t=__agyChannelsText;
  const [status,setStatus]=D.useState(null),[expanded,setExpanded]=D.useState(false),[editor,setEditor]=D.useState(null),[pendingMode,setPendingMode]=D.useState(null),[error,setError]=D.useState(''),[busy,setBusy]=D.useState(false);
  const call=async input=>{
    setError('');setBusy(true);
    try{return await window.ohMyChannels.request(input);}
    catch(failure){setError(failure.message);return null;}
    finally{setBusy(false);}
  };
  D.useEffect(()=>{if(window.ohMyChannels)window.ohMyChannels.request({action:'status'}).then(setStatus).catch(failure=>setError(failure.message));},[]);
  if(!window.ohMyChannels)return null;
  const startAdding=()=>{setPendingMode('channels');setExpanded(true);setEditor({provider:null});setError('');};
  const selectMode=async mode=>{
    if(mode==='channels'&&!status.providers.length){startAdding();return;}
    const result=await call({action:'mode',mode});if(result){setStatus(result);setPendingMode(null);setEditor(null);}
  };
  const save=async provider=>{
    const result=await call({action:'save',provider,activate:pendingMode==='channels'});
    if(result){setStatus(result);setPendingMode(null);setEditor(null);}
  };
  const cancel=()=>{setEditor(null);setPendingMode(null);setError('');};
  return h('section',{className:'agy-channel-settings','aria-label':t('Model connection','模型接入')},
    h('div',{className:'agy-channel-summary'},h('div',null,h('div',{className:'agy-channel-title'},t('Model connection','模型接入')),h('p',{className:'agy-channel-muted'},t('Use your own API models in the main Agent.','在主 Agent 中使用自己的 API 模型。'))),
      h('button',{type:'button',className:'agy-channel-button','data-testid':'channels-manage','aria-expanded':expanded,onClick:()=>setExpanded(!expanded)},expanded?t('Collapse','收起'):t('Manage channels','管理渠道'))),
    expanded&&h('div',{className:'agy-channel-content'},
      status?h(__agyChannelConnection,{mode:pendingMode??status.connectionMode,busy,pending:pendingMode==='channels',onChange:selectMode}):h('div',{className:'agy-channel-skeleton','aria-label':t('Loading connection settings','正在加载接入设置')}),
      !pendingMode&&status?.restartRequired&&h('p',{role:'status',className:'agy-channel-notice'},t('Saved. Fully quit and reopen Antigravity to apply.','已保存，完全退出并重新打开 Antigravity 后生效。')),
      !editor&&h(D.Fragment,null,
        status?.providers.length===0&&h('div',{className:'agy-channel-empty'},h('div',null,h('strong',null,t('No API channels yet','尚未添加 API 渠道')),h('p',{className:'agy-channel-muted'},t('Add a provider URL, API key and model to begin.','添加服务地址、密钥和模型，即可开始使用。'))),h('button',{type:'button',className:'agy-channel-button agy-channel-primary','data-testid':'channels-add',disabled:busy,onClick:startAdding},t('Add channel','添加渠道'))),
        status?.providers.map(provider=>h('div',{key:provider.id,className:'agy-channel-provider'},h('div',null,h('strong',null,provider.name),h('p',{className:'agy-channel-muted'},__agyChannelProtocolLabel(provider.protocol)+' · '+provider.models.length+' '+t('models','个模型'))),
          h('div',{className:'agy-channel-actions'},h('button',{type:'button',className:'agy-channel-button',disabled:busy,onClick:()=>{setEditor({provider});setPendingMode(null);setError('');}},t('Edit','编辑')),h('button',{type:'button',className:'agy-channel-button agy-channel-quiet',disabled:busy,onClick:async()=>{const result=await call({action:'remove',id:provider.id});if(result)setStatus(result);}},t('Delete','删除'))))),
        !!status?.providers.length&&h('button',{type:'button',className:'agy-channel-button agy-channel-add','data-testid':'channels-add',disabled:busy,onClick:startAdding},t('Add channel','添加渠道'))),
      editor&&h(__agyChannelEditor,{key:editor.provider?.id??'new',provider:editor.provider,activate:pendingMode==='channels',busy,call,onSave:save,onCancel:cancel})),
    error&&h('p',{role:'alert',className:'agy-channel-error'},error));
}
