// game.js - 灵伴世界 微信小游戏入口 (原生 WebGL, 零依赖)
var GL = require('./js/gl');
var World = require('./js/world');
var Nav = require('./js/nav');
var CamMod = require('./js/camera');

// ---------- canvas / gl ----------
var canvas = wx.createCanvas();
var info = wx.getSystemInfoSync();
var dpr = info.pixelRatio || 1;
var W = Math.round(info.windowWidth * dpr);
var H = Math.round(info.windowHeight * dpr);
canvas.width = W; canvas.height = H;
var gl = GL.initGL(canvas);

var prog3 = GL.make3DProgram(gl);
var progUI = GL.makeUIProgram(gl);

// ---------- world ----------
var world = World.buildWorld();
var worldMesh = new GL.Mesh(gl); worldMesh.upload(world.opaque.p, world.opaque.n, world.opaque.c, world.opaque.i);
var waterMesh = new GL.Mesh(gl); waterMesh.upload(world.water.p, world.water.n, world.water.c, world.water.i);
var playerMesh = new GL.Mesh(gl); playerMesh.upload(world.playerGeo.p, world.playerGeo.n, world.playerGeo.c, world.playerGeo.i);
var petMesh = new GL.Mesh(gl); petMesh.upload(world.petGeo.p, world.petGeo.n, world.petGeo.c, world.petGeo.i);
var uiMesh = new GL.UIMesh(gl);

var cam = new CamMod.Camera();
cam.setAspect(W, H);
cam.half = world.worldHalf;
cam.snapTo(0, -3);

// ---------- entities ----------
// 出生点放在中央广场（喷泉南侧），(0,0) 是喷泉阻挡格，不能出生在里面
var player = { x: 0, z: -3, rot: 0, path: null, pi: 1, walkSpeed: 3.4, runSpeed: 5.8, moving: false, running: false, bob: 0 };
var pet = { x: 1.8, z: -1.6, rot: 0, state: 'follow', timer: 2, sx: 0, sz: 0 };

// ---------- input state ----------
var joy = { active: false, id: -1, cx: 0, cy: 0, dx: 0, dy: 0, max: 75 * dpr };
var pinch = { startDist: 0, startH: 0 };
var touches = {};
var maxTouches = 0;
var lastJoyStart = 0;
var TAP_MOVE = 14 * dpr, TAP_TIME = 260;

// ---------- zone transition ----------
var curTint = world.zones.HUB.tint.slice();
var curFog = world.zones.HUB.fog.slice();
var curRange = world.zones.HUB.range.slice();
var curZone = 'HUB';

// ---------- minimap ----------
var explored = {};
var CHUNK = 8;

// ---------- perf ----------
var fpsCnt = 0, fpsTimer = 0, quality = 'HIGH';

// ---------- matrices ----------
var modelMat = GL.mat4.create();

// ---------- helpers ----------
function hypot(a, b) { return Math.sqrt(a * a + b * b); }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerpArr(a, b, t) { for (var i = 0; i < a.length; i++) a[i] += (b[i] - a[i]) * t; }
function touchXY(t) { return { x: t.clientX * dpr, y: t.clientY * dpr }; }

// ---------- touch ----------
wx.onTouchStart(function (e) {
  var list = e.changedTouches || e.touches;
  for (var k = 0; k < list.length; k++) {
    var tt = list[k], p = touchXY(tt);
    touches[tt.identifier] = { x: p.x, y: p.y, sx: p.x, sy: p.y, t: Date.now() };
  }
  var ids = Object.keys(touches);
  maxTouches = Math.max(maxTouches, ids.length);
  if (ids.length === 1) {
    var only = touches[ids[0]];
    if (only.sx < W * 0.45 && only.sy > H * 0.5) {
      joy.active = true; joy.id = parseInt(ids[0]); joy.cx = only.sx; joy.cy = only.sy; joy.dx = 0; joy.dy = 0;
      var now = Date.now();
      if (now - lastJoyStart < 300) player.running = true;
      lastJoyStart = now;
    }
  }
  if (ids.length >= 2) {
    joy.active = false; joy.dx = 0; joy.dy = 0;
    var a = touches[ids[0]], b = touches[ids[1]];
    pinch.startDist = hypot(a.x - b.x, a.y - b.y);
    pinch.startH = cam.targetH;
  }
});

wx.onTouchMove(function (e) {
  var list = e.changedTouches || e.touches;
  for (var k = 0; k < list.length; k++) {
    var tt = list[k], p = touchXY(tt);
    if (touches[tt.identifier]) { touches[tt.identifier].x = p.x; touches[tt.identifier].y = p.y; }
  }
  if (joy.active && touches[joy.id]) {
    var dx = touches[joy.id].x - joy.cx, dy = touches[joy.id].y - joy.cy;
    var d = hypot(dx, dy);
    if (d > joy.max) { dx = dx / d * joy.max; dy = dy / d * joy.max; }
    joy.dx = dx; joy.dy = dy;
  }
  var ids = Object.keys(touches);
  if (ids.length >= 2 && pinch.startDist > 0) {
    var a = touches[ids[0]], b = touches[ids[1]];
    var d2 = hypot(a.x - b.x, a.y - b.y);
    cam.setOrthoHeight(pinch.startH * (pinch.startDist / d2));
  }
});

function endTouch(e) {
  var list = e.changedTouches || e.touches;
  for (var k = 0; k < list.length; k++) {
    var tt = list[k], id = tt.identifier, rec = touches[id];
    if (!rec) continue;
    if (joy.active && id === joy.id) {
      joy.active = false; joy.dx = 0; joy.dy = 0; player.running = false;
    } else if (maxTouches <= 1) {
      var moved = hypot(rec.x - rec.sx, rec.y - rec.sy);
      if (moved < TAP_MOVE && Date.now() - rec.t < TAP_TIME) handleClick(rec.sx, rec.sy);
    }
    delete touches[id];
  }
  if (Object.keys(touches).length === 0) maxTouches = 0;
}
wx.onTouchEnd(endTouch);
wx.onTouchCancel(endTouch);

function handleClick(sx, sy) {
  if (sx < W * 0.45 && sy > H * 0.5) return; // 摇杆区不点移
  var g = cam.screenToGround(sx, sy, 1.2, W, H);
  if (!g) return;
  var path = Nav.findPath(player.x, player.z, g.x, g.z, world.isBlocked, world.worldHalf);
  if (path.length > 1) { player.path = path; player.pi = 1; }
}

// ---------- update ----------
function updatePlayer(dt) {
  var mvx = 0, mvz = 0, moving = false;
  if (joy.active && hypot(joy.dx, joy.dy) > joy.max * 0.15) {
    var sxn = joy.dx / joy.max, syn = -joy.dy / joy.max;
    var ml = hypot(sxn, syn); if (ml > 1) { sxn /= ml; syn /= ml; }
    mvx = (sxn + syn) * 0.707; mvz = (-sxn + syn) * 0.707; moving = true;
  } else if (player.path && player.pi < player.path.length) {
    var tg = player.path[player.pi];
    var ddx = tg[0] - player.x, ddz = tg[1] - player.z, dd = hypot(ddx, ddz);
    if (dd < 0.25) { player.pi++; if (player.pi >= player.path.length) player.path = null; }
    else { mvx = ddx / dd; mvz = ddz / dd; moving = true; }
  }
  if (moving) {
    var spd = player.running ? player.runSpeed : player.walkSpeed;
    var step = spd * dt;
    var nx = player.x + mvx * step, nz = player.z + mvz * step;
    if (!world.isBlocked(Math.round(nx), Math.round(nz))) { player.x = nx; player.z = nz; }
    else if (!world.isBlocked(Math.round(nx), Math.round(player.z))) player.x = nx;
    else if (!world.isBlocked(Math.round(player.x), Math.round(nz))) player.z = nz;
    player.rot = Math.atan2(mvx, mvz);
    player.bob += dt * spd * 1.6;
    var lr = Math.sqrt(player.x * player.x + player.z * player.z);
    if (lr > world.worldHalf - 2) { var sc = (world.worldHalf - 2) / lr; player.x *= sc; player.z *= sc; }
  }
  player.moving = moving;
}

function updatePet(dt) {
  pet.timer -= dt;
  var dx = player.x - pet.x, dz = player.z - pet.z, d = hypot(dx, dz);
  var mvx = 0, mvz = 0;
  if (pet.state === 'follow') {
    if (d > 2.2) { mvx = dx / d; mvz = dz / d; }
    else if (pet.timer <= 0 && Math.random() < 0.4) {
      pet.state = 'sniff'; pet.timer = 2 + Math.random() * 2.5;
      pet.sx = pet.x + (Math.random() - 0.5) * 3; pet.sz = pet.z + (Math.random() - 0.5) * 3;
    }
  } else {
    var sdx = pet.sx - pet.x, sdz = pet.sz - pet.z, sd = hypot(sdx, sdz);
    if (sd > 0.3) { mvx = sdx / sd; mvz = sdz / sd; }
    if (pet.timer <= 0 || d > 5) { pet.state = 'follow'; pet.timer = 3 + Math.random() * 4; }
  }
  if (mvx || mvz) {
    var ps = 2.6 * dt;
    var nx = pet.x + mvx * ps, nz = pet.z + mvz * ps;
    if (!world.isBlocked(Math.round(nx), Math.round(nz))) { pet.x = nx; pet.z = nz; }
    pet.rot = Math.atan2(mvx, mvz);
  }
}

// ---------- UI build ----------
function buildUI() {
  var ui = { p: [], c: [], i2: [] };
  // 摇杆
  var jcx = joy.active ? joy.cx : W * 0.16, jcy = joy.active ? joy.cy : H * 0.82;
  GL.buildCircle2D(ui, jcx, jcy, joy.max, 22, [1, 1, 1, joy.active ? 0.14 : 0.07]);
  GL.buildCircle2D(ui, jcx + joy.dx, jcy + joy.dy, joy.max * 0.42, 18, [1, 1, 1, joy.active ? 0.45 : 0.18]);
  // 小地图
  var mr = 66 * dpr, mcx = W - mr - 14 * dpr, mcy = mr + 14 * dpr;
  GL.buildCircle2D(ui, mcx, mcy, mr + 3 * dpr, 28, [1, 1, 1, 0.25]);
  GL.buildCircle2D(ui, mcx, mcy, mr, 28, [0.08, 0.1, 0.14, 0.55]);
  var scale = (mr * 0.92) / world.worldHalf;
  var keys = Object.keys(explored);
  for (var i = 0; i < keys.length; i++) {
    var parts = keys[i].split(','); var ecx = parseInt(parts[0]), ecz = parseInt(parts[1]);
    var wx = (ecx + 0.5) * CHUNK, wz = (ecz + 0.5) * CHUNK;
    var px = mcx + wx * scale - (CHUNK * scale) / 2;
    var py = mcy - wz * scale - (CHUNK * scale) / 2;
    var zc = world.getZone(wx, wz);
    var col;
    if (zc === 'HUB') col = [0.8, 0.72, 0.5, 0.8];
    else if (zc === 'SEA') col = [0.2, 0.4, 0.6, 0.7];
    else if (zc === 'ZN') col = [0.2, 0.5, 0.25, 0.8];
    else if (zc === 'ZE') col = [0.7, 0.7, 0.3, 0.8];
    else if (zc === 'ZW') col = [0.5, 0.4, 0.3, 0.8];
    else if (zc === 'ZSE') col = [0.25, 0.4, 0.5, 0.8];
    else if (zc === 'ZS') col = [0.5, 0.45, 0.6, 0.8];
    else col = [0.8, 0.72, 0.45, 0.8];
    GL.buildRect2D(ui, px, py, CHUNK * scale, CHUNK * scale, col);
  }
  // 玩家/宠物点
  var ppx = mcx + player.x * scale, ppy = mcy - player.z * scale;
  GL.buildCircle2D(ui, ppx, ppy, 4 * dpr, 10, [1, 1, 1, 1]);
  var petpx = mcx + pet.x * scale, petpy = mcy - pet.z * scale;
  GL.buildCircle2D(ui, petpx, petpy, 3 * dpr, 10, [1, 0.6, 0.8, 1]);
  return ui;
}

// ---------- render ----------
function render() {
  gl.viewport(0, 0, W, H);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.useProgram(prog3.program);
  gl.uniformMatrix4fv(prog3.uVP, false, cam.getVP());
  gl.uniform3f(prog3.uLightDir, 0.4, 0.85, 0.45);
  gl.uniform3fv(prog3.uTint, curTint);
  gl.uniform3fv(prog3.uFogColor, curFog);
  gl.uniform2fv(prog3.uFogRange, curRange);
  gl.uniform3fv(prog3.uCamPos, cam.getEye());

  // opaque
  gl.disable(gl.BLEND); gl.depthMask(true); gl.enable(gl.CULL_FACE);
  gl.uniform1f(prog3.uAlpha, 1.0);
  GL.mat4.identity(modelMat); gl.uniformMatrix4fv(prog3.uModel, false, modelMat);
  worldMesh.draw(prog3);

  var by = Math.abs(Math.sin(player.bob)) * 0.07 * (player.moving ? 1 : 0);
  GL.mat4.model(modelMat, player.x, world.heightAt(player.x, player.z) + by, player.z, player.rot, 1);
  gl.uniformMatrix4fv(prog3.uModel, false, modelMat); playerMesh.draw(prog3);

  GL.mat4.model(modelMat, pet.x, world.heightAt(pet.x, pet.z), pet.z, pet.rot, 1);
  gl.uniformMatrix4fv(prog3.uModel, false, modelMat); petMesh.draw(prog3);

  // water
  if (quality !== 'LOW') {
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    gl.uniform1f(prog3.uAlpha, 0.6);
    GL.mat4.identity(modelMat); gl.uniformMatrix4fv(prog3.uModel, false, modelMat);
    waterMesh.draw(prog3);
    gl.depthMask(true); gl.disable(gl.BLEND);
  }

  // UI
  var ui = buildUI();
  uiMesh.upload(ui.p, ui.c, ui.i2);
  gl.useProgram(progUI.program);
  var proj2 = GL.mat4.create(); GL.mat4.ortho(proj2, 0, W, H, 0, -1, 1);
  gl.uniformMatrix4fv(progUI.uProj, false, proj2);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
  uiMesh.draw(progUI);
  gl.enable(gl.DEPTH_TEST);
}

// ---------- loop ----------
var last = Date.now();
function loop() {
  var now = Date.now();
  var dt = (now - last) / 1000; last = now;
  if (dt > 0.05) dt = 0.05;

  updatePlayer(dt);
  updatePet(dt);
  cam.update(player.x, player.z, dt);

  var z = world.getZone(player.x, player.z);
  curZone = z;
  var zd = world.zones[z] || world.zones.HUB;
  var tt = dt * 1.6;
  lerpArr(curTint, zd.tint, tt); lerpArr(curFog, zd.fog, tt);
  curRange[0] += (zd.range[0] - curRange[0]) * tt; curRange[1] += (zd.range[1] - curRange[1]) * tt;

  var ecx = Math.floor(player.x / CHUNK), ecz = Math.floor(player.z / CHUNK);
  explored[ecx + ',' + ecz] = 1;

  fpsCnt++; fpsTimer += dt;
  if (fpsTimer >= 2) {
    var fps = fpsCnt / fpsTimer; fpsCnt = 0; fpsTimer = 0;
    var nq = fps >= 45 ? 'HIGH' : (fps >= 28 ? 'MID' : 'LOW');
    if (nq !== quality) { quality = nq; console.log('[perf] ' + quality + ' fps=' + fps.toFixed(1)); }
  }

  render();
  requestAnimationFrame(loop);
}

console.log('[LingPal] world built: opaque tris=' + (world.opaque.i.length / 3) + ' water tris=' + (world.water.i.length / 3));
requestAnimationFrame(loop);
