// QuickJS/WASM exposes only the native-workflow bridge, no Node globals.
import readline from 'node:readline';
import {getQuickJS} from 'quickjs-emscripten';

const input=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
const emit=value=>process.stdout.write(JSON.stringify(value)+'\n');
const initial=await new Promise(resolve=>input.once('line',line=>resolve(JSON.parse(line))));
const timeout=Math.min(Math.max(initial.timeout_ms||120000,1000),180000);
const deadline=Date.now()+timeout;
const QuickJS=await getQuickJS(),runtime=QuickJS.newRuntime();
runtime.setMemoryLimit(32*1024*1024);runtime.setMaxStackSize(512*1024);
runtime.setInterruptHandler(()=>Date.now()>deadline);
const vm=runtime.newContext(),pending=new Map();let sequence=0,closed=false,calls=0,outputBytes=0;
const maxOutput=Math.min(initial.max_output_chars||16000,64000);
const allowed=new Map((initial.tools||[]).map(t=>[t.name,t]));
const hardTimeout=setTimeout(()=>{emit({type:'error',message:'JS execution timeout; native workflow calls will be cancelled'});process.exit(1);},timeout+500);

function jobs(){
  if(closed)return;
  const result=runtime.executePendingJobs();
  if(result.error){const e=vm.dump(result.error);result.error.dispose();emit({type:'error',message:String(e?.message||e)});process.exit(1);}
}
const bridge=vm.newFunction('__native_call',(nameHandle,argsHandle)=>{
  const name=vm.getString(nameHandle),args=vm.getString(argsHandle);
  if(!allowed.has(name)||['run_workflow','finish'].includes(name))throw Error('Tool unavailable in this native workflow: '+name);
  if(++calls>64)throw Error('JS tool call limit exceeded (64)');
  if(args.length>200000)throw Error('Tool arguments exceed limit');
  const promise=vm.newPromise(),id=++sequence;
  pending.set(id,promise);emit({type:'call',id,name,args:JSON.parse(args)});
  return promise.handle.dup();
});
vm.setProp(vm.global,'__native_call',bridge);bridge.dispose();
const print=vm.newFunction('__text',value=>{
  const raw=vm.getString(value),remaining=maxOutput-outputBytes;
  if(remaining>0){emit({type:'text',text:raw.slice(0,remaining)});outputBytes+=Math.min(raw.length,remaining);}
  if(raw.length>remaining&&remaining>0)emit({type:'text',text:'[JS output truncated; select a smaller result slice]'});
});
vm.setProp(vm.global,'__text',print);print.dispose();

const catalog=[...allowed.values()].map(t=>({name:t.name,binding:t.name.replace(/[^a-zA-Z0-9_]/g,'_'),description:t.description||''}));
if(new Set(catalog.map(t=>t.binding)).size!==catalog.length)throw Error('Tool binding collision');
const bootstrap=`
const ALL_TOOLS=Object.freeze(${JSON.stringify(catalog)}.map(Object.freeze));
const tools=Object.create(null);
for(const tool of ALL_TOOLS){
  tools[tool.binding]=async(args={})=>{
    const reply=JSON.parse(await __native_call(tool.name,JSON.stringify(args)));
    if(reply.error){const e=new Error(reply.error.message);e.name='ToolError';e.denied=reply.error.denied===true;e.tool=tool.name;throw e;}
    return reply.result;
  };
}
Object.freeze(tools);
function text(value){__text(typeof value==='string'?value:JSON.stringify(value));}
const console=Object.freeze({log:(...values)=>text(values.map(v=>typeof v==='string'?v:JSON.stringify(v)).join(' '))});
`;
vm.unwrapResult(vm.evalCode(bootstrap,'workflow-bootstrap.js')).dispose();
input.on('line',line=>{
  if(closed)return;
  let m;try{m=JSON.parse(line);}catch{return;}
  const promise=pending.get(m.id);if(!promise)return;
  pending.delete(m.id);
  const value=vm.newString(JSON.stringify(m));promise.resolve(value);value.dispose();
  promise.handle.dispose();jobs();
});

let handle;
try{
  if(typeof initial.source!=='string'||initial.source.length>100000)throw Error('Invalid JS source');
  handle=vm.unwrapResult(vm.evalCode('(async()=>{\n'+initial.source+'\n})()','workflow.js'));
  const resultPromise=vm.resolvePromise(handle);jobs();
  const result=await resultPromise;
  vm.unwrapResult(result).dispose();
  emit({type:'done',calls,discardedPendingCalls:pending.size});
}catch(error){emit({type:'error',message:String(error?.message||error)});process.exitCode=1;}
finally{
  closed=true;clearTimeout(hardTimeout);input.close();
  if(handle?.alive)handle.dispose();
  for(const p of pending.values())if(p.handle.alive)p.handle.dispose();
  vm.dispose();runtime.dispose();
}
