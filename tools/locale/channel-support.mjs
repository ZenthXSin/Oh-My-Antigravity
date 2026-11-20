import fs from 'node:fs';
import path from 'node:path';
export function addChannelSettings(source,root) {
  const edits=[
    ['let T=R.features.customModelsFeature?.customModelsProvider;T&&z.dispatch(bHa(T));',
     'let T=R.features.customModelsFeature?.customModelsProvider;if(window.ohMyChannels){const catalog=await window.ohMyChannels.request({action:"catalog"});if(catalog.enabled)T=__agyChannelModelsProvider(catalog);}T&&z.dispatch(bHa(T));'],
    ['showCustomModelHeader:T,onAddCustomModel:P','showCustomModelHeader:T||m.length>0,onAddCustomModel:P'],
    ['if(k)return D.createElement(g0c,{refreshModels:b});var q=a.some(t=>t.options.length>0);',
     'if(k&&!c.length)return D.createElement(g0c,{refreshModels:b});var q=a.some(t=>t.options.length>0)||c.length>0;'],
    ['var l=a.modelOptions,m=new Map','var l=[...a.modelOptions,...a.customModels??[]],m=new Map'],
    ['var o6=a=>{if(!a.isCustom){','var o6=a=>{if(a.isCustom)return window.__agyChannelEfforts?.get(a.label);if(!a.isCustom){'],
    ['D.createElement(aT,null,D.createElement(__agyLanguageRow,null))','D.createElement(aT,null,D.createElement(__agyLanguageRow,null),D.createElement(__agyChannelSettings,null))']
  ];
  for(const [before,after] of edits){if(source.split(before).length!==2)throw new Error('Native channel integration anchor changed: '+before);source=source.replace(before,after);}
  const end=source.indexOf(';')+1;
  return source.slice(0,end)+'\n'+fs.readFileSync(path.join(root,'frontend/channel-settings.js'),'utf8')+'\n'+source.slice(end);
}
