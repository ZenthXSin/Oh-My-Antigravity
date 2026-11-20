function __agyChannelConnection({mode,busy,pending,onChange}) {
  const h=D.createElement,t=__agyChannelsText;
  const choices=[['local',t('Local workspace','本地工作区')],['channels',t('API channels','API 聚合')],['official',t('Official service','官方服务')]];
  const descriptions={local:t('Open the workspace without an account.','无需账号，直接打开工作区。'),channels:pending?t('Save your first channel to enable API aggregation.','保存首个渠道后，自动启用 API 聚合。'):t('The main Agent uses your configured API channels.','主 Agent 使用你配置的 API 渠道。'),official:t('Use the official models and account sign-in.','使用官方模型与账号登录。')};
  return h('div',{className:'agy-channel-connection'},
    h('div',{className:'agy-channel-label',id:'agy-connection-label'},t('Connection mode','接入方式')),
    h('div',{role:'radiogroup','aria-labelledby':'agy-connection-label','data-testid':'connection-mode',className:'agy-channel-modes'},choices.map(([value,label],index)=>h('button',{
      key:value,type:'button',role:'radio','aria-checked':mode===value,tabIndex:mode===value?0:-1,disabled:busy,'data-mode':value,
      onClick:()=>onChange(value),onKeyDown:event=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
        event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?choices.length-1:(index+(event.key==='ArrowRight'?1:choices.length-1))%choices.length;
        event.currentTarget.parentElement.children[next].focus();onChange(choices[next][0]);
      }
    },label))),
    h('p',{className:'agy-channel-muted'},descriptions[mode]));
}
