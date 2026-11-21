import fs from 'node:fs';
import path from 'node:path';
export function addChannelSettings(source,root) {
  const edits=[
    ['let T=R.features.customModelsFeature?.customModelsProvider;T&&z.dispatch(bHa(T));',
     'let T=R.features.customModelsFeature?.customModelsProvider;let omaCatalog;if(window.ohMyChannels){omaCatalog=await window.ohMyChannels.request({action:"catalog"});window.__agyAccountOptional=["local","channels"].includes(omaCatalog.connectionMode);window.__agyChannelsReady=omaCatalog.ready;window.__agyChannelModelStorage=R.features.storageService;if(omaCatalog.enabled)T=__agyChannelModelsProvider(omaCatalog);}T&&z.dispatch(bHa(T));if(omaCatalog)__agyRestoreChannelModel(omaCatalog,z);'],
    ['a&&d.payload.fallbackConversationId===void 0&&a.setLastSelectedAgentModel(d.payload.model)',
     'a&&d.payload.fallbackConversationId===void 0&&(a.setLastSelectedAgentModel(d.payload.model),__agyRememberChannelModel(d.payload.customLabel))'],
    ['showCustomModelHeader:T,onAddCustomModel:P','showCustomModelHeader:T||m.length>0,onAddCustomModel:P'],
    ['if(k)return D.createElement(g0c,{refreshModels:b});var q=a.some(t=>t.options.length>0);',
     'if(k&&!c.length)return D.createElement(g0c,{refreshModels:b});var q=a.some(t=>t.options.length>0)||c.length>0;'],
    ['var l=a.modelOptions,m=new Map','var l=[...a.modelOptions,...a.customModels??[]],m=new Map'],
    ['var o6=a=>{if(!a.isCustom){','var o6=a=>{if(a.isCustom)return window.__agyChannelEfforts?.get(a.label);if(!a.isCustom){'],
    ['D.createElement(aT,null,D.createElement(__agyLanguageRow,null))','D.createElement(aT,null,D.createElement(__agyLanguageRow,null),D.createElement(__agyChannelSettings,null))']
  ];
  for(const [before,after] of edits){if(source.split(before).length!==2)throw new Error('Native channel integration anchor changed: '+before);source=source.replace(before,after);}
  const menuStart=source.indexOf('var e0c=({customModels:a,onAddCustomModel:b,onEditCustomModel:c})=>');
  const menuEnd=source.indexOf(';var g0c=',menuStart);
  if(menuStart<0||menuEnd<0)throw new Error('Native custom model menu changed.');
  let menu=source.slice(menuStart,menuEnd);
  const items='a.map(h=>D.createElement(d0c,{key:h.label,model:h,onEdit:c}))';
  if(menu.split(items).length!==2)throw new Error('Native custom model rows changed.');
  menu=menu.replace(items,'D.createElement(__agyChannelModelItems,{models:a,onEdit:c})');
  const title=['Custom','自定义'].map(label=>'D.createElement("span",{className:"opacity-50"},'+JSON.stringify(label)+')').find(anchor=>menu.includes(anchor));
  if(!title)throw new Error('Native custom model title changed.');
  menu=menu.replace(title,'D.createElement("span",{className:"opacity-50"},__agyCustomModelsTitle(a))');
  menu=menu.replace('=>{var {supportsCustomModels:d}', '=>{if(a.some(model=>window.__agyChannelModels?.has(model.label))){b=void 0;c=void 0;}var {supportsCustomModels:d}');
  source=source.slice(0,menuStart)+menu+source.slice(menuEnd);
  const end=source.indexOf(';')+1;
  const ui=['channel-models.js','channel-settings.js','channel-connection.js','channel-editor.js'].map(file=>fs.readFileSync(path.join(root,'frontend',file),'utf8')).join('\n');
  return source.slice(0,end)+'\n'+ui+'\n'+source.slice(end);
}
