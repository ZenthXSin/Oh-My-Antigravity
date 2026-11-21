import {createHash} from 'node:crypto';
import {stableStringify} from './stable-json.mjs';

const digest=value=>createHash('sha256').update(value).digest('hex');
const guid='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
export function promptCacheKey(route,body,headers={}) {
  const explicit=headers['session_id']??headers['x-session-id']??headers['thread-id']??headers['x-conversation-id'];
  const text=(body.systemInstruction?.parts??[]).map(part=>part.text??'').join('\n');
  const session=explicit??new RegExp('^Conversation ID: ('+guid+')\\s*$','im').exec(text)?.[1];
  if(!session)return undefined;
  return 'oma-'+digest(stableStringify([route.provider.id,route.provider.protocol,route.provider.baseUrl,route.model.id,session]));
}

// Keep bounded digests and numeric usage, never prompts, signatures or keys.
export class PromptCacheStats {
  constructor(){this.scopes=new Map();this.recent=[];}
  start(route,request) {
    const body=request.body;
    const scope=body.prompt_cache_key;
    const history=body.input??body.messages??[];
    const system=history.filter(item=>['system','developer'].includes(item.role));
    const snapshot={system:digest(stableStringify(system)),tools:digest(stableStringify(body.tools??[])),history:history.slice(0,4096).map(item=>digest(stableStringify(item)))};
    const previous=scope&&this.scopes.get(scope);
    let unchanged=0;
    if(previous)while(unchanged<Math.min(previous.history.length,snapshot.history.length)&&previous.history[unchanged]===snapshot.history[unchanged])unchanged++;
    const row={model:route.base,protocol:route.provider.protocol,affinity:!!scope,
      previousRequest:!!previous,systemUnchanged:previous?previous.system===snapshot.system:null,
      toolsUnchanged:previous?previous.tools===snapshot.tools:null,unchangedHistoryItems:unchanged,
      historyItems:history.length,previousHistoryItems:previous?.history.length??0,
      inputTokens:null,cachedTokens:null,hitRate:null,state:'running'};
    if(scope){this.scopes.delete(scope);this.scopes.set(scope,snapshot);if(this.scopes.size>64)this.scopes.delete(this.scopes.keys().next().value);}
    this.recent.push(row);if(this.recent.length>8)this.recent.shift();
    return row;
  }
  finish(row,usage) {
    row.state='complete';
    row.inputTokens=usage?.promptTokenCount??null;
    row.cachedTokens=usage?.cachedContentTokenCount??null;
    row.hitRate=row.inputTokens>0&&row.cachedTokens!==null?row.cachedTokens/row.inputTokens:null;
  }
  status(){return this.recent.map(row=>({...row}));}
}
