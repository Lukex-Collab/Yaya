// features.js - Feature 注册表 + flag 开关 + UI 覆盖层
// 设计对齐 cocos-project 的 FeatureRegistry：
//   flag 关 = init 不执行、不订阅事件 = 零成本；flag 开 = init/onWorldReady/onTick/dispose 生命周期。
// Feature 之间不互相 import，只通过 events.js 通信。
var bus = require('./events');

var _modules = {};  // id -> module
var _flags = {};    // id -> bool
var _enabled = {};  // id -> true

function register(mod) {
  if (!mod || !mod.id) { console.warn('[features] module without id'); return; }
  if (_modules[mod.id]) { console.warn('[features] duplicate module: ' + mod.id); return; }
  _modules[mod.id] = mod;
}

function applyFlags(flags) {
  if (!flags) return;
  for (var id in flags) {
    if (Object.prototype.hasOwnProperty.call(flags, id)) _flags[id] = !!flags[id];
  }
  for (var mid in _modules) {
    var should = _flags[mid] === true;
    var isOn = !!_enabled[mid];
    if (should && !isOn) _enable(mid);
    else if (!should && isOn) _disable(mid);
  }
}

function notifyWorldReady() {
  for (var id in _modules) {
    if (_enabled[id] && _modules[id].onWorldReady) {
      try { _modules[id].onWorldReady(); }
      catch (e) { console.error('[features] onWorldReady error: ' + id, e); }
    }
  }
}

function tick(dt) {
  for (var id in _modules) {
    if (_enabled[id] && _modules[id].onTick) {
      try { _modules[id].onTick(dt); }
      catch (e) { console.error('[features] onTick error: ' + id, e); }
    }
  }
}

function isEnabled(id) { return !!_enabled[id]; }
function getModule(id) { return _modules[id]; }

function _enable(id) {
  var mod = _modules[id];
  try {
    if (mod.init) mod.init();
    _enabled[id] = true;
    bus.emit(bus.EVENTS.FEATURE_ENABLED, { featureId: id });
    console.log('[features] enabled: ' + id);
  } catch (e) {
    console.error('[features] init error: ' + id, e);
  }
}

function _disable(id) {
  var mod = _modules[id];
  try {
    if (mod.dispose) mod.dispose();
  } catch (e) {
    console.error('[features] dispose error: ' + id, e);
  }
  delete _enabled[id];
  bus.emit(bus.EVENTS.FEATURE_DISABLED, { featureId: id });
}

// ---- UI 覆盖层：功能模块注册每帧绘制回调，在 WebGL UI pass 中执行 ----
var _draws = [];
var uiRegistry = {
  add: function (fn) {
    if (_draws.indexOf(fn) < 0) _draws.push(fn);
  },
  remove: function (fn) {
    var i = _draws.indexOf(fn);
    if (i >= 0) _draws.splice(i, 1);
  },
  run: function (helper) {
    for (var i = 0; i < _draws.length; i++) {
      try { _draws[i](helper); }
      catch (e) { console.error('[ui] draw error', e); }
    }
  }
};

module.exports = {
  register: register,
  applyFlags: applyFlags,
  notifyWorldReady: notifyWorldReady,
  tick: tick,
  isEnabled: isEnabled,
  getModule: getModule,
  uiRegistry: uiRegistry
};
