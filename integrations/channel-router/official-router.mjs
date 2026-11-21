import http from 'node:http';
import {events} from './sse.mjs';

// Keep official authentication in the native client. This router receives its
// request and only forwards account credentials to the fixed official endpoint.
const officialEndpoint='https://daily-cloudcode-pa.googleapis.com';
const forwardedHeaders=['authorization','content-type','accept','user-agent','x-goog-api-client','x-goog-user-project','x-client-data'];
export async function startOfficialRouter(gateway,token,{fetchOfficial=fetch}={}) {
  const prefix='/official/'+token;
  const server=http.createServer(async(request,response)=>{
    const controller=new AbortController();response.on('close',()=>controller.abort());
    try {
      const url=new URL(request.url,'http://127.0.0.1');
      if(!url.pathname.startsWith(prefix+'/v1internal')){response.writeHead(404);response.end();return;}
      const endpoint=url.pathname.slice(prefix.length);
      let raw='';for await(const chunk of request){raw+=chunk;if(raw.length>32*1024*1024)throw new Error('Request exceeds the local channel size limit.');}
      const operation=/^\/v1internal:(streamGenerateContent|generateContent|countTokens)$/.exec(endpoint);
      const body=operation&&raw?JSON.parse(raw):null;
      const channel=typeof body?.model==='string'&&body.model.startsWith('oma-');
      let upstream;
      if(channel) {
        if(request.method!=='POST')throw new Error('Channel generation requires POST.');
        upstream=await fetch(`${gateway.url}/v1beta/models/${encodeURIComponent(body.model)}:${operation[1]}${url.search}`,{
          method:'POST',headers:{'content-type':'application/json','x-goog-api-key':token},
          body:JSON.stringify(body.request),signal:controller.signal,redirect:'error'});
      } else {
        const headers=Object.fromEntries(forwardedHeaders.filter(name=>request.headers[name]!==undefined).map(name=>[name,request.headers[name]]));
        upstream=await fetchOfficial(officialEndpoint+endpoint+url.search,{method:request.method,headers,
          ...(request.method==='GET'||request.method==='HEAD'?{}:{body:raw}),signal:controller.signal,redirect:'error'});
      }
      response.writeHead(upstream.status,{'content-type':upstream.headers.get('content-type')??'application/json'});
      if(channel&&upstream.ok&&operation[1]==='streamGenerateContent') {
        for await(const value of events(upstream.body))response.write('data: '+JSON.stringify(value.error?value:{response:value})+'\n\n');
      } else if(channel&&upstream.ok&&operation[1]==='generateContent') {
        response.write(JSON.stringify({response:await upstream.json()}));
      } else if(upstream.body)for await(const chunk of upstream.body)response.write(chunk);
      response.end();
    } catch(error) {
      if(controller.signal.aborted)return;
      const value={error:{code:502,status:'UNAVAILABLE',message:'Model routing failed: '+error.name}};
      if(response.headersSent)response.end('data: '+JSON.stringify(value)+'\n\n');
      else{response.writeHead(502,{'content-type':'application/json'});response.end(JSON.stringify(value));}
    }
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  return {server,url:`http://127.0.0.1:${server.address().port}${prefix}`};
}
