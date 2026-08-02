const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "LingPal Team";
pres.title = "牙牙 Yaya — AI守护玩偶 · 路演演示";

// ═══════════════════════════════════════════
// DESIGN SYSTEM
// ═══════════════════════════════════════════
const C = {
  bg:       "0C0C0C",
  bgCard:   "1A1A1A",
  pink:     "F4A0B5",
  pinkDark: "D4788E",
  cream:    "FFF8F0",
  gold:     "D4A850",
  white:    "FFFFFF",
  gray:     "A09898",
  grayLt:   "C0B8B8",
  darkGray: "666060",
  green:    "7ECB9A",
  blue:     "7EB8D4",
  purple:   "C4A0D4",
  orange:   "E8B878",
  red:      "E87878",
};

const FONT = {
  title: "Arial Black",
  heading: "Arial",
  body: "Calibri",
  mono: "Consolas",
};

// Helper: create a fresh shadow factory to avoid mutation bugs
const cardShadow = () => ({ type: "outer", blur: 8, offset: 3, angle: 135, color: "000000", opacity: 0.3 });
const subtleShadow = () => ({ type: "outer", blur: 4, offset: 1, angle: 135, color: "000000", opacity: 0.2 });

// Helper: add a bottom accent bar
function addBottomBar(slide) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 5.4, w: 10, h: 0.225,
    fill: { color: C.pink },
  });
}

// Helper: page number
function addPageNum(slide, num) {
  slide.addText(String(num), {
    x: 9.2, y: 5.2, w: 0.5, h: 0.3,
    fontSize: 9, fontFace: FONT.body, color: C.darkGray, align: "right",
  });
}

// Helper: section divider line
function addSectionLine(slide, x, y, w) {
  slide.addShape(pres.shapes.LINE, { x, y, w, h: 0, line: { color: C.pink, width: 1.5 } });
}

// ═══════════════════════════════════════════
// SLIDE 1 — TITLE
// ═══════════════════════════════════════════
(function() {
  const s = pres.addSlide();
  s.background = { color: C.bg };

  // Atmospheric glow behind title
  s.addShape(pres.shapes.OVAL, {
    x: 1.5, y: 0.5, w: 7, h: 3.5,
    fill: { color: C.pink, transparency: 92 },
  });

  // Top accent line
  s.addShape(pres.shapes.RECTANGLE, {
    x: 3.5, y: 1.2, w: 3, h: 0.015,
    fill: { color: C.pink, transparency: 40 },
  });

  // Main title
  s.addText("牙牙 YAYA", {
    x: 0.5, y: 1.4, w: 9, h: 1.4,
    fontSize: 54, fontFace: FONT.title, color: C.white, align: "center",
    bold: true, charSpacing: 6,
  });

  // Subtitle
  s.addText("AI 守护玩偶 · 灵伴平台", {
    x: 0.5, y: 2.9, w: 9, h: 0.7,
    fontSize: 20, fontFace: FONT.heading, color: C.pink, align: "center",
    charSpacing: 3,
  });

  // Tagline
  s.addText([
    { text: "\u201C", options: { fontSize: 28, color: C.gold, fontFace: "Georgia" } },
    { text: "牙牙在，就不孤单", options: { fontSize: 22, color: C.cream, fontFace: "Georgia", italic: true } },
    { text: "\u201D", options: { fontSize: 28, color: C.gold, fontFace: "Georgia" } },
  ], {
    x: 0.5, y: 3.8, w: 9, h: 0.7,
    align: "center",
  });

  // Bottom: date & team
  s.addText("LingPal Team · 2026.08 · MoonStone Roadshow", {
    x: 0.5, y: 4.7, w: 9, h: 0.4,
    fontSize: 11, fontFace: FONT.body, color: C.darkGray, align: "center",
  });

  // Bottom bar
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 5.4, w: 10, h: 0.225,
    fill: { color: C.pink },
  });
})();

// ═══════════════════════════════════════════
// SLIDE 2 — THE PROBLEM
// ═══════════════════════════════════════════
(function() {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addBottomBar(s);
  addPageNum(s, 2);

  s.addText("城市独居女性的困境", {
    x: 0.6, y: 0.3, w: 8, h: 0.7,
    fontSize: 32, fontFace: FONT.title, color: C.white, bold: true,
  });
  addSectionLine(s, 0.6, 1.0, 2.5);

  // Left: Pain points
  const pains = [
    { icon: "\uD83D\uDC94", title: "情感孤独", desc: "独居生活中缺少倾诉对象，深夜emo无处释放。72%独居女性表示经常感到孤独。" },
    { icon: "\uD83D\uDE31", title: "安全焦虑", desc: "独居女性遭遇入室盗窃概率是普通家庭的2.3倍。睡前听到异响，却不敢去查看。" },
    { icon: "\uD83C\uDFE5", title: "健康忽视", desc: "经期不规律、作息紊乱、情绪低谷......缺少日常健康关怀提醒。" },
    { icon: "\uD83D\uDCF1", title: "屏幕疲劳", desc: "现有解决方案全是APP/社交软件，冰冷的屏幕无法给予真正的陪伴感。" },
  ];

  pains.forEach((p, i) => {
    const yBase = 1.35 + i * 1.0;
    // Icon circle
    s.addShape(pres.shapes.OVAL, {
      x: 0.6, y: yBase, w: 0.5, h: 0.5,
      fill: { color: C.bgCard },
      line: { color: C.pink, width: 1 },
    });
    s.addText(p.icon, {
      x: 0.6, y: yBase, w: 0.5, h: 0.5,
      fontSize: 18, align: "center", valign: "middle",
    });
    s.addText(p.title, {
      x: 1.3, y: yBase - 0.05, w: 3.5, h: 0.35,
      fontSize: 16, fontFace: FONT.heading, color: C.pink, bold: true,
    });
    s.addText(p.desc, {
      x: 1.3, y: yBase + 0.3, w: 4.0, h: 0.6,
      fontSize: 11, fontFace: FONT.body, color: C.grayLt,
    });
  });

  // Right: Big stats
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.8, y: 1.2, w: 3.8, h: 3.8,
    fill: { color: C.bgCard },
    shadow: cardShadow(),
  });

  // Big number
  s.addText("1.25\u4EBF", {
    x: 5.8, y: 1.5, w: 3.8, h: 1.0,
    fontSize: 48, fontFace: FONT.title, color: C.pink, align: "center", bold: true,
  });
  s.addText("中国独居人口", {
    x: 5.8, y: 2.4, w: 3.8, h: 0.4,
    fontSize: 14, fontFace: FONT.heading, color: C.white, align: "center",
  });

  // Separator
  s.addShape(pres.shapes.LINE, {
    x: 6.6, y: 3.0, w: 2.2, h: 0,
    line: { color: C.pink, width: 0.5, dashType: "dash" },
  });

  // Sub-stats
  const stats = [
    ["2000\u4E07+", "18-28\u5C81\u72EC\u5C45\u5973\u6027"],
    ["72%", "\u7ECF\u5E38\u611F\u5230\u5B64\u72EC"],
    ["68%", "\u613F\u4E3A\u966A\u4F34\u4EA7\u54C1\u4ED8\u8D39"],
  ];
  stats.forEach((st, i) => {
    const yS = 3.25 + i * 0.55;
    s.addText(st[0], {
      x: 5.8, y: yS, w: 1.5, h: 0.45,
      fontSize: 22, fontFace: FONT.title, color: C.gold, align: "right", bold: true,
    });
    s.addText(st[1], {
      x: 7.4, y: yS + 0.02, w: 2.2, h: 0.45,
      fontSize: 11, fontFace: FONT.body, color: C.grayLt, align: "left",
    });
  });
})();

// ═══════════════════════════════════════════
// SLIDE 3 — SOLUTION
// ═══════════════════════════════════════════
(function() {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addBottomBar(s);
  addPageNum(s, 3);

  s.addText("三合一 · 重新定义陪伴", {
    x: 0.6, y: 0.3, w: 8, h: 0.7,
    fontSize: 32, fontFace: FONT.title, color: C.white, bold: true,
  });
  addSectionLine(s, 0.6, 1.0, 2.5);

  // Three pillars
  const pillars = [
    {
      title: "\uD83E\uDDF8 实体玩偶",
      sub: "毛绒触感 · NFC芯片",
      items: [
        "高品质毛绒材质，柔软治愈手感",
        "内置NFC芯片，唯一身份绑定",
        "触摸传感器，感知拥抱/抚摸",
        "温感互动，牙牙知道你在身边",
      ],
      color: C.pink,
    },
    {
      title: "\uD83E\uDDE0 AI 灵魂",
      sub: "DeepSeek · 记忆引擎",
      items: [
        "多轮深度对话，理解你的情绪",
        "长期记忆系统，记住你的故事",
        "个性演化引擎，牙牙越来越懂你",
        "声音克隆+语音通话，听见牙牙",
      ],
      color: C.gold,
    },
    {
      title: "\uD83D\uDEE1\uFE0F 安全守护",
      sub: "红外检测 · 独居保障",
      items: [
        "红外门窗入侵检测，24h监控",
        "异常声音识别（碎窗/撬锁）",
        "一键报警+紧急联系人通知",
        "离家/回家安全确认流程",
      ],
      color: C.blue,
    },
  ];

  pillars.forEach((p, i) => {
    const xBase = 0.4 + i * 3.15;
    // Card bg
    s.addShape(pres.shapes.RECTANGLE, {
      x: xBase, y: 1.3, w: 2.95, h: 3.85,
      fill: { color: C.bgCard },
      shadow: cardShadow(),
    });
    // Colored top accent
    s.addShape(pres.shapes.RECTANGLE, {
      x: xBase, y: 1.3, w: 2.95, h: 0.06,
      fill: { color: p.color },
    });
    // Title
    s.addText(p.title, {
      x: xBase + 0.2, y: 1.55, w: 2.55, h: 0.45,
      fontSize: 18, fontFace: FONT.heading, color: p.color, bold: true,
    });
    s.addText(p.sub, {
      x: xBase + 0.2, y: 1.95, w: 2.55, h: 0.3,
      fontSize: 10, fontFace: FONT.body, color: C.gray,
    });
    // Items
    s.addText(p.items.map((item, j) => ({
      text: item,
      options: { bullet: true, breakLine: j < p.items.length - 1, fontSize: 11, fontFace: FONT.body, color: C.grayLt, paraSpaceAfter: 6 },
    })), {
      x: xBase + 0.2, y: 2.4, w: 2.55, h: 2.5,
      valign: "top",
    });
  });

  // Bottom tagline
  s.addText("不只是玩具，是真正懂你、守护你的AI伙伴", {
    x: 0.5, y: 5.0, w: 9, h: 0.3,
    fontSize: 12, fontFace: FONT.body, color: C.pink, align: "center", italic: true,
  });
})();

// ═══════════════════════════════════════════
// SLIDE 4 — CORE EXPERIENCE
// ═══════════════════════════════════════════
(function() {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addBottomBar(s);
  addPageNum(s, 4);

  s.addText("牙牙的一天 · 7大核心场景", {
    x: 0.6, y: 0.3, w: 8, h: 0.7,
    fontSize: 32, fontFace: FONT.title, color: C.white, bold: true,
  });
  addSectionLine(s, 0.6, 1.0, 2.5);

  const scenes = [
    ["\u2600\uFE0F", "早安仪式", "牙牙叫你起床，播报天气\n和今日运势，元气满满"],
    ["\uD83D\uDCDD", "手账日记", "AI自动生成图文手账\n记录美好日常点滴"],
    ["\uD83D\uDCAC", "深夜倾诉", "全天候AI深度对话\n分享喜怒哀乐"],
    ["\uD83C\uDF19", "睡前陪伴", "专属梦境编织+睡前故事\n温柔哄你入睡"],
    ["\uD83D\uDCAA", "健康关怀", "经期预测+身体提醒\n做你的私人小护士"],
    ["\uD83D\uDEE1\uFE0F", "独居安全", "24h门窗监控+异常检测\n守护你的安全"],
    ["\u2728", "成就庆祝", "成长里程碑+39成就体系\n牙牙为你的每一步欢呼"],
  ];

  scenes.forEach((sc, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const xBase = 0.4 + col * 2.4;
    const yBase = 1.3 + row * 2.0;

    // Card
    s.addShape(pres.shapes.RECTANGLE, {
      x: xBase, y: yBase, w: 2.2, h: 1.8,
      fill: { color: C.bgCard },
      shadow: subtleShadow(),
    });
    // Icon
    s.addText(sc[0], {
      x: xBase, y: yBase + 0.15, w: 2.2, h: 0.45,
      fontSize: 24, align: "center",
    });
    // Title
    s.addText(sc[1], {
      x: xBase + 0.1, y: yBase + 0.6, w: 2.0, h: 0.35,
      fontSize: 13, fontFace: FONT.heading, color: C.pink, bold: true, align: "center",
    });
    // Description
    s.addText(sc[2], {
      x: xBase + 0.1, y: yBase + 0.95, w: 2.0, h: 0.7,
      fontSize: 10, fontFace: FONT.body, color: C.grayLt, align: "center",
    });
  });
})();

// ═══════════════════════════════════════════
// SLIDE 5 — TECH ARCHITECTURE
// ═══════════════════════════════════════════
(function() {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addBottomBar(s);
  addPageNum(s, 5);

  s.addText("技术架构全景", {
    x: 0.6, y: 0.3, w: 8, h: 0.7,
    fontSize: 32, fontFace: FONT.title, color: C.white, bold: true,
  });
  addSectionLine(s, 0.6, 1.0, 2.5);

  // Architecture layers - top to bottom
  const layers = [
    { label: "接入层", items: "微信小程序 · Web Demo · 硬件ESP32", color: C.pink, y: 1.25 },
    { label: "网关层", items: "Gin API Gateway · WebSocket · SSE流式 · JWT鉴权", color: C.gold, y: 2.05 },
    { label: "服务层 (31模块)", items: "chat · memory · journal · ritual · emotion · safety · voice · world · pet · social · payment · admin ...", color: C.blue, y: 2.85 },
    { label: "AI引擎", items: "DeepSeek Chat API · 记忆提取管线 · 情绪分析 · 日记生成 · 梦境编织", color: C.purple, y: 3.65 },
    { label: "数据层", items: "PostgreSQL 16 + pgvector · Redis 7 · MinIO 对象存储 · WebSocket实时通道", color: C.green, y: 4.45 },
  ];

  layers.forEach((l) => {
    // Layer bar
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.6, y: l.y, w: 0.12, h: 0.65,
      fill: { color: l.color },
    });
    // Label
    s.addText(l.label, {
      x: 0.95, y: l.y, w: 1.2, h: 0.65,
      fontSize: 12, fontFace: FONT.heading, color: l.color, bold: true, valign: "middle",
    });
    // Items
    s.addText(l.items, {
      x: 2.2, y: l.y, w: 7.2, h: 0.65,
      fontSize: 11, fontFace: FONT.body, color: C.grayLt, valign: "middle",
    });
    // Bottom border
    s.addShape(pres.shapes.LINE, {
      x: 0.6, y: l.y + 0.65, w: 8.8, h: 0,
      line: { color: C.bgCard, width: 0.5 },
    });
  });

  // Right side: key metrics stack
  const metrics = [
    ["154", "Go\u6E90\u6587\u4EF6"],
    ["31", "\u5FAE\u670D\u52A1\u6A21\u5757"],
    ["144+", "API\u7AEF\u70B9"],
    ["21", "\u6570\u636E\u5E93\u8868"],
    ["~20K", "\u4EE3\u7801\u884C"],
  ];

  // Hide the last layer's bottom border area and put metrics on the right
  // Actually, let's put key stats at the bottom as callout boxes
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 5.08, w: 8.8, h: 0.02,
    fill: { color: C.pink, transparency: 30 },
  });
})();

// ═══════════════════════════════════════════
// SLIDE 6 — AI ENGINE
// ═══════════════════════════════════════════
(function() {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addBottomBar(s);
  addPageNum(s, 6);

  s.addText("AI灵魂 · 不只是聊天机器人", {
    x: 0.6, y: 0.3, w: 8, h: 0.7,
    fontSize: 32, fontFace: FONT.title, color: C.white, bold: true,
  });
  addSectionLine(s, 0.6, 1.0, 2.5);

  // Center - AI "brain" diagram
  // Central circle
  s.addShape(pres.shapes.OVAL, {
    x: 3.65, y: 2.15, w: 2.7, h: 2.7,
    fill: { color: C.pink, transparency: 85 },
    line: { color: C.pink, width: 2 },
  });
  s.addText("DeepSeek\nAI Engine", {
    x: 3.65, y: 2.5, w: 2.7, h: 2.0,
    fontSize: 18, fontFace: FONT.heading, color: C.pink, bold: true, align: "center", valign: "middle",
  });

  // Surrounding capabilities
  const caps = [
    { x: 0.5, y: 1.4, title: "多轮对话", desc: "上下文感知，\n情感共鸣回应", color: C.pink },
    { x: 7.2, y: 1.4, title: "记忆系统", desc: "pgvector语义存储，\n记住你说过的一切", color: C.gold },
    { x: 0.5, y: 3.6, title: "情绪分析", desc: "实时情绪识别，\n趋势追踪+急救", color: C.blue },
    { x: 7.2, y: 3.6, title: "内容生成", desc: "日记/梦境/周信，\n7种AI原创内容", color: C.purple },
    { x: 3.65, y: 0.85, title: "声音克隆", desc: "5种牙牙专属音色，\nChatterbox TTS", color: C.green },
    { x: 3.65, y: 4.4, title: "自主行为", desc: "21物种宠物引擎，\n无需指令自主活动", color: C.orange },
  ];

  caps.forEach((c) => {
    s.addShape(pres.shapes.RECTANGLE, {
      x: c.x, y: c.y, w: 2.3, h: 1.05,
      fill: { color: C.bgCard },
      line: { color: c.color, width: 0.5 },
      shadow: subtleShadow(),
    });
    s.addText(c.title, {
      x: c.x + 0.1, y: c.y + 0.08, w: 2.1, h: 0.3,
      fontSize: 12, fontFace: FONT.heading, color: c.color, bold: true, align: "center",
    });
    s.addText(c.desc, {
      x: c.x + 0.1, y: c.y + 0.38, w: 2.1, h: 0.6,
      fontSize: 10, fontFace: FONT.body, color: C.grayLt, align: "center",
    });
  });
})();

// ═══════════════════════════════════════════
// SLIDE 7 — FEATURE MATRIX
// ═══════════════════════════════════════════
(function() {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addBottomBar(s);
  addPageNum(s, 7);

  s.addText("功能矩阵 · 全面覆盖陪伴场景", {
    x: 0.6, y: 0.3, w: 8, h: 0.7,
    fontSize: 32, fontFace: FONT.title, color: C.white, bold: true,
  });
  addSectionLine(s, 0.6, 1.0, 2.5);

  // Feature table - normalize all cells to {text, options} format
  const rawRows = [
    ["模块", "核心功能", "AI能力", "状态"],
    ["💬 对话", "SSE流式多轮对话·上下文记忆·情感感知", "DeepSeek Chat", "✅ 就绪"],
    ["🧠 记忆", "语义搜索·核心事实提取·记忆时间线", "pgvector + LLM", "✅ 就绪"],
    ["📓 日记", "AI生成图文手账·情绪标签·时间轴", "LLM分析+模板", "✅ 就绪"],
    ["🌅 仪式", "早安/晚安·睡前故事·每日话题", "LLM生成", "✅ 就绪"],
    ["💖 情绪", "趋势追踪·情绪报告·急救干预", "NLP情感分析", "✅ 就绪"],
    ["🏠 安全", "门窗入侵检测·异常声音·一键报警", "IoT传感器", "⚙️ 模拟"],
    ["🌍 世界", "3D探索·21物种·NFC实体绑定", "自主行为引擎", "✅ 就绪"],
    ["🎤 语音", "声音克隆·实时通话·TTS合成", "Chatterbox TTS", "✅ 就绪"],
    ["👑 社交", "好友·拜访·闺蜜配对·内容广场", "推荐算法", "✅ 就绪"],
  ];

  const rows = rawRows.map((row, i) => {
    const isHeader = i === 0;
    return row.map((cell, j) => {
      const statusOk = cell.includes("就绪");
      const opts = {
        fontSize: isHeader ? 12 : 10,
        fontFace: isHeader ? FONT.heading : FONT.body,
        color: isHeader ? C.white : (j === 3 ? (statusOk ? C.green : C.gold) : C.grayLt),
        fill: { color: isHeader ? C.bgCard : (i % 2 === 0 ? "141414" : C.bgCard) },
        bold: isHeader,
        align: j === 3 ? "center" : "left",
      };
      return { text: cell, options: opts };
    });
  });

  s.addTable(rows, {
    x: 0.4, y: 1.25, w: 9.2,
    colW: [1.5, 3.3, 2.5, 1.9],
    border: { pt: 0.5, color: C.bgCard },
    rowH: [0.4, 0.38, 0.38, 0.38, 0.38, 0.38, 0.38, 0.38, 0.38],
    autoPage: false,
  });

  // Footnote
  s.addText("\u2699\uFE0F 模拟 = 硬件模拟器已就绪，等待ESP32联调   |   全部31个模块编译通过，0错误0警告", {
    x: 0.4, y: 5.05, w: 9.2, h: 0.25,
    fontSize: 9, fontFace: FONT.body, color: C.darkGray,
  });
})();

// ═══════════════════════════════════════════
// SLIDE 8 — MARKET OPPORTUNITY
// ═══════════════════════════════════════════
(function() {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addBottomBar(s);
  addPageNum(s, 8);

  s.addText("市场机会 · 千亿情感经济", {
    x: 0.6, y: 0.3, w: 8, h: 0.7,
    fontSize: 32, fontFace: FONT.title, color: C.white, bold: true,
  });
  addSectionLine(s, 0.6, 1.0, 2.5);

  // TAM / SAM / SOM funnel
  const funnel = [
    { label: "TAM 总可寻址市场", value: "\u00A5360\u4EBF", sub: "中国情感陪伴经济（宠物/心理咨询/社交/娱乐）", w: 5.0, color: C.pink },
    { label: "SAM 可服务市场", value: "\u00A5120\u4EBF", sub: "AI陪伴+智能硬件+独居女性消费", w: 6.5, color: C.gold },
    { label: "SOM 可获得市场", value: "\u00A56\u4EBF", sub: "1%渗透率 × 2000万目标用户 × \u00A5300年ARPU", w: 8.0, color: C.blue },
  ];

  funnel.forEach((f, i) => {
    const yF = 1.2 + i * 1.1;
    const xOffset = (9.6 - f.w) / 2;
    s.addShape(pres.shapes.RECTANGLE, {
      x: xOffset, y: yF, w: f.w, h: 0.88,
      fill: { color: C.bgCard },
      line: { color: f.color, width: 1 },
    });
    s.addText(f.label, {
      x: xOffset + 0.3, y: yF + 0.08, w: f.w - 0.6, h: 0.28,
      fontSize: 12, fontFace: FONT.heading, color: f.color, bold: true,
    });
    s.addText(f.value, {
      x: xOffset + 0.3, y: yF + 0.32, w: 1.6, h: 0.55,
      fontSize: 26, fontFace: FONT.title, color: C.white, bold: true,
    });
    s.addText(f.sub, {
      x: xOffset + 1.9, y: yF + 0.45, w: f.w - 2.2, h: 0.35,
      fontSize: 9, fontFace: FONT.body, color: C.gray, valign: "middle",
    });
  });

  // Bottom row: key market drivers
  s.addText("市场驱动力", {
    x: 0.6, y: 4.45, w: 3, h: 0.3,
    fontSize: 11, fontFace: FONT.heading, color: C.pink, bold: true,
  });
  const drivers = [
    "\uD83D\uDCC8 中国独居人口年增12%，2027年将超1.5亿",
    "\uD83E\uDDE0 AI陪伴接受度：68%年轻人愿意尝试AI朋友",
    "\uD83E\uDDF8 潮玩市场爆发：盲盒+毛绒玩具超800亿/年",
    "\uD83D\uDCF1 微信小程序生态：12亿MAU·零安装成本",
  ];
  drivers.forEach((d, i) => {
    s.addText(d, {
      x: 0.6 + (i % 2) * 4.5, y: 4.72 + Math.floor(i / 2) * 0.35, w: 4.3, h: 0.3,
      fontSize: 9, fontFace: FONT.body, color: C.grayLt,
    });
  });
})();

// ═══════════════════════════════════════════
// SLIDE 9 — COMPETITIVE LANDSCAPE
// ═══════════════════════════════════════════
(function() {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addBottomBar(s);
  addPageNum(s, 9);

  s.addText("竞品分析 · 牙牙的差异化优势", {
    x: 0.6, y: 0.3, w: 8, h: 0.7,
    fontSize: 32, fontFace: FONT.title, color: C.white, bold: true,
  });
  addSectionLine(s, 0.6, 1.0, 2.5);

  const rawComp = [
    ["", "🧸 牙牙", "Replika", "小爱同学", "天猫精灵"],
    ["实体形态", "✅ 毛绒玩偶", "❌ 纯APP", "✅ 智能音箱", "✅ 智能音箱"],
    ["AI情感深度", "⭐⭐⭐⭐⭐", "⭐⭐⭐⭐", "⭐⭐", "⭐⭐"],
    ["独居安全", "✅ 红外+声音检测", "❌ 无", "❌ 无", "❌ 无"],
    ["长期记忆", "✅ pgvector语义记忆", "✅ 有", "❌ 无", "❌ 无"],
    ["声音克隆", "✅ 5种专属音色", "❌ 无", "❌ 无", "❌ 无"],
    ["社交裂变", "✅ 闺蜜配对", "❌ 无", "❌ 无", "❌ 无"],
    ["目标人群", "18-28岁独居女性", "全年龄段", "全年龄段", "全年龄段"],
    ["价格", "¥79-129/实体", "免费+€7.99/月", "¥199+", "¥99+"],
  ];

  const compRows = rawComp.map((row, i) => {
    const isHeader = i === 0;
    return row.map((cell, j) => ({
      text: cell,
      options: {
        fontSize: 10,
        fontFace: FONT.body,
        color: isHeader ? C.white : (j === 1 ? C.pink : C.grayLt),
        fill: { color: isHeader ? C.bgCard : (i % 2 === 0 ? "141414" : C.bgCard) },
        bold: isHeader,
        align: j > 0 ? "center" : "left",
      },
    }));
  });

  s.addTable(compRows, {
    x: 0.3, y: 1.25, w: 9.4,
    colW: [1.7, 2.0, 1.7, 2.0, 2.0],
    border: { pt: 0.5, color: C.bgCard },
    rowH: [0.45, 0.42, 0.42, 0.42, 0.42, 0.42, 0.42, 0.42, 0.42],
    autoPage: false,
  });

  // Key insight callout
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.3, y: 4.9, w: 9.4, h: 0.4,
    fill: { color: C.pink, transparency: 90 },
  });
  s.addText("\uD83D\uDCA1 牙牙是唯一同时覆盖「实体毛绒陪伴 + AI情感深度 + 独居安全」的产品 —— 三个维度都做到极致，形成不可替代的交叉优势", {
    x: 0.5, y: 4.9, w: 9.0, h: 0.4,
    fontSize: 10, fontFace: FONT.body, color: C.pink, valign: "middle",
  });
})();

// ═══════════════════════════════════════════
// SLIDE 10 — BUSINESS MODEL
// ═══════════════════════════════════════════
(function() {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addBottomBar(s);
  addPageNum(s, 10);

  s.addText("商业模式 · 软硬一体化变现", {
    x: 0.6, y: 0.3, w: 8, h: 0.7,
    fontSize: 32, fontFace: FONT.title, color: C.white, bold: true,
  });
  addSectionLine(s, 0.6, 1.0, 2.5);

  // Revenue streams - 4 cards
  const streams = [
    { title: "\uD83E\uDDF8 实体销售", price: "\u00A579-129", unit: "/个", desc: "牙牙毛绒玩偶\n内置NFC+传感器\n毛利率 55-65%", color: C.pink },
    { title: "\uD83C\uDF0D 盲盒系列", price: "\u00A539-79", unit: "/个", desc: "灵伴世界21物种\n4层级稀有度\n收藏驱动复购", color: C.gold },
    { title: "\u2728 会员订阅", price: "\u00A519.9", unit: "/月", desc: "灵伴+高级特权\n无限AI对话·专属音色\n高级梦境定制", color: C.blue },
    { title: "\uD83C\uDFC6 赛季手册", price: "\u00A568", unit: "/季", desc: "限定皮肤+成就\n社交排行榜\n限定联名活动", color: C.purple },
  ];

  streams.forEach((st, i) => {
    const xBase = 0.3 + i * 2.4;
    s.addShape(pres.shapes.RECTANGLE, {
      x: xBase, y: 1.3, w: 2.2, h: 2.5,
      fill: { color: C.bgCard },
      shadow: cardShadow(),
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: xBase, y: 1.3, w: 2.2, h: 0.06,
      fill: { color: st.color },
    });
    s.addText(st.title, {
      x: xBase + 0.15, y: 1.5, w: 1.9, h: 0.35,
      fontSize: 14, fontFace: FONT.heading, color: st.color, bold: true,
    });
    s.addText(st.price, {
      x: xBase + 0.15, y: 1.95, w: 1.3, h: 0.55,
      fontSize: 28, fontFace: FONT.title, color: C.white, bold: true,
    });
    s.addText(st.unit, {
      x: xBase + 1.35, y: 2.2, w: 0.7, h: 0.3,
      fontSize: 12, fontFace: FONT.body, color: C.gray,
    });
    s.addText(st.desc, {
      x: xBase + 0.15, y: 2.7, w: 1.9, h: 0.9,
      fontSize: 10, fontFace: FONT.body, color: C.grayLt,
    });
  });

  // Bottom: Projected ARPU & Revenue
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.3, y: 4.1, w: 9.4, h: 1.1,
    fill: { color: C.bgCard },
  });

  s.addText([
    { text: "单用户年ARPU \u00A5", options: { fontSize: 11, color: C.gray, fontFace: FONT.body } },
    { text: "280-380", options: { fontSize: 32, color: C.pink, fontFace: FONT.title, bold: true } },
  ], {
    x: 0.5, y: 4.15, w: 3, h: 1.0,
    valign: "middle",
  });

  s.addShape(pres.shapes.LINE, {
    x: 3.6, y: 4.3, w: 0, h: 0.7,
    line: { color: C.darkGray, width: 0.5 },
  });

  s.addText([
    { text: "首年营收目标 \u00A5", options: { fontSize: 11, color: C.gray, fontFace: FONT.body } },
    { text: "500-800万", options: { fontSize: 28, color: C.gold, fontFace: FONT.title, bold: true } },
  ], {
    x: 3.9, y: 4.15, w: 3, h: 1.0,
    valign: "middle",
  });

  s.addShape(pres.shapes.LINE, {
    x: 6.9, y: 4.3, w: 0, h: 0.7,
    line: { color: C.darkGray, width: 0.5 },
  });

  s.addText([
    { text: "获客成本 CAC \u00A5", options: { fontSize: 11, color: C.gray, fontFace: FONT.body } },
    { text: "25-35", options: { fontSize: 28, color: C.green, fontFace: FONT.title, bold: true } },
  ], {
    x: 7.1, y: 4.15, w: 2.5, h: 1.0,
    valign: "middle",
  });
})();

// ═══════════════════════════════════════════
// SLIDE 11 — GO-TO-MARKET
// ═══════════════════════════════════════════
(function() {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addBottomBar(s);
  addPageNum(s, 11);

  s.addText("市场策略 · 冷启到规模", {
    x: 0.6, y: 0.3, w: 8, h: 0.7,
    fontSize: 32, fontFace: FONT.title, color: C.white, bold: true,
  });
  addSectionLine(s, 0.6, 1.0, 2.5);

  // Three phases
  const phases = [
    {
      phase: "Phase 1", time: "M1-M3", title: "种子冷启动",
      items: [
        "\uD83C\uDF0A 小红书种草：100位独居生活KOC",
        "\uD83D\uDCAC 私域社群：微信核心用户群运营",
        "\uD83C\uDFAC 抖音短视频：牙牙日常内容矩阵",
        "\uD83C\uDF81 种子赠品：首批500个体验官",
      ],
      color: C.pink, goal: "目标: 5,000用户",
    },
    {
      phase: "Phase 2", time: "M4-M9", title: "社交裂变",
      items: [
        "\uD83D\uDC91 闺蜜配对：邀请好友解锁双人特权",
        "\uD83D\uDCF1 分享卡片：AI手账一键发朋友圈",
        "\uD83C\uDFB6 声音克隆UGC：录一段牙牙专属问候",
        "\uD83D\uDCE6 实体开箱：小红书拆箱潮引发跟风",
      ],
      color: C.gold, goal: "目标: 50,000用户",
    },
    {
      phase: "Phase 3", time: "M10-M18", title: "品牌破圈",
      items: [
        "\uD83E\uDD1D 品牌联名：潮玩IP×美妆×生活方式",
        "\uD83C\uDFA4 明星合作：女性艺人专属牙牙定制",
        "\uD83C\uDF89 线下快闪：独居女孩的城市疗愈站",
        "\uD83D\uDCFA 综艺植入：独居生活综艺品牌露出",
      ],
      color: C.blue, goal: "目标: 300,000用户",
    },
  ];

  phases.forEach((p, i) => {
    const xBase = 0.3 + i * 3.2;
    // Phase card
    s.addShape(pres.shapes.RECTANGLE, {
      x: xBase, y: 1.3, w: 3.0, h: 3.5,
      fill: { color: C.bgCard },
      shadow: cardShadow(),
    });
    // Phase badge
    s.addShape(pres.shapes.RECTANGLE, {
      x: xBase + 0.2, y: 1.45, w: 1.0, h: 0.32,
      fill: { color: p.color },
    });
    s.addText(p.phase, {
      x: xBase + 0.2, y: 1.45, w: 1.0, h: 0.32,
      fontSize: 10, fontFace: FONT.heading, color: C.bg, bold: true, align: "center", valign: "middle",
    });
    s.addText(p.time, {
      x: xBase + 1.3, y: 1.45, w: 1.5, h: 0.32,
      fontSize: 10, fontFace: FONT.body, color: C.gray, valign: "middle",
    });
    // Title
    s.addText(p.title, {
      x: xBase + 0.2, y: 1.95, w: 2.6, h: 0.35,
      fontSize: 16, fontFace: FONT.heading, color: C.white, bold: true,
    });
    // Items
    s.addText(p.items.map((item, j) => ({
      text: item,
      options: { bullet: true, breakLine: j < p.items.length - 1, fontSize: 10, fontFace: FONT.body, color: C.grayLt, paraSpaceAfter: 5 },
    })), {
      x: xBase + 0.2, y: 2.4, w: 2.6, h: 2.0,
    });
    // Goal
    s.addText(p.goal, {
      x: xBase + 0.2, y: 4.45, w: 2.6, h: 0.25,
      fontSize: 11, fontFace: FONT.heading, color: p.color, bold: true,
    });
  });
})();

// ═══════════════════════════════════════════
// SLIDE 12 — TRACTION (48h Hackathon)
// ═══════════════════════════════════════════
(function() {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addBottomBar(s);
  addPageNum(s, 12);

  s.addText("开发进展 · 48小时黑客松成果", {
    x: 0.6, y: 0.3, w: 8, h: 0.7,
    fontSize: 32, fontFace: FONT.title, color: C.white, bold: true,
  });
  addSectionLine(s, 0.6, 1.0, 2.5);

  // Big metrics - 2 rows x 4 columns
  const bigMetrics = [
    ["154", "Go源文件", C.pink],
    ["31", "微服务模块", C.gold],
    ["144+", "API端点", C.blue],
    ["~20K", "代码行数", C.purple],
    ["21", "数据库表", C.green],
    ["13页", "小程序前端", C.orange],
    ["0", "编译警告", C.green],
    ["48h", "从策划到就绪", C.pink],
  ];

  bigMetrics.forEach((m, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const xM = 0.3 + col * 2.4;
    const yM = 1.3 + row * 1.7;

    s.addShape(pres.shapes.RECTANGLE, {
      x: xM, y: yM, w: 2.2, h: 1.5,
      fill: { color: C.bgCard },
      shadow: subtleShadow(),
    });
    s.addText(m[0], {
      x: xM, y: yM + 0.2, w: 2.2, h: 0.7,
      fontSize: 36, fontFace: FONT.title, color: m[2], bold: true, align: "center", valign: "middle",
    });
    s.addText(m[1], {
      x: xM, y: yM + 0.95, w: 2.2, h: 0.35,
      fontSize: 12, fontFace: FONT.body, color: C.gray, align: "center",
    });
  });

  // Bottom callout
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.3, y: 4.85, w: 9.4, h: 0.4,
    fill: { color: C.pink, transparency: 90 },
  });
  s.addText("\u26A1 2天完成：产品策划 \u2192 架构设计 \u2192 全栈实现 \u2192 AI集成 \u2192 编译就绪 — Go Monorepo·双后端·微信小程序·DeepSeek流式对话", {
    x: 0.5, y: 4.85, w: 9.0, h: 0.4,
    fontSize: 9, fontFace: FONT.body, color: C.pink, valign: "middle",
  });
})();

// ═══════════════════════════════════════════
// SLIDE 13 — ROADMAP
// ═══════════════════════════════════════════
(function() {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addBottomBar(s);
  addPageNum(s, 13);

  s.addText("发展路线图", {
    x: 0.6, y: 0.3, w: 8, h: 0.7,
    fontSize: 32, fontFace: FONT.title, color: C.white, bold: true,
  });
  addSectionLine(s, 0.6, 1.0, 2.5);

  // Timeline line
  s.addShape(pres.shapes.LINE, {
    x: 0.8, y: 2.6, w: 8.4, h: 0,
    line: { color: C.pink, width: 2 },
  });

  // Three milestones
  const milestones = [
    {
      x: 1.2, quarter: "2026 Q3", title: "MVP 内测",
      items: [
        "微信小程序真机测试",
        "核心对话+记忆+日记",
        "300名种子用户体验",
        "硬件原型ESP32联调",
      ],
      color: C.pink,
    },
    {
      x: 4.2, quarter: "2026 Q4", title: "正式发布",
      items: [
        "微信小程序上架",
        "牙牙毛绒首批量产",
        "声音克隆+语音通话",
        "闺蜜配对社交裂变",
      ],
      color: C.gold,
    },
    {
      x: 7.2, quarter: "2027 Q1-Q2", title: "规模化增长",
      items: [
        "灵伴世界3D小游戏",
        "品牌联名×IP合作",
        "AI定制硬件v2.0",
        "日韩/东南亚出海",
      ],
      color: C.blue,
    },
  ];

  milestones.forEach((m) => {
    // Dot on timeline
    s.addShape(pres.shapes.OVAL, {
      x: m.x + 0.85, y: 2.45, w: 0.3, h: 0.3,
      fill: { color: m.color },
    });
    // Quarter badge
    s.addShape(pres.shapes.RECTANGLE, {
      x: m.x, y: 1.5, w: 2.0, h: 0.35,
      fill: { color: m.color },
    });
    s.addText(m.quarter, {
      x: m.x, y: 1.5, w: 2.0, h: 0.35,
      fontSize: 10, fontFace: FONT.heading, color: C.bg, bold: true, align: "center", valign: "middle",
    });
    // Title
    s.addText(m.title, {
      x: m.x, y: 1.95, w: 2.0, h: 0.4,
      fontSize: 14, fontFace: FONT.heading, color: C.white, bold: true,
    });
    // Items
    s.addText(m.items.map((item, j) => ({
      text: item,
      options: { bullet: true, breakLine: j < m.items.length - 1, fontSize: 10, fontFace: FONT.body, color: C.grayLt, paraSpaceAfter: 4 },
    })), {
      x: m.x, y: 3.0, w: 2.0, h: 1.9,
    });
  });
})();

// ═══════════════════════════════════════════
// SLIDE 14 — INVESTMENT ASK
// ═══════════════════════════════════════════
(function() {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addBottomBar(s);
  addPageNum(s, 14);

  s.addText("融资需求 · 天使轮", {
    x: 0.6, y: 0.3, w: 8, h: 0.7,
    fontSize: 32, fontFace: FONT.title, color: C.white, bold: true,
  });
  addSectionLine(s, 0.6, 1.0, 2.5);

  // Big ask
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.3, y: 1.3, w: 4.5, h: 2.2,
    fill: { color: C.bgCard },
    shadow: cardShadow(),
  });
  s.addText("\u00A5 300-500\u4E07", {
    x: 0.3, y: 1.5, w: 4.5, h: 1.0,
    fontSize: 42, fontFace: FONT.title, color: C.pink, bold: true, align: "center", valign: "middle",
  });
  s.addText("天使轮融资 · 出让10-15%", {
    x: 0.3, y: 2.5, w: 4.5, h: 0.4,
    fontSize: 14, fontFace: FONT.heading, color: C.gray, align: "center",
  });
  s.addText("投后估值 3,000-5,000万", {
    x: 0.3, y: 2.85, w: 4.5, h: 0.35,
    fontSize: 12, fontFace: FONT.body, color: C.gold, align: "center",
  });

  // Use of funds
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.2, y: 1.3, w: 4.5, h: 2.2,
    fill: { color: C.bgCard },
    shadow: cardShadow(),
  });
  s.addText("资金用途", {
    x: 5.4, y: 1.4, w: 4.1, h: 0.4,
    fontSize: 16, fontFace: FONT.heading, color: C.white, bold: true,
  });

  const usage = [
    ["\uD83D\uDCBB 研发团队", "40%", C.pink],
    ["\uD83C\uDFA8 硬件开模+量产", "25%", C.gold],
    ["\uD83D\uDCE3 市场推广", "20%", C.blue],
    ["\uD83D\uDCCB 运营+合规", "15%", C.green],
  ];

  usage.forEach((u, i) => {
    const yU = 1.9 + i * 0.38;
    s.addText(u[0], {
      x: 5.4, y: yU, w: 2.0, h: 0.3,
      fontSize: 11, fontFace: FONT.body, color: C.grayLt,
    });
    // Bar
    s.addShape(pres.shapes.RECTANGLE, {
      x: 7.6, y: yU + 0.06, w: 1.9 * (parseInt(u[1]) / 50), h: 0.18,
      fill: { color: u[2] },
    });
    s.addText(u[1], {
      x: 7.6, y: yU, w: 1.9, h: 0.3,
      fontSize: 11, fontFace: FONT.heading, color: u[2], bold: true, align: "right",
    });
  });

  // Milestone targets
  s.addText("本轮达成目标", {
    x: 0.6, y: 3.8, w: 8, h: 0.4,
    fontSize: 16, fontFace: FONT.heading, color: C.white, bold: true,
  });

  const targets = [
    "\u2705 微信小程序正式上架，DAU 3,000+",
    "\u2705 牙牙毛绒玩偶首批量产5,000个，售罄率 > 80%",
    "\u2705 完成付费订阅闭环，月付费率 > 5%",
    "\u2705 用户月留存 > 40%，NPS > 50",
    "\u2705 团队扩展至15人（研发8 + 运营4 + 硬件3）",
  ];

  s.addText(targets.map((t, j) => ({
    text: t,
    options: { bullet: true, breakLine: j < targets.length - 1, fontSize: 11, fontFace: FONT.body, color: C.grayLt, paraSpaceAfter: 4 },
  })), {
    x: 0.45, y: 4.2, w: 9.1, h: 1.1,
  });
})();

// ═══════════════════════════════════════════
// SLIDE 15 — CLOSING
// ═══════════════════════════════════════════
(function() {
  const s = pres.addSlide();
  s.background = { color: C.bg };

  // Atmospheric glow
  s.addShape(pres.shapes.OVAL, {
    x: 1.5, y: 0.5, w: 7, h: 3.5,
    fill: { color: C.pink, transparency: 92 },
  });

  // Main slogan
  s.addText([
    { text: "\u201C", options: { fontSize: 40, color: C.gold, fontFace: "Georgia" } },
    { text: "牙牙在，就不孤单", options: { fontSize: 36, color: C.white, fontFace: "Georgia", italic: true } },
    { text: "\u201D", options: { fontSize: 40, color: C.gold, fontFace: "Georgia" } },
  ], {
    x: 0.5, y: 1.5, w: 9, h: 1.2,
    align: "center", valign: "middle",
  });

  // Subtitle
  s.addText("用AI温暖每一位独居女孩的日常", {
    x: 0.5, y: 2.8, w: 9, h: 0.6,
    fontSize: 18, fontFace: FONT.heading, color: C.pink, align: "center",
    charSpacing: 2,
  });

  // Contact
  s.addText([
    { text: "\uD83D\uDCE7 ", options: {} },
    { text: "hello@lingpal.ai", options: {} },
    { text: "    ", options: {} },
    { text: "\uD83C\uDF10 ", options: {} },
    { text: "github.com/Lukex-Collab/Yaya", options: {} },
    { text: "    ", options: {} },
    { text: "\uD83D\uDCF1 ", options: {} },
    { text: "微信小程序：灵伴", options: {} },
  ], {
    x: 0.5, y: 3.8, w: 9, h: 0.4,
    fontSize: 11, fontFace: FONT.body, color: C.grayLt, align: "center",
  });

  // CTA
  s.addShape(pres.shapes.RECTANGLE, {
    x: 3.5, y: 4.4, w: 3, h: 0.55,
    fill: { color: C.pink },
  });
  s.addText("\uD83E\uDDF8 一起，让牙牙守护更多人", {
    x: 3.5, y: 4.4, w: 3, h: 0.55,
    fontSize: 13, fontFace: FONT.heading, color: C.white, bold: true, align: "center", valign: "middle",
  });

  // Bottom bar
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 5.4, w: 10, h: 0.225,
    fill: { color: C.pink },
  });
})();

// ═══════════════════════════════════════════
// OUTPUT
// ═══════════════════════════════════════════
pres.writeFile({ fileName: "E:/C++/lingpal-platform/Yaya-Roadshow-2026.pptx" })
  .then(() => console.log("DONE: Yaya-Roadshow-2026.pptx"))
  .catch(err => console.error("FAILED:", err));
