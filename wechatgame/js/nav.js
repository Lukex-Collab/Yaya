// nav.js - 等距网格 A* 寻路 (8方向, 对角线阻挡检查, 路径简化)
var DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

function heur(x1, z1, x2, z2) {
  var dx = Math.abs(x1 - x2), dz = Math.abs(z1 - z2);
  return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
}

// isBlocked(gx,gz)->bool ; half = 世界半径(网格边界)
function nearestFree(x, z, isBlocked, half) {
  if (!isBlocked(x, z)) return [x, z];
  for (var r = 1; r <= 8; r++) {
    for (var dx = -r; dx <= r; dx++) for (var dz = -r; dz <= r; dz++) {
      if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
      var nx = x + dx, nz = z + dz;
      if (nx < -half || nx > half || nz < -half || nz > half) continue;
      if (!isBlocked(nx, nz)) return [nx, nz];
    }
  }
  return null;
}
function findPath(fromX, fromZ, toX, toZ, isBlocked, half) {
  var sx = Math.round(fromX), sz = Math.round(fromZ);
  var ex = Math.round(toX), ez = Math.round(toZ);
  if (ex < -half || ex > half || ez < -half || ez > half) return [];
  if (isBlocked(ex, ez)) { var nb = nearestFree(ex, ez, isBlocked, half); if (!nb) return []; ex = nb[0]; ez = nb[1]; }

  var open = [], openMap = {}, closed = {};
  var start = { x: sx, z: sz, g: 0, h: heur(sx, sz, ex, ez), f: 0, parent: null };
  start.f = start.h;
  open.push(start); openMap[sx + ',' + sz] = start;

  var iter = 0, maxIter = 3000;
  while (open.length > 0 && iter < maxIter) {
    iter++;
    // 取 f 最小 (线性扫描, 路径短够用)
    var bi = 0;
    for (var i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    var cur = open[bi];
    open.splice(bi, 1);
    var ck = cur.x + ',' + cur.z;
    delete openMap[ck]; closed[ck] = 1;

    if (cur.x === ex && cur.z === ez) return reconstruct(cur);

    for (var d = 0; d < DIRS.length; d++) {
      var dx = DIRS[d][0], dz = DIRS[d][1];
      var nx = cur.x + dx, nz = cur.z + dz, nk = nx + ',' + nz;
      if (closed[nk]) continue;
      if (nx < -half || nx > half || nz < -half || nz > half) continue;
      if (isBlocked(nx, nz)) continue;
      if (dx !== 0 && dz !== 0) {
        if (isBlocked(cur.x + dx, cur.z) && isBlocked(cur.x, cur.z + dz)) continue;
      }
      var cost = (dx !== 0 && dz !== 0) ? 1.414 : 1.0;
      var g = cur.g + cost;
      var ex2 = openMap[nk];
      if (ex2) {
        if (g < ex2.g) { ex2.g = g; ex2.f = g + ex2.h; ex2.parent = cur; }
      } else {
        var node = { x: nx, z: nz, g: g, h: heur(nx, nz, ex, ez), f: 0, parent: cur };
        node.f = node.g + node.h;
        open.push(node); openMap[nk] = node;
      }
    }
  }
  return [];
}

function reconstruct(end) {
  var path = [], cur = end;
  while (cur) { path.push([cur.x, cur.z]); cur = cur.parent; }
  path.reverse();
  return simplify(path);
}

function simplify(path) {
  if (path.length <= 2) return path;
  var res = [path[0]];
  for (var i = 1; i < path.length - 1; i++) {
    var p = path[i - 1], c = path[i], n = path[i + 1];
    if ((c[0] - p[0]) !== (n[0] - c[0]) || (c[1] - p[1]) !== (n[1] - c[1])) res.push(c);
  }
  res.push(path[path.length - 1]);
  return res;
}

module.exports = { findPath: findPath };