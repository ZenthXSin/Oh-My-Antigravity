let lastFailure=null;
export function channelFailure(){return lastFailure;}
export function clearChannelFailure(){lastFailure=null;}
export function rememberChannelFailure(error,route){lastFailure={time:new Date().toISOString(),model:route?.base??null,message:error.message};}
export function upstreamEventError(value,route,key) {
  const detail=value.response?.error??value.error??value;
  const message=typeof detail==='string'?detail:detail.message??detail.code??'The upstream reported a failed response.';
  const safe=String(message).split(key).join('[redacted]').replace(/Bearer\s+\S+/gi,'Bearer [redacted]').slice(0,500);
  const error=new Error(`${route.provider.name} / ${route.model.id}: HTTP 502. ${safe}`);
  error.status=502;return error;
}
export async function upstreamError(response,route,key) {
  const raw=await response.text();
  let detail;
  try{const value=JSON.parse(raw);const message=value.error?.message??value.message;detail=message&&message!=='openai_error'?message:JSON.stringify(value);}
  catch{detail=raw.trim().startsWith('<')?'The endpoint returned an HTML page instead of API data.':raw.slice(0,500);}
  const safe=String(detail??response.statusText).split(key).join('[redacted]').replace(/Bearer\s+\S+/gi,'Bearer [redacted]').slice(0,500);
  const error=new Error(`${route.provider.name} / ${route.model.id}: HTTP ${response.status}. ${safe}`);
  error.status=response.status;return error;
}
