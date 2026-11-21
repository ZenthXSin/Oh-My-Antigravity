import fs from 'node:fs';
import path from 'node:path';
export function addLocalSession(source,root) {
  const edits=[
    ['search:L=>rhb(K,L.project)', 'search:L=>({...rhb(K,L.project),login:!0})'],
    ['t=p&&m==="uninitialized"','t=p&&m==="uninitialized"&&!window.__agyAccountOptional'],
    ['m=p&&n&&(m==="signedOut"||m==="loginError"||m==="projectPicker"||m==="licensePicker")',
     'm=p&&n&&(!window.__agyAccountOptional||h)&&(m==="signedOut"||m==="loginError"||m==="projectPicker"||m==="licensePicker")'],
    ['hasOnboardingScreens:f}),[c.agentOnboardingState,f]','hasOnboardingScreens:f&&!window.__agyAccountOptional}),[c.agentOnboardingState,f]'],
    ['if(b)return{reason:b};if(!c||!d)return{}',
     'if(b)return{reason:b};if(window.__agyAccountOptional){if(!window.__agyChannelsReady)return{reason:window.__agyUiLanguage==="en"?"Add an API channel in Settings to use the Agent.":"请在设置中添加 API 渠道后使用 Agent。"};return}if(!c||!d)return{}'],
    ['ia=t?void 0:D.createElement(a3c,{cascadeId:d});return Zc?',
     'ia=t?void 0:D.createElement(D.Fragment,null,D.createElement(__agyLocalSessionNotice,null),D.createElement(a3c,{cascadeId:d}));return Zc?']
  ];
  for(const [before,after] of edits){if(source.split(before).length!==2)throw new Error('Native local-session anchor changed: '+before);source=source.replace(before,after);}
  const end=source.indexOf(';')+1;
  return source.slice(0,end)+'\n'+fs.readFileSync(path.join(root,'frontend/local-session.js'),'utf8')+'\n'+source.slice(end);
}
