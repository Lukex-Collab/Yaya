// behavior.js - M1 行为模块：宠物状态机（follow/idle/sniff/sleep/explore）+ trait 参数化
// init() 置 state.pet.ai = true 后，game.js 跳过内置宠物 AI，改由本模块 onTick 驱动。
var features = require('../features');
var bus = require('../events');
var state = require('../state');
var SPECIES = require('../../content/species');

// trait 标签 -> 行为权重/速度修正（乘积叠加，默认 1）
var TRAIT_PARAMS = {
  lazy:      { idleW: 2.2, sniffW: 0.6,  exploreW: 0.3, speedMul: 0.75 },
  curious:   { idleW: 0.6, sniffW: 1.8,  exploreW: 1.8, speedMul: 1.0 },
  playful:   { idleW: 0.8, sniffW: 1.4,  exploreW: 1.4, speedMul: 1.05 },
  energetic: { idleW: 0.4, sniffW: 1.2,  exploreW: 1.6, speedMul: 1.2 },
  calm:      { idleW: 1.6, sniffW: 0.7,  exploreW: 0.5, speedMul: 0.9 },
  brave:     { idleW: 0.9, sniffW: 1.0,  exploreW: 1.4, speedMul: 1.05 },
  gentle:    { idleW: 1.4, sniffW: 1.1,  exploreW: 0.8, speedMul: 0.95 },
  clever:    { idleW: 1.0, sniffW: 1.3,  exploreW: 1.3, speedMul: 1.0 }
};
var BASE = { idleW: 1, sniffW: 1, exploreW: 1, speedMul: 1 };

function paramsFor(speciesId) {
  var sp = null;
  for (var i = 0; i < SPECIES.length; i++) {
    if (SPECIES[i].id === speciesId) { sp = SPECIES[i]; break; }
  }
  if (!sp) return BASE;
  var p = { idleW: 1, sniffW: 1, exploreW: 1, speedMul: 1 };
  for (var t = 0; t < sp.traits.length; t++) {
    var tp = TRAIT_PARAMS[sp.traits[t]];
    if (!tp) continue;
    p.idleW *= tp.idleW;
    p.sniffW *= tp.sniffW;
    p.exploreW *= tp.exploreW;
    p.speedMul *= tp.speedMul;
  }
  return p;
}

var mod = {
  id: 'behavior',
  _params: BASE,
  _timer: 0,
  _night: false,
  _woke: false,
  _sniffTarget: null,
  _exploreTarget: null,
  _emotion: 'calm',

  init: function () {
    state.pet.ai = true;
    bus.on(bus.EVENTS.TIME_TICK, this._onTime, this);
    bus.on(bus.EVENTS.PET_TAPPED, this._onTapped, this);
    bus.on(bus.EVENTS.EMOTION_CHANGE, this._onEmotion, this);
    bus.on(bus.EVENTS.VOICE_COMMAND, this._onVoice, this);
    this._params = paramsFor(state.pet.speciesId);
  },

  dispose: function () {
    bus.off(bus.EVENTS.TIME_TICK, this._onTime, this);
    bus.off(bus.EVENTS.PET_TAPPED, this._onTapped, this);
    bus.off(bus.EVENTS.EMOTION_CHANGE, this._onEmotion, this);
    bus.off(bus.EVENTS.VOICE_COMMAND, this._onVoice, this);
    state.pet.ai = false;
  },

  onWorldReady: function () {},

  _onTime: function (p) { this._night = (p.dayPhase === 'night'); },

  _onTapped: function () {
    this._woke = true;
    this._timer = Math.min(this._timer, 1);
  },

  _onEmotion: function (p) { this._emotion = p.emotion; },

  // 语音指令（M3，flag 关闭时也预留通道）：映射到行为状态/目标
  _onVoice: function (cmd) {
    if (!cmd || !cmd.intent) return;
    this._woke = true;
    switch (cmd.intent) {
      case 'follow_me':
        this._setState('follow');
        break;
      case 'sit':
        this._sitUntil = (this._sitUntil || 0) + 4;  // 坐 4 秒
        this._setState('idle');
        break;
      case 'come_here':
        this._exploreTarget = { x: state.player.x, z: state.player.z };
        this._setState('explore');
        break;
      case 'go_home':
        this._exploreTarget = { x: 0, z: 0 };
        this._setState('explore');
        break;
      case 'be_happy':
        this._timer = Math.min(this._timer, 0.5);
        this._setState('idle');
        break;
      case 'be_quiet':
        this._setState('idle');
        break;
    }
  },

  _setState: function (s) {
    if (state.pet.state === s) return;
    state.pet.state = s;
    bus.emit(bus.EVENTS.PET_STATE_CHANGE, { state: s });
  },

  onTick: function (dt) {
    var pet = state.pet, pl = state.player, world = state.world;
    if (!pet || !pl || !world) return;
    this._timer -= dt;
    var dx = pl.x - pet.x, dz = pl.z - pet.z;
    var dist = Math.sqrt(dx * dx + dz * dz);
    var p = this._params;
    var cur = pet.state || 'follow';

    // ---- 行为决策 ----
    var want;
    if (cur === 'sleep') {
      want = (this._woke || dist > 4) ? 'follow' : 'sleep';
      if (want === 'follow') this._woke = false;
    } else if (dist > 2.2) {
      want = 'follow';
    } else if (!(this._sitUntil && this._sitUntil > 0) && this._night && (this._emotion === 'sleepy' || Math.random() < 0.25)) {
      want = 'sleep';
    } else if (this._timer <= 0) {
      var r = Math.random() * (p.idleW + p.sniffW + p.exploreW);
      if (r < p.idleW) want = 'idle';
      else if (r < p.idleW + p.sniffW) want = 'sniff';
      else want = 'explore';
      this._timer = 2 + Math.random() * 4;
    } else {
      want = cur === 'sniff' || cur === 'explore' || cur === 'idle' ? cur : 'idle';
    }
    if (this._sitUntil && this._sitUntil > 0) {
      this._sitUntil -= dt;
      want = 'idle';  // 指令"坐下"期间保持待机姿态
    }
    if (want !== cur) this._setState(want);

    // ---- 移动 ----
    var mvx = 0, mvz = 0, speed = 2.6 * p.speedMul;
    if (want === 'follow' && dist > 2.2) {
      mvx = dx / dist; mvz = dz / dist;
    } else if (want === 'sniff') {
      if (!this._sniffTarget) this._sniffTarget = this._randomNear(pet, 1.6);
      var sdx = this._sniffTarget.x - pet.x, sdz = this._sniffTarget.z - pet.z;
      var sd = Math.sqrt(sdx * sdx + sdz * sdz);
      if (sd > 0.35) { mvx = sdx / sd; mvz = sdz / sd; speed *= 0.6; }
      else this._sniffTarget = null;
    } else if (want === 'explore') {
      if (!this._exploreTarget) this._exploreTarget = this._randomFree(pet, 3 + Math.random() * 4);
      if (this._exploreTarget) {
        var edx = this._exploreTarget.x - pet.x, edz = this._exploreTarget.z - pet.z;
        var ed = Math.sqrt(edx * edx + edz * edz);
        if (ed > 0.4) { mvx = edx / ed; mvz = edz / ed; speed *= 0.75; }
        else this._exploreTarget = null;
      }
    }

    if (mvx || mvz) {
      var step = speed * dt;
      var nx = pet.x + mvx * step, nz = pet.z + mvz * step;
      if (!world.isBlocked(Math.round(nx), Math.round(nz))) { pet.x = nx; pet.z = nz; }
      else if (!world.isBlocked(Math.round(nx), Math.round(pet.z))) pet.x = nx;
      else if (!world.isBlocked(Math.round(pet.x), Math.round(nz))) pet.z = nz;
      pet.rot = Math.atan2(mvx, mvz);
      pet.scaleY = 1;
      pet.heightOff = 0;
    } else {
      if (want === 'sleep') { pet.scaleY = 0.55; pet.heightOff = -0.15; }
      else { pet.scaleY = 1; pet.heightOff = 0; }
    }

    // 世界半径钳制
    var lr = Math.sqrt(pet.x * pet.x + pet.z * pet.z);
    if (lr > world.worldHalf - 2) {
      var sc = (world.worldHalf - 2) / lr;
      pet.x *= sc;
      pet.z *= sc;
    }
  },

  _randomNear: function (pet, r) {
    return { x: pet.x + (Math.random() - 0.5) * r * 2, z: pet.z + (Math.random() - 0.5) * r * 2 };
  },

  _randomFree: function (pet, r) {
    var world = state.world;
    for (var i = 0; i < 12; i++) {
      var ang = Math.random() * Math.PI * 2;
      var rr = r * (0.5 + Math.random() * 0.5);
      var x = pet.x + Math.cos(ang) * rr, z = pet.z + Math.sin(ang) * rr;
      if (!world.isBlocked(Math.round(x), Math.round(z))) return { x: x, z: z };
    }
    return null;
  }
};

features.register(mod);
