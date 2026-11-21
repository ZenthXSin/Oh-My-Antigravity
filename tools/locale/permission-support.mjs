import {parse} from 'acorn';
import * as walk from 'acorn-walk';

// Only native approval copy is translated; targets, scope IDs and decisions stay
// intact. Each template keeps its original expressions, including command text.
export function localizePermissionPrompts(source, dictionary) {
  const templates = new Map([
    [["Yes, allow downloads from ", " for this run"], ["允许本次从 ", " 下载"]],
    [["Yes, save rule for '", "' in this conversation"], ["允许，并在当前会话保存规则：'", "'"]],
    [["Yes, allow downloads from ", " in this conversation"], ["允许当前会话从 ", " 下载"]],
    [["Yes, allow ", " in this conversation"], ["允许当前会话访问 ", ""]],
    [["Yes, and always allow '", "' in this conversation"], ["允许，并在当前会话始终允许：'", "'"]],
    [["Yes, save rule for '", "' globally"], ["允许，并保存全局规则：'", "'"]],
    [["Yes, always allow downloads from ", ""], ["允许，并始终允许从 ", " 下载"]],
    [["Yes, always allow ", ""], ["允许，并始终允许访问 ", ""]],
    [["Yes, and always allow '", "'"], ["允许，并始终允许：'", "'"]],
    [["Conflicts with your configured Ask permission: ", ""], ["与已配置的询问权限冲突：", ""]],
    [["Requires manual confirmation: ", ""], ["需要手动确认：", ""]],
    [["Requesting permission to ", " ", ""], ["正在请求权限：", " ", ""]],
    [["Save rule to always allow ", "?"], ["保存规则，始终允许", "？"]],
    [["Allow ", "?"], ["允许", "？"]],
  ].map(([from, to]) => [JSON.stringify(from), to]));
  const patches = [];
  const owned = ancestors => ancestors.some(node => node.type === 'VariableDeclarator' && ['had', 'bad', 'aad', '$$c'].includes(node.id?.name));
  walk.ancestor(parse(source, {ecmaVersion:'latest'}), {
    Literal(node, ancestors) {
      if (!owned(ancestors) || typeof node.value !== 'string' || !Object.hasOwn(dictionary, node.value)) return;
      patches.push({start:node.start, end:node.end, text:JSON.stringify(dictionary[node.value])});
    },
    TemplateLiteral(node, ancestors) {
      if (!owned(ancestors)) return;
      const translated = templates.get(JSON.stringify(node.quasis.map(part => part.value.cooked)));
      if (!translated) return;
      node.quasis.forEach((part, index) => patches.push({start:part.start, end:part.end, text:translated[index]}));
    },
  });
  for (const patch of patches.sort((a, b) => b.start - a.start)) source = source.slice(0, patch.start) + patch.text + source.slice(patch.end);
  return source;
}

export function restorePermissionSelector(source) {
  const before = 'Q=P?.showPermissionsSelector??!1,R=P?.environmentSelector';
  if (source.split(before).length !== 2) throw new Error('Native permission selector gate changed.');
  return source.replace(before, 'Q=(P?.showPermissionsSelector??!1)||!!(window.electronNative&&window.ohMyChannels),R=P?.environmentSelector');
}
