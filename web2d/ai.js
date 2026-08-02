/* yaya 灵魂引擎（本地版）：性格 + 记忆 + 气泡/日记/对话生成
 * LLM 接口：设置 window.YAYA_LLM = async (prompt) => text 即可切换真模型 */

// ---------- 九只宠物的灵魂（源自策划案性格引擎） ----------
const SOULS = {
  yaya:       { cn: '牙牙', traits: { courage: 60, curiosity: 85, sociability: 70, laziness: 40, talkativeness: 75 },
                style: '软糯，爱用叠词', cp: '嗷呜~', emoji: ['✨', '🫧'], loves: ['浆果', '晒太阳', '收集石头'], fears: ['打雷'] },
  pixiu:      { cn: '貔貅', traits: { courage: 90, curiosity: 60, sociability: 40, laziness: 30, talkativeness: 45 },
                style: '沉稳，话少但可靠', cp: '唔。', emoji: ['🪙'], loves: ['亮晶晶的东西', '守护'], fears: [] },
  pangda:     { cn: '胖达', traits: { courage: 45, curiosity: 55, sociability: 65, laziness: 85, talkativeness: 50 },
                style: '憨憨的，慢吞吞', cp: '嗯呐……', emoji: ['🎋'], loves: ['竹子', '躺着', '温泉'], fears: ['早起'] },
  maotouying: { cn: '猫头鹰', traits: { courage: 70, curiosity: 75, sociability: 35, laziness: 20, talkativeness: 55 },
                style: '文静，爱讲道理', cp: '咕。', emoji: ['🌙', '📖'], loves: ['夜晚', '看书', '星星'], fears: ['大太阳'] },
  long:       { cn: '龙', traits: { courage: 95, curiosity: 70, sociability: 55, laziness: 25, talkativeness: 60 },
                style: '豪迈，有点小骄傲', cp: '哼！', emoji: ['🔥', '☁️'], loves: ['飞', '宝物', '被夸奖'], fears: ['被说小'] },
  linghu:     { cn: '灵狐', traits: { courage: 65, curiosity: 90, sociability: 60, laziness: 35, talkativeness: 70 },
                style: '灵动俏皮，爱卖关子', cp: '嘿嘿~', emoji: ['🦊', '🍃'], loves: ['森林', '谜语', '月光'], fears: ['孤独'] },
  jingyu:     { cn: '鲸鱼', traits: { courage: 55, curiosity: 60, sociability: 50, laziness: 60, talkativeness: 40 },
                style: '温吞，哲学家气质', cp: '呜——', emoji: ['🌊', '🐚'], loves: ['大海', '唱歌', '发呆'], fears: ['拥挤'] },
  zhangyu:    { cn: '章鱼', traits: { courage: 50, curiosity: 95, sociability: 45, laziness: 45, talkativeness: 65 },
                style: '好奇宝宝，十万个为什么', cp: '欸？', emoji: ['🐙', '🔮'], loves: ['新东西', '解谜', '墨汁画'], fears: ['无聊'] },
  xiongmao:   { cn: '熊猫', traits: { courage: 48, curiosity: 58, sociability: 72, laziness: 80, talkativeness: 55 },
                style: '软萌，爱撒娇', cp: '抱抱~', emoji: ['🐼', '🎋'], loves: ['竹子', '抱抱', '睡午觉'], fears: ['独自吃饭'] },
};

// ---------- 记忆 ----------
const MEM_KEY = (id) => `yaya_mem_${id}`;
const Memory = {
  data: null,
  load(petId) {
    try { this.data = JSON.parse(localStorage.getItem(MEM_KEY(petId))) || null; } catch { this.data = null; }
    if (!this.data) this.data = { name: null, likes: [], fears: [], events: [], intimacy: 0, chatCount: 0, bornAt: Date.now(), lastSeen: Date.now(), shout: null };
    return this.data;
  },
  save(petId) { this.data.lastSeen = Date.now(); localStorage.setItem(MEM_KEY(petId), JSON.stringify(this.data)); },
  remember(type, text) {
    this.data.events.push({ t: Date.now(), type, text });
    if (this.data.events.length > 50) this.data.events = this.data.events.slice(-50);
  },
  addIntimacy(n) { this.data.intimacy += n; },
  get level() { return Math.floor(this.data.intimacy / 6) + 1; },
};

// ---------- 工具 ----------
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
function hour() { return new Date().getHours(); }
function timeGreet() {
  const h = hour();
  if (h < 6) return '夜深了';
  if (h < 11) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  if (h < 23) return '晚上好';
  return '夜深了';
}

// ---------- 气泡生成（性格×情境） ----------
const BUBBLE_LINES = {
  base: {
    high: ['{cp}今天想{love}！', '发现没，{zone}的风都是{adj}的', '我刚刚数了星星，数到第 42 颗就忘了', '{cp}你在身边就好啦'],
    mid: ['{zone}好像藏着什么秘密……', '嗯……接下来去哪呢', '{cp}', '有点想{love}了'],
    low: ['……（发呆）', '（打了个哈欠）', '（ quietly 跟着你）'],
  },
  zone: {
    灵屿: ['回家啦回家啦', '家里最舒服了{emoji}', '要不要种点什么呀'],
    星砂海滩: ['贝壳！那个贝壳在发光！', '海浪声好好听……', '想捡一颗最圆的珍珠给你'],
    迷雾森林: ['雾里好像有什么在动……', '{cp}别走丢哦，跟紧我', '雨夜的森林会有宝贝出没'],
    回声山谷: ['你喊一句试试？山谷会记住的', '喂——有人吗——', '这里的回声好像在说悄悄话'],
    霜语雪山: ['呼……有点冷，但好漂亮', '温泉！我看到温泉的热气了', '雪花落在鼻尖上，凉凉的'],
    沉睡遗迹: ['这些柱子以前是什么样子的呢', '嘘……你听，石头在睡觉', '感觉脚下踩着好多故事'],
    云端浮岛: ['我们飞到云上面了！', '云真的是棉花糖做的吗', '{cp}这里离星星好近'],
  },
  trait: {
    brave: ['前面有什么我都不怕！', '走，去最里面看看！'],
    curious: ['那个角落我还没去过！', '这是什么？那是什么？欸欸那又是什么！'],
    lazy: ['飞累了……歇一下下嘛', '要不……今天就在这躺着吧'],
    social: ['要是能遇到别的小伙伴就好了', '跟你一起玩最开心了{emoji}'],
  },
};

function genBubble(zoneName, soul) {
  const t = soul.traits;
  const pool = [...(BUBBLE_LINES.zone[zoneName] || [])];
  pool.push(...(t.talkativeness > 65 ? BUBBLE_LINES.base.high : t.talkativeness > 45 ? BUBBLE_LINES.base.mid : BUBBLE_LINES.base.low));
  if (t.courage > 75) pool.push(...BUBBLE_LINES.trait.brave);
  if (t.curiosity > 80) pool.push(...BUBBLE_LINES.trait.curious);
  if (t.laziness > 70) pool.push(...BUBBLE_LINES.trait.lazy);
  if (t.sociability > 65) pool.push(...BUBBLE_LINES.trait.social);
  return fill(pick(pool), soul, zoneName);
}

function fill(tpl, soul, zoneName) {
  return tpl.replace('{cp}', soul.cp)
    .replace('{emoji}', pick(soul.emoji))
    .replace('{love}', pick(soul.loves))
    .replace('{zone}', zoneName || '这里')
    .replace('{adj}', pick(['甜甜', '凉凉', '软软', '香香']));
}

// ---------- 日记生成 ----------
function genDiary(soul, mem, zoneNames) {
  const today = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
  const evts = mem.data.events.filter(e => Date.now() - e.t < 24 * 3600 * 1000);
  const lines = [`${soul.cn}的日记 · ${today}`, ''];
  lines.push(`${timeGreet()}！我是${mem.data.name || soul.cn}${soul.emoji[0] || ''}`);
  if (evts.length === 0) {
    lines.push(`今天还没出门呢。${soul.traits.laziness > 60 ? '在家躺了一天，好舒服……但也有点想你。' : '好想去外面看看呀，明天一定要出门！'}`);
  } else {
    const stories = evts.slice(-8).map(e => e.text);
    lines.push(...stories);
  }
  const zv = zoneNames.filter(Boolean);
  if (zv.length) lines.push(`今天去过的地方：${[...new Set(zv)].join('、')}。`);
  lines.push(`今日心情：${pick(['☀️', '🌈', '🫧', '🌙'])} （亲密 Lv.${mem.level}）`);
  lines.push('', `—— ${mem.data.name || soul.cn} 写于睡前`);
  return lines.join('\n');
}

// ---------- 对话 ----------
const CHAT_RULES = [
  { re: /叫我|叫我(.{1,6})$/, act: (m, mem) => { const n = m[1]; if (n) { mem.data.name = null; mem.data.ownerName = n.trim(); return `好！以后就叫你${n.trim()}啦${'{emoji}'}`; } return '那……你想让我叫你什么呀？'; } },
  { re: /我喜欢(.{1,10})/, act: (m, mem) => { mem.data.likes.push(m[1].trim()); return `记住啦，你喜欢${m[1].trim()}！我也喜欢{emoji}`; } },
  { re: /我怕(.{1,10})/, act: (m, mem) => { mem.data.fears.push(m[1].trim()); return `别怕别怕，${m[1].trim()}来了我保护你{cp}`; } },
  { re: /难过|伤心|不开心|郁闷|想哭/, act: () => pick(['（蹭蹭你）我在这呢，不走', '难过的话就靠着我一会儿吧……我不说话，就陪着你', '谁欺负你了？我去用{cp}瞪他！']) },
  { re: /累|好困|想睡|疲惫/, act: () => pick(['辛苦啦……要不要听海浪的声音？我可以学给你听：哗——哗——', '累了就休息嘛，我帮你看着家{emoji}']) },
  { re: /开心|高兴|太好了|哈哈/, act: () => pick(['太好啦！你开心我也开心{emoji}', '嘿嘿，被你传染了，我也想笑{cp}']) },
  { re: /晚安/, act: () => pick(['晚安……我帮你把家看好，安心睡吧{emoji}', '晚安呀。等你睡着了，我就去梦里找你玩']) },
  { re: /早上好|早安/, act: () => `${timeGreet()}！今天想不想去探险？` },
  { re: /你叫什么|名字/, act: (m, mem, soul) => `我是${mem.data.name || soul.cn}呀！{cp}` },
  { re: /喜欢什么|爱什么/, act: (m, mem, soul) => `我呀，最喜欢${soul.loves.join('、')}……还有你{emoji}` },
  { re: /怕什么/, act: (m, mem, soul) => soul.fears.length ? `唔……我有点怕${soul.fears.join('和')}……你在就不怕了` : '我什么都不怕！……好吧，有一点点怕你不在' },
  { re: /爱我|喜欢我/, act: () => pick(['当然喜欢你啦，最最喜欢{emoji}', '{cp}你猜？……猜对了，就是你']) },
  { re: /你好|在吗|在干嘛/, act: () => pick(['在呀在呀！一直在等你呢', '我在看云，云刚才变成你的样子了', '{cp}你回来啦！']) },
  { re: /再见|拜拜|走了/, act: () => pick(['去吧去吧，我会想你的……早点回来', '那我数着星星等你，数到 100 你就回来好不好']) },
];

async function chatReply(text, soul, mem) {
  mem.data.chatCount++;
  for (const [i, rule] of CHAT_RULES.entries()) {
    const m = text.match(rule.re);
    if (m) {
      const out = typeof rule.act === 'function' ? rule.act(m, mem, soul) : '';
      if (out) {
        mem.remember('chat', `你对我说「${text.slice(0, 20)}」，我回了你一句${soul.style.split('，')[0]}的话`);
        return fill(out.replace('{emoji}', pick(soul.emoji)).replace('{cp}', soul.cp), soul);
      }
    }
  }
  if (window.YAYA_LLM) {
    try {
      const persona = `你是${soul.cn}，一只${soul.style}的宠物。口癖：${soul.cp}。用户的话：${text}`;
      return await window.YAYA_LLM(persona);
    } catch { /* 落到本地 */ }
  }
  const fallbacks = soul.traits.talkativeness > 60
    ? ['{cp}这个我得想想……', '嗯嗯！然后呢然后呢？', '欸？有意思！再多说一点嘛', '（歪着头看你）{emoji}']
    : ['{cp}', '（点点头）', '嗯，我在听', '……（蹭了蹭你）'];
  return fill(pick(fallbacks), soul);
}

window.YAYA_AI = { SOULS, Memory, genBubble, genDiary, chatReply, fill, pick };
