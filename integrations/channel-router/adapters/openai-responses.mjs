import {messages,tools} from './openai-chat.mjs';
import {encodeReasoning} from '../reasoning-history.mjs';

export function request(route,body,key) {
  const input=[];
  for(const message of messages(body,route)) {
    if(message.role==='tool')input.push({type:'function_call_output',call_id:message.tool_call_id,output:message.content});
    else {
      input.push(...message.omaReasoning??[]);
      if(message.content){const parts=typeof message.content==='string'?[{type:'text',text:message.content}]:message.content;
        input.push({role:message.role,content:parts.map(part=>part.type==='image_url'?{type:'input_image',image_url:part.image_url.url}:{type:message.role==='assistant'?'output_text':'input_text',text:part.text})});}
      for(const call of message.tool_calls??[])input.push({type:'function_call',call_id:call.id,name:call.function.name,arguments:call.function.arguments});
    }
  }
  return {url:route.provider.baseUrl.replace(/\/responses\/?$/,'')+'/responses',headers:{'content-type':'application/json',authorization:'Bearer '+key},
    body:{model:route.model.id,input,stream:true,store:false,include:['reasoning.encrypted_content'],tools:tools(body).map(tool=>({type:'function',...tool.function,strict:false})),
      ...(route.parameters.reasoningEffort?{reasoning:{effort:route.parameters.reasoningEffort}}:{}),max_output_tokens:route.model.maxOutputTokens??125000}};
}
export function nativeResponse(value,state) {
  switch(value.type) {
    case 'response.output_text.delta':return {parts:[{text:value.delta,...(state.reasoningItems.length?{thoughtSignature:encodeReasoning(state.route,state.reasoningItems)}:{})}]};
    case 'response.reasoning_summary_text.delta':return {parts:[{text:value.delta,thought:true}]};
    case 'response.output_item.done':
      if(value.item?.type==='reasoning'){state.reasoningItems.push(value.item);return {parts:[]};}
      return value.item?.type==='function_call'?{parts:[{functionCall:{id:value.item.call_id,name:value.item.name,args:JSON.parse(value.item.arguments||'{}')},...(state.reasoningItems.length?{thoughtSignature:encodeReasoning(state.route,state.reasoningItems)}:{})}]}:{parts:[]};
    case 'response.incomplete':return {parts:[],finish:'length'};
    case 'response.completed':{const usage=value.response?.usage;return {parts:[],finish:'STOP',usage:usage?{promptTokenCount:usage.input_tokens??0,candidatesTokenCount:usage.output_tokens??0,totalTokenCount:usage.total_tokens??0,
      ...(usage.input_tokens_details?.cached_tokens!==undefined?{cachedContentTokenCount:usage.input_tokens_details.cached_tokens}:{})}:undefined};}
    case 'response.failed':case 'error':throw new Error('The Responses upstream reported a failed response.');
    default:return {parts:[]};
  }
}
