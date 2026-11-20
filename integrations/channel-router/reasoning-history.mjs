// Carry provider-specific reasoning through the native Gemini history format.
export function encodeReasoning(route,items) {
  return Buffer.from(JSON.stringify({omaReasoning:1,provider:route.provider.id,model:route.model.id,protocol:route.provider.protocol,items})).toString('base64');
}
export function decodeReasoning(signature,route) {
  if(!signature||!route)return [];
  const raw=Buffer.from(signature,'base64').toString('utf8');
  if(!raw.startsWith('{"omaReasoning":1,'))return [];
  const value=JSON.parse(raw);
  return value.provider===route.provider.id&&value.model===route.model.id&&value.protocol===route.provider.protocol?value.items:[];
}
