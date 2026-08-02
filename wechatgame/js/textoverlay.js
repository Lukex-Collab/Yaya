// textoverlay.js - 2D Canvas 文字覆盖层，合成到 WebGL 主画面
// 微信小游戏：第一个 createCanvas 是屏幕画布(WebGL)，后续 createCanvas 是离屏画布(可 2d)。
// 流程：气泡/提示画到离屏 2d canvas -> 每帧(脏时)上传纹理 -> 全屏 quad 绘制。
var GL = require('./gl');

var EMO_COLORS = {
  happy: '#ffd166',
  excited: '#ff9f43',
  sad: '#74b9ff',
  gentle: '#a8e6cf',
  sleepy: '#b8c6db',
  calm: '#cdb4db',
  angry: '#ff7675',
  default: '#f5f0e6'
};

function TextOverlay() {
  this.canvas = null;
  this.ctx = null;
  this.quad = null;
  this.prog = null;
  this.w = 0;
  this.h = 0;
  this.dpr = 1;
  this.bubble = null;   // {text, emo, x, y, align, t, duration}
  this.tip = null;      // {text, t, duration}
  this.dirty = true;
  this._warned = false;
}

// gl: WebGL 上下文；w/h: 画布像素尺寸；dpr: 像素比
TextOverlay.prototype.attach = function (gl, w, h, dpr) {
  this.w = w;
  this.h = h;
  this.dpr = dpr || 1;
  try {
    var wx = (typeof wx !== 'undefined') ? wx : ((typeof window !== 'undefined' && window.wx) || null);
    if (!wx || !wx.createCanvas) { this._warn('no wx.createCanvas'); return false; }
    var canvas = wx.createCanvas();
    var ctx = canvas.getContext ? canvas.getContext('2d') : null;
    if (!ctx || typeof ctx.fillRect !== 'function') { this._warn('2d canvas unavailable'); return false; }
    canvas.width = w;
    canvas.height = h;
    this.canvas = canvas;
    this.ctx = ctx;
    this.quad = new GL.TexQuad(gl);
    this.prog = GL.makeTexProgram(gl);
    this.quad.upload(w, h);
    return true;
  } catch (e) {
    this._warn('attach failed: ' + (e && e.message));
    return false;
  }
};

TextOverlay.prototype.showBubble = function (text, opts) {
  opts = opts || {};
  this.bubble = {
    text: String(text || ''),
    emo: opts.emo || 'default',
    x: opts.x != null ? opts.x : this.w / 2,
    y: opts.y != null ? opts.y : this.h * 0.24,
    align: opts.align || 'center',
    t: (opts.duration || 3200) / 1000,
    duration: (opts.duration || 3200) / 1000
  };
  this.dirty = true;
};

TextOverlay.prototype.hideBubble = function () {
  this.bubble = null;
  this.dirty = true;
};

TextOverlay.prototype.showTip = function (text, duration) {
  this.tip = {
    text: String(text || ''),
    t: (duration || 1800) / 1000,
    duration: (duration || 1800) / 1000
  };
  this.dirty = true;
};

TextOverlay.prototype.hideTip = function () {
  this.tip = null;
  this.dirty = true;
};

// 每帧推进计时
TextOverlay.prototype.frame = function (dt) {
  var changed = false;
  if (this.bubble) {
    this.bubble.t -= dt;
    if (this.bubble.t <= 0) { this.bubble = null; changed = true; }
  }
  if (this.tip) {
    this.tip.t -= dt;
    if (this.tip.t <= 0) { this.tip = null; changed = true; }
  }
  if (changed) this.dirty = true;
};

// 在 WebGL UI pass 末尾调用；仅在脏时重新渲染并上传纹理
TextOverlay.prototype.draw = function (gl) {
  if (!this.canvas || !this.quad || !this.prog) return;
  if (this.dirty) {
    this._render();
    this._upload(gl);
    this.dirty = false;
  }
  this.quad.draw(this.prog, 1);
};

// ---- 内部 ----

TextOverlay.prototype._render = function () {
  var ctx = this.ctx;
  var w = this.w, h = this.h;
  ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  ctx.clearRect(0, 0, w / this.dpr, h / this.dpr);
  if (this.tip) this._drawTip(ctx);
  if (this.bubble) this._drawBubble(ctx);
};

TextOverlay.prototype._drawBubble = function (ctx) {
  var b = this.bubble;
  var fs = Math.round(26 * this.dpr);
  ctx.font = 'bold ' + fs + 'px sans-serif';
  ctx.textBaseline = 'middle';
  var maxWidth = this.w * 0.78;
  var lines = this._wrap(ctx, b.text, maxWidth);
  var lineH = fs * 1.35;
  var pad = 14 * this.dpr;
  var bw = maxWidth;
  var bh = lines.length * lineH + pad * 2;
  var bx = b.x - bw / 2;
  var by = b.y - bh / 2;
  // 边界钳制
  if (bx < 8 * this.dpr) bx = 8 * this.dpr;
  if (bx + bw > this.w - 8 * this.dpr) bx = this.w - 8 * this.dpr - bw;
  if (by < 8 * this.dpr) by = 8 * this.dpr;
  if (by + bh > this.h - 8 * this.dpr) by = this.h - 8 * this.dpr - bh;
  var alpha = b.t < 0.5 ? b.t / 0.5 : 1;  // 末尾淡出
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  var emoColor = EMO_COLORS[b.emo] || EMO_COLORS.default;
  this._roundRect(ctx, bx, by, bw, bh, 14 * this.dpr);
  ctx.fillStyle = 'rgba(22, 26, 34, 0.86)';
  ctx.fill();
  ctx.lineWidth = 2 * this.dpr;
  ctx.strokeStyle = emoColor;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  for (var i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], bx + bw / 2, by + pad + lineH * i + lineH / 2);
  }
  ctx.globalAlpha = 1;
};

TextOverlay.prototype._drawTip = function (ctx) {
  var tp = this.tip;
  var fs = Math.round(22 * this.dpr);
  ctx.font = fs + 'px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  var tw = ctx.measureText(tp.text).width;
  var pad = 12 * this.dpr;
  var bw = tw + pad * 2;
  var bh = fs * 1.6;
  var bx = (this.w - bw) / 2;
  var by = 24 * this.dpr;
  ctx.globalAlpha = 0.85;
  this._roundRect(ctx, bx, by, bw, bh, bh / 2);
  ctx.fillStyle = 'rgba(20, 24, 32, 0.8)';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(tp.text, this.w / 2, by + bh / 2);
  ctx.globalAlpha = 1;
};

TextOverlay.prototype._wrap = function (ctx, text, maxWidth) {
  var lines = [];
  var cur = '';
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (ch === '\n') { lines.push(cur); cur = ''; continue; }
    if (ctx.measureText(cur + ch).width > maxWidth && cur) {
      lines.push(cur);
      cur = ch;
    } else {
      cur += ch;
    }
  }
  if (cur) lines.push(cur);
  return lines;
};

TextOverlay.prototype._roundRect = function (ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
};

TextOverlay.prototype._upload = function (gl) {
  var glc = gl;
  glc.activeTexture(glc.TEXTURE0);
  glc.bindTexture(glc.TEXTURE_2D, this.quad.tex);
  glc.pixelStorei(glc.UNPACK_FLIP_Y_WEBGL, true);
  glc.texImage2D(glc.TEXTURE_2D, 0, glc.RGBA, glc.RGBA, glc.UNSIGNED_BYTE, this.canvas);
  glc.texParameteri(glc.TEXTURE_2D, glc.TEXTURE_MIN_FILTER, glc.LINEAR);
  glc.texParameteri(glc.TEXTURE_2D, glc.TEXTURE_MAG_FILTER, glc.LINEAR);
  glc.texParameteri(glc.TEXTURE_2D, glc.TEXTURE_WRAP_S, glc.CLAMP_TO_EDGE);
  glc.texParameteri(glc.TEXTURE_2D, glc.TEXTURE_WRAP_T, glc.CLAMP_TO_EDGE);
};

TextOverlay.prototype._warn = function (msg) {
  if (this._warned) return;
  this._warned = true;
  console.warn('[textoverlay] ' + msg + ' — 文本气泡功能不可用');
};

module.exports = { TextOverlay: TextOverlay };
