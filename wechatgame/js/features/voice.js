// voice.js - M3 语音模块骨架（flag 默认关：等外部 ASR/TTS 密钥后再启用）
// 已实现：录音开始/停止（wx.getRecorderManager）、预制音频播放（InnerAudioContext）、
//         ASR 文本 -> 指令解析 -> VOICE_COMMAND 事件。ASR 目前透传文本（stub）。
var features = require('../features');
var bus = require('../events');
var commands = require('../voice/commands');

function wxApi() {
  try {
    if (typeof wx !== 'undefined') return wx;
  } catch (e) {}
  return null;
}

var mod = {
  id: 'voice',
  _recorder: null,
  _audio: null,

  init: function () {
    var wxx = wxApi();
    if (!wxx) return;
    // 录音（按住说话由 UI 层调用 startRecord/stopRecord）
    if (wxx.getRecorderManager) {
      this._recorder = wxx.getRecorderManager();
      var self = this;
      if (this._recorder.onStop) {
        this._recorder.onStop(function (res) {
          self._onRecordStop(res);
        });
      }
    }
  },

  dispose: function () {
    if (this._recorder && this._recorder.stop) {
      try { this._recorder.stop(); } catch (e) {}
    }
    this._recorder = null;
  },

  onWorldReady: function () {},
  onTick: function () {},

  // ---- 录音（UI：按下开始、抬起停止）----
  startRecord: function () {
    if (this._recorder && this._recorder.start) {
      try { this._recorder.start({ format: 'mp3', duration: 15000 }); } catch (e) {}
    }
  },

  stopRecord: function () {
    if (this._recorder && this._recorder.stop) {
      try { this._recorder.stop(); } catch (e) {}
    }
  },

  // 录音结束 -> ASR（stub 透传）-> 指令 -> VOICE_COMMAND
  _onRecordStop: function (res) {
    var text = this._asr(res);
    var cmd = commands.parse(text);
    if (cmd.intent !== 'unknown') {
      bus.emit(bus.EVENTS.VOICE_COMMAND, { intent: cmd.intent, raw: cmd.raw });
    }
  },

  // ASR 占位：接入流式 ASR 服务后替换为真实调用（音频文件 res.tempFilePath）
  _asr: function () {
    return '';
  },

  // 预制音频播放（content_pack 的 audio_ref）
  playAudio: function (ref) {
    var wxx = wxApi();
    if (!wxx || !wxx.createInnerAudioContext) return false;
    try {
      if (!this._audio) this._audio = wxx.createInnerAudioContext();
      this._audio.src = ref;
      this._audio.play();
      return true;
    } catch (e) {
      return false;
    }
  }
};

features.register(mod);
