function __agyZhStatus(value) {
  if (typeof value !== 'string') return value;
  return __agyZhText(value)
    .replace(/^Worked for (.+)$/, '执行耗时 $1')
    .replace(/^Working for (.+)$/, '已执行 $1')
    .replace(/^Thinking for (\d+)s$/, '已思考 $1 秒')
    .replace(/^Using browser(?: · )?/, '正在使用浏览器 · ')
    .replace(/(^| · )Thinking(?: \((\d+)s\))?…$/, (_, lead, seconds) => lead + '思考中' + (seconds ? '（' + seconds + ' 秒）' : '') + '…');
}
