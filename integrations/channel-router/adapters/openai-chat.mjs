import {createHash} from 'node:crypto';
import {decodeReasoning} from '../reasoning-history.mjs';
import {stableStringify,stableValue} from '../stable-json.mjs';
import {promptCacheKey} from '../prompt-cache.mjs';

export function messages(body,route) {
  const result=[];const calls=[];
  if(body.systemInstruction?.parts)result.push({role:'system',content:body.systemInstruction.parts.filter(part=>part.text).map(part=>part.text).join('\n')});
  for(const content of body.contents??[]) {
    const parts=[];const toolCalls=[];const responses=[];const reasoning=new Map();
    for(const part of content.parts??[]) {
      if(Object.keys(part).some(key=>!['text','thought','thoughtSignature','inlineData','functionCall','functionResponse'].includes(key)))throw new Error('This channel cannot forward the supplied media or content part.');
      for(const item of decodeReasoning(part.thoughtSignature,route))reasoning.set(JSON.stringify(item),item);
      if(part.text&&!part.thought)parts.push({type:'text',text:part.text});
      if(part.inlineData){
        if(!part.inlineData.mimeType.startsWith('image/'))throw new Error('This OpenAI Chat route cannot forward non-image inline media.');
        parts.push({type:'image_url',image_url:{url:`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`}});
      }
      if(part.functionCall){
        const call=part.functionCall;const argumentsJson=stableStringify(call.args??{});
        const id=call.id||'call_'+createHash('sha256').update(stableStringify([calls.length,call.name,argumentsJson])).digest('hex').slice(0,32);
        calls.push({id,name:call.name});toolCalls.push({id,type:'function',function:{name:call.name,arguments:argumentsJson}});
      }
      if(part.functionResponse){const value=part.functionResponse;const call=calls.find(call=>!call.answered&&(value.id?call.id===value.id:call.name===value.name));if(!call&&!value.id)throw new Error('A tool result has no matching tool call.');if(call)call.answered=true;responses.push({role:'tool',tool_call_id:value.id||call.id,content:stableStringify(value.response??{})});}
    }
    if(parts.length||toolCalls.length||reasoning.size)result.push({role:content.role==='model'?'assistant':'user',content:parts.length?parts:null,...(toolCalls.length?{tool_calls:toolCalls}:{}),...(reasoning.size?{omaReasoning:[...reasoning.values()]}:{})});
    result.push(...responses);
  }
  return result;
}
export function tools(body) {
  return (body.tools??[]).flatMap(tool=>tool.functionDeclarations??[]).map(tool=>({type:'function',function:{name:tool.name,description:tool.description,parameters:stableValue(tool.parametersJsonSchema??tool.parameters??{type:'object',properties:{}})}})).sort((a,b)=>a.function.name<b.function.name?-1:a.function.name>b.function.name?1:0);
}
export function request(route,body,key,stream,headers) {
  const declarations=tools(body);
  const cacheKey=promptCacheKey(route,body,headers);
  return {url:route.provider.baseUrl.replace(/\/chat\/completions\/?$/,'')+'/chat/completions',headers:{'content-type':'application/json',authorization:'Bearer '+key},
    body:{model:route.model.id,messages:messages(body,route),stream:true,stream_options:{include_usage:true},
      ...(declarations.length?{tools:declarations}:{}),...(route.parameters.reasoningEffort?{reasoning_effort:route.parameters.reasoningEffort}:{}),
      ...(cacheKey?{prompt_cache_key:cacheKey}:{}),max_completion_tokens:route.model.maxOutputTokens??125000}};
}
export function nativeResponse(value) {
  const choice=value.choices?.[0];const delta=choice?.delta??choice?.message??{};
  const parts=[];
  if(delta.content)parts.push({text:delta.content});
  if(delta.reasoning_content)parts.push({text:delta.reasoning_content,thought:true});
  return {parts,toolDeltas:delta.tool_calls??[],finish:choice?.finish_reason,
    usage:value.usage?{promptTokenCount:value.usage.prompt_tokens??0,candidatesTokenCount:value.usage.completion_tokens??0,totalTokenCount:value.usage.total_tokens??0,
      ...(value.usage.prompt_tokens_details?.cached_tokens!==undefined?{cachedContentTokenCount:value.usage.prompt_tokens_details.cached_tokens}:{})}:undefined};
}
