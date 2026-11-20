function __agyLanguageText(english, chinese) {
  return window.__agyUiLanguage === 'en' ? english : chinese;
}

function __agyLocaleGate({storage, children}) {
  const saved = storage.get('antigravity-custom.ui-language', 'zh-CN');
  const language = saved === 'en' ? 'en' : 'zh-CN';
  D.useEffect(() => {
    if (language !== window.__agyUiLanguage) {
      localStorage.setItem('antigravity-custom.ui-language', language);
      location.reload();
    }
  }, [language]);
  return language === window.__agyUiLanguage ? children : null;
}

function __agyLanguageRow() {
  const storage = rd().core.storageService;
  const [error, setError] = D.useState('');
  const names = {'zh-CN': '简体中文', en: 'English'};
  const change = async language => {
    if (language === window.__agyUiLanguage) return;
    try {
      if (window.agPulseHost) {
        const preferences = await window.agPulseHost.setPreferences({language});
        if (preferences.error || preferences.language !== language) throw new Error(preferences.error || 'Dashboard language was not saved.');
      }
      storage.store('antigravity-custom.ui-language', language);
      await storage.flush();
      localStorage.setItem('antigravity-custom.ui-language', language);
      location.reload();
    } catch (failure) {
      setError(__agyLanguageText('Could not save language: ', '无法保存语言：') + failure.message);
    }
  };
  return D.createElement(D.Fragment, null,
    D.createElement(bU, {
      label: __agyLanguageText('Language', '语言'),
      description: __agyLanguageText(
        'Changing the language reloads the interface. Send or save drafts first.',
        '切换语言会刷新界面，请先发送或保存草稿。'),
      value: names[window.__agyUiLanguage],
      options: ['zh-CN', 'en'],
      displayResolver: language => names[language],
      onSelect: change,
      'data-testid': 'interface-language-setting'
    }),
    error && D.createElement('p', {role: 'alert', className: 'px-3 text-sm text-destructive'}, error));
}
