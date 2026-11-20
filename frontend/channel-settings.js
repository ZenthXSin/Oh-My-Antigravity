function __agyChannelsText(english,chinese) {return window.__agyUiLanguage==='en'?english:chinese;}
function __agyChannelModelsProvider(catalog) {
  const values=Object.fromEntries(catalog.models.map(model=>[model.label,model.modelInfo]));
  window.__agyChannelEfforts=new Map(catalog.models.filter(model=>model.effort).map(model=>[model.label,{base:model.base,effort:model.effort}]));
  return {getState:()=>({customModels:values}),onDidChange:()=>({dispose(){}}),pushUpdate(){throw new Error('Manage aggregated models in Settings → Channels.');}};
}
function __agyChannelSettings() {
  const h=D.createElement,t=__agyChannelsText;
  const [status,setStatus]=D.useState(null),[expanded,setExpanded]=D.useState(false),[editor,setEditor]=D.useState(null),[error,setError]=D.useState(''),[busy,setBusy]=D.useState(false),[discovered,setDiscovered]=D.useState([]);
  const call=async input=>{
    setError('');setBusy(true);
    try{return await window.ohMyChannels.request(input);}
    catch(failure){setError(failure.message);return null;}
    finally{setBusy(false);}
  };
  D.useEffect(()=>{if(window.ohMyChannels)window.ohMyChannels.request({action:'status'}).then(setStatus).catch(failure=>setError(failure.message));},[]);
  if(!window.ohMyChannels)return null;
  const change=(key,value)=>setEditor(prior=>({...prior,[key]:value}));
  const modelChange=(index,key,value)=>setEditor(prior=>({...prior,models:prior.models.map((model,current)=>current===index?{...model,[key]:value}:model)}));
  const freshModel=()=>({id:'',label:'',contextWindow:275000,maxOutputTokens:125000,supportedEfforts:[],effortParameters:{}});
  const edit=provider=>{setEditor(provider?{...provider,apiKey:'',models:provider.models.map(model=>({...model,parameterDrafts:Object.fromEntries(Object.entries(model.effortParameters).map(([effort,value])=>[effort,JSON.stringify(value)]))}))}:{name:'',protocol:'openai-chat',baseUrl:'',apiKey:'',models:[freshModel()]});setDiscovered([]);};
  const save=async()=>{
    let provider;
    try{provider={...editor,models:editor.models.map(model=>({...model,effortParameters:Object.fromEntries(model.supportedEfforts.map(effort=>[effort,JSON.parse(model.parameterDrafts?.[effort]??JSON.stringify(model.effortParameters[effort]))]))}))};}
    catch{setError(t('Enter valid JSON for every effort parameter.','请为每个思考档位填写有效的 JSON 参数。'));return;}
    const result=await call({action:'save',provider});if(result){setStatus(result);setEditor(null);}
  };
  const field=(label,props)=>h('label',{className:'agy-channel-field'},h('span',null,label),h('input',{...props,disabled:busy}));
  return h('div',{className:'agy-channel-settings'},
    h('div',{className:'agy-channel-summary'},h('div',null,h('div',{className:'font-medium'},t('Channels','渠道聚合')),h('p',{className:'text-sm text-muted-foreground'},t('Choose models from multiple API providers.','在原生 Agent 中选择多个 API 渠道的模型。'))),
      h('button',{type:'button',className:'agy-channel-button','data-testid':'channels-manage',onClick:()=>setExpanded(!expanded)},t('Manage channels','管理渠道'))),
    expanded&&h('div',{className:'agy-channel-content'},
      status&&h('div',{className:'agy-channel-summary'},h('span',null,status.running?t('Aggregation is active','聚合运行中'):t('Official connection is active','使用官方接入')),
        h('button',{type:'button',disabled:busy,className:'agy-channel-button',onClick:async()=>{const result=await call({action:'mode',enabled:!status.enabled});if(result)setStatus(result);}},status.enabled?t('Use official connection','使用官方接入'):t('Enable aggregation','启用聚合'))),
      status?.restartRequired&&h('p',{role:'status',className:'agy-channel-notice'},t('Save your work, fully quit Antigravity and reopen it to apply channel and model changes.','请保存工作，完全退出并重新打开 Antigravity，使渠道和模型设置生效。')),
      !editor&&h(D.Fragment,null,
        status?.providers.length===0&&h('p',{className:'text-muted-foreground text-sm'},t('Add an API provider and its supported models to begin.','先添加 API 渠道及其支持的模型。')),
        status?.providers.map(provider=>h('div',{key:provider.id,className:'agy-channel-summary'},h('div',null,h('strong',null,provider.name),h('p',{className:'text-sm text-muted-foreground'},provider.protocol+' · '+provider.models.length+' '+t('models','个模型'))),
          h('div',{className:'agy-channel-actions'},h('button',{type:'button',className:'agy-channel-button',onClick:()=>edit(provider)},t('Edit','编辑')),h('button',{type:'button',className:'agy-channel-button',disabled:busy,onClick:async()=>{const result=await call({action:'remove',id:provider.id});if(result)setStatus(result);}},t('Delete','删除'))))),
        h('button',{type:'button',className:'agy-channel-button',onClick:()=>edit(null)},t('Add channel','添加渠道'))),
      editor&&h('div',{className:'agy-channel-editor'},
        field(t('Channel name','渠道名称'),{value:editor.name,onChange:event=>change('name',event.target.value)}),
        h('label',{className:'agy-channel-field'},h('span',null,t('API protocol','接口协议')),h('select',{value:editor.protocol,disabled:busy,onChange:event=>change('protocol',event.target.value)},['openai-chat','openai-responses','gemini','anthropic'].map(protocol=>h('option',{key:protocol,value:protocol},protocol)))),
        field(t('API base URL','API 基础地址'),{value:editor.baseUrl,onChange:event=>change('baseUrl',event.target.value)}),
        field(editor.id?t('New API key (leave blank to keep saved key)','新 API 密钥（留空保留已保存密钥）'):t('API key','API 密钥'),{type:'pass'+'word',autoComplete:'off',value:editor.apiKey,onChange:event=>change('apiKey',event.target.value)}),
        h('p',{className:'text-sm text-muted-foreground'},t('Keys are encrypted with your Windows account and kept outside project folders.','密钥使用当前 Windows 账号加密，保存在项目目录之外。')),
        h('button',{type:'button',disabled:busy,className:'agy-channel-button',onClick:async()=>{const result=await call({action:'models',provider:editor});if(result)setDiscovered(result);}},t('Fetch models','获取模型列表')),
        discovered.length>0&&h('select',{value:'',onChange:event=>{const model=discovered.find(model=>model.id===event.target.value);if(model)setEditor(prior=>({...prior,models:[...prior.models.filter(model=>model.id),{...freshModel(),...model}]}));}},h('option',{value:''},t('Add a discovered model…','添加查询到的模型…')),discovered.map(model=>h('option',{key:model.id,value:model.id},model.label))),
        editor.models.map((model,index)=>h('div',{key:index,className:'agy-channel-model'},
          h('div',{className:'agy-channel-summary'},h('strong',null,t('Model','模型')+' '+(index+1)),h('button',{type:'button',className:'agy-channel-button',onClick:()=>change('models',editor.models.filter((_,current)=>current!==index))},t('Remove','移除'))),
          field(t('Model ID','模型 ID'),{value:model.id,onChange:event=>modelChange(index,'id',event.target.value)}),
          field(t('Display name','显示名称'),{value:model.label,onChange:event=>modelChange(index,'label',event.target.value)}),
          field(t('Maximum input tokens','最大输入 Token'),{type:'number',min:1,step:1,value:model.contextWindow??275000,onChange:event=>modelChange(index,'contextWindow',Number(event.target.value))}),
          field(t('Maximum output tokens','最大输出 Token'),{type:'number',min:1,step:1,value:model.maxOutputTokens??125000,onChange:event=>modelChange(index,'maxOutputTokens',Number(event.target.value))}),
          h('div',{className:'agy-channel-efforts'},['low','medium','high','xhigh','max','ultra'].map(effort=>h('label',{key:effort},h('input',{type:'checkbox',checked:model.supportedEfforts.includes(effort),onChange:event=>{
            modelChange(index,'supportedEfforts',event.target.checked?[...model.supportedEfforts,effort]:model.supportedEfforts.filter(value=>value!==effort));
            if(event.target.checked&&!model.parameterDrafts?.[effort])modelChange(index,'parameterDrafts',{...model.parameterDrafts,[effort]:JSON.stringify(editor.protocol.startsWith('openai')?{reasoningEffort:effort}:editor.protocol==='anthropic'?{adaptiveEffort:effort}:{thinkingLevel:effort.toUpperCase()})});
          }}),effort))),
          model.supportedEfforts.map(effort=>field(effort+' '+t('API parameters','API 参数'),{value:model.parameterDrafts?.[effort]??JSON.stringify(model.effortParameters[effort]),onChange:event=>modelChange(index,'parameterDrafts',{...model.parameterDrafts,[effort]:event.target.value})})),
          h('p',{className:'text-sm text-muted-foreground'},t('Enable only levels supported by this model. Set the exact API values from the provider documentation.','只勾选模型实际支持的档位，并按渠道文档填写对应 API 参数。')))),
        h('div',{className:'agy-channel-actions'},h('button',{type:'button',className:'agy-channel-button',onClick:()=>change('models',[...editor.models,freshModel()])},t('Add model','添加模型')),h('button',{type:'button',className:'agy-channel-button',disabled:busy,onClick:save},t('Save channel','保存渠道')),h('button',{type:'button',className:'agy-channel-button',onClick:()=>setEditor(null)},t('Cancel','取消'))))),
    error&&h('p',{role:'alert',className:'text-destructive text-sm'},error));
}
