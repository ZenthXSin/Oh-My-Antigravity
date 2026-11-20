(() => {
  const language = localStorage.getItem('antigravity-custom.ui-language') === 'en' ? 'en' : 'zh-CN';
  window.__agyUiLanguage = language;
  document.documentElement.lang = language;
  const script = document.createElement('script');
  script.src = language === 'en' ? '/main.en.js' : '/main.js';
  script.async = false;
  document.body.appendChild(script);
})();
