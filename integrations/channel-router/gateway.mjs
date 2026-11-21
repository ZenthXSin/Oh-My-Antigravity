import http from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {routes} from './catalog.mjs';
import {events} from './sse.mjs';
import * as gemini from './adapters/gemini.mjs';
import * as chat from './adapters/openai-chat.mjs';
import * as responses from './adapters/openai-responses.mjs';
import * as anthropic from './adapters/anthropic.mjs';
import {upstreamError,upstreamEventError,rememberChannelFailure,clearChannelFailure} from './upstream-error.mjs';
import {PromptCacheStats} from './prompt-cache.mjs';
const adapters={'gemini':gemini,'openai-chat':chat,'openai-responses':responses,anthropic};

function authorized(value,token) {
  const supplied=Buffer.from(value??'');const expected=Buffer.from(token);
  return supplied.length===expected.length&&timingSafeEqual(supplied,expected);
}
function nativeChunk(parts,finish,usage) {
  return {candidates:[{index:0,content:{role:'model',parts},...(finish?{finishReason:finish==='length'?'MAX_TOKENS':'STOP'}:{})}],...(usage?{usageMetadata:usage}:{})};
}
export async function startGateway(store,token,{attachments}={}) {
  const cache=new PromptCacheStats();
  const server=http.createServer(async(request,response)=>{
    const controller=new AbortController();response.on('close',()=>controller.abort());
    let activeRoute,cacheRequest;
    try {
      const url=new URL(request.url,'http://127.0.0.1');
      if(!authorized(request.headers['x-goog-api-key']??url.searchParams.get('key')??request.headers.authorization?.replace(/^Bearer /,''),token)){response.writeHead(401);response.end('Local channel authorization failed.');return;}
      const config=await store.read();const available=routes(config);
      if(request.method==='GET'&&url.pathname.endsWith('/models')){response.setHeader('content-type','application/json');response.end(JSON.stringify({models:available.map(route=>({name:'models/'+route.alias,displayName:route.label,supportedGenerationMethods:['generateContent','streamGenerateContent']}))}));return;}
      const match=/\/models\/([^/]+):(streamGenerateContent|generateContent|countTokens)$/.exec(url.pathname);
      if(request.method!=='POST'||!match){response.writeHead(404);response.end('Unknown channel endpoint.');return;}
      const alias=decodeURIComponent(match[1]);
      const route=available.find(route=>route.alias===alias)??(!alias.startsWith('oma-')?available.find(route=>route.alias===config.defaultAlias):null);
      if(!route)throw new Error('No channel is configured for the selected model.');
      activeRoute=route;
      const adapter=adapters[route.provider.protocol];
      if(match[2]==='countTokens'&&adapter!==gemini){response.writeHead(501);response.end('This upstream does not expose Gemini token counting.');return;}
      let raw='';for await(const chunk of request){raw+=chunk;if(raw.length>32*1024*1024)throw new Error('Request exceeds the local channel size limit.');}
      const body=JSON.parse(raw);const stream=match[2]==='streamGenerateContent';
      if(attachments)await attachments.request(body);
      const key=await store.secret(route.provider.id);
      const upstreamRequest=adapter.request(route,body,key,stream,request.headers);
      if(adapter===chat||adapter===responses)cacheRequest=cache.start(route,upstreamRequest);
      if(match[2]==='countTokens')upstreamRequest.url=upstreamRequest.url.replace(':generateContent',':countTokens');
      const upstream=await fetch(upstreamRequest.url,{method:'POST',headers:upstreamRequest.headers,body:JSON.stringify(upstreamRequest.body),signal:controller.signal,redirect:'error'});
      if(!upstream.ok)throw await upstreamError(upstream,route,key);
      clearChannelFailure();
      if(match[2]==='countTokens'){response.setHeader('content-type','application/json');response.end(JSON.stringify(await upstream.json()));return;}
      if(adapter===gemini) {
        response.setHeader('content-type',stream?'text/event-stream':'application/json');
        for await(const chunk of upstream.body)response.write(chunk);
        response.end();return;
      }
      const chunks=[];const calls=new Map();const state={calls:new Map(),usage:{},route,reasoningBlocks:new Map(),reasoningItems:[]};let finished=false,lastUsage;
      if(stream)response.setHeader('content-type','text/event-stream');
      const emit=value=>{if(stream)response.write('data: '+JSON.stringify(value)+'\n\n');else chunks.push(value);};
      const contentType=upstream.headers.get('content-type')??'';
      if(adapter!==chat&&!contentType.includes('text/event-stream'))throw new Error('This channel requires an SSE streaming response from the upstream.');
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
        if(parts.length||native.finish||native.usage)emit(nativeChunk(parts,native.finish,native.usage));
      }
      if(!finished)throw new Error('Upstream stream ended without a completion event.');
      if(cacheRequest)cache.finish(cacheRequest,lastUsage);
      if(!stream){const parts=chunks.flatMap(chunk=>chunk.candidates[0].content.parts);const last=chunks.at(-1);response.setHeader('content-type','application/json');response.end(JSON.stringify(nativeChunk(parts,last?.candidates[0].finishReason,last?.usageMetadata)));}
      else response.end();
    } catch(error) {
      if(cacheRequest)cacheRequest.state=controller.signal.aborted?'cancelled':'failed';
      if(controller.signal.aborted)return;
      rememberChannelFailure(error,activeRoute);
      const known=['Attachment','No channel','This channel','This OpenAI','A tool result','Upstream stream','The Anthropic upstream','The Responses upstream','Request exceeds'];
      const message=error.message.includes('HTTP ')||known.some(prefix=>error.message.startsWith(prefix))?error.message:'Channel request failed: '+error.name;
      const code=error.status??502;const status=code===400?'INVALID_ARGUMENT':code===401?'UNAUTHENTICATED':code===403?'PERMISSION_DENIED':code===404?'NOT_FOUND':code===429?'RESOURCE_EXHAUSTED':'UNAVAILABLE';
      if(response.headersSent)response.end('data: '+JSON.stringify({error:{code,status,message}})+'\n\n');
      else {response.writeHead(code,{'content-type':'application/json'});response.end(JSON.stringify({error:{code,status,message}}));}
    }
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  return {server,cache,url:`http://127.0.0.1:${server.address().port}`};
}
