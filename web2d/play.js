/* 玩法层：区域互动点 + 天气 + 派遣 + 背包 + 等级门槛
 * 依赖 window.YAYA_AI（ai.js），由 main.js 驱动 */

const Play = {
  scene: null, pet: null, soul: null, mem: null,
  zoneW: 1920,
  inventory: {},
  weather: '晴',
  dispatched: false,
  dispatchSecs: 15,      // demo 派遣时长（秒），测试可改小
  action: null,          // 当前可用互动 {label, run}
  onEvent: null,         // (text, intimacyGain) => void 记录事件/加亲密

  // ---------- 各区域互动点 ----------
  spots(zoneIdx) {
    const x0 = zoneIdx * this.zoneW;
    const S = {
      1: [{ key: 'fish', x: x0 + 1000, y: 950, label: '🎣 钓鱼', cd: 20 }],
      2: [{ key: 'rare', x: x0 + 600, y: 800, label: '🌧 听雨', cd: 30 }],
      3: [{ key: 'shout', x: x0 + 960, y: 700, label: '📣 喊话', cd: 10 }],
      4: [{ key: 'spring', x: x0 + 900, y: 980, label: '♨️ 泡温泉', cd: 25 }],
      5: [{ key: 'relic', x: x0 + 700, y: 850, label: '🏺 挖掘', cd: 25 }],
      6: [{ key: 'star', x: x0 + 960, y: 500, label: '✨ 摘星尘', cd: 40 }],
    };
    return S[zoneIdx] || [];
  },

  // ---------- 互动执行 ----------
  run(key) {
    const M = this.mem, soul = this.soul;
    const emit = (text, inti = 2, item = null) => {
      if (item) this.inventory[item] = (this.inventory[item] || 0) + 1;
      M.remember('play', text);
      M.addIntimacy(inti);
      this.onEvent && this.onEvent(text, inti);
    };
    const R = (arr) => arr[(Math.random() * arr.length) | 0];
    switch (key) {
      case 'fish': {
        const got = R([['一条银光闪闪的小鱼', '银鱼'], ['一颗圆润的珍珠', '珍珠'], ['一只花纹贝壳', '贝壳'], ['一只旧靴子……它扔回去了', null]]);
        if (got[1]) emit(`在星砂海滩钓到了${got[0]}，开心得不行`, 3, got[1]);
        else emit('在海边钓了半天，只钓到一只旧靴子，有点沮丧', 1);
        return got[1] ? `钓到${got[0]}！` : '钓到一只旧靴子……';
      }
      case 'rare':
        if (this.weather === '雨') { emit('在雨夜的森林里找到了发光的月光石', 4, '月光石'); return '雨夜限定 · 月光石 ✓'; }
        emit('在迷雾森林听了一会儿雨前奏，很安心', 1); return '现在没下雨……听说雨夜会有发光的石头';
      case 'shout': {
        const said = prompt('对着山谷喊一句话吧（它会记住的）');
        if (said) { M.data.shout = said; emit(`在回声山谷听见你喊「${said.slice(0, 12)}」，山谷记住了`, 3); return `山谷记住了：「${said.slice(0, 16)}」`; }
        return '你张了张嘴，又闭上了';
      }
      case 'spring':
        emit('在霜语雪山的温泉里泡得暖乎乎的，都不想走了', 3);
        return '暖洋洋……亲密 +3';
      case 'relic': {
        const n = (this.inventory['文物碎片'] || 0);
        if (n >= 2) { emit('在沉睡遗迹拼合出一件完整的远古文物！', 6, '远古文物'); this.inventory['文物碎片'] = 0; return '拼合成功 · 远古文物 ✓'; }
        emit('在沉睡遗迹挖到一块刻着花纹的碎片', 2, '文物碎片');
        return `挖到文物碎片（${n + 1}/3）`;
      }
      case 'star':
        emit('在云端浮岛摘到一把闪闪的星尘', 5, '星尘');
        return '摘到星尘 ✨ 亲密 +5';
    }
  },

  // ---------- 天气（每次进入随机，雨夜森林有彩蛋） ----------
  rollWeather(scene) {
    this.weather = Math.random() < 0.35 ? '雨' : '晴';
    if (this.weather === '雨') {
      this.rainParticles = scene.add.particles(0, 0, 'trail', {
        speedY: { min: 500, max: 700 }, speedX: -60, lifespan: 1600,
        scale: { start: 0.8, end: 0.4 }, alpha: 0.35, tint: 0x9fd0ff,
        frequency: 25, emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(0, -40, 99999, 40) },
      }).setDepth(20);
    }
    return this.weather;
  },

  // ---------- 派遣模式 ----------
  dispatch(done) {
    if (this.dispatched) return null;
    this.dispatched = true;
    const secs = this.dispatchSecs || 15;
    const places = ['星砂海滩', '迷雾森林', '回声山谷', '霜语雪山', '沉睡遗迹'];
    const place = R2(places);
    const finds = ['一颗会发光的石头', '半张奇怪的地图', '一朵星星形状的花', '一枚温热的蛋形石子', '一根漂亮的羽毛'];
    const find = R2(finds);
    setTimeout(() => {
      this.dispatched = false;
      this.mem.data.dispatchCount = (this.mem.data.dispatchCount || 0) + 1;
      this.inventory['纪念品'] = (this.inventory['纪念品'] || 0) + 1;
      const story = `它独自去了${place}，带回了${find}，还想跟你讲一路上的冒险`;
      this.mem.remember('dispatch', story);
      this.mem.addIntimacy(3);
      done(story);
    }, secs * 1000);
    function R2(a) { return a[(Math.random() * a.length) | 0]; }
    return secs;
  },

  // ---------- 每日签到 ----------
  checkin() {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (this.mem.data.lastCheckin === today) return null;
    this.mem.data.lastCheckin = today;
    this.mem.data.checkinDays = (this.mem.data.checkinDays || 0) + 1;
    this.inventory['浆果'] = (this.inventory['浆果'] || 0) + 2;
    this.mem.addIntimacy(2);
    this.mem.remember('play', `完成第 ${this.mem.data.checkinDays} 天签到，领到 2 颗浆果`);
    return { berries: this.inventory['浆果'], day: this.mem.data.checkinDays };
  },

  // ---------- 喂食 ----------
  feed() {
    if ((this.inventory['浆果'] || 0) < 1) return null;
    this.inventory['浆果']--;
    this.mem.data.feedCount = (this.mem.data.feedCount || 0) + 1;
    this.mem.addIntimacy(2);
    this.mem.remember('play', '喂了一颗浆果给它，它眼睛都亮了');
    return { berries: this.inventory['浆果'], intimacy: this.mem.data.intimacy };
  },

  // ---------- 等级门槛 ----------
  gateText(zoneIdx, ZONES) {
    const need = ZONES[zoneIdx].lv;
    return `「${ZONES[zoneIdx].name}」需要亲密 Lv.${need}\n多和它互动、收集灵光来提升吧`;
  },
  canEnter(zoneIdx, ZONES, level) { return level >= ZONES[zoneIdx].lv; },
};

window.YAYA_PLAY = Play;
