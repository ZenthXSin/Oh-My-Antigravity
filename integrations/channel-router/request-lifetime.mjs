// Bound silent waits, while allowing a stream that continues making progress.
export class RequestLifetime {
  constructor(signal,{headersMs=45000,progressMs=180000}={}) {
    this.controller=new AbortController();this.signal=this.controller.signal;
    this.headersMs=headersMs;this.progressMs=progressMs;this.parent=signal;
    this.disconnect=()=>this.controller.abort(signal.reason);
    if(signal.aborted)this.disconnect();else signal.addEventListener('abort',this.disconnect,{once:true});
    this.arm(headersMs,'The upstream did not return response headers in time.');
  }
  arm(ms,message) {
    clearTimeout(this.timer);
    this.timer=setTimeout(()=>{
      const error=new Error(message);error.name='UpstreamTimeout';error.status=504;
      this.controller.abort(error);
    },ms);this.timer.unref?.();
  }
  progress(){this.arm(this.progressMs,'The upstream stopped making progress. The request timed out.');}
  error(error){return this.signal.aborted&&!this.parent.aborted?this.signal.reason:error;}
  close(){clearTimeout(this.timer);this.parent.removeEventListener('abort',this.disconnect);this.controller.abort();}
}

export function retryable(error) {
  return error.name==='UpstreamTimeout'||error.name==='TypeError'||
    ['ECONNRESET','ETIMEDOUT','EPIPE','UND_ERR_SOCKET','UND_ERR_CONNECT_TIMEOUT'].includes(error.cause?.code)||
    [408,429,500,502,503,504].includes(error.status);
}

export async function retryDelay(signal) {
  // An abortable delay also releases promptly when the user cancels the run.
  await new Promise((resolve,reject)=>{
    if(signal.aborted){reject(signal.reason);return;}
    const abort=()=>{clearTimeout(timer);reject(signal.reason);};
    const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},750);
    signal.addEventListener('abort',abort,{once:true});
  });
}
