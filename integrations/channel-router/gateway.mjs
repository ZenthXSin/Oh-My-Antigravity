import http from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {routes} from './catalog.mjs';
import * as gemini from './adapters/gemini.mjs';
import * as chat from './adapters/openai-chat.mjs';
import * as responses from './adapters/openai-responses.mjs';
import * as anthropic from './adapters/anthropic.mjs';
import {upstreamError,rememberChannelFailure,clearChannelFailure} from './upstream-error.mjs';
import {PromptCacheStats} from './prompt-cache.mjs';
import {RequestLifetime,retryable,retryDelay} from './request-lifetime.mjs';
import {forwardResponse} from './stream-response.mjs';
const adapters={'gemini':gemini,'openai-chat':chat,'openai-responses':responses,anthropic};

function authorized(value,token) {
  const supplied=Buffer.from(value??'');const expected=Buffer.from(token);
  return supplied.length===expected.length&&timingSafeEqual(supplied,expected);
}
export async function startGateway(store,token,{attachments,timeouts,fetchUpstream=fetch}={}) {
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
      const serialized=JSON.stringify(upstreamRequest.body);let outputStarted=false;
      for(let attempt=1;attempt<=2;attempt++) {
        const lifetime=new RequestLifetime(controller.signal,timeouts);
        if(cacheRequest){cacheRequest.attempts=attempt;cacheRequest.state='running';}
        try {
          const upstream=await fetchUpstream(upstreamRequest.url,{method:'POST',headers:upstreamRequest.headers,body:serialized,signal:lifetime.signal,redirect:'error'});
          lifetime.progress();
          if(!upstream.ok)throw await upstreamError(upstream,route,key);
          if(match[2]==='countTokens'){response.setHeader('content-type','application/json');response.end(JSON.stringify(await upstream.json()));return;}
          if(adapter===gemini) {
            response.setHeader('content-type',stream?'text/event-stream':'application/json');
            for await(const chunk of upstream.body){lifetime.progress();outputStarted=true;response.write(chunk);}
            clearChannelFailure();response.end();return;
          }
          if(adapter!==chat&&!(upstream.headers.get('content-type')??'').includes('text/event-stream'))throw new Error('This channel requires an SSE streaming response from the upstream.');
          const usage=await forwardResponse(upstream,{adapter,route,key,stream,response,lifetime,onOutput:()=>{outputStarted=true;}});
          if(cacheRequest)cache.finish(cacheRequest,usage);
          clearChannelFailure();return;
        } catch(cause) {
          const error=lifetime.error(cause);
          if(attempt===2||outputStarted||controller.signal.aborted||!retryable(error))throw error;
          if(cacheRequest)cacheRequest.state='retrying';
        } finally {lifetime.close();}
        await retryDelay(controller.signal);
      }
    } catch(error) {
      if(cacheRequest)cacheRequest.state=controller.signal.aborted?'cancelled':'failed';
      if(controller.signal.aborted)return;
      rememberChannelFailure(error,activeRoute);
      const known=['Attachment','No channel','This channel','This OpenAI','A tool result','Upstream stream','The Anthropic upstream','The Responses upstream','Request exceeds'];
      const message=error.name==='UpstreamTimeout'||error.message.includes('HTTP ')||known.some(prefix=>error.message.startsWith(prefix))?error.message:'Channel request failed: '+error.name;
      const code=error.status??502;const status=code===400?'INVALID_ARGUMENT':code===401?'UNAUTHENTICATED':code===403?'PERMISSION_DENIED':code===404?'NOT_FOUND':code===429?'RESOURCE_EXHAUSTED':code===504?'DEADLINE_EXCEEDED':'UNAVAILABLE';
      if(response.headersSent)response.end('data: '+JSON.stringify({error:{code,status,message}})+'\n\n');
      else {response.writeHead(code,{'content-type':'application/json'});response.end(JSON.stringify({error:{code,status,message}}));}
    }
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  return {server,cache,url:`http://127.0.0.1:${server.address().port}`};
}
