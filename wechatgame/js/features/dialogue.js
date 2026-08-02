// dialogue.js - M2 对话模块：预制台词 + 气泡 UI
// 触发源：点宠物/交互物/进区域/空闲闲聊/其他模块 DIALOGUE_REQUEST（仪式/交互）
// 选句走 content/engine 条件选择引擎，展示走 state.overlay（TextOverlay）。
var features = require('../features');
var bus = require('../events');
var state = require('../state');
var PACKS = require('../../content/packs');
var engine = require('../../content/engine');

var BUBBLE_DURATION = 3200;      // 气泡停留 ms
var IDLE_MIN = 25, IDLE_MAX = 40;

var mod = {
  id: 'dialogue',
  _count: 0,
  _busy: false,
  _hideTimer: 0,
  _idleTimer: 0,
  _zoneSeen: {},
  _hour: null,

  init: function () {
    bus.on(bus.EVENTS.PET_TAPPED, this._onPetTapped, this);
    bus.on(bus.EVENTS.INTERACT_TRIGGER, this._onInteract, this);
    bus.on(bus.EVENTS.ZONE_ENTER, this._onZoneEnter, this);
    bus.on(bus.EVENTS.DIALOGUE_REQUEST, this._onRequest, this);
    bus.on(bus.EVENTS.TIME_TICK, this._onTime, this);
    this._idleTimer = IDLE_MIN + Math.random() * (IDLE_MAX - IDLE_MIN);
  },

  dispose: function () {
    bus.off(bus.EVENTS.PET_TAPPED, this._onPetTapped, this);
    bus.off(bus.EVENTS.INTERACT_TRIGGER, this._onInteract, this);
    bus.off(bus.EVENTS.ZONE_ENTER, this._onZoneEnter, this);
    bus.off(bus.EVENTS.DIALOGUE_REQUEST, this._onRequest, this);
    bus.off(bus.EVENTS.TIME_TICK, this._onTime, this);
    if (state.overlay) state.overlay.hideBubble();
  },

  onWorldReady: function () {},

  onTick: function (dt) {
    if (this._busy) {
      this._hideTimer -= dt;
      if (this._hideTimer <= 0) this._hide();
    }
    this._idleTimer -= dt;
    if (this._idleTimer <= 0 && !this._busy) {
      this._idleTimer = IDLE_MIN + Math.random() * (IDLE_MAX - IDLE_MIN);
      var pet = state.pet, pl = state.player;
      if (pet && pl) {
        var d = Math.sqrt((pl.x - pet.x) * (pl.x - pet.x) + (pl.z - pet.z) * (pl.z - pet.z));
        if (d < 3) this._request('idle_chat', {});
      }
    }
  },

  _onPetTapped: function () { this._request('pet_tap', {}); },

  _onInteract: function (p) { this._request('interact', { interactType: p.type }); },

  _onTime: function (p) {
    if (p && typeof p.hour === 'number') this._hour = p.hour;
  },

  _onZoneEnter: function (p) {
    if (this._zoneSeen[p.zoneId]) return;
    this._zoneSeen[p.zoneId] = true;
    this._request('zone_first', {});
  },

  _onRequest: function (p) {
    if (!p || !p.trigger) return;
    this._request(p.trigger, p.context || {});
  },

  _request: function (trigger, ctx) {
    if (this._busy) return;  // 气泡显示中，简单限流
    var pet = state.pet, world = state.world, pl = state.player;
    if (!pet || !world || !pl) return;
    var hour = this._hour != null ? this._hour : 12;
    if (this._hour == null) {
      try { hour = new Date().getHours(); } catch (e) {}
    }
    var fullCtx = {
      trigger: trigger,
      emotion: pet.emotion || 'calm',
      hour: hour,
      zone: world.getZone(pl.x, pl.z),
      slots: this._collectSlots()
    };
    for (var k in ctx) fullCtx[k] = ctx[k];

    var r = engine.select(PACKS, pet.speciesId || 'linghu', fullCtx, { seed: 1, count: this._count++ });
    if (!r) return;

    // 锚点：宠物头顶（overlay/cam 不可用时回落顶部居中）
    var x = null, y = null;
    if (state.cam && typeof state.cam.worldToScreen === 'function' && state.W && state.H) {
      var sp = state.cam.worldToScreen(pet.x, world.heightAt(pet.x, pet.z) + 1.6, pet.z, state.W, state.H);
      if (sp) { x = sp.x; y = sp.y - 36; }
    }

    bus.emit(bus.EVENTS.DIALOGUE_SHOW, {
      text: r.text, emo: r.emo, lineId: r.lineId, duration: BUBBLE_DURATION
    });
    this._busy = true;
    if (state.overlay) {
      state.overlay.showBubble(r.text, { emo: r.emo, x: x, y: y, duration: BUBBLE_DURATION });
      this._hideTimer = BUBBLE_DURATION / 1000;
    } else {
      this._hideTimer = 0.2;  // 无覆盖层（stub/不可用）：事件已发，短忙模拟
    }
  },

  _hide: function () {
    this._busy = false;
    if (state.overlay) state.overlay.hideBubble();
    bus.emit(bus.EVENTS.DIALOGUE_HIDE, undefined);
  },

  // 记忆槽位（M5）合并进选句上下文；模块未启用时为空
  _collectSlots: function () {
    var slots = {};
    var mem = features.getModule('memory');
    if (mem && typeof mem.getSlots === 'function') {
      var s = mem.getSlots();
      for (var k in s) {
        if (Object.prototype.hasOwnProperty.call(s, k)) slots[k] = s[k];
      }
    }
    return slots;
  }
};

features.register(mod);
