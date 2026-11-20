import fs from 'node:fs';
import path from 'node:path';
import {parse} from 'acorn';
import * as walk from 'acorn-walk';
import {addLanguageSetting} from './locale/language-support.mjs';
import {projectDisplayPairs} from './locale/project-display.mjs';
import {addEffortSlider} from './locale/effort-support.mjs';
import {addChannelSettings} from './locale/channel-support.mjs';
import {addLocalSession} from './locale/local-session-support.mjs';

const root=path.resolve(import.meta.dirname,'..');
const original=fs.readFileSync(path.join(root,'original-web/main.js'),'utf8');
const dictionary=Object.fromEntries(fs.readFileSync(path.join(root,'locales/zh-CN.tsv'),'utf8').split(/\r?\n/).filter(l=>l.includes('\t')).map(l=>{const i=l.indexOf('\t');return [l.slice(0,i),l.slice(i+1)];}));
Object.assign(dictionary,Object.fromEntries(fs.readFileSync(path.join(root,'locales/zh-CN-extra.tsv'),'utf8').split(/\r?\n/).filter(l=>l.includes('\t')).map(l=>{const i=l.indexOf('\t');return [l.slice(0,i),l.slice(i+1)];})));
Object.assign(dictionary,Object.fromEntries(fs.readFileSync(path.join(root,'locales/zh-CN-audit.tsv'),'utf8').split(/\r?\n/).filter(l=>l.includes('\t')).map(l=>{const i=l.indexOf('\t');return [l.slice(0,i),l.slice(i+1)];})));
const candidates=JSON.parse(fs.readFileSync(path.join(root,'inspection/ui-candidates.json'),'utf8'));
const patches=[];
for(const entry of candidates) {
  if(!Object.hasOwn(dictionary,entry.text) || dictionary[entry.text]===entry.text)continue;
  for(const location of entry.locations)patches.push({start:location.start,end:location.end,text:JSON.stringify(dictionary[entry.text]),original:entry.text});
}
const tree=parse(original,{ecmaVersion:'latest'});
// Audited display-only label functions and the standalone-project label.
walk.ancestor(tree,{Literal(node,ancestors){
  if(typeof node.value!=='string'||!Object.hasOwn(dictionary,node.value))return;
  const f=ancestors.findLast(a=>['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(a.type));
  const owner=f&&ancestors[ancestors.indexOf(f)-1];
  const name=f?.id?.name??(owner?.type==='VariableDeclarator'?owner.id.name:undefined);
  if(['xTb','yTb','g3c','Kza','fCd'].includes(name))patches.push({start:node.start,end:node.end,text:JSON.stringify(dictionary[node.value]),original:node.value});
}});
const templates={
  'Hey ':'你好，', ', what should we build today?':'，今天想做什么？',
  'Welcome back, ':'欢迎回来，', '. Where should we pick up?':'。我们从哪里继续？',
  'Good to see you, ':'你好，', ". What's next?":'。接下来做什么？',
  'Select project, current: ':'选择项目，当前：',
  'Select model, current: ':'选择模型，当前：',
  'Agent permissions preset selector, current: ':'Agent 权限预设，当前：',
  'Agent permissions preset: ':'Agent 权限预设：',
};
walk.simple(tree,{TemplateElement(node){
  const text=node.value.cooked;
  if(Object.hasOwn(templates,text))patches.push({start:node.start,end:node.end,text:templates[text],original:text});
}});
patches.sort((a,b)=>a.start-b.start);
for(let i=1;i<patches.length;i++)if(patches[i].start<patches[i-1].end)throw new Error('Overlapping translations');
let cursor=0;const parts=[];
for(const patch of patches){parts.push(original.slice(cursor,patch.start),patch.text);cursor=patch.end;}
parts.push(original.slice(cursor));let compiled=parts.join('');
// 设置页面的内部 screen 标识不能翻译，只在两个原生导航渲染点转换文案。
const labels={General:'通用',App:'应用',Application:'应用',Appearance:'外观',Shortcuts:'快捷键',Notifications:'通知',Models:'模型',Browser:'浏览器',Account:'账号',Customizations:'自定义',Conversations:'会话','Provide Feedback':'反馈','Not in Project':'不属于项目',Projects:'项目'};
const labelHelper=`function __agyZhSettings(v){const d=${JSON.stringify(labels)};return Object.prototype.hasOwnProperty.call(d,v)?d[v]:v;}\n`;
const textHelper=`function __agyZhText(v){const d=${JSON.stringify(dictionary)};return typeof v==='string'&&Object.prototype.hasOwnProperty.call(d,v)?d[v]:v;}\n`;
const statusHelper=fs.readFileSync(path.join(root,'frontend/status-text.js'),'utf8');
const screenLabel='function $S(a){return MIb.get(a)??a}';
if(!compiled.includes(screenLabel))throw new Error('Screen display label function changed');
compiled=compiled.replace(screenLabel,'function $S(a){return __agyZhText(MIb.get(a)??a)}');
// bT is the native settings-row renderer. API-supplied labels are converted
// only at its two display points, retaining IDs, values and callbacks.
const rowStart=compiled.indexOf('var bT=({label:a,description:b,');
const rowEnd=compiled.indexOf(';var cT=',rowStart);
if(rowStart<0||rowEnd<0)throw new Error('Settings row renderer changed');
let row=compiled.slice(rowStart,rowEnd);
for(const [before,after] of [['id:k},a)','id:k},__agyZhText(a))'],['id:l},b)','id:l},__agyZhText(b))']]){
  if(!row.includes(before))throw new Error('Settings row text structure changed');
  row=row.replace(before,after);
}
compiled=compiled.slice(0,rowStart)+row+compiled.slice(rowEnd);
const auditedDisplayPairs=[
  ...projectDisplayPairs,
  ['unnamed:"Hey there, what should we build today?"','unnamed:"你好，今天想做什么？"'],
  ['unnamed:"Welcome back. Where should we pick up?"','unnamed:"欢迎回来，我们从哪里继续？"'],
  ['unnamed:"Good to see you. What\'s next?"','unnamed:"你好，接下来做什么？"'],
  ['var G=f?.label??"No Model Selected",H=""','var G=f?.label??"未选择模型",H=""'],
  ['var k=g||h||"Account";return','var k=g||h||"账号";return'],
  ['nextLabel:C===10?xc?"Continue":"Skip":void 0','nextLabel:C===10?xc?"继续":"跳过":void 0'],
  ['label:t.name,description:t.description,selection:{kind:"persona",id:t.id}',
   'label:__agyZhText(t.name),description:__agyZhText(t.description),selection:{kind:"persona",id:t.id}'],
  ['description:b.description,selection:{kind:"custom"}','description:__agyZhText(b.description),selection:{kind:"custom"}'],
  ['a?`Select ${a} Theme`:"选择主题"', 'a?`选择 ${a} 主题`:"选择主题"'],
  ['label:b="Advanced Settings",expanded:c','label:b="高级设置",expanded:c'],
  ['d=b?"Side Panel":"Built-in Browser",f=b?"New Tab":"External Browser"','d=b?"侧面板":"内置浏览器",f=b?"新标签页":"外部浏览器"'],
  ['var d2=a=>knc()?D.createElement(jnc,{...a}):D.createElement(D.Fragment,null,a.text)',
   'var d2=a=>knc()?D.createElement(jnc,{...a,text:__agyZhText(a.text)}):D.createElement(D.Fragment,null,__agyZhText(a.text))'],
  ['D.createElement(MMc,{label:p,lastStepIndex:m','D.createElement(MMc,{label:__agyZhText(p),lastStepIndex:m'],
  ['"aria-label":p,dataTestId:"tool-group-collapsible"','"aria-label":__agyZhText(p),dataTestId:"tool-group-collapsible"'],
  ['Q=P?"Start Live Chat":"Start Voice mode";P=P?"End Live chat":"End Voice mode"','Q=P?"开始实时语音":"开始语音模式";P=P?"结束实时语音":"结束语音模式"'],
  ['f?a="Undo to this point":d?a="Cannot revert to a message that was cleared to save space"',
   'f?a="撤销到此处":d?a="无法还原因节省空间而清除的消息"'],
  ['"确定要删除此",h.lowercase','"确定要删除此",__agyZhText(h.lowercase)'],
  ['"aria-label":l??(typeof c==="string"?qXb[c]:void 0)','"aria-label":__agyZhText(l??(typeof c==="string"?qXb[c]:void 0))'],
  ['b&&D.createElement("div",{className:"text-muted-foreground bg-transparent"},b)','b&&D.createElement("div",{className:"text-muted-foreground bg-transparent"},__agyZhText(b))'],
  ['D.createElement(WX,{active:!(n&&k),className:"truncate"},m)','D.createElement(WX,{active:!(n&&k),className:"truncate"},__agyZhStatus(m))'],
  ['statusText:u?"Waiting for subagent":m','statusText:u?"等待子 Agent":__agyZhStatus(m)'],
  ['`Worked for ${Ct(a.durationMs)}`','`执行耗时 ${Ct(a.durationMs)}`'],
  ['`Load older messages, showing ${b} of ${c}`:`No more older messages, showing ${b} of ${c}`',
   '`加载更早的消息，已显示 ${b}／${c}`:`没有更早的消息，已显示 ${b}／${c}`'],
  ['Qa=I?"Workspaces":\n"Projects"','Qa=I?"工作区":\n"项目"'],
  [':"No conversations yet")&&u.push',':"暂无会话")&&u.push'],
  ['Ia=h==="none"||h==="status"||h==="location"?"Conversations":Qa','Ia=h==="none"||h==="status"||h==="location"?"会话":Qa'],
  ['d?"text-foreground":"text-secondary-foreground group-hover/nav-item:text-foreground")},b??a)','d?"text-foreground":"text-secondary-foreground group-hover/nav-item:text-foreground")},__agyZhText(b??a))'],
  ['D.createElement("span",{className:"font-medium text-foreground leading-normal"},p.label)','D.createElement("span",{className:"font-medium text-foreground leading-normal"},__agyZhText(p.label))'],
  ['id:q,className:"text-sm text-muted-foreground mt-0.5 leading-snug"},p.description)','id:q,className:"text-sm text-muted-foreground mt-0.5 leading-snug"},__agyZhText(p.description))'],
  ['D.createElement("span",{className:"truncate",id:t},a)','D.createElement("span",{className:"truncate",id:t},__agyZhText(a))'],
  ['y&&z?`${x} (disabled by admin)`:x,z&&D.createElement(Oz','y&&z?`${__agyZhText(x)}（管理员已禁用）`:__agyZhText(x),z&&D.createElement(Oz'],
  ['type:"section-header",id:"section-standalone",title:"Conversations"','type:"section-header",id:"section-standalone",title:"会话"'],
  // Permission labels, badges and hints are display text; preset values stay native.
  ['function Q7a(a){if(a.length!==0)return`${a.map(b=>RC[b].label).join(" and ")} ${a.length>1?"need":"needs"} the terminal sandbox, which isn\'t available on this host.`}',
   'function Q7a(a){if(a.length!==0)return`${a.map(b=>RC[b].label).join("和")}模式需要终端沙箱，但本机暂不支持。`}'],
  ['D.createElement(FW,{className:"!p-0 !pb-0 truncate"},H)',
   'D.createElement(FW,{className:"!p-0 !pb-0 truncate"},__agyZhText(H))'],
  ['G=l?"Only this conversation uses this preset.":`This ${y.lowercase} overrides your global permission settings.`',
   'G=l?"仅当前会话使用此预设。":`此${__agyZhText(y.capitalized)}使用独立权限设置，覆盖全局设置。`'],
  ['var H=l?"This Conversation":`${y.capitalized} Settings`',
   'var H=l?"当前会话":`${__agyZhText(y.capitalized)}设置`'],
  ['D.createElement(a3,{option:{tagTitle:"默认",tagDescription:m==="project"?\n`${n||y.capitalized} setting`:m==="cloud"?"你的远程权限设置":"你的本机权限设置"}})',
   'D.createElement(a3,{option:{tagTitle:"默认",tagDescription:m==="project"?\n`${__agyZhText(n||y.capitalized)}设置`:m==="cloud"?"你的远程权限设置":"你的本机权限设置"}})'],
];
for(const [before,after] of auditedDisplayPairs){
  if(!compiled.includes(before))throw new Error('Audited display expression changed: '+before);
  compiled=compiled.replace(before,after);
}
const nav='},b??a),D.createElement(Nq,{name:"chevron_right",size:20';
if(!compiled.includes(nav))throw new Error('Settings navigation structure changed');
compiled=compiled.replace(nav,'},__agyZhText(b??a)),D.createElement(Nq,{name:"chevron_right",size:20');
const heading='function kUb({text:a}){return D.createElement("div",{className:"px-4 pt-3 pb-1"},D.createElement("h2",{className:"m-0 text-sm font-medium text-muted-foreground select-none"},a))}';
if(!compiled.includes(heading))throw new Error('Settings heading structure changed');
compiled=compiled.replace(heading,heading.replace('},a))}','},__agyZhText(a)))}'));
const sectionTitle='D.createElement("h3",{className:"m-0 font-medium"},a)';
if(!compiled.includes(sectionTitle))throw new Error('Settings section title changed');
compiled=compiled.replace(sectionTitle,'D.createElement("h3",{className:"m-0 font-medium"},__agyZhText(a))');
const projectLabel='case "standalone":return"No Project";case "project":';
if(!compiled.includes(projectLabel))throw new Error('Project label structure changed');
compiled=compiled.replace(projectLabel,'case "standalone":return"无项目";case "project":');
const directiveEnd = tree.body.findLast(n=>n.directive)?.end ?? 0;
// Keep every original directive (notably use strict) at the start of the script.
compiled=compiled.slice(0,directiveEnd)+'\n'+labelHelper+textHelper+statusHelper+compiled.slice(directiveEnd);
parse(compiled,{ecmaVersion:'latest'});
compiled=addLanguageSetting(compiled,root);
compiled=addEffortSlider(compiled,root);
compiled=addChannelSettings(compiled,root);
compiled=addLocalSession(compiled,root);
const english=addLocalSession(addChannelSettings(addEffortSlider(addLanguageSetting(original,root),root),root),root);
parse(compiled,{ecmaVersion:'latest'});
parse(english,{ecmaVersion:'latest'});
const web=path.join(root,'web');fs.mkdirSync(web,{recursive:true});
fs.cpSync(path.join(root,'original-web'),web,{recursive:true});
fs.writeFileSync(path.join(web,'main.js'),compiled);
fs.writeFileSync(path.join(web,'main.en.js'),english);
fs.copyFileSync(path.join(root,'frontend/locale-loader.js'),path.join(web,'locale-loader.js'));
fs.copyFileSync(path.join(root,'frontend/effort-slider.css'),path.join(web,'effort-slider.css'));
fs.copyFileSync(path.join(root,'frontend/channel-settings.css'),path.join(web,'channel-settings.css'));
let html=fs.readFileSync(path.join(web,'index.html'),'utf8');
html=html.replace('lang="en"','lang="zh-CN"');
html=html.replace('<script src="/main.js"></script>','<script src="/locale-loader.js"></script>');
// 中国语系字体只补充回退，不替换原生字号、颜色或布局。
html=html.replace('</head>','<style>body{font-family:Inter,"Segoe UI","Microsoft YaHei UI","Microsoft YaHei",sans-serif}</style>\n</head>');
html=html.replace('</head>','<link rel="stylesheet" href="/effort-slider.css">\n</head>');
html=html.replace('</head>','<link rel="stylesheet" href="/channel-settings.css">\n</head>');
fs.writeFileSync(path.join(web,'index.html'),html);
fs.writeFileSync(path.join(root,'inspection/locale-build.json'),JSON.stringify({version:'2.33.0',dictionaryEntries:Object.keys(dictionary).length,translatedOccurrences:patches.length,translatedStrings:new Set(patches.map(p=>p.original)).size},null,2));
fs.writeFileSync(path.join(root,'inspection/locale-patches.json'),JSON.stringify(patches,null,2));
console.log(fs.readFileSync(path.join(root,'inspection/locale-build.json'),'utf8'));
