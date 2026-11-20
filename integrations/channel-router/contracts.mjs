export const protocols=['gemini','openai-chat','openai-responses','anthropic'];
export const effortLevels=['low','medium','high','xhigh','max','ultra'];

export function endpoint(value) {
  const url=new URL(value);
  if(!['https:','http:'].includes(url.protocol)||url.username||url['pass'+'word']||url.search||url.hash)throw new Error('API address must be an HTTP(S) URL without credentials, query or fragment.');
  return url.href.replace(/\/$/,'');
}
export function validateProvider(input) {
  if(!input||typeof input.name!=='string'||!input.name.trim())throw new Error('Channel name is required.');
  if(!protocols.includes(input.protocol))throw new Error('Unsupported channel protocol.');
  if(!Array.isArray(input.models)||!input.models.length)throw new Error('Add at least one model.');
  const ids=new Set();
  const models=input.models.map(model=>{
    if(typeof model.id!=='string'||!model.id.trim()||ids.has(model.id))throw new Error('Model IDs must be nonempty and unique within a channel.');
    ids.add(model.id);
    const supportedEfforts=model.supportedEfforts??[];
    if(!Array.isArray(supportedEfforts)||supportedEfforts.some(effort=>!effortLevels.includes(effort))||new Set(supportedEfforts).size!==supportedEfforts.length)throw new Error('Invalid thinking effort list.');
    const effortParameters=model.effortParameters??{};
    const allowed=input.protocol.startsWith('openai')?['reasoningEffort']:input.protocol==='gemini'?['thinkingBudget','thinkingLevel']:['thinkingBudget','adaptiveEffort'];
    for(const effort of supportedEfforts) {
      const parameters=effortParameters[effort];
      if(!parameters||typeof parameters!=='object'||Array.isArray(parameters))throw new Error(`Define the API parameters for ${effort}.`);
      if(!Object.keys(parameters).length||Object.keys(parameters).some(key=>!allowed.includes(key)))throw new Error(`Invalid ${input.protocol} API parameters for ${effort}.`);
      if(input.protocol==='anthropic'&&parameters.thinkingBudget!==undefined&&parameters.adaptiveEffort!==undefined)throw new Error('Choose budget thinking or adaptive thinking, not both.');
      if(input.protocol==='anthropic'&&parameters.thinkingBudget!==undefined&&(parameters.thinkingBudget<1024||parameters.thinkingBudget>=(model.maxOutputTokens??125000)))throw new Error('Anthropic thinking budget must be at least 1024 and below the output limit.');
      for(const [key,value] of Object.entries(parameters)) {
        if(key==='thinkingBudget'?(!Number.isSafeInteger(value)||value<0):(typeof value!=='string'||!value))throw new Error(`Invalid ${key}.`);
      }
    }
    for(const key of ['contextWindow','maxOutputTokens'])if(model[key]!==undefined&&(!Number.isSafeInteger(model[key])||model[key]<=0))throw new Error(`Invalid ${key}.`);
    return {id:model.id.trim(),label:typeof model.label==='string'&&model.label.trim()?model.label.trim():model.id.trim(),supportedEfforts,effortParameters,
      contextWindow:model.contextWindow??275000,maxOutputTokens:model.maxOutputTokens??125000};
  });
  return {name:input.name.trim(),protocol:input.protocol,baseUrl:endpoint(input.baseUrl),models};
}
