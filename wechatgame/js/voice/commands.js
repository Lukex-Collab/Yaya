// voice/commands.js - 语音指令解析（纯函数，可单测）
// ASR 文本 -> 意图。后续接流式 ASR 时直接复用。
var RULES = [
  { intent: 'follow_me', keywords: ['跟我走', '跟着我', '一起走', '跟紧'] },
  { intent: 'come_here', keywords: ['过来', '来这边', '到我这儿'] },
  { intent: 'sit', keywords: ['坐下', '坐好', '蹲下'] },
  { intent: 'go_home', keywords: ['回家', '回村', '回灵屿'] },
  { intent: 'be_happy', keywords: ['开心点', '开心', '笑一个', '高兴起来'] },
  { intent: 'be_quiet', keywords: ['安静', '别闹', '小声'] }
];

function parse(text) {
  var raw = String(text || '').replace(/\s+/g, '');
  if (!raw) return { intent: 'unknown', raw: raw };
  for (var i = 0; i < RULES.length; i++) {
    var kw = RULES[i].keywords;
    for (var j = 0; j < kw.length; j++) {
      if (raw.indexOf(kw[j]) >= 0) {
        return { intent: RULES[i].intent, raw: raw };
      }
    }
  }
  return { intent: 'unknown', raw: raw };
}

module.exports = { parse: parse, RULES: RULES };
