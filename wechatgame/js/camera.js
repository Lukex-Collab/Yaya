// camera.js - 2.5D 等距正交相机: 固定角度 + 平滑跟随 + 捏合缩放 + 边界钳制 + 反投影
var GL = require('./gl');
var M = GL.mat4;

var ELEV = 35 * Math.PI / 180;
var AZIM = 45 * Math.PI / 180;
var DIST = 70;
var NEAR = 1, FAR = 220;
var LERP = 0.12;

function Camera() {
  this.proj = M.create();
  this.view = M.create();
  this.vp = M.create();
  this.invVP = M.create();
  this._tmp = M.create();
  this.curX = 0; this.curZ = 0;
  this.orthoH = 11; this.targetH = 11;
  this.aspect = 1;
  this.eye = [0, 0, 0];
  this.half = 24;
  this._offX = -Math.sin(AZIM) * Math.cos(ELEV);
  this._offY = Math.sin(ELEV);
  this._offZ = -Math.cos(AZIM) * Math.cos(ELEV);
}

Camera.prototype.setAspect = function (w, h) { this.aspect = w / h; };
Camera.prototype.setOrthoHeight = function (h) { this.targetH = Math.max(7, Math.min(18, h)); };
Camera.prototype.snapTo = function (x, z) { this.curX = x; this.curZ = z; };

Camera.prototype.update = function (tx, tz, dt) {
  this.curX += (tx - this.curX) * LERP;
  this.curZ += (tz - this.curZ) * LERP;
  this.orthoH += (this.targetH - this.orthoH) * 0.15;

  var margin = this.orthoH * 0.6;
  var cx = this.curX, cz = this.curZ;
  if (cx < -this.half + margin) cx = -this.half + margin;
  if (cx > this.half - margin) cx = this.half - margin;
  if (cz < -this.half + margin) cz = -this.half + margin;
  if (cz > this.half - margin) cz = this.half - margin;

  this.eye[0] = cx + this._offX * DIST;
  this.eye[1] = this._offY * DIST;
  this.eye[2] = cz + this._offZ * DIST;

  var halfH = this.orthoH, halfW = this.orthoH * this.aspect;
  M.ortho(this.proj, -halfW, halfW, -halfH, halfH, NEAR, FAR);
  M.lookAt(this.view, this.eye[0], this.eye[1], this.eye[2], cx, 0, cz, 0, 1, 0);
  M.multiply(this.vp, this.proj, this.view);
};

Camera.prototype.getEye = function () { return this.eye; };
Camera.prototype.getVP = function () { return this.vp; };

// 世界坐标 -> 屏幕像素（气泡/提示定位用；vp 需已由 update() 更新）
Camera.prototype.worldToScreen = function (x, y, z, W, H) {
  var m = this.vp;
  var cx = m[0] * x + m[4] * y + m[8] * z + m[12];
  var cy = m[1] * x + m[5] * y + m[9] * z + m[13];
  var cw = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (Math.abs(cw) < 1e-7) return null;
  var nx = cx / cw, ny = cy / cw;
  return { x: (nx + 1) / 2 * W, y: (1 - ny) / 2 * H };
};

// 屏幕像素 -> 世界地面坐标 (与 y=h 平面求交)
Camera.prototype.screenToGround = function (sx, sy, h, W, H) {
  if (!M.invert(this.invVP, this.vp)) return null;
  var nx = (sx / W) * 2 - 1;
  var ny = 1 - (sy / H) * 2;  // 触摸 y 向下, NDC y 向上
  var p0 = unproject(this.invVP, nx, ny, -1);
  var p1 = unproject(this.invVP, nx, ny, 1);
  if (!p0 || !p1) return null;
  var dy = p1[1] - p0[1];
  if (Math.abs(dy) < 1e-5) return null;
  var t = (h - p0[1]) / dy;
  return { x: p0[0] + (p1[0] - p0[0]) * t, z: p0[2] + (p1[2] - p0[2]) * t };
};

function unproject(m, x, y, z) {
  var w = m[3]*x + m[7]*y + m[11]*z + m[15];
  if (Math.abs(w) < 1e-7) return null;
  var ox = (m[0]*x + m[4]*y + m[8]*z + m[12]) / w;
  var oy = (m[1]*x + m[5]*y + m[9]*z + m[13]) / w;
  var oz = (m[2]*x + m[6]*y + m[10]*z + m[14]) / w;
  return [ox, oy, oz];
}

module.exports = { Camera: Camera };
