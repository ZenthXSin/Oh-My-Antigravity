let lastFailure=null;
export function channelFailure(){return lastFailure;}
export function clearChannelFailure(){lastFailure=null;}
export function rememberChannelFailure(error,route){lastFailure={time:new Date().toISOString(),model:route?.base??null,message:error.message};}
export async function upstreamError(response,route,key) {
  const raw=await response.text();
  let detail;
  try{const value=JSON.parse(raw);const message=value.error?.message??value.message;detail=message&&message!=='openai_error'?message:JSON.stringify(value);}
  catch{detail=raw.trim().startsWith('<')?'The endpoint returned an HTML page instead of API data.':raw.slice(0,500);}
  const safe=String(detail??response.statusText).split(key).join('[redacted]').replace(/Bearer\s+\S+/gi,'Bearer [redacted]').slice(0,500);
  const error=new Error(`${route.provider.name} / ${route.model.id}: HTTP ${response.status}. ${safe}`);
  error.status=response.status;return error;
}
