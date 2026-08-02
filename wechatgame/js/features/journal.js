// journal.js - M8 手账模块（本地版）：事件日志 -> 每日小记（wx 存储）
// 记录：首次进入的区域、当天对话台词数；跨天时归档昨日并生成一句小记。
var features = require('../features');
var bus = require('../events');
var state = require('../state');

var STORAGE_KEY = 'lingpal_journal';

var ZONE_NAMES = {
  HUB: '灵屿村', 'Z-N': '云杉林', 'Z-E': '花语原', 'Z-SE': '萤火沼',
  'Z-S': '月影丘', 'Z-W': '暮光谷', 'Z-NW': '星砂滩', SEA: '海边'
};

function storage() {
  try {
    if (typeof wx !== 'undefined' && wx.getStorageSync && wx.setStorageSync) return wx;
  } catch (e) {}
  return null;
}

function zoneName(id) { return ZONE_NAMES[id] || id; }

// 生成每日小记文案（确定性，供测试与展示）
function buildEntryText(day, zones, lines) {
  var parts = [];
  if (zones && zones.length) parts.push('去了' + zones.map(zoneName).join('、'));
  if (lines) parts.push('聊了' + lines + '句话');
  if (!parts.length) parts.push('在家休息');
  return '第' + day + '天：' + parts.join('，') + '。';
}

var mod = {
  id: 'journal',
  _day: '',
  _zones: [],
  _lines: 0,
  _entries: {},
  _welcomeDone: false,

  init: function () {
    this._day = this._todayKey();
    this._entries = this._loadEntries();
    bus.on(bus.EVENTS.ZONE_ENTER, this._onZone, this);
    bus.on(bus.EVENTS.DIALOGUE_SHOW, this._onDialogue, this);
    bus.on(bus.EVENTS.WORLD_READY, this._onReady, this);
  },

  dispose: function () {
    bus.off(bus.EVENTS.ZONE_ENTER, this._onZone, this);
    bus.off(bus.EVENTS.DIALOGUE_SHOW, this._onDialogue, this);
    bus.off(bus.EVENTS.WORLD_READY, this._onReady, this);
    this._save();
  },

  onWorldReady: function () {},
  onTick: function () {},

  // ---- 测试/查询钩子 ----
  getEntries: function () { return this._entries; },
  buildEntryText: buildEntryText,

  _onZone: function (p) {
    if (!p || !p.zoneId) return;
    if (this._zones.indexOf(p.zoneId) < 0) this._zones.push(p.zoneId);
  },

  _onDialogue: function () { this._lines++; },

  _onReady: function () {
    var dk = this._todayKey();
    if (dk !== this._day) {
      // 跨天：归档昨日
      this._archive(this._day);
      this._day = dk;
      this._zones = [];
      this._lines = 0;
    }
    if (!this._welcomeDone) {
      this._welcomeDone = true;
      var prev = this._entries[this._yesterdayKey(dk)];
      var text = prev && prev.text ? '昨日手账：' + prev.text : null;
      if (text && state.overlay) state.overlay.showTip(text, 3200);
    }
  },

  _archive: function (day) {
    if (!day) return;
    var entry = {
      zones: this._zones.slice(),
      lines: this._lines,
      text: buildEntryText(this._dayNum(day), this._zones, this._lines)
    };
    this._entries[day] = entry;
    this._save();
  },

  _loadEntries: function () {
    var st = storage();
    var raw = null;
    if (st) {
      try { raw = st.getStorageSync(STORAGE_KEY); } catch (e) {}
    }
    if (raw && typeof raw === 'string') {
      try { return JSON.parse(raw) || {}; } catch (e) {}
    }
    return {};
  },

  _save: function () {
    var st = storage();
    if (!st) return;
    try { st.setStorageSync(STORAGE_KEY, JSON.stringify(this._entries)); } catch (e) {}
  },

  _today: function () { return new Date(); },

  _todayKey: function () {
    var d = this._today();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  },

  _yesterdayKey: function (dk) {
    var parts = dk.split('-').map(Number);
    var d = new Date(parts[0], parts[1] - 1, parts[2] - 1);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  },

  _dayNum: function (dk) {
    var parts = dk.split('-').map(Number);
    return Math.floor((new Date(parts[0], parts[1] - 1, parts[2]).getTime() - new Date(2026, 6, 1).getTime()) / 86400000) + 1;
  }
};

features.register(mod);
