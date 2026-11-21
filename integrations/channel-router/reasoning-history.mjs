// Carry provider-specific reasoning through the native Gemini history format.
export function encodeReasoning(route,items) {
  return Buffer.from(JSON.stringify({omaReasoning:1,provider:route.provider.id,model:route.model.id,protocol:route.provider.protocol,items})).toString('base64');
}
export function nextReasoningSignature(state) {
  const items=state.reasoningItems.slice(state.reasoningSent??0);
  if(!items.length)return {};
  state.reasoningSent=state.reasoningItems.length;
  return {thoughtSignature:encodeReasoning(state.route,items)};
}

// Native streams concatenate signature bytes when they merge output parts.
// Older versions sent a complete envelope on every delta, so read every
// complete envelope and recover each reasoning item once.
function envelopes(raw) {
  const values=[];let start=0;
  while(start<raw.length) {
    while(/\s/.test(raw[start]??'')&&start<raw.length)start++;
    if(start===raw.length)break;
    if(raw[start]!=='{')throw new Error('This channel cannot restore malformed reasoning history.');
    let depth=0,quoted=false,escaped=false,end=start;
    for(;end<raw.length;end++) {
      const char=raw[end];
      if(quoted) {
        if(escaped)escaped=false;
        else if(char==='\\')escaped=true;
        else if(char==='"')quoted=false;
      } else if(char==='"')quoted=true;
      else if(char==='{'||char==='[')depth++;
      else if(char==='}'||char===']') {
        depth--;
        if(depth===0){end++;break;}
      }
    }
    if(depth!==0||quoted)throw new Error('This channel cannot restore incomplete reasoning history.');
    const value=JSON.parse(raw.slice(start,end));
    if(value.omaReasoning!==1||!Array.isArray(value.items))throw new Error('This channel cannot restore malformed reasoning history.');
    values.push(value);start=end;
  }
  return values;
}
export function decodeReasoning(signature,route) {
  if(!signature||!route)return [];
  const raw=Buffer.from(signature,'base64').toString('utf8');
  if(!raw.startsWith('{"omaReasoning":1,'))return [];
  const items=new Map();
  for(const value of envelopes(raw)) {
    if(value.provider!==route.provider.id||value.model!==route.model.id||value.protocol!==route.provider.protocol)continue;
    for(const item of value.items)items.set(JSON.stringify(item),item);
  }
  return [...items.values()];
}
