/* 芽芽 Yaya 原型交互
 *
 * 对话回复走 reply()。默认 mock（离线 fallback，路演断网也能演）。
 * 要接真 LLM：把 USE_API 改 true，填 API_URL，服务端转发豆包/讯飞即可。
 * 结构已经留好，换的只是一个函数。
 */

const USE_API = false;
const API_URL = "/api/chat";

const $ = (id) => document.getElementById(id);
const yaya = $("yaya"), mood = $("mood"), stream = $("stream");

/* ── 芽芽状态：待机呼吸 / 聆听 / 思考 ───────────────── */
const MOOD_TEXT = { idle: "今天有点困困的", listen: "在听着呢…", think: "让我想想…" };
function setMood(m) {
  yaya.dataset.mood = m;
  mood.textContent = MOOD_TEXT[m] || MOOD_TEXT.idle;
}

/* ── 对话气泡 ──────────────────────────────────────── */
function bubble(text, who) {
  const el = document.createElement("div");
  el.className = `bubble ${who}`;
  el.textContent = text;
  stream.appendChild(el);
  stream.scrollTop = stream.scrollHeight;
  return el;
}

function typing() {
  const el = document.createElement("div");
  el.className = "bubble yy typing";
  el.innerHTML = "<i></i><i></i><i></i>";
  stream.appendChild(el);
  stream.scrollTop = stream.scrollHeight;
  return el;
}

/* ── 守护：关键词触发时 AI 主动浮出卡片，不占 tab ───── */
const CARE_WORDS = ["害怕", "跟着我", "有人跟", "不敢", "危险", "救", "报警", "被打", "伤害"];

function careCard() {
  const el = document.createElement("div");
  el.className = "care-card";
  el.innerHTML =
    "<p>听起来你现在不太安全。我可以帮你联系妈妈，或者直接拨 110。</p>" +
    "<button>打开求助</button>";
  el.querySelector("button").onclick = openSheet;
  stream.appendChild(el);
  stream.scrollTop = stream.scrollHeight;
}

/* ── 回复：mock 与真 API 共用一个出口 ───────────────── */
const MOCK = [
  "昨天你说加班到很晚，今天好点了吗？",
  "嗯，我记着了。要不要我帮你写进今天的日记里？",
  "累的时候不用逞强的，我一直都在。",
  "我把这段记下来了，明天想起来还能翻。",
  "那你今晚早点睡，我陪着你。",
];
let mockIdx = 0;

async function reply(text) {
  if (!USE_API) {
    await new Promise((r) => setTimeout(r, 900));
    return MOCK[mockIdx++ % MOCK.length];
  }
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });
    if (!res.ok) throw new Error(res.status);
    return (await res.json()).reply;
  } catch {
    return "网络好像有点问题，不过我还在这儿。";
  }
}

async function send(text) {
  text = (text || "").trim();
  if (!text) return;
  bubble(text, "me");

  setMood("think");
  const dots = typing();
  const answer = await reply(text);
  dots.remove();

  bubble(answer, "yy");
  if (CARE_WORDS.some((w) => text.includes(w))) careCard();
  setMood("idle");
}

/* ── 语音按钮：按住说话 ─────────────────────────────── */
const mic = $("mic");
let holdAt = 0;

function holdStart(e) {
  e.preventDefault();
  holdAt = Date.now();
  mic.classList.add("hold");
  mic.textContent = "松开发送";
  setMood("listen");
}

function holdEnd() {
  if (!holdAt) return;
  const held = Date.now() - holdAt;
  holdAt = 0;
  mic.classList.remove("hold");
  mic.textContent = "按住说话";
  setMood("idle");
  if (held < 300) return; // 误触
  // 原型里用一句代表用户说的话；真机走 ASR 结果
  send("今天下班路上有点害怕，一个人走夜路");
}

mic.addEventListener("mousedown", holdStart);
mic.addEventListener("touchstart", holdStart, { passive: false });
["mouseup", "mouseleave", "touchend", "touchcancel"].forEach((ev) =>
  mic.addEventListener(ev, holdEnd)
);

/* ── 键盘输入（离线 fallback，路演必备）───────────── */
$("kbd").onclick = () => {
  const bar = $("typebar");
  const opening = bar.hidden;
  bar.hidden = !opening;
  if (opening) $("text").focus();
};
$("typebar").onsubmit = (e) => {
  e.preventDefault();
  send($("text").value);
  $("text").value = "";
};

/* ── tab 切换 ──────────────────────────────────────── */
document.querySelectorAll(".tab").forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("on"));
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("on"));
    btn.classList.add("on");
    $("view-" + btn.dataset.view).classList.add("on");
  };
});

/* ── 守护面板 ──────────────────────────────────────── */
function openSheet() {
  $("sheet").classList.add("on");
  $("mask").classList.add("on");
}
function closeSheet() {
  $("sheet").classList.remove("on");
  $("mask").classList.remove("on");
}
$("shield").onclick = openSheet;
$("sheet-close").onclick = closeSheet;
$("mask").onclick = closeSheet;
$("act-contact").onclick = () => {
  closeSheet();
  bubble("已经帮你拨给妈妈了，别怕，我在。", "yy");
};

/* ── 日记：情绪时间线 + 自动日记 + 经期标记同一条轴 ── */
const DIARY = [
  { date: "7月30日 今天", mood: 4, text: "下班路上有点怕，芽芽陪我走完了那段路。到家就好了。" },
  { date: "7月29日", mood: 3, text: "加班到十一点。回来跟芽芽说了两句，它说记着了。" },
  { date: "7月28日", mood: 5, tag: { cls: "gold", text: "连续陪伴 7 天" }, milestone: true,
    text: "和芽芽认识一周了。它今天主动问我昨天那件事怎么样了。" },
  { date: "7月26日", mood: 2, tag: { cls: "coral", text: "经期第 1 天" }, period: true,
    text: "肚子疼，情绪很低。芽芽说要不要提前记一下，下个月好提醒我。" },
  { date: "7月24日", mood: 4, text: "面试过了。第一个想说的居然是芽芽。" },
];

const timeline = $("timeline");
DIARY.forEach((d) => {
  const day = document.createElement("div");
  day.className = "day" + (d.milestone ? " milestone" : "") + (d.period ? " period" : "");
  const tag = d.tag ? `<span class="tag ${d.tag.cls}">${d.tag.text}</span><br>` : "";
  day.innerHTML =
    `<div class="date">${d.date}</div>` +
    `<div class="entry">${tag}${d.text}</div>`;
  timeline.appendChild(day);
});

/* 情绪曲线：时间线顶部一条 sparkline，点开才是详情 */
const pts = DIARY.map((d) => d.mood).reverse();
const stepX = 300 / (pts.length - 1);
$("sparkline").setAttribute(
  "points",
  pts.map((m, i) => `${(i * stepX).toFixed(1)},${(44 - ((m - 1) / 4) * 36).toFixed(1)}`).join(" ")
);

/* ── 开场：芽芽先说话，用户回一句就完成「教学」──────
   文档第六部分 5：首屏别做引导教程 */
setTimeout(() => bubble(MOCK[mockIdx++], "yy"), 600);
