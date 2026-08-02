// world.js - 程序化世界: 圆形岛 + 6扇区外围 + 中心HUB + 地标 + 阻挡
var GL = require('./gl');

var WORLD_HALF = 24;     // 世界半径 (米)
var SHORE = 20;          // 海岸阻挡半径
var ISLAND_IN = 18;      // 岛内全高
var ISLAND_OUT = 23;     // 岛外沉海
var HUB_R = 8;           // 中心枢纽半径

var ZONES = {
  HUB:  { name:'灵屿村', tint:[1.0,0.97,0.90], fog:[0.80,0.85,0.90], range:[40,70] },
  ZN:   { name:'云杉林', tint:[0.70,0.90,0.70], fog:[0.55,0.70,0.60], range:[30,60] },
  ZE:   { name:'花语原', tint:[1.0,0.95,0.80],  fog:[0.90,0.88,0.75], range:[45,75] },
  ZW:   { name:'暮光谷', tint:[0.85,0.78,0.70], fog:[0.60,0.55,0.50], range:[28,55] },
  ZSE:  { name:'萤火沼', tint:[0.60,0.70,0.90], fog:[0.30,0.40,0.60], range:[25,50] },
  ZS:   { name:'月影丘', tint:[0.85,0.80,0.95], fog:[0.50,0.45,0.70], range:[35,65] },
  ZNW:  { name:'星砂滩', tint:[0.90,0.95,1.00], fog:[0.70,0.85,0.95], range:[45,80] },
  SEA:  { name:'海域',   tint:[0.70,0.85,0.95], fog:[0.70,0.85,0.95], range:[40,70] }
};

// 6 扇区顺序 (ang=atan2(z,x), 0=东, 逆时针)
var SECTOR = ['ZE','ZN','ZNW','ZW','ZS','ZSE'];

// 交互点（与地标位置对齐）。r = 触发半径（格）。D 轨道在此扩展。
var INTERACTABLES = [
  { id: 'fountain', type: 'fountain', label: '喷泉', x: 0, z: 0, r: 1.6 },
  { id: 'mailbox',  type: 'mailbox',  label: '邮箱', x: 5, z: -2, r: 1.2 },
  { id: 'house_n',  type: 'house',    label: '小屋', x: 3, z: 3, r: 1.8 },
  { id: 'house_w',  type: 'house',    label: '小屋', x: -4, z: 2, r: 1.8 },
  { id: 'house_s',  type: 'house',    label: '小屋', x: -2, z: -4, r: 1.8 },
  { id: 'lamp_ne',  type: 'lamp',     label: '路灯', x: 6, z: 6, r: 1.0 },
  { id: 'lamp_nw',  type: 'lamp',     label: '路灯', x: -6, z: 6, r: 1.0 },
  { id: 'lamp_se',  type: 'lamp',     label: '路灯', x: 6, z: -6, r: 1.0 },
  { id: 'lamp_sw',  type: 'lamp',     label: '路灯', x: -6, z: -6, r: 1.0 }
];

function getZone(x, z) {
  var r = Math.sqrt(x * x + z * z);
  if (r <= HUB_R) return 'HUB';
  if (r > ISLAND_OUT) return 'SEA';
  var ang = Math.atan2(z, x); if (ang < 0) ang += Math.PI * 2;
  var s = Math.floor(ang / (Math.PI / 3)) % 6;
  return SECTOR[s];
}

function hash2(x, z) {
  var n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function smooth(t) { return t * t * (3 - 2 * t); }
function vnoise(x, z) {
  var xi = Math.floor(x), zi = Math.floor(z);
  var xf = x - xi, zf = z - zi;
  var a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  var u = smooth(xf), v = smooth(zf);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
function fbm(x, z) { return vnoise(x * 0.18, z * 0.18) * 0.7 + vnoise(x * 0.4, z * 0.4) * 0.3; }

function zoneBaseHeight(zone) {
  switch (zone) {
    case 'HUB': return 1.6;
    case 'ZN': return 2.2;
    case 'ZE': return 1.1;
    case 'ZW': return 1.4;
    case 'ZSE': return 0.2;   // 低洼 -> 水塘
    case 'ZS': return 3.6;    // 丘陵
    case 'ZNW': return 0.6;   // 沙滩低平
    default: return 0.0;
  }
}

function groundColor(zone, h, n) {
  var c;
  switch (zone) {
    case 'HUB': c = [0.55, 0.62, 0.32]; break;     // 草地
    case 'ZN':  c = [0.22, 0.40, 0.20]; break;     // 苔藓深绿
    case 'ZE':  c = [0.62, 0.66, 0.28]; break;     // 花原黄绿
    case 'ZW':  c = [0.45, 0.38, 0.30]; break;     // 岩土
    case 'ZSE': c = [0.20, 0.32, 0.30]; break;     // 沼泽暗绿
    case 'ZS':  c = [0.50, 0.46, 0.55]; break;     // 月丘紫灰
    case 'ZNW': c = [0.82, 0.74, 0.50]; break;     // 沙
    default:    c = [0.30, 0.45, 0.55]; break;
  }
  var t = (n - 0.5) * 0.18 + (h * 0.02);
  return [clamp01(c[0] + t), clamp01(c[1] + t), clamp01(c[2] + t * 0.6)];
}
function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(e0, e1, x) { var t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); }

function heightAt(x, z) {
  var zone = getZone(x, z);
  var base = zoneBaseHeight(zone);
  var n = fbm(x, z);
  var h = base + (n - 0.5) * 2.2;
  if (zone === 'ZS') h += smoothstep(10, 20, Math.sqrt(x*x+z*z)) * 1.5; // 丘顶更高
  if (zone === 'ZW') h -= 0.8; // 谷底
  var r = Math.sqrt(x * x + z * z);
  var island = 1 - smoothstep(ISLAND_IN, ISLAND_OUT, r);
  return lerp(-1.2, h, island);
}

function buildWorld() {
  var opaque = { p: [], n: [], c: [], i: [] };
  var water = { p: [], n: [], c: [], i: [] };
  var blocked = {};

  // ---- 地形网格 ----
  var STEP = 1, N = WORLD_HALF * 2;
  var grid = [];
  for (var iz = 0; iz <= N; iz++) {
    grid[iz] = [];
    for (var ix = 0; ix <= N; ix++) {
      var x = -WORLD_HALF + ix * STEP, z = -WORLD_HALF + iz * STEP;
      var h = heightAt(x, z);
      var zone = getZone(x, z);
      var col = groundColor(zone, h, fbm(x, z));
      // store vertex index
      var idx = opaque.p.length / 3;
      opaque.p.push(x, h, z);
      opaque.n.push(0, 1, 0); // 法线稍后重算
      opaque.c.push(col[0], col[1], col[2]);
      grid[iz][ix] = idx;
    }
  }
  // 索引 + 重算法线 (per-face 用平均)
  var nx = new Float32Array(opaque.p.length / 3 * 3);
  for (var iz2 = 0; iz2 < N; iz2++) {
    for (var ix2 = 0; ix2 < N; ix2++) {
      var i00 = grid[iz2][ix2], i10 = grid[iz2][ix2 + 1], i01 = grid[iz2 + 1][ix2], i11 = grid[iz2 + 1][ix2 + 1];
      opaque.i.push(i00, i10, i11, i00, i11, i01);
    }
  }
  // 计算面法线累加到顶点
  for (var t = 0; t < opaque.i.length; t += 3) {
    var a = opaque.i[t], b = opaque.i[t + 1], c = opaque.i[t + 2];
    var ax = opaque.p[a*3], ay = opaque.p[a*3+1], az = opaque.p[a*3+2];
    var bx = opaque.p[b*3], by = opaque.p[b*3+1], bz = opaque.p[b*3+2];
    var cx = opaque.p[c*3], cy = opaque.p[c*3+1], cz = opaque.p[c*3+2];
    var e1x = bx-ax, e1y = by-ay, e1z = bz-az;
    var e2x = cx-ax, e2y = cy-ay, e2z = cz-az;
    var fnx = e1y*e2z - e1z*e2y, fny = e1z*e2x - e1x*e2z, fnz = e1x*e2y - e1y*e2x;
    for (var q = 0; q < 3; q++) {
      var vi = opaque.i[t + q];
      nx[vi*3] += fnx; nx[vi*3+1] += fny; nx[vi*3+2] += fnz;
    }
  }
  for (var v = 0; v < nx.length; v += 3) {
    var L = Math.sqrt(nx[v]*nx[v]+nx[v+1]*nx[v+1]+nx[v+2]*nx[v+2]) || 1;
    opaque.n[v] = nx[v]/L; opaque.n[v+1] = nx[v+1]/L; opaque.n[v+2] = nx[v+2]/L;
  }

  // 海岸阻挡
  for (var bz = -WORLD_HALF; bz <= WORLD_HALF; bz++) {
    for (var bx = -WORLD_HALF; bx <= WORLD_HALF; bx++) {
      if (Math.sqrt(bx*bx+bz*bz) > SHORE) blocked[bx + ',' + bz] = 1;
    }
  }

  function markBlock(x, z, rad) {
    for (var dz = -rad; dz <= rad; dz++) for (var dx = -rad; dx <= rad; dx++) {
      blocked[Math.round(x + dx) + ',' + Math.round(z + dz)] = 1;
    }
  }

  // 扇区中心方向工具
  function sectorDir(s) { var a = (s + 0.5) * (Math.PI / 3); return [Math.cos(a), Math.sin(a)]; }
  function at(s, radius, sideOff) {
    var d = sectorDir(s); var perp = [-d[1], d[0]];
    return [d[0] * radius + perp[0] * sideOff, d[1] * radius + perp[1] * sideOff];
  }
  function zoneOfSector(s) { return SECTOR[s]; }

  // ---- 地标 ----
  function house(x, z, col) {
    var h0 = heightAt(x, z);
    GL.buildBox(opaque, x, h0 + 1.0, z, 2.2, 2.0, 2.2, col);
    GL.buildCone(opaque, x, h0 + 2.0, z, 1.7, 1.2, 4, [0.6, 0.25, 0.2]);
    markBlock(x, z, 1);
  }
  function tree(x, z, trunkH, crownH, crownR, crownCol) {
    var h0 = heightAt(x, z);
    GL.buildCyl(opaque, x, h0, z, 0.18, trunkH, 6, [0.4, 0.28, 0.16]);
    GL.buildCone(opaque, x, h0 + trunkH * 0.7, z, crownR, crownH, 8, crownCol);
    markBlock(x, z, 0);
  }
  function rock(x, z, r, col) {
    var h0 = heightAt(x, z);
    GL.buildSphere(opaque, x, h0 + r * 0.5, z, r, 6, 8, col);
    markBlock(x, z, 0);
  }

  // HUB (中心)
  house(3, 3, [0.85, 0.7, 0.5]);
  house(-4, 2, [0.8, 0.65, 0.45]);
  house(-2, -4, [0.9, 0.75, 0.55]);
  // 喷泉
  (function () { var h0 = heightAt(0, 0); GL.buildCyl(opaque, 0, h0, 0, 1.0, 0.4, 12, [0.7, 0.7, 0.75]); GL.buildSphere(opaque, 0, h0 + 0.5, 0, 0.3, 6, 8, [0.4, 0.7, 1.0]); markBlock(0, 0, 1); })();
  // 邮箱
  (function () { var x = 5, z = -2, h0 = heightAt(x, z); GL.buildBox(opaque, x, h0 + 0.6, z, 0.4, 0.8, 0.3, [0.8, 0.2, 0.2]); })();
  // 路灯
  [[6, 6], [-6, 6], [6, -6], [-6, -6]].forEach(function (p) { var h0 = heightAt(p[0], p[1]); GL.buildCyl(opaque, p[0], h0, p[1], 0.08, 2.0, 6, [0.3, 0.3, 0.35]); GL.buildSphere(opaque, p[0], h0 + 2.1, p[1], 0.22, 6, 6, [1.4, 1.3, 0.7]); });

  // 遍历 6 扇区放外围地标
  for (var s = 0; s < 6; s++) {
    var zid = zoneOfSector(s);
    if (zid === 'ZN') {
      for (var k = 0; k < 8; k++) { var p = at(s, 11 + (k % 3) * 3, (k - 4) * 2.2); tree(p[0], p[1], 1.2, 3.2, 1.1, [0.15, 0.35, 0.18]); }
      var r1 = at(s, 14, 4); rock(r1[0], r1[1], 1.0, [0.4, 0.5, 0.4]);
    } else if (zid === 'ZE') {
      var w = at(s, 14, 0); var h0 = heightAt(w[0], w[1]);
      GL.buildCyl(opaque, w[0], h0, w[1], 0.4, 3.0, 8, [0.85, 0.8, 0.7]);
      GL.buildBox(opaque, w[0], h0 + 3.0, w[1], 2.4, 0.15, 0.3, [0.9, 0.9, 0.85]);
      GL.buildBox(opaque, w[0], h0 + 3.0, w[1], 0.3, 0.15, 2.4, [0.9, 0.9, 0.85]);
      markBlock(w[0], w[1], 0);
      var flowerCols = [[0.9,0.3,0.5],[0.95,0.8,0.2],[0.9,0.9,0.95],[0.6,0.4,0.8]];
      for (var f = 0; f < 6; f++) { var fp = at(s, 10 + (f % 2) * 3, (f - 3) * 2.5); var fh = heightAt(fp[0], fp[1]); GL.buildSphere(opaque, fp[0], fh + 0.25, fp[1], 0.3, 5, 6, flowerCols[f % 4]); }
    } else if (zid === 'ZW') {
      for (var rk = 0; rk < 4; rk++) { var rp = at(s, 12 + (rk % 2) * 3, (rk - 2) * 3); var rh = heightAt(rp[0], rp[1]); GL.buildBox(opaque, rp[0], rh + 2.0, rp[1], 1.6, 4.0, 1.6, [0.5, 0.42, 0.34]); markBlock(rp[0], rp[1], 1); }
      var cr = at(s, 16, 0); var crh = heightAt(cr[0], cr[1]); GL.buildCone(opaque, cr[0], crh, cr[1], 1.0, 1.6, 6, [0.7, 0.5, 1.3]); // 水晶洞发光
    } else if (zid === 'ZSE') {
      for (var lk = 0; lk < 5; lk++) { var lp = at(s, 11 + (lk % 2) * 2, (lk - 2) * 2); var lh = heightAt(lp[0], lp[1]); GL.buildCyl(opaque, lp[0], lh, lp[1], 0.05, 1.0, 4, [0.3, 0.5, 0.25]); }
      for (var mk = 0; mk < 2; mk++) { var mp = at(s, 13, (mk - 0.5) * 5); var mh = heightAt(mp[0], mp[1]); GL.buildSphere(opaque, mp[0], mh + 0.3, mp[1], 0.35, 6, 6, [0.7, 0.9, 1.4]); }
    } else if (zid === 'ZS') {
      for (var bk = 0; bk < 3; bk++) { var bp = at(s, 12 + bk * 2, (bk - 1) * 3); rock(bp[0], bp[1], 1.1, [0.5, 0.46, 0.55]); }
      var tp = at(s, 15, 0); var th = heightAt(tp[0], tp[1]); GL.buildCone(opaque, tp[0], th, tp[1], 1.2, 1.4, 4, [0.9, 0.5, 0.2]); markBlock(tp[0], tp[1], 1);
    } else if (zid === 'ZNW') {
      for (var ck = 0; ck < 4; ck++) { var cp = at(s, 12 + (ck % 2) * 3, (ck - 2) * 3); var ch = heightAt(cp[0], cp[1]); GL.buildCyl(opaque, cp[0], ch, cp[1], 0.2, 2.4, 6, [0.5, 0.4, 0.25]); GL.buildCone(opaque, cp[0], ch + 2.2, cp[1], 1.3, 0.8, 6, [0.2, 0.55, 0.25]); markBlock(cp[0], cp[1], 0); }
      var lt = at(s, 17, 0); var lth = heightAt(lt[0], lt[1]); GL.buildCyl(opaque, lt[0], lth, lt[1], 0.5, 4.0, 8, [0.9, 0.9, 0.92]); GL.buildSphere(opaque, lt[0], lth + 4.1, lt[1], 0.4, 6, 6, [1.4, 1.3, 0.6]); markBlock(lt[0], lt[1], 1);
    }
  }

  // ---- 水面 (全覆盖平面 y=0.05, 透明, 自动海岸线) ----
  var wN = 24, wStep = WORLD_HALF * 2 / wN;
  var wgrid = [];
  for (var wz = 0; wz <= wN; wz++) {
    wgrid[wz] = [];
    for (var wx = 0; wx <= wN; wx++) {
      var wxx = -WORLD_HALF + wx * wStep, wzz = -WORLD_HALF + wz * wStep;
      var wi = water.p.length / 3;
      water.p.push(wxx, 0.05, wzz); water.n.push(0, 1, 0); water.c.push(0.18, 0.42, 0.68);
      wgrid[wz][wx] = wi;
    }
  }
  for (var wz2 = 0; wz2 < wN; wz2++) for (var wx2 = 0; wx2 < wN; wx2++) {
    water.i.push(wgrid[wz2][wx2], wgrid[wz2][wx2 + 1], wgrid[wz2 + 1][wx2 + 1], wgrid[wz2][wx2], wgrid[wz2 + 1][wx2 + 1], wgrid[wz2 + 1][wx2]);
  }

  // ---- 玩家几何 ----
  var playerGeo = { p: [], n: [], c: [], i: [] };
  GL.buildCyl(playerGeo, 0, 0, 0, 0.32, 1.0, 10, [0.3, 0.45, 0.8]);   // 身
  GL.buildSphere(playerGeo, 0, 1.25, 0, 0.3, 8, 10, [0.95, 0.8, 0.7]); // 头

  // ---- 宠物几何 (朝 +Z 为脸) ----
  var petGeo = { p: [], n: [], c: [], i: [] };
  GL.buildSphere(petGeo, 0, 0.35, 0, 0.4, 8, 10, [0.95, 0.7, 0.8]);    // 身
  GL.buildSphere(petGeo, 0, 0.55, 0.35, 0.26, 6, 8, [0.95, 0.75, 0.85]); // 头
  GL.buildCone(petGeo, -0.18, 0.7, 0.3, 0.1, 0.3, 5, [0.9, 0.6, 0.75]);  // 耳
  GL.buildCone(petGeo, 0.18, 0.7, 0.3, 0.1, 0.3, 5, [0.9, 0.6, 0.75]);   // 耳

  return {
    opaque: opaque, water: water, playerGeo: playerGeo, petGeo: petGeo,
    blocked: blocked,
    isBlocked: function (gx, gz) { return blocked[gx + ',' + gz] === 1; },
    interactables: INTERACTABLES,
    getZone: getZone,
    zones: ZONES,
    heightAt: heightAt,
    worldHalf: WORLD_HALF
  };
}

module.exports = { buildWorld: buildWorld, getZone: getZone, ZONES: ZONES };
