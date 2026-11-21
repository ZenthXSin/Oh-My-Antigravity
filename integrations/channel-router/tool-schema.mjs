// Gemini's protobuf JSON uses uppercase type enums. Convert schema nodes only;
// parameter names, enum values and descriptions keep their original text.
export function jsonToolSchema(schema) {
  if(typeof schema==='boolean')return schema;
  const result={...schema};
  if(typeof result.type==='string')result.type=result.type.toLowerCase();
  else if(Array.isArray(result.type))result.type=result.type.map(type=>type.toLowerCase());
  if(result.nullable&&typeof result.type==='string')result.type=[result.type,'null'];
  delete result.nullable;delete result.propertyOrdering;
  for(const key of ['minItems','maxItems','minLength','maxLength','minProperties','maxProperties','minimum','maximum','exclusiveMinimum','exclusiveMaximum','multipleOf'])if(typeof result[key]==='string')result[key]=Number(result[key]);
  for(const key of ['properties','patternProperties','$defs','definitions'])if(result[key])result[key]=Object.fromEntries(Object.entries(result[key]).map(([name,value])=>[name,jsonToolSchema(value)]));
  for(const key of ['items','additionalProperties','not','contains','if','then','else'])if(result[key]&&typeof result[key]==='object')result[key]=Array.isArray(result[key])?result[key].map(jsonToolSchema):jsonToolSchema(result[key]);
  for(const key of ['anyOf','allOf','oneOf','prefixItems'])if(result[key])result[key]=result[key].map(jsonToolSchema);
  return result;
}
