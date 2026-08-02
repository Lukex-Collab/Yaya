// ritual.js - M6 仪式模块（本地版）：每日首次问候 + 早安/晚安调度
// 只负责发 DIALOGUE_REQUEST，台词与展示由对话模块处理。
var features = require('../features');
var bus = require('../events');

function todayKey() {
  var d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

var mod = {
  id: 'ritual',
  _day: '',
  _sent: {},

  init: function () {
    this._day = todayKey();
    this._sent = {};
    bus.on(bus.EVENTS.TIME_TICK, this._onTime, this);
    bus.on(bus.EVENTS.WORLD_READY, this._onReady, this);
  },

  dispose: function () {
    bus.off(bus.EVENTS.TIME_TICK, this._onTime, this);
    bus.off(bus.EVENTS.WORLD_READY, this._onReady, this);
  },

  onWorldReady: function () {},
  onTick: function () {},

  _onReady: function () {
    this._day = todayKey();
    var self = this;
    setTimeout(function () {
      self._fire(self._day, 'greet_return');
    }, 800);
  },

  _onTime: function (p) {
    var dk = todayKey();
    if (dk !== this._day) {
      // 跨天：重置去重
      this._day = dk;
      this._sent = {};
    }
    var h = p.hour;
    if (h >= 6 && h <= 9) this._fire(dk, 'morning_greeting');
    if (h >= 20 && h <= 23) this._fire(dk, 'night_greeting');
  },

  _fire: function (dk, trigger) {
    var key = dk + ':' + trigger;
    if (this._sent[key]) return;
    this._sent[key] = true;
    bus.emit(bus.EVENTS.DIALOGUE_REQUEST, { speaker: 'pet', trigger: trigger, context: {} });
  }
};

features.register(mod);
