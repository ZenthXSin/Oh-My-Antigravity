import {events} from './sse.mjs';
import {upstreamEventError} from './upstream-error.mjs';

export function nativeChunk(parts,finish,usage) {
  return {candidates:[{index:0,content:{role:'model',parts},...(finish?{finishReason:finish==='length'?'MAX_TOKENS':'STOP'}:{})}],...(usage?{usageMetadata:usage}:{})};
}

export async function forwardResponse(upstream,{adapter,route,key,stream,response,lifetime,onOutput}) {
  const chunks=[];const calls=new Map();const state={calls:new Map(),usage:{},route,reasoningBlocks:new Map(),reasoningItems:[]};
  let finished=false,lastUsage;
  if(stream)response.setHeader('content-type','text/event-stream');
  const emit=value=>{onOutput();if(stream)response.write('data: '+JSON.stringify(value)+'\n\n');else chunks.push(value);};
  const contentType=upstream.headers.get('content-type')??'';
  const iterable=contentType.includes('text/event-stream')?events(upstream.body):(async function*(){yield await upstream.json();})();
  for await(const value of iterable) {
    if(value.type==='response.failed'||value.type==='error')throw upstreamEventError(value,route,key);
    const native=adapter.nativeResponse(value,state);
    if(native.usage)lastUsage=native.usage;
    for(const delta of native.toolDeltas??[]) {
      const call=calls.get(delta.index??0)??{id:'',name:'',json:''};
      if(delta.id)call.id=delta.id;if(delta.function?.name)call.name+=delta.function.name;
      if(delta.function?.arguments)call.json+=delta.function.arguments;
      calls.set(delta.index??0,call);
    }
    const parts=native.parts??[];
    if(native.finish) {
      for(const call of calls.values())parts.push({functionCall:{id:call.id,name:call.name,args:JSON.parse(call.json||'{}')}});
      calls.clear();finished=true;
    }
    // Heartbeats and empty events do not extend a stalled generation forever.
    if(parts.length||native.finish||native.usage||native.toolDeltas?.some(d=>d.function?.arguments||d.function?.name))lifetime.progress();
    if(parts.length||native.finish||native.usage)emit(nativeChunk(parts,native.finish,native.usage));
    if(['response.completed','response.incomplete','message_stop'].includes(value.type)||finished&&native.usage)break;
  }
  if(!finished)throw new Error('Upstream stream ended without a completion event.');
  if(!stream){const parts=chunks.flatMap(chunk=>chunk.candidates[0].content.parts);const last=chunks.at(-1);response.setHeader('content-type','application/json');response.end(JSON.stringify(nativeChunk(parts,last?.candidates[0].finishReason,last?.usageMetadata)));}
  else response.end();
  return lastUsage;
}
