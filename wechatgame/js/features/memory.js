// memory.js - M5 记忆模块：结构化槽位 + wx 存储持久化（预制模式的"记忆"）
// 槽位供对话引擎的 has_slot / {slot} 模板使用；敏感信息不上槽（写入侧规则见 _guard）。
var features = require('../features');
var bus = require('../events');

var STORAGE_KEY = 'lingpal_memory';

var DEFAULT_SLOTS = {
  name: '小伴',
  favorite: '亮晶晶的小石头',
  place: '灵屿村',
  met_day: 1
};

function storage() {
  try {
    if (typeof wx !== 'undefined' && wx.getStorageSync && wx.setStorageSync) return wx;
  } catch (e) {}
  return null;
}

// 简单敏感信息拦截：不存联系方式/证件/地址类内容
function guardValue(v) {
  if (/1[3-9]\d{9}|身份证|密码|住址|电话|微信/.test(String(v))) return false;
  return true;
}

var mod = {
  id: 'memory',
  _slots: null,

  init: function () {
    this._load();
  },

  dispose: function () {
    this._save();
  },

  onWorldReady: function () {},
  onTick: function () {},

  getSlots: function () {
    if (!this._slots) this._load();
    return this._slots || {};
  },

  /** 写入槽位（幂等；非法值返回 false） */
  setSlot: function (key, value) {
    if (!key || value == null) return false;
    if (String(value).length > 64) return false;
    if (!guardValue(value)) return false;
    if (!this._slots) this._load();
    this._slots[key] = String(value);
    this._save();
    return true;
  },

  /** 删除槽位（用户可删） */
  removeSlot: function (key) {
    if (!this._slots) this._load();
    delete this._slots[key];
    this._save();
  },

  // ---- 内部 ----

  _load: function () {
    this._slots = {};
    var st = storage();
    var raw = null;
    if (st) {
      try { raw = st.getStorageSync(STORAGE_KEY); } catch (e) {}
    }
    var data = null;
    if (raw && typeof raw === 'string') {
      try { data = JSON.parse(raw); } catch (e) {}
    }
    var src = data && typeof data === 'object' ? data : DEFAULT_SLOTS;
    for (var k in DEFAULT_SLOTS) {
      this._slots[k] = src[k] != null ? src[k] : DEFAULT_SLOTS[k];
    }
    for (var k2 in src) {
      if (Object.prototype.hasOwnProperty.call(src, k2)) this._slots[k2] = src[k2];
    }
  },

  _save: function () {
    var st = storage();
    if (!st || !this._slots) return;
    try { st.setStorageSync(STORAGE_KEY, JSON.stringify(this._slots)); } catch (e) {}
  }
};

features.register(mod);
