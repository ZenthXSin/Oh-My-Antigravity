import {messages,tools} from './openai-chat.mjs';
import {nextReasoningSignature} from '../reasoning-history.mjs';

export function request(route,body,key) {
  const input=[];let system='';
  for(const message of messages(body,route)) {
    if(message.role==='system'){system=message.content;continue;}
    if(message.role==='tool'){input.push({role:'user',content:[{type:'tool_result',tool_use_id:message.tool_call_id,content:message.content}]});continue;}
    const content=[...(message.omaReasoning??[]),...(message.content??[]).map(part=>part.type==='image_url'?{type:'image',source:{type:'base64',media_type:part.image_url.url.split(';')[0].slice(5),data:part.image_url.url.split(',')[1]}}:{type:'text',text:part.text})];
    for(const call of message.tool_calls??[])content.push({type:'tool_use',id:call.id,name:call.function.name,input:JSON.parse(call.function.arguments)});
    input.push({role:message.role,content});
  }
  const thinking=route.parameters.adaptiveEffort?{type:'adaptive'}:route.parameters.thinkingBudget!==undefined?{type:'enabled',budget_tokens:route.parameters.thinkingBudget}:undefined;
  return {url:route.provider.baseUrl.replace(/\/messages\/?$/,'')+'/messages',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
    body:{model:route.model.id,messages:input,system,stream:true,max_tokens:route.model.maxOutputTokens??125000,
      tools:tools(body).map(tool=>({name:tool.function.name,description:tool.function.description,input_schema:tool.function.parameters})),
      ...(thinking?{thinking}:{}),...(route.parameters.adaptiveEffort?{output_config:{effort:route.parameters.adaptiveEffort}}:{})}};
}
export function nativeResponse(value,state) {
  if(value.type==='message_start')state.usage={promptTokenCount:value.message.usage?.input_tokens??0,candidatesTokenCount:0,cachedContentTokenCount:value.message.usage?.cache_read_input_tokens??0};
  if(value.type==='content_block_start'&&value.content_block.type==='tool_use')state.calls.set(value.index,{id:value.content_block.id,name:value.content_block.name,json:'',input:value.content_block.input});
  if(value.type==='content_block_start'&&['thinking','redacted_thinking'].includes(value.content_block.type))state.reasoningBlocks.set(value.index,{...value.content_block});
  if(value.type==='content_block_delta') {
    const delta=value.delta;
    if(delta.type==='text_delta')return {parts:[{text:delta.text,...nextReasoningSignature(state)}]};
    if(delta.type==='thinking_delta'){state.reasoningBlocks.get(value.index).thinking+=delta.thinking;return {parts:[{text:delta.thinking,thought:true}]};}
    if(delta.type==='signature_delta')state.reasoningBlocks.get(value.index).signature=(state.reasoningBlocks.get(value.index).signature??'')+delta.signature;
    if(delta.type==='input_json_delta')state.calls.get(value.index).json+=delta.partial_json;
  }
  if(value.type==='content_block_stop'&&state.reasoningBlocks.has(value.index)){const block=state.reasoningBlocks.get(value.index);state.reasoningItems.push(block);return {parts:[]};}
  if(value.type==='content_block_stop'&&state.calls.has(value.index)) {const call=state.calls.get(value.index);return {parts:[{functionCall:{id:call.id,name:call.name,args:call.json?JSON.parse(call.json):call.input},...nextReasoningSignature(state)}]};}
  if(value.type==='message_delta'){state.usage.candidatesTokenCount=value.usage?.output_tokens??0;state.usage.totalTokenCount=state.usage.promptTokenCount+state.usage.candidatesTokenCount;return {parts:[],finish:value.delta?.stop_reason==='max_tokens'?'length':'STOP',usage:state.usage};}
  if(value.type==='error')throw new Error('The Anthropic upstream reported a failed response.');
  return {parts:[]};
}
