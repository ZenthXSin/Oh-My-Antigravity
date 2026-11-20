export function request(route,body,key,stream) {
  const generationConfig={...body.generationConfig};
  delete generationConfig.thinkingConfig;
  if(route.parameters.thinkingBudget!==undefined||route.parameters.thinkingLevel)generationConfig.thinkingConfig={
    ...(route.parameters.thinkingBudget!==undefined?{thinkingBudget:route.parameters.thinkingBudget}:{}),
    ...(route.parameters.thinkingLevel?{thinkingLevel:route.parameters.thinkingLevel}:{})};
  const root=route.provider.baseUrl.replace(/\/v1beta\/?$/,'');
  return {url:`${root}/v1beta/models/${encodeURIComponent(route.model.id)}:${stream?'streamGenerateContent?alt=sse':'generateContent'}`,
    headers:{'content-type':'application/json','x-goog-api-key':key},body:{...body,generationConfig:{...generationConfig,maxOutputTokens:route.model.maxOutputTokens??125000}}};
}
export const nativeResponse=value=>value;
