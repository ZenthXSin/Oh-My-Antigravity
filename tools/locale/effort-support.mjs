import fs from 'node:fs';
import path from 'node:path';

export function addEffortSlider(source, root) {
  const resolver='const S_c=new Map,T_c=/^(.*?)\\s*\\((low|medium|high|xhigh|max)(?:\\s+thinking)?\\)\\s*$/i;';
  if (!source.includes(resolver)) throw new Error('Native effort resolver changed.');
  source=source.replace(resolver,resolver.replace('low|medium|high|xhigh|max','low|medium|high|xhigh|max|ultra'));
  source=source.replace('Q_c=["low","medium","high","xhigh","max"]','Q_c=["low","medium","high","xhigh","max","ultra"]');
  source=source.replace('R_c={low:"Low",medium:"Medium",high:"High",xhigh:"Extra",max:"Max"}',
    'R_c={low:"Low",medium:"Medium",high:"High",xhigh:"XHigh",max:"Max",ultra:"Ultra"}');
  source=source.replace('R_c={low:"低",medium:"中",high:"高",xhigh:"Extra",max:"Max"}',
    'R_c={low:"Low",medium:"Medium",high:"High",xhigh:"XHigh",max:"Max",ultra:"Ultra"}');
  const start=source.indexOf('var n0c=a=>');
  const end=source.indexOf(';var o0c=',start);
  if(start<0||end<0)throw new Error('Native model selector changed.');
  const before='D.createElement(b0c,{...a,setSelectedModel:g},D.createElement(wW,';
  let selector=source.slice(start,end);
  if(selector.split(before).length!==2||!selector.endsWith(')))}'))throw new Error('Native model selector layout changed.');
  selector=selector.replace(before,'D.createElement(b0c,{...a,setSelectedModel:g},D.createElement("div",{className:"flex items-center gap-1"},D.createElement(wW,');
  selector=selector.slice(0,-2)+',D.createElement(__agyEffortControl,null)))}';
  source=source.slice(0,start)+selector+source.slice(end);
  const directiveEnd=source.indexOf(';')+1;
  return source.slice(0,directiveEnd)+'\n'+fs.readFileSync(path.join(root,'frontend/effort-slider.js'),'utf8')+'\n'+source.slice(directiveEnd);
}
