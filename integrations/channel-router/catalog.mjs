import {createHash} from 'node:crypto';
import {effortLevels} from './contracts.mjs';

export function routes(config) {
  return config.providers.flatMap(provider=>provider.models.flatMap(model=>{
    const hash=createHash('sha256').update(model.id).digest('hex').slice(0,12);
    const base=provider.name+' / '+model.label;
    return (model.supportedEfforts.length?effortLevels.filter(effort=>model.supportedEfforts.includes(effort)):[null]).map(effort=>({
      alias:`oma-${provider.id}-${hash}${effort?'-'+effort:''}`,label:base+(effort?` (${effort})`:''),base,effort,provider,model,
      parameters:effort?model.effortParameters[effort]:{}
    }));
  }));
}
export function publicCatalog(config,baseUrl) {
  return {enabled:config.enabled,models:config.enabled?routes(config).map(route=>({alias:route.alias,label:route.label,base:route.base,effort:route.effort,
    modelInfo:{modelId:326,modelType:2,apiProvider:24,modelName:route.alias,displayName:route.label,baseUrl,
      maxTokens:route.model.contextWindow??275000,maxOutputTokens:route.model.maxOutputTokens??125000}})):[]};
}
