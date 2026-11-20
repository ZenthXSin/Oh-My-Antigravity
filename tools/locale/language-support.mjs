import fs from 'node:fs';
import path from 'node:path';

export function addLanguageSetting(source, root) {
  const edits = [
    ['dca=({children:a,services:b})=>D.createElement(cca.Provider,{value:b},a)',
     'dca=({children:a,services:b})=>D.createElement(cca.Provider,{value:b},D.createElement(__agyLocaleGate,{storage:b.core.storageService},a))'],
    ['D.createElement("div",{className:"space-y-6"},H&&D.createElement(cT,',
     'D.createElement("div",{className:"space-y-6"},D.createElement(aT,null,D.createElement(__agyLanguageRow,null)),H&&D.createElement(cT,']
  ];
  for (const [before, after] of edits) {
    if (source.split(before).length !== 2) throw new Error('Native language-setting anchor changed: ' + before);
    source = source.replace(before, after);
  }
  const runtime = fs.readFileSync(path.join(root, 'frontend/language-settings.js'), 'utf8');
  const directiveEnd = source.indexOf(';') + 1;
  return source.slice(0, directiveEnd) + '\n' + runtime + '\n' + source.slice(directiveEnd);
}
