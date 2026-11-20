import readline from 'node:readline';
import {callTool} from './store.mjs';
const str=description=>({type:'string',description});
const scope={conversation_id:str('当前原生会话 ID，由 PreInvocation 提示提供；禁止使用其他会话的 ID。')};
const schema=(props,required=[])=>({type:'object',properties:{...scope,...props},required:['conversation_id',...required],additionalProperties:false});
const evidence={type:'array',items:{type:'string'},maxItems:20};
export const toolList=[
  {name:'create_goal',description:'仅在用户明确要求 /goal、持久目标或目标模式时创建。保存目标和验收条件；不修改模型或权限。不支持精确 token 预算。',inputSchema:schema({objective:str('完整目标'),acceptance:evidence,max_continuations:{type:'integer',minimum:1,maximum:100,description:'自动续跑次数上限，默认 12；上限不代表任务完成。'}},['objective','acceptance'])},
  {name:'get_goal',description:'读取当前会话持久目标、检查点、验收依据和续跑次数。',inputSchema:schema({}),annotations:{readOnlyHint:true}},
  {name:'checkpoint_goal',description:'保存已做工作与下一步；使用原生计划管理步骤。等待用户时 auto_continue=false。相同真正阻碍跨三个不同轮次才标记 blocked。',inputSchema:schema({summary:str('简短进度'),next_action:str('下一步'),blocker:str('无法独立推进的具体阻碍；无阻碍时省略'),evidence,auto_continue:{type:'boolean'}},['summary','next_action'])},
  {name:'update_goal',description:'完成须逐项提供实际验收依据。blocked 必须经过三轮同一阻碍。paused 仅用户要求时使用。',inputSchema:schema({status:{type:'string',enum:['complete','blocked','paused']},evidence},['status'])},
  {name:'control_goal',description:'仅当前用户明确要求时暂停、恢复或取消目标；恢复重新开始续跑计数和阻碍审计。',inputSchema:schema({action:{type:'string',enum:['pause','resume','cancel']}},['action'])},
  {name:'get_execution_status',description:'读取原生工具执行记录与已知命令句柄。结果不替代原生 command_status 的进程状态和输出。',inputSchema:schema({}),annotations:{readOnlyHint:true}}
];
function reply(id,result,error){process.stdout.write(JSON.stringify(error?{jsonrpc:'2.0',id,error}:{jsonrpc:'2.0',id,result})+'\n');}
const rl=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
rl.on('line',line=>{
  let m;try{m=JSON.parse(line);}catch{return;}
  if(m.id===undefined)return;
  try{
    if(m.method==='initialize')return reply(m.id,{protocolVersion:m.params?.protocolVersion||'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'agent-workflow-zh',version:'1.2.0'}});
    if(m.method==='ping')return reply(m.id,{});
    if(m.method==='tools/list')return reply(m.id,{tools:toolList});
    if(m.method==='tools/call'){
      try{const result=callTool(m.params?.name,m.params?.arguments);return reply(m.id,{content:[{type:'text',text:JSON.stringify(result)}]});}
      catch(e){return reply(m.id,{isError:true,content:[{type:'text',text:e.message}]});}
    }
    reply(m.id,null,{code:-32601,message:'Method not found'});
  }catch{reply(m.id,null,{code:-32603,message:'Workflow internal error'});}
});
