// events.js - 轻量事件总线（微信小游戏 / Node 测试通用）
// 事件名集中定义，避免拼写错误；WorldCore 与 Feature 之间唯一通信通道。
var EVENTS = {
  WORLD_READY: 'world:ready',
  PLAYER_MOVE: 'player:move',
  PLAYER_STOP: 'player:stop',
  PLAYER_TAP: 'player:tap',              // 点击地面 {x, z}
  PET_TAPPED: 'pet:tapped',              // 点击宠物 {x, z}
  INTERACT_TRIGGER: 'interact:trigger',  // 点击交互物 {targetId, type, label, x, z}
  PET_STATE_CHANGE: 'pet:state',         // {state}
  ZONE_ENTER: 'zone:enter',              // {zoneId, fromZone}
  TIME_TICK: 'time:tick',                // {hour, minute, dayPhase}
  DIALOGUE_REQUEST: 'dialogue:request',  // {speaker, trigger, context}
  DIALOGUE_SHOW: 'dialogue:show',        // {text, emo, lineId, duration}
  DIALOGUE_HIDE: 'dialogue:hide',
  EMOTION_CHANGE: 'emotion:change',      // {emotion, level}
  PERF_GRADE_CHANGED: 'perf:grade',      // {grade}
  FEATURE_ENABLED: 'feature:enabled',    // {featureId}
  FEATURE_DISABLED: 'feature:disabled'   // {featureId}
};

var _listeners = {};

function on(name, fn, ctx) {
  if (!_listeners[name]) _listeners[name] = [];
  _listeners[name].push({ fn: fn, ctx: ctx });
}

function off(name, fn, ctx) {
  var arr = _listeners[name];
  if (!arr) return;
  for (var i = arr.length - 1; i >= 0; i--) {
    if (arr[i].fn === fn && arr[i].ctx === ctx) arr.splice(i, 1);
  }
}

function emit(name, payload) {
  var arr = _listeners[name];
  if (!arr) return;
  for (var i = 0; i < arr.length; i++) {
    try { arr[i].fn.call(arr[i].ctx, payload); }
    catch (e) { console.error('[bus] error in ' + name, e); }
  }
}

function once(name, fn, ctx) {
  var wrapper = function (p) { off(name, wrapper, ctx); fn.call(ctx, p); };
  on(name, wrapper, ctx);
}

function clear(name) {
  if (name) delete _listeners[name];
  else { _listeners = {}; }
}

module.exports = { EVENTS: EVENTS, on: on, off: off, emit: emit, once: once, clear: clear };
