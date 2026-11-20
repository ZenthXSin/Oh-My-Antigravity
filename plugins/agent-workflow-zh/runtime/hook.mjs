import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {transaction,validId,userIntent} from './store.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const load=name=>fs.readFileSync(path.join(root,'..','prompts',name),'utf8');
export function goalSnapshot(g){
  return {objective:g.objective,acceptance:g.acceptance,status:g.status,checkpoint:g.checkpoint,
    next_action:g.status==='complete'?'目标已完成':g.nextAction,evidence:g.evidence,
    blocker:g.blocker,blocker_rounds:g.blockerCount,continuations:g.continuations,
    max_continuations:g.maxContinuations,auto_continue:g.autoContinue,token_budget_supported:false};
}
export function handleHook(p){
  const id=validId(p.conversationId);
  return transaction(id,s=>{
    if(p.hookEventName==='PostToolUse'){
      const args=p.toolCall?.args||{},name=String(p.toolCall?.name||'unknown').slice(0,100);
      // Raw commands, tool results, prompts, environment variables and tokens
      // stay in the native trajectory, never duplicated into this ledger.
      const e={tool:name,stepIdx:p.stepIdx,failed:!!p.error,at:new Date().toISOString()};
      const commandId=args.CommandId??args.commandId??args.command_id;
      if(typeof commandId==='string'&&commandId.length<150)e.commandId=commandId;
      s.events.push(e);s.events=s.events.slice(-30);return {};
    }
    if(p.hookEventName==='PreInvocation'){
      const inputHash=createHash('sha256').update(String(p.lastUserInput||'')).digest('hex');
      const prior=s.context;
      // initialNumSteps grows after each tool. A round follows the native
      // invocation sequence, rather than treating every tool as a new turn.
      const fresh=!prior||prior.roundEnded||prior.inputHash!==inputHash||
        (Number.isInteger(p.invocationNum)&&p.invocationNum<prior.invocationNum)||
        (p.invocationNum===1&&prior.invocationNum===1&&p.initialNumSteps!==prior.initialNumSteps);
      const roundSerial=(prior?.roundSerial||0)+(fresh?1:0);
      const key=String(roundSerial)+':'+inputHash;
      s.context={roundKey:key,roundSerial,inputHash,userIntent:userIntent(p.lastUserInput),invocationNum:p.invocationNum,initialNumSteps:p.initialNumSteps,roundEnded:false};
      const parts=[];
      const g=s.goal;
      if(g&&s.context.userIntent.cancel){g.status='cancelled';g.autoContinue=false;}
      else if(g&&s.context.userIntent.pause&&g.status==='active'){g.status='paused';g.autoContinue=false;}
      const relevant=g&&(!['complete','cancelled'].includes(g.status)||s.context.userIntent.mentionsGoal);
      if(relevant&&(fresh||g.lastContextKey!==key)){
        // The objective is data quoted by JSON, not a new system instruction.
        parts.push(load('goal-context.md')+'\n当前 conversation_id：'+id+'\n保存的目标数据：'+JSON.stringify(goalSnapshot(g)));
        g.lastContextKey=key;
      }else if(!g&&fresh&&s.context.userIntent.mentionsGoal)parts.push('Goal 工具当前 conversation_id：'+id+'。加载 goal 技能；先遵循用户当前目标指令。');
      const latest=s.events.at(-1);
      if(latest?.failed&&s.lastFailureStep!==latest.stepIdx){
        const failure={tool:latest.tool,stepIdx:latest.stepIdx,failed:latest.failed,...(latest.commandId?{commandId:latest.commandId}:{})};
        parts.push('上次原生工具执行失败：'+JSON.stringify(failure)+'。先查看原生结果，诊断实际原因，不重复提交相同命令；等待超时不代表进程已退出。');
        s.lastFailureStep=latest.stepIdx;
      }
      return parts.length?{injectSteps:[{systemMessage:{systemMessage:parts.join('\n\n')}}]}:{};
    }
    if(p.hookEventName!=='Stop')return {};
    if(s.context)s.context.roundEnded=true;
    const g=s.goal;
    if(!g||g.status!=='active')return {};
    if(p.terminationReason==='USER_CANCELED'){
      g.status='paused';g.autoContinue=false;g.pauseReason='用户通过原生停止操作取消运行';return {};
    }
    // Native errors, token limits and terminal steps are authoritative.
    if(p.terminationReason?.startsWith('MAX_')){g.status='native_limited';g.autoContinue=false;return {};}
    if(p.terminationReason==='ERROR'||p.error){g.status='execution_error';g.autoContinue=false;return {};}
    if(p.terminationReason!=='NO_TOOL_CALL')return {};
    if(s.context?.userIntent?.status)return {};
    if(g.autoContinue===false)return {};
    if(g.blockerCount>=3){g.status='blocked';g.autoContinue=false;return {};}
    if(g.continuations>=g.maxContinuations){g.status='continuation_limited';g.autoContinue=false;return {};}
    // continuationActive is permitted only for this goal's own recorded chain.
    if(p.continuationActive&&g.continuations===0)return {};
    g.continuations++;
    return {decision:'continue',reason:load('continuation.md')+'\n当前 conversation_id：'+id};
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  try{const p=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(handleHook(p)));}
  catch{process.stdout.write('{}');process.stderr.write('Agent workflow hook unavailable; native execution preserved\n');}
}
