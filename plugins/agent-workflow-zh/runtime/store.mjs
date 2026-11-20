import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';

export const dataRoot=process.env.AGY_WORKFLOW_DATA||path.join(os.homedir(),'.gemini','antigravity','agent-workflow-zh');
export function validId(id){if(typeof id!=='string'||! /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id))throw Error('Invalid conversation_id');return id;}
const fileFor=id=>path.join(dataRoot,validId(id)+'.json');
const sleep=ms=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);

export function readState(id){
  const file=fileFor(id);
  if(!fs.existsSync(file))return {schema:1,conversationId:id,goal:null,events:[],context:null};
  const result=JSON.parse(fs.readFileSync(file,'utf8'));
  if(result.schema!==1||result.conversationId!==id)throw Error('Invalid saved workflow state');
  return result;
}
export function transaction(id,update){
  fs.mkdirSync(dataRoot,{recursive:true});
  const file=fileFor(id),lock=file+'.lock',until=Date.now()+2500;
  let handle;
  while(handle===undefined){
    try{handle=fs.openSync(lock,'wx',0o600);}
    catch(e){if(e.code!=='EEXIST'||Date.now()>until)throw Error('Workflow state busy; retry later');sleep(15);}
  }
  let temp;
  try{
    const state=readState(id),result=update(state);
    state.updatedAt=new Date().toISOString();
    temp=file+'.'+randomUUID()+'.tmp';
    fs.writeFileSync(temp,JSON.stringify(state),{mode:0o600});
    try{fs.renameSync(temp,file);}
    catch(e){
      if(process.platform!=='win32'||e.code!=='EXDEV')throw e;
      fs.copyFileSync(temp,file);
      if(!fs.readFileSync(temp).equals(fs.readFileSync(file)))throw Error('State copy verification failed');
    }
    return result;
  }finally{if(temp&&fs.existsSync(temp))fs.unlinkSync(temp);fs.closeSync(handle);fs.unlinkSync(lock);}
}

const text=(v,key,max=4000)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('Invalid '+key);return v.trim();};
function context(s){if(!s.context)throw Error('No native conversation context; invoke this tool from Antigravity');return s.context;}
export function userIntent(input=''){
  const patterns={
    create:/(?:^|\s)\/goal\b(?!\s+(?:status|pause|resume|cancel)\b)|(?:创建|设定|设置|启动|开始|建立).{0,12}(?:goal|持久目标|持续目标|目标模式)|(?:goal|目标模式).{0,8}(?:创建|启动|开始)/i,
    pause:/(?:\/goal\s+pause\b)|(?:暂停|停止|取消).{0,12}(?:goal|目标)|(?:goal|目标).{0,8}(?:暂停|停止|取消)/i,
    resume:/(?:\/goal\s+resume\b)|(?:继续|恢复|重启).{0,12}(?:goal|目标)|(?:goal|目标).{0,8}(?:继续|恢复|重启)/i,
    cancel:/(?:\/goal\s+cancel\b)|(?:取消|删除|清除).{0,12}(?:goal|目标)|(?:goal|目标).{0,8}(?:取消|删除|清除)/i
  };
  return {create:patterns.create.test(input),pause:patterns.pause.test(input),resume:patterns.resume.test(input),cancel:patterns.cancel.test(input),status:/\/goal\s+status\b|(?:goal|目标).{0,8}(?:状态|进度|怎么样)|(?:查看|查询).{0,8}(?:goal|目标)/i.test(input),mentionsGoal:/\/goal\b|目标模式|持久目标/.test(input)};
}
function authorized(s,action){
  if(context(s).userIntent?.[action]!==true)throw Error('This operation requires an explicit current user goal instruction');
}
export function publicGoal(g){return g?{...g,tokenUsage:null,tokenBudgetSupported:false}:null;}
export function callTool(name,a={}){
  const fields={create_goal:['objective','acceptance','max_continuations'],get_goal:[],get_execution_status:[],control_goal:['action'],checkpoint_goal:['summary','next_action','blocker','evidence','auto_continue'],update_goal:['status','evidence']};
  if(!fields[name])throw Error('Unknown tool');
  if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).some(k=>k!=='conversation_id'&&!fields[name].includes(k)))throw Error('Invalid or unsupported tool arguments');
  if(a.auto_continue!==undefined&&typeof a.auto_continue!=='boolean')throw Error('auto_continue must be boolean');
  const id=validId(a.conversation_id);
  if(name==='get_goal')return publicGoal(readState(id).goal);
  if(name==='get_execution_status'){
    const s=readState(id);return {events:s.events,notice:'原生执行元数据；不包含完整输出。继续通过原生 command_status 读取真实进程状态。'};
  }
  return transaction(id,s=>{
    const c=context(s);
    if(name==='create_goal'){
      authorized(s,'create');
      if(s.goal&&!['complete','cancelled'].includes(s.goal.status))throw Error('An unfinished goal exists; resume or explicitly cancel it first');
      if(!Array.isArray(a.acceptance)||!a.acceptance.length||a.acceptance.length>20)throw Error('At least one acceptance criterion is required');
      const limit=a.max_continuations??12;
      if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('max_continuations must be 1..100');
      s.goal={id:randomUUID(),objective:text(a.objective,'objective'),acceptance:a.acceptance.map(x=>text(x,'acceptance',1000)),status:'active',createdAt:new Date().toISOString(),maxContinuations:limit,continuations:0,checkpoint:null,blocker:null,blockerCount:0,lastBlockerRound:null,lastContextKey:null,evidence:[],nextAction:'读取现状并执行',autoContinue:true};
      return publicGoal(s.goal);
    }
    const g=s.goal;if(!g)throw Error('No goal exists');
    if(name==='control_goal'){
      if(!['pause','resume','cancel'].includes(a.action))throw Error('Unknown control action');
      authorized(s,a.action);
      if(a.action==='resume'){
        if(['complete','cancelled'].includes(g.status))throw Error('Create a new goal for terminal work');
        Object.assign(g,{status:'active',continuations:0,blocker:null,blockerCount:0,lastBlockerRound:null,autoContinue:true});
      }else{g.status=a.action==='pause'?'paused':'cancelled';g.autoContinue=false;}
      return publicGoal(g);
    }
    if(name==='checkpoint_goal'){
      if(g.status!=='active')throw Error('The goal is not active');
      const summary=text(a.summary,'summary',2000),next=text(a.next_action,'next_action',2000);
      g.checkpoint=summary;g.nextAction=next;g.autoContinue=a.auto_continue!==false;
      if(a.blocker){
        const reason=text(a.blocker,'blocker',1500),round=c.roundKey+':'+g.continuations;
        if(g.blocker!==reason){g.blocker=reason;g.blockerCount=0;g.lastBlockerRound=null;}
        if(g.lastBlockerRound!==round){g.blockerCount++;g.lastBlockerRound=round;}
      }else{g.blocker=null;g.blockerCount=0;g.lastBlockerRound=null;}
      if(a.evidence!==undefined){if(!Array.isArray(a.evidence)||a.evidence.length>20)throw Error('Invalid evidence');g.evidence=a.evidence.map(x=>text(x,'evidence',1500));}
      return publicGoal(g);
    }
    if(name==='update_goal'){
      if(a.status==='paused'){authorized(s,'pause');g.status='paused';g.autoContinue=false;}
      else if(a.status==='blocked'){
        if(!g.blocker||g.blockerCount<3)throw Error('The same blocker must recur across at least three distinct goal rounds');
        g.status='blocked';g.autoContinue=false;
      }else if(a.status==='complete'){
        if(g.status!=='active')throw Error('The goal must be active');
        if(!Array.isArray(a.evidence)||a.evidence.length!==g.acceptance.length)throw Error('Provide one evidence item for each acceptance criterion');
        g.evidence=a.evidence.map(x=>text(x,'evidence',1500));g.status='complete';g.autoContinue=false;
        g.completedAt=new Date().toISOString();
      }else throw Error('Unknown goal status');
      return publicGoal(g);
    }
    throw Error('Unknown tool');
  });
}
