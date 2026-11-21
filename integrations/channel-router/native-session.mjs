import https from 'node:https';

// The desktop host already supplies the port and CSRF token for its own local
// language server. Its loopback HTTPS certificate is generated at startup.
export class NativeSession {
  connect(port,csrf){this.port=port;this.csrf=csrf;}
  trajectory(cascadeId) {
    return new Promise((resolve,reject)=>{
      if(!this.port){reject(new Error('Attachment workspace connection is not ready.'));return;}
      const request=https.request({hostname:'127.0.0.1',port:this.port,
        path:'/exa.language_server_pb.LanguageServerService/GetCascadeTrajectory',method:'POST',rejectUnauthorized:false,
        headers:{'content-type':'application/json','connect-protocol-version':'1','x-codeium-csrf-token':this.csrf}},response=>{
          let raw='';response.setEncoding('utf8');response.on('data',chunk=>raw+=chunk);
          response.on('end',()=>{try{if(response.statusCode!==200)throw new Error('Attachment conversation could not be loaded.');resolve(JSON.parse(raw).trajectory);}catch(error){reject(error);}});
          response.on('error',reject);
        });
      request.setTimeout(15000,()=>request.destroy(new Error('Attachment workspace lookup timed out.')));
      request.on('error',reject);request.end(JSON.stringify({cascadeId}));
    });
  }
}
