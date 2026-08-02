// interact.js - 交互模块：响应 INTERACT_TRIGGER，转成对话请求驱动台词
var features = require('../features');
var bus = require('../events');

features.register({
  id: 'interact',
  init: function () {
    bus.on(bus.EVENTS.INTERACT_TRIGGER, this._onInteract, this);
  },
  onWorldReady: function () {},
  onTick: function () {},
  dispose: function () {
    bus.off(bus.EVENTS.INTERACT_TRIGGER, this._onInteract, this);
  },

  _onInteract: function (payload) {
    // 台词由对话模块（M2）呈现；这里只负责把交互事件转成对话请求
    bus.emit(bus.EVENTS.DIALOGUE_REQUEST, {
      speaker: 'pet',
      trigger: 'interact',
      context: { interactType: payload.type }
    });
    console.log('[interact] ' + (payload.label || payload.type) + ' @ ' + payload.x + ',' + payload.z);
  }
});
