function __agyChannelProtocolLabel(protocol) {
  return {'openai-chat':'OpenAI Chat Completions','openai-responses':'OpenAI Responses',gemini:'Gemini',anthropic:'Anthropic Messages'}[protocol];
}
function __agyChannelFreshModel(){return {id:'',label:'',contextWindow:275000,maxOutputTokens:125000,supportedEfforts:[],effortParameters:{},parameterDrafts:{}};}
function __agyChannelEditor({provider,activate,busy,call,onSave,onCancel}) {
  const h=D.createElement,t=__agyChannelsText;
  const [draft,setDraft]=D.useState(()=>provider?{...provider,apiKey:'',models:provider.models.map(model=>({...model,parameterDrafts:Object.fromEntries(Object.entries(model.effortParameters).map(([level,value])=>[level,JSON.stringify(value)]))}))}:{name:'',protocol:'openai-chat',baseUrl:'',apiKey:'',models:[__agyChannelFreshModel()]}),[discovered,setDiscovered]=D.useState([]),[error,setError]=D.useState('');
  const change=(key,value)=>setDraft(prior=>({...prior,[key]:value}));
  const modelChange=(index,key,value)=>setDraft(prior=>({...prior,models:prior.models.map((model,current)=>current===index?{...model,[key]:value}:model)}));
  const field=(label,props)=>h('label',{className:'agy-channel-field'},h('span',null,label),h('input',{...props,disabled:busy}));
  const submit=event=>{
    event.preventDefault();setError('');
    let value;
    try{value={...draft,models:draft.models.map(({parameterDrafts,...model})=>({...model,effortParameters:Object.fromEntries(model.supportedEfforts.map(level=>[level,JSON.parse(parameterDrafts[level])]))}))};}
    catch{setError(t('Use valid JSON for the thinking parameters.','思考参数需要填写有效的 JSON。'));return;}
    onSave(value);
  };
  return h('form',{className:'agy-channel-editor',onSubmit:submit},
    h('div',{className:'agy-channel-summary'},h('h3',{className:'agy-channel-title'},provider?t('Edit channel','编辑渠道'):t('Add API channel','添加 API 渠道'))),
    h('div',{className:'agy-channel-columns'},
      field(t('Channel name','渠道名称'),{value:draft.name,required:true,autoFocus:true,onChange:event=>change('name',event.target.value)}),
      h('label',{className:'agy-channel-field'},h('span',null,t('API protocol','接口协议')),h('select',{value:draft.protocol,disabled:busy,onChange:event=>{change('protocol',event.target.value);setDiscovered([]);}},['openai-chat','openai-responses','gemini','anthropic'].map(protocol=>h('option',{key:protocol,value:protocol},__agyChannelProtocolLabel(protocol)))))),
    field(t('API base URL','API 基础地址'),{type:'url',value:draft.baseUrl,required:true,onChange:event=>change('baseUrl',event.target.value)}),
    field(provider?t('API key (leave blank to keep saved key)','API 密钥（留空保留原密钥）'):t('API key','API 密钥'),{type:'pass'+'word',autoComplete:'off',value:draft.apiKey,required:!provider,onChange:event=>change('apiKey',event.target.value)}),
    h('p',{className:'agy-channel-muted'},t('Your key is encrypted on this device.','密钥在本机加密保存。')),
    h('div',{className:'agy-channel-discovery'},h('button',{type:'button',disabled:busy,className:'agy-channel-button',onClick:async()=>{const result=await call({action:'models',provider:draft});if(result)setDiscovered(result);}},busy?t('Working…','处理中…'):t('Fetch models','获取模型列表')),
      discovered.length>0&&h('select',{'aria-label':t('Choose a model','选择模型'),value:'',onChange:event=>{const model=discovered.find(model=>model.id===event.target.value);if(model)setDraft(prior=>({...prior,models:[...prior.models.filter(model=>model.id),{...__agyChannelFreshModel(),...model}]}));}},h('option',{value:''},t('Select a discovered model','选择查询到的模型')),discovered.map(model=>h('option',{key:model.id,value:model.id},model.label)))),
    draft.models.map((model,index)=>h('div',{key:index,className:'agy-channel-model'},
      h('div',{className:'agy-channel-summary'},h('strong',null,t('Model','模型')+' '+(index+1)),h('button',{type:'button',className:'agy-channel-button agy-channel-quiet',disabled:busy||draft.models.length===1,onClick:()=>change('models',draft.models.filter((_,current)=>current!==index))},t('Remove','移除'))),
      h('div',{className:'agy-channel-columns'},field(t('Model ID','模型 ID'),{value:model.id,required:true,onChange:event=>modelChange(index,'id',event.target.value)}),field(t('Display name','显示名称'),{value:model.label,onChange:event=>modelChange(index,'label',event.target.value)})),
      h('div',{className:'agy-channel-columns'},field(t('Maximum input tokens','最大输入 Token'),{type:'number',min:1,step:1,value:model.contextWindow,onChange:event=>modelChange(index,'contextWindow',Number(event.target.value))}),field(t('Maximum output tokens','最大输出 Token'),{type:'number',min:1,step:1,value:model.maxOutputTokens,onChange:event=>modelChange(index,'maxOutputTokens',Number(event.target.value))})),
      h('div',{className:'agy-channel-field'},h('span',null,t('Supported thinking levels','支持的思考强度')),h('div',{className:'agy-channel-efforts'},['low','medium','high','xhigh','max','ultra'].map(level=>h('label',{key:level},h('input',{type:'checkbox',disabled:busy,checked:model.supportedEfforts.includes(level),onChange:event=>{
        modelChange(index,'supportedEfforts',event.target.checked?[...model.supportedEfforts,level]:model.supportedEfforts.filter(value=>value!==level));
        if(event.target.checked&&!model.parameterDrafts[level])modelChange(index,'parameterDrafts',{...model.parameterDrafts,[level]:JSON.stringify(draft.protocol.startsWith('openai')?{reasoningEffort:level}:draft.protocol==='anthropic'?{adaptiveEffort:level}:{thinkingLevel:level.toUpperCase()})});
      }}),level)))),
      model.supportedEfforts.length>0&&h('details',{className:'agy-channel-parameters'},h('summary',null,t('Thinking API parameters','思考强度 API 参数')),model.supportedEfforts.map(level=>field(level,{value:model.parameterDrafts[level],onChange:event=>modelChange(index,'parameterDrafts',{...model.parameterDrafts,[level]:event.target.value})}))),
      h('p',{className:'agy-channel-muted'},t('Select the levels this model supports.','只选择模型实际支持的档位。')))),
    error&&h('p',{role:'alert',className:'agy-channel-error'},error),
    h('div',{className:'agy-channel-editor-footer'},h('button',{type:'button',className:'agy-channel-button agy-channel-quiet',disabled:busy,onClick:()=>change('models',[...draft.models,__agyChannelFreshModel()])},t('Add model','添加模型')),
      h('div',{className:'agy-channel-actions'},h('button',{type:'button',className:'agy-channel-button',disabled:busy,onClick:onCancel},t('Cancel','取消')),h('button',{type:'submit',className:'agy-channel-button agy-channel-primary',disabled:busy},busy?t('Saving…','保存中…'):activate?t('Save and enable','保存并启用'):t('Save changes','保存修改')))));
}
