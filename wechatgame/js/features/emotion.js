// emotion.js - M4 情绪模块：pet_emotion 状态机 + 随时间衰减
// 输出写 state.pet.emotion / emotionLevel，变化时发 EMOTION_CHANGE 供对话/行为读取。
var features = require('../features');
var bus = require('../events');
var state = require('../state');

function emotionForLevel(level, night) {
  if (night && level < 50) return 'sleepy';
  if (level >= 75) return 'excited';
  if (level >= 55) return 'happy';
  if (level >= 40) return 'calm';
  return 'sad';
}

var mod = {
  id: 'emotion',
  _level: 55,
  _emotion: 'calm',
  _night: false,
  _stopTimer: 0,

  init: function () {
    this._level = 55;
    this._emotion = 'calm';
    this._night = false;
    this._stopTimer = 0;
    bus.on(bus.EVENTS.PET_TAPPED, this._onTapped, this);
    bus.on(bus.EVENTS.TIME_TICK, this._onTime, this);
    bus.on(bus.EVENTS.ZONE_ENTER, this._onZone, this);
    bus.on(bus.EVENTS.PLAYER_STOP, this._onStop, this);
    this._sync();
  },

  dispose: function () {
    bus.off(bus.EVENTS.PET_TAPPED, this._onTapped, this);
    bus.off(bus.EVENTS.TIME_TICK, this._onTime, this);
    bus.off(bus.EVENTS.ZONE_ENTER, this._onZone, this);
    bus.off(bus.EVENTS.PLAYER_STOP, this._onStop, this);
  },

  onWorldReady: function () {},

  onTick: function (dt) {
    this._level -= dt * 0.5;          // 情绪随时间回落
    this._stopTimer -= dt;
    if (!this._night && this._stopTimer < -10) {
      // 玩家长时间静止 -> 情绪向平静回归
      this._level = Math.min(this._level + dt * 0.4, 55);
    }
    this._clamp();
    this._sync();
  },

  _onTapped: function () {
    this._level += 12;
    this._clamp();
    this._sync();
  },

  _onZone: function () {
    this._level += 8;
    this._clamp();
    this._sync();
  },

  _onStop: function () { this._stopTimer = 0; },

  _onTime: function (p) {
    this._night = (p.dayPhase === 'night');
    if (p.dayPhase === 'night') this._level -= 4;   // 夜晚显著拉低 -> 困倦
    if (p.dayPhase === 'dawn') this._level = Math.max(this._level, 55);  // 清晨恢复元气
    this._clamp();
    this._sync();
  },

  _clamp: function () {
    if (this._level < 0) this._level = 0;
    if (this._level > 100) this._level = 100;
  },

  _sync: function () {
    var level = Math.round(this._level);
    var e = emotionForLevel(level, this._night);
    state.pet.emotion = e;
    state.pet.emotionLevel = level;
    if (e !== this._emotion) {
      this._emotion = e;
      bus.emit(bus.EVENTS.EMOTION_CHANGE, { emotion: e, level: level });
    }
  }
};

features.register(mod);
