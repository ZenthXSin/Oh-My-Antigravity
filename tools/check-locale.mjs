import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {parse} from 'acorn';
import * as walk from 'acorn-walk';

const root=path.resolve(import.meta.dirname,'..');
const original=parse(fs.readFileSync(path.join(root,'original-web/main.js'),'utf8'),{ecmaVersion:'latest'});
const patched=parse(fs.readFileSync(path.join(root,'web/main.js'),'utf8'),{ecmaVersion:'latest'});
const clean=n=>JSON.stringify(n,(k,v)=>['start','end','raw'].includes(k)?undefined:typeof v==='bigint'?v.toString()+'n':v);
function invariants(tree){
  const result={cases:[],comparisons:[],keys:[],internalValues:[],registryTitles:[]};
  walk.ancestor(tree,{
    SwitchCase(n){if(n.test)result.cases.push(clean(n.test));},
    BinaryExpression(n){if(['===','!==','==','!='].includes(n.operator))result.comparisons.push(clean(n));},
    Property(n,ancestors){
      const f=ancestors.findLast(a=>a.type==='FunctionDeclaration');
      if(f?.id?.name?.startsWith('__agyZh'))return;
      result.keys.push(clean(n.key));
      const key=n.key.name??n.key.value;
      if(['screen','id','type','name','model','modelId','status','url','endpoint','permission'].includes(key)&&n.value.type==='Literal')result.internalValues.push([key,n.value.value]);
      const call=ancestors.at(-3);
      const object=ancestors.at(-2);
      const isDisplaySection=object?.properties?.some(p=>(p.key?.name??p.key?.value)==='type'&&p.value?.value==='section-header');
      if(key==='title'&&!isDisplaySection&&call?.callee?.property?.name!=='createElement')result.registryTitles.push(clean(n.value));
    }
  });
  return result;
}
// Remove helper definitions before comparing the untouched native program.
patched.body=patched.body.filter(n=>!n.id?.name?.startsWith('__agyZh'));
assert.deepEqual(patched.body.filter(n=>n.directive).map(n=>n.directive),original.body.filter(n=>n.directive).map(n=>n.directive));
assert.deepEqual(invariants(patched),invariants(original));
assert(!fs.readFileSync(path.join(root,'web/index.html'),'utf8').includes('window.__APP_CONFIG__ ='));
console.log('PASS: native screen IDs, routes, enums, comparisons, registry titles, property keys and directives preserved');
