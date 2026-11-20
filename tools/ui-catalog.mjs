import fs from 'node:fs';
import path from 'node:path';
import {parse} from 'acorn';
import * as walk from 'acorn-walk';

const root = path.resolve(import.meta.dirname, '..');
const source = fs.readFileSync(path.join(root, 'original-web/main.js'), 'utf8');
const tree = parse(source, {ecmaVersion: 'latest', sourceType: 'script'});
const displayKeys = new Set(['label', 'title', 'description', 'place'+'holder', 'tooltip', 'tooltipText', 'aria-label','ariaLabel', 'emptyMessage', 'emptyMessageSingular', 'emptyMessagePlural', 'sidebarLabel', 'searchPlaceholder', 'inputPlaceholder', 'subtitle', 'buttonLabel', 'confirmLabel', 'cancelLabel', 'header','noMatches','noArchived','noConversations','tagTitle','tagDescription','copyLabel','settingsLabel','revealLabel','archiveLabel','deleteLabel','renameLabel','moveUpLabel','moveDownLabel']);
function key(node) { return node?.name ?? node?.value; }
function isDisplay(node, ancestors) {
  const parent = ancestors.at(-2);
  if (parent?.type === 'Property' && parent.key === node) return false;
  if (parent?.type === 'MemberExpression' && parent.property === node) return false;
  if (ancestors.some(a => a.type === 'BinaryExpression' && ['===', '!==', '==', '!='].includes(a.operator))) return false;
  // These resolver callbacks return display labels/descriptions, never values.
  const containingFunction=ancestors.findLast(a=>['ArrowFunctionExpression','FunctionExpression'].includes(a.type));
  const owner=containingFunction && ancestors[ancestors.indexOf(containingFunction)-1];
  if(owner?.type==='Property'&&['resolveOptionToString','resolveOptionToDescription'].includes(key(owner.key)))return true;
  for (let i = ancestors.length - 2; i >= 0; i--) {
    const a = ancestors[i];
    if (a.type === 'Property') {
      const call=ancestors[i-2];
      const reactProp=call?.type==='CallExpression' && key(call.callee.property)==='createElement';
      // In command registries, title is also an internal discriminator.
      if(key(a.key)==='title'&&!reactProp)return false;
      if (displayKeys.has(key(a.key)) && a.value.start <= node.start && a.value.end >= node.end) return true;
      return key(a.key)==='text' && a.value===node && reactProp && ['R6','kUb'].includes(call.arguments[0]?.name);
    }
    if (a.type === 'CallExpression' && a.callee.type === 'MemberExpression' && key(a.callee.property) === 'createElement' && a.arguments.slice(2).some(v => v.start <= node.start && v.end >= node.end)) return true;
    // Only final text values may be traversed. Calls, computations and returns
    // can contain protocol names, routes, enum values and internal screen IDs.
    if (!['ConditionalExpression','LogicalExpression','ArrayExpression'].includes(a.type)) return false;
    if (a.type === 'ConditionalExpression' && a.test.start <= node.start && a.test.end >= node.end) return false;
  }
  return false;
}
const candidates = new Map();
walk.ancestor(tree, {
  Literal(node, ancestors) {
    if (typeof node.value !== 'string' || node.value.length > 650 || !/[A-Za-z]{2}/.test(node.value) || !isDisplay(node, ancestors)) return;
    if (/^https?:|^[a-z]+:\/\/|^[a-zA-Z0-9_.-]+\.[a-z]{2,6}$|^--|^\[|\{|\n/.test(node.value)) return;
    const rows = candidates.get(node.value) ?? [];
    rows.push({start: node.start, end: node.end, context: source.slice(Math.max(0,node.start-100),node.end+100)});
    candidates.set(node.value, rows);
  }
});
fs.mkdirSync(path.join(root,'inspection'), {recursive:true});
fs.writeFileSync(path.join(root,'inspection/ui-candidates.json'), JSON.stringify([...candidates].map(([text,locations])=>({text,locations})),null,2));
console.log(JSON.stringify({strings:candidates.size,occurrences:[...candidates.values()].reduce((n,a)=>n+a.length,0)}));

