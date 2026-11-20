function __agyLocalSessionNotice() {
  if(!window.__agyAccountOptional||window.__agyChannelsReady)return null;
  const english=window.__agyUiLanguage==='en';
  return D.createElement('div',{className:'agy-local-session',role:'status'},
    D.createElement('span',null,english?'Local workspace · Add a channel to use the Agent':'本地工作区 · 使用 Agent 时添加渠道'),
    D.createElement('button',{type:'button',onClick:()=>document.querySelector('[data-testid="settings-button"]')?.click()},english?'Settings':'打开设置'));
}
