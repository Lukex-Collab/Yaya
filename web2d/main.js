/* 灵伴世界 · 七小世界（Phaser 3 2D 横卷版，spz 预渲染背景） */

// ---------- 配置 ----------
const CONFIG = {
  ZONE_W: 1920,
  WORLD_H: 1120,
  ORB_PER_ZONE: 2,
  SPEED: 380,
  PET_SCALE: 0.28,
  ORB_MARGIN_X: 350,
  ORB_Y_MIN: 400,
  ORB_Y_RANGE: 500,
  ORB_FLOAT_DIST: 14,
  TRAIL_FREQ: 40,
  JOY_RADIUS: 56,
  TOAST_MS: 2200,
  BUBBLE_MS: 7000,
  HINTS_FADE_MS: 8000,
};

const PET_NAMES = {
  yaya: '牙牙', pangda: '胖达', maotouying: '猫头鹰', long: '龙',
  linghu: '灵狐', jingyu: '鲸鱼', zhangyu: '章鱼', xiongmao: '貔貅',
};
const petId = new URLSearchParams(location.search).get('pet') || 'yaya';
const petName = PET_NAMES[petId] || petId;

// ---------- 灵魂与记忆（ai.js） ----------
const AI = window.YAYA_AI;
const soul = AI.SOULS[petId] || AI.SOULS.yaya;
const mem = AI.Memory;
mem.load(petId);
const nick = localStorage.getItem('petName');
if (nick && !mem.data.name) mem.data.name = nick;

// ---------- 云存档（后端在线时同步） ----------
function deviceId() {
  let d = localStorage.getItem('deviceId');
  if (!d) { d = 'dev_' + Math.random().toString(36).slice(2, 12); localStorage.setItem('deviceId', d); }
  return d;
}
function cloudSave() {
  fetch('/api/save', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device: deviceId(), pet: petId, state: mem.data }),
  }).catch(() => {});
}
fetch(`/api/load?device=${deviceId()}&pet=${petId}`)
  .then(r => r.json())
  .then(d => {
    if (d.ok && d.state && (d.state.intimacy || 0) > (mem.data.intimacy || 0)) {
      mem.data = d.state;
      updateLevelHUD();
    }
  })
  .catch(() => {});

/* bg 与区域的对应关系：肉眼挑图后改这里即可 */
const ZONES = [
  { name: '灵屿', lv: 1, desc: '宠物之家', bg: 'world1_d5' },
  { name: '星砂海滩', lv: 3, desc: '捡贝壳/钓鱼/看日落', bg: 'world2_d5' },
  { name: '迷雾森林', lv: 6, desc: '雨夜有稀有物', bg: 'world3_d5' },
  { name: '回声山谷', lv: 10, desc: '喊话有回音', bg: 'world4_d5' },
  { name: '霜语雪山', lv: 15, desc: '需保暖，有温泉', bg: 'world5_d5' },
  { name: '沉睡遗迹', lv: 20, desc: '拼凑失落文明', bg: 'world6_d5' },
  { name: '云端浮岛', lv: 30, desc: '隐藏区域', bg: 'world1_d9' },
];
const WORLD_W = ZONES.length * CONFIG.ZONE_W;
const ORB_TOTAL = ZONES.length * CONFIG.ORB_PER_ZONE;

const PHRASES = [
  '……想吃浆果了', '今天云好像棉花糖', '主人怎么还不回来（第 3 次叹气）',
  '那边好像有亮亮的东西', '嗷呜~', '这里的风好舒服', '我捡到过一颗会发光的石头！',
  '想去海边看看', '刚刚那只蝴蝶等等我呀', '嗯……接下来去哪呢',
];

// ---------- 状态 ----------
let pet, cursors, wasd, orbs, trail, burst, confetti, petGlow, petShade;
let collected = 0, curZone = -1, toastTimer = 0;
const joy = { active: false, id: null, baseX: 0, baseY: 0, dx: 0, dy: 0 };

const $ = id => document.getElementById(id);

// ---------- HUD ----------
function updateOrbCounter() {
  const el = $('orbs');
  el.textContent =
    `✦ 灵光 ${collected} / ${ORB_TOTAL}` + (collected === ORB_TOTAL ? ' · 集齐啦！' : '');
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}

function pulseScreen() {
  const p = $('pulse');
  p.style.opacity = 0.22;
  clearTimeout(pulseScreen.t);
  pulseScreen.t = setTimeout(() => { p.style.opacity = 0; }, 130);
}

function showToast(html, ms = CONFIG.TOAST_MS, cls = '') {
  const t = $('toast');
  t.innerHTML = html;
  t.className = cls;
  void t.offsetWidth;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('on'); }, ms);
}

function showZoneToast(zi) {
  const z = ZONES[zi];
  showToast(`${z.name}<span class="rule"></span><span class="toast-desc">${z.desc}</span>`);
}

function celebrate(scene) {
  scene.cameras.main.flash(250, 255, 240, 200);
  scene.cameras.main.shake(200, 0.004);
  confetti.explode(70, pet.x, pet.y - 60);
  showToast('七界灵光集齐！<span class="rule"></span><span class="toast-desc">星海因你而亮</span>', 4200, 'gold');
}

// ---------- 气泡（AI 性格生成） ----------
function tickBubble() {
  const b = $('bubble');
  if (b.style.opacity === '1') { b.style.opacity = '0'; return; }
  // 山谷喊话的回忆偶尔回放
  if (mem.data.shout && Math.random() < 0.15) {
    b.textContent = `${soul.cp}山谷让我告诉你：「${mem.data.shout.slice(0, 20)}」`;
  } else {
    b.textContent = AI.genBubble(ZONES[curZone]?.name, soul);
  }
  b.style.opacity = '1';
}

// ---------- 等级 ----------
function updateLevelHUD() {
  $('level').textContent = `Lv.${mem.level} · 亲密 ${mem.data.intimacy}`;
}

// ---------- 成就 ----------
function unlockAwards() {
  const got = AI.checkAchievements(mem);
  if (!got.length) return;
  const names = got.map(a => a.name).join('、');
  showToast(`🏆 解锁成就：${names}<span class="rule"></span><span class="toast-desc">好感又近了一步</span>`, 3600, 'gold');
  const b = $('bubble');
  b.textContent = `${soul.cp}${AI.pick(['我好像变得更厉害了一点！', '你看你看，我有新徽章了！', '嘿嘿，被夸得有点不好意思'])}`;
  b.style.opacity = '1';
  AI.Memory.save(petId);
}

// ---------- 聊天面板 ----------
function addMsg(text, who) {
  const box = $('chatMsgs');
  const div = document.createElement('div');
  div.className = 'msg ' + who;
  div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}
function wireChat() {
  $('btnChat').onclick = () => {
    const c = $('chat');
    c.classList.toggle('open');
    document.body.classList.toggle('chat-open', c.classList.contains('open'));
    if (c.classList.contains('open') && !$('chatMsgs').children.length) {
      addMsg(`${soul.cp}你终于来陪我啦！${AI.pick(soul.emoji)}`, 'pet');
    }
  };
  const send = async () => {
    const inp = $('chatInput');
    const text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    addMsg(text, 'me');
    mem.addIntimacy(1);
    updateLevelHUD();
    const reply = await AI.chatReply(text, soul, mem);
    addMsg(reply, 'pet');
    AI.Memory.save(petId);
    unlockAwards();
  };
  $('chatSend').onclick = send;
  $('chatInput').addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
}

// ---------- 手账面板 ----------
function wireDiary() {
  $('btnDiary').onclick = () => {
    $('diaryTitle').textContent = `${mem.data.name || soul.cn} 的手账`;
    $('diaryBody').textContent = AI.genDiary(soul, mem, mem.data.events.filter(e => e.type === 'play' || e.type === 'dispatch').map(() => ZONES[curZone]?.name));
    const inv = Object.entries(window.YAYA_PLAY.inventory);
    $('diaryInv').innerHTML = inv.length
      ? '🎒 背包：' + inv.map(([k, v]) => `${k} ×${v}`).join('　')
      : '🎒 背包空空如也，去探险收集吧';
    $('diary').classList.add('open');
  };
  $('diaryClose').onclick = () => $('diary').classList.remove('open');
}

// ---------- 派遣 ----------
function wireDispatch() {
  $('btnDispatch').onclick = () => {
    const P = window.YAYA_PLAY;
    if (P.dispatched) { showToast('它已经出门了…'); return; }
    const secs = P.dispatch((story) => {
      pet.setVisible(true);
      trail.emitting = true;
      showToast('它回来啦！', 2600);
      const b = $('bubble');
      b.textContent = `${soul.cp}${story}`;
      b.style.opacity = '1';
      updateLevelHUD();
      unlockAwards();
      AI.Memory.save(petId);
    });
    if (secs) {
      pet.setVisible(false);
      trail.emitting = false;
      showToast(`派它出门探险啦（${secs} 秒后回来）`, 2600);
    }
  };
}

// ---------- 宠物展示 ----------
function wireShowcase() {
  $('btnShow').onclick = () => {
    AI.Memory.save(petId);
    cloudSave();
    location.href = './showcase.html?pet=' + petId;
  };
}

// ---------- 每日签到 / 喂食 ----------
function wireDaily() {
  $('btnCheckin').onclick = () => {
    const P = window.YAYA_PLAY;
    const r = P.checkin();
    if (!r) { showToast('今天已经签到过啦，明天再来'); return; }
    showToast(`✨ 签到成功 · 第 ${r.day} 天<span class="rule"></span><span class="toast-desc">浆果 ×2 · 亲密 +2</span>`, 2600, 'gold');
    updateLevelHUD();
    AI.Memory.save(petId);
    unlockAwards();
  };
  $('btnFeed').onclick = () => {
    const P = window.YAYA_PLAY;
    const r = P.feed();
    if (!r) { showToast('背包里没有浆果，先签到或去探险吧'); return; }
    const b = $('bubble');
    b.textContent = `${soul.cp}${AI.pick(['好吃！浆果甜甜的', '再喂一颗嘛……（星星眼）', '唔姆唔姆……好幸福'])}`;
    b.style.opacity = '1';
    showToast(`🥣 喂食成功 · 亲密 +2<span class="rule"></span><span class="toast-desc">浆果还剩 ${r.berries} 颗</span>`);
    updateLevelHUD();
    AI.Memory.save(petId);
    unlockAwards();
  };
}

// ---------- 图鉴面板（宠物 + 成就） ----------
function renderCodex() {
  const box = $('codexPets');
  box.innerHTML = '';
  for (const [id, s] of Object.entries(AI.SOULS)) {
    const owned = id === petId;
    const t = s.traits;
    const card = document.createElement('div');
    card.className = 'cx-card' + (owned ? ' owned' : '');
    card.innerHTML =
      `<img src="../assets/2d/pets/${id}.png" alt=""><b>${s.cn}</b>` +
      `<span class="cx-tag">${owned ? '⭐ 当前伙伴' : '🔒 未解锁'}</span>` +
      `<small>勇${t.courage} 奇${t.curiosity} 社${t.sociability} 懒${t.laziness} 话${t.talkativeness}</small>` +
      `<i>${s.style}</i>`;
    box.appendChild(card);
  }
  $('codexAch').innerHTML = AI.ACHIEVEMENTS.map(a => {
    const done = mem.data.achievements && mem.data.achievements[a.id];
    return `<div class="cx-ach${done ? ' done' : ''}">${done ? '✓' : '🔒'} ${a.name} · ${a.desc}</div>`;
  }).join('');
}

function wireCodex() {
  $('btnCodex').onclick = () => { renderCodex(); $('codex').classList.add('open'); };
  $('codexClose').onclick = () => $('codex').classList.remove('open');
}

// ---------- 区域互动 ----------
function wireAction(scene) {
  $('btnAction').onclick = () => {
    const P = window.YAYA_PLAY;
    if (!P.action) return;
    const now = Date.now();
    if (P.action.cdUntil && now < P.action.cdUntil) { showToast('休息一下吧…'); return; }
    const result = P.run(P.action.key);
    P.action.cdUntil = now + P.action.spot.cd * 1000;
    showToast(result, 2600);
    updateLevelHUD();
    AI.Memory.save(petId);
    unlockAwards();
  };
}

function checkActionSpot() {
  const P = window.YAYA_PLAY;
  let found = null;
  for (const spot of P.spots(curZone)) {
    if (Math.hypot(pet.x - spot.x, pet.y - spot.y) < 140) { found = spot; break; }
  }
  if (found) {
    P.action = { key: found.key, spot: found, cdUntil: P['cd_' + found.key] || 0 };
    const btn = $('btnAction');
    btn.textContent = found.label;
    btn.style.display = 'flex';
  } else {
    P.action = null;
    $('btnAction').style.display = 'none';
  }
}

function syncBubble(scene) {
  const b = $('bubble');
  if (b.style.opacity !== '1') return;
  const cam = scene.cameras.main;
  b.style.left = (pet.x - cam.scrollX - 30) + 'px';
  b.style.top = (pet.y - cam.scrollY - 130) + 'px';
}

// ---------- 触屏摇杆 ----------
function setupTouch(scene) {
  if (!scene.sys.game.device.input.touch) return;
  const base = $('joy-base'), thumb = $('joy-thumb');
  const isMouse = p =>
    (p.event && p.event.pointerType === 'mouse') || p.pointerType === 'mouse';

  scene.input.on('pointerdown', p => {
    if (joy.active || isMouse(p)) return;
    joy.active = true;
    joy.id = p.id;
    joy.baseX = p.x;
    joy.baseY = p.y;
    joy.dx = joy.dy = 0;
    base.style.left = joy.baseX + 'px';
    base.style.top = joy.baseY + 'px';
    thumb.style.transform = 'translate(-50%,-50%)';
    base.style.opacity = 1;
  });

  scene.input.on('pointermove', p => {
    if (!joy.active || p.id !== joy.id) return;
    let dx = p.x - joy.baseX;
    let dy = p.y - joy.baseY;
    const d = Math.hypot(dx, dy), r = CONFIG.JOY_RADIUS;
    if (d > r) { dx = dx / d * r; dy = dy / d * r; }
    joy.dx = dx / r;
    joy.dy = dy / r;
    thumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  });

  const end = p => {
    if (!joy.active || p.id !== joy.id) return;
    joy.active = false;
    joy.dx = joy.dy = 0;
    base.style.opacity = 0;
  };
  scene.input.on('pointerup', end);
  scene.input.on('pointerupoutside', end);
}

// ---------- 纹理 ----------
function makeTextures(scene) {
  const orb = scene.textures.createCanvas('orb', 64, 64);
  const o = orb.getContext();
  let g = o.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, '#fff7d9'); g.addColorStop(0.35, '#ffd77f'); g.addColorStop(1, 'rgba(255,180,80,0)');
  o.fillStyle = g; o.beginPath(); o.arc(32, 32, 30, 0, 7); o.fill();
  orb.refresh();

  const trailTex = scene.textures.createCanvas('trail', 32, 32);
  const t = trailTex.getContext();
  g = t.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(216,204,255,.95)'); g.addColorStop(1, 'rgba(179,157,255,0)');
  t.fillStyle = g; t.beginPath(); t.arc(16, 16, 16, 0, 7); t.fill();
  trailTex.refresh();

  const spark = scene.textures.createCanvas('spark', 12, 12);
  const s = spark.getContext();
  s.fillStyle = '#ffffff';
  s.beginPath(); s.arc(6, 6, 5, 0, 7); s.fill();
  spark.refresh();

  // 宠物身周柔光
  const glow = scene.textures.createCanvas('glow', 128, 128);
  const gl = glow.getContext();
  g = gl.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,240,214,.9)'); g.addColorStop(0.5, 'rgba(255,224,176,.35)');
  g.addColorStop(1, 'rgba(255,224,176,0)');
  gl.fillStyle = g; gl.beginPath(); gl.arc(64, 64, 62, 0, 7); gl.fill();
  glow.refresh();

  // 宠物投影
  const shade = scene.textures.createCanvas('shade', 128, 128);
  const sh = shade.getContext();
  g = sh.createRadialGradient(64, 64, 2, 64, 64, 60);
  g.addColorStop(0, 'rgba(4,4,20,.5)'); g.addColorStop(1, 'rgba(4,4,20,0)');
  sh.fillStyle = g; sh.beginPath(); sh.arc(64, 64, 60, 0, 7); sh.fill();
  shade.refresh();

  // 灵光球光环
  const halo = scene.textures.createCanvas('halo', 96, 96);
  const h = halo.getContext();
  g = h.createRadialGradient(48, 48, 18, 48, 48, 46);
  g.addColorStop(0, 'rgba(255,215,140,0)'); g.addColorStop(0.62, 'rgba(255,215,140,0)');
  g.addColorStop(0.8, 'rgba(255,221,160,.55)'); g.addColorStop(1, 'rgba(255,215,140,0)');
  h.fillStyle = g; h.beginPath(); h.arc(48, 48, 46, 0, 7); h.fill();
  halo.refresh();
}

// 两层星尘，视差闪烁
function buildStars(scene) {
  const layers = [
    { n: 70, scroll: 0.25, sMin: 0.25, sMax: 0.7, aMax: 0.45 },
    { n: 50, scroll: 0.5, sMin: 0.4, sMax: 1.0, aMax: 0.75 },
  ];
  const tints = [0xffffff, 0xffffff, 0xffe9bd, 0xd9ccff];
  for (const L of layers) {
    for (let i = 0; i < L.n; i++) {
      const s = scene.add.image(
        Math.random() * WORLD_W,
        Math.random() * CONFIG.WORLD_H * 0.8,
        'spark'
      )
        .setScrollFactor(L.scroll)
        .setScale(L.sMin + Math.random() * (L.sMax - L.sMin))
        .setTint(tints[(Math.random() * tints.length) | 0])
        .setAlpha(0)
        .setDepth(1);
      scene.tweens.add({
        targets: s, alpha: 0.15 + Math.random() * L.aMax,
        duration: 1200 + Math.random() * 2400,
        yoyo: true, repeat: -1, delay: Math.random() * 3000, ease: 'Sine.inOut',
      });
    }
  }
}

function buildZone(scene, i) {
  const x0 = i * CONFIG.ZONE_W;
  const z = ZONES[i];

  // spz 预渲染背景
  scene.add.image(x0, 0, 'bg' + i).setOrigin(0).setDisplaySize(CONFIG.ZONE_W, CONFIG.WORLD_H);
  // 底部压暗，保证 HUD/名牌可读
  scene.add.rectangle(x0, CONFIG.WORLD_H - 260, CONFIG.ZONE_W, 260, 0x000000, 0.35)
    .setOrigin(0).setBlendMode(Phaser.BlendModes.MULTIPLY);

  scene.add.text(x0 + CONFIG.ZONE_W / 2, 92, `${z.name} · Lv.${z.lv}`, {
    fontFamily: '"Noto Serif SC", "Songti SC", serif',
    fontSize: '40px', color: '#ffffff', fontStyle: 'bold', letterSpacing: 8,
    stroke: 'rgba(8,8,28,.9)', strokeThickness: 6,
  }).setOrigin(0.5).setAlpha(0.95);
  scene.add.text(x0 + CONFIG.ZONE_W / 2, 148, z.desc, {
    fontFamily: '"Noto Serif SC", "Songti SC", serif',
    fontSize: '17px', color: '#ffe9bd', letterSpacing: 4,
    stroke: 'rgba(8,8,28,.85)', strokeThickness: 4,
  }).setOrigin(0.5).setAlpha(0.72);
}

// ---------- 场景 ----------
function create() {
  const scene = this;
  makeTextures(scene);
  ZONES.forEach((_, i) => buildZone(scene, i));
  buildStars(scene);

  orbs = scene.physics.add.group();
  ZONES.forEach((z, i) => {
    for (let k = 0; k < CONFIG.ORB_PER_ZONE; k++) {
      const o = orbs.create(
        i * CONFIG.ZONE_W + CONFIG.ORB_MARGIN_X +
          Math.random() * (CONFIG.ZONE_W - CONFIG.ORB_MARGIN_X * 2),
        CONFIG.ORB_Y_MIN + Math.random() * CONFIG.ORB_Y_RANGE,
        'orb'
      );
      o.body.setAllowGravity(false);
      o.setDepth(2);
      const halo = scene.add.image(o.x, o.y, 'halo')
        .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.8).setDepth(1);
      o.setData('halo', halo);
      scene.tweens.add({
        targets: [o, halo], y: '-=' + CONFIG.ORB_FLOAT_DIST,
        duration: 1300 + Math.random() * 800,
        yoyo: true, repeat: -1, ease: 'Sine.inOut',
      });
      scene.tweens.add({
        targets: halo, scale: { from: 0.85, to: 1.3 }, alpha: { from: 0.85, to: 0.25 },
        duration: 1500 + Math.random() * 900,
        yoyo: true, repeat: -1, ease: 'Sine.inOut',
      });
    }
  });

  pet = scene.physics.add.sprite(CONFIG.ZONE_W / 2, 700, 'pet');
  pet.setScale(0).setDepth(10);
  pet.body.setAllowGravity(false);
  pet.setCollideWorldBounds(true);

  petShade = scene.add.image(pet.x + 12, pet.y + 18, 'shade')
    .setScale(1.7).setAlpha(0.5).setDepth(9);
  petGlow = scene.add.image(pet.x, pet.y, 'glow')
    .setScale(2.4).setAlpha(0.5).setDepth(9)
    .setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe0b0);
  scene.tweens.add({
    targets: petGlow, alpha: { from: 0.38, to: 0.62 }, scale: { from: 2.3, to: 2.55 },
    duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.inOut',
  });

  // 入场：夜色淡入 + 宠物弹出，之后接呼吸
  scene.cameras.main.fadeIn(500, 7, 7, 24);
  scene.tweens.add({
    targets: pet, scaleX: CONFIG.PET_SCALE, scaleY: CONFIG.PET_SCALE,
    duration: 650, ease: 'Back.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: pet, scaleY: 0.27, scaleX: 0.29, duration: 900,
        yoyo: true, repeat: -1, ease: 'Sine.inOut',
      });
    },
  });

  trail = scene.add.particles(0, 0, 'trail', {
    speed: 12, lifespan: 550, scale: { start: 1.1, end: 0 },
    alpha: { start: 0.8, end: 0 }, frequency: CONFIG.TRAIL_FREQ, blendMode: 'ADD',
  });
  trail.startFollow(pet, 0, 20);

  burst = scene.add.particles(0, 0, 'orb', {
    speed: { min: 90, max: 240 }, lifespan: 450,
    scale: { start: 0.5, end: 0 }, blendMode: 'ADD', emitting: false,
  });
  burst.setDepth(11);

  confetti = scene.add.particles(0, 0, 'spark', {
    speed: { min: 160, max: 430 }, angle: { min: 200, max: 340 },
    gravityY: 520, lifespan: 1400, scale: { start: 1, end: 0.3 },
    tint: [0xffe9bd, 0xd9ccff, 0xffb3d9, 0xb8f0e0], emitting: false,
  });
  confetti.setDepth(12);

  scene.cameras.main.setBounds(0, 0, WORLD_W, CONFIG.WORLD_H);
  scene.cameras.main.startFollow(pet, true, 0.08, 0.08);
  scene.physics.world.setBounds(0, 0, WORLD_W, CONFIG.WORLD_H);

  cursors = scene.input.keyboard.createCursorKeys();
  wasd = scene.input.keyboard.addKeys('W,A,S,D');
  setupTouch(scene);

  scene.physics.add.overlap(pet, orbs, (_, orb) => {
    burst.explode(14, orb.x, orb.y);
    const halo = orb.getData('halo');
    if (halo) halo.destroy();
    orb.destroy();
    collected++;
    mem.addIntimacy(1);
    mem.remember('play', `在${ZONES[curZone]?.name || '世界'}收集到第 ${collected} 颗灵光`);
    mem.data.orbsCollected = Math.max(mem.data.orbsCollected || 0, collected);
    updateOrbCounter();
    updateLevelHUD();
    unlockAwards();
    if (collected === ORB_TOTAL) celebrate(scene);
  });

  scene.time.addEvent({ delay: CONFIG.BUBBLE_MS, loop: true, callback: tickBubble });
  setTimeout(() => { $('hints').style.opacity = 0; }, CONFIG.HINTS_FADE_MS);

  // ---------- 玩法层初始化（play.js） ----------
  const P = window.YAYA_PLAY;
  P.scene = scene; P.pet = pet; P.soul = soul; P.mem = mem; P.zoneW = CONFIG.ZONE_W;
  P.onEvent = () => { updateLevelHUD(); };
  $('weather').textContent = P.rollWeather(scene) === '雨' ? '🌧 雨' : '☀️ 晴';
  wireChat();
  wireDiary();
  wireDispatch();
  wireShowcase();
  wireDaily();
  wireCodex();
  wireAction(scene);
  updateLevelHUD();
  // 定期存档 + 离开存档（本地 + 云端）
  scene.time.addEvent({ delay: 10000, loop: true, callback: () => { AI.Memory.save(petId); cloudSave(); } });
  addEventListener('beforeunload', () => { AI.Memory.save(petId); cloudSave(); });

  // tools/shot.py 截图验证依赖这些全局
  window.__dbg = { petLoaded: true, orbCount: ORB_TOTAL, zoneCount: ZONES.length, petId };
  window.__pet = pet;
  window.__orbs = orbs;
  window.__unlockAwards = unlockAwards;

  document.title = `灵伴世界 · ${petName}`;
  $('title').textContent = `灵伴世界 · ${petName}`;
  updateOrbCounter();
}

function update() {
  if (!pet) return;

  let vx = 0, vy = 0;
  if (joy.active && (joy.dx !== 0 || joy.dy !== 0)) {
    vx = joy.dx;
    vy = joy.dy;
  } else {
    if (cursors.left.isDown || wasd.A.isDown) vx = -1;
    if (cursors.right.isDown || wasd.D.isDown) vx = 1;
    if (cursors.up.isDown || wasd.W.isDown) vy = -1;
    if (cursors.down.isDown || wasd.S.isDown) vy = 1;
    if (vx && vy) { vx *= 0.7071; vy *= 0.7071; }
  }
  const moving = vx !== 0 || vy !== 0;
  pet.setVelocity(vx * CONFIG.SPEED, vy * CONFIG.SPEED);
  trail.emitting = moving;

  if (vx < -0.1) pet.setFlipX(true);
  else if (vx > 0.1) pet.setFlipX(false);
  pet.setAngle(Phaser.Math.Linear(pet.angle, vx !== 0 ? 6 : 0, 0.12));

  // ---------- 区域等级门槛 ----------
  let zi = Phaser.Math.Clamp(Math.floor(pet.x / CONFIG.ZONE_W), 0, ZONES.length - 1);
  const P = window.YAYA_PLAY;
  if (!P.canEnter(zi, ZONES, mem.level)) {
    // 拦在 locked 区边界
    const prevZi = Phaser.Math.Clamp(Math.floor(pet.x / CONFIG.ZONE_W) + (pet.x % CONFIG.ZONE_W < CONFIG.ZONE_W / 2 ? -1 : 1), 0, ZONES.length - 1);
    const enterFromLeft = pet.x < zi * CONFIG.ZONE_W + CONFIG.ZONE_W / 2;
    pet.x = enterFromLeft ? zi * CONFIG.ZONE_W - 60 : (zi + 1) * CONFIG.ZONE_W + 60;
    pet.setVelocityX(0);
    showToast(P.gateText(zi, ZONES).replace('\n', '<br><span class="toast-desc">') + '</span>', 3000);
    zi = curZone;
  }
  if (zi !== curZone) {
    curZone = zi;
    showZoneToast(zi);
    pulseScreen();
    mem.remember('play', `第一次来到了${ZONES[zi].name}`);
  }

  if (pet.x % 1 !== -1) checkActionSpot();

  if (petGlow) {
    petGlow.setPosition(pet.x, pet.y);
    petShade.setPosition(pet.x + 12, pet.y + 18);
    petGlow.setVisible(pet.visible);
    petShade.setVisible(pet.visible);
  }
  syncBubble(this);
}

// ---------- 启动 ----------
(async () => {
  // 等衬线字体就绪（上限 1.5s），避免区域标题退回默认衬线
  try {
    await Promise.race([
      document.fonts.load('700 40px "Noto Serif SC"', '灵屿星海'),
      new Promise(r => setTimeout(r, 1500)),
    ]);
  } catch (e) { /* 字体不可用时用系统衬线兜底 */ }

  new Phaser.Game({
    type: Phaser.AUTO,
    width: innerWidth,
    height: innerHeight,
    parent: document.body,
    banner: false,
    physics: { default: 'arcade', arcade: { debug: false } },
    scene: {
      preload() {
        const pct = $('load-pct');
        this.load.on('progress', v => { pct.textContent = `加载中 ${(v * 100) | 0}%`; });
        this.load.on('complete', () => { $('loading').style.display = 'none'; });
        this.load.image('pet', `../assets/2d/pets/${petId}.png`);
        ZONES.forEach((z, i) => this.load.image('bg' + i, `../assets/2d/worlds/${z.bg}.jpg`));
      },
      create,
      update,
    },
    scale: { mode: Phaser.Scale.RESIZE },
  });
})();
