// glb.js - 宠物 GLB 网格运行时加载（预转换 base64：positions float32 + indices uint16）
// 微信小游戏无 atob，这里自带最小 base64 解码；法线在加载时按面平均重算。

var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
var B64_MAP = {};
for (var bi = 0; bi < B64.length; bi++) B64_MAP[B64[bi]] = bi;

// str -> Uint8Array
function decodeBase64(str) {
  var out = [];
  var acc = 0, bits = 0;
  for (var i = 0; i < str.length; i++) {
    var c = str[i];
    if (c === '=') break;
    var v = B64_MAP[c];
    if (v == null) continue;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

function toFloat32(bytes, byteOffset) {
  if (bytes.length - byteOffset < 4) return new Float32Array(0);
  var dv = new DataView(bytes.buffer, bytes.byteOffset + byteOffset);
  var n = (bytes.length - byteOffset) / 4;
  var out = new Float32Array(n);
  for (var i = 0; i < n; i++) out[i] = dv.getFloat32(i * 4, true);
  return out;
}

function toUint16(bytes, byteOffset) {
  if (bytes.length - byteOffset < 2) return new Uint16Array(0);
  var n = (bytes.length - byteOffset) / 2;
  var u = new Uint16Array(n);
  for (var i = 0; i < n; i++) {
    u[i] = bytes[byteOffset + i * 2] | (bytes[byteOffset + i * 2 + 1] << 8);
  }
  return u;
}

// 面法线 -> 顶点法线（平均，归一化）
function computeNormals(pos, idx) {
  var vc = pos.length / 3;
  var n = new Float32Array(vc * 3);
  for (var t = 0; t < idx.length; t += 3) {
    var a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    var ax = pos[a], ay = pos[a + 1], az = pos[a + 2];
    var bx = pos[b], by = pos[b + 1], bz = pos[b + 2];
    var cx = pos[c], cy = pos[c + 1], cz = pos[c + 2];
    var e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    var e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    var fnx = e1y * e2z - e1z * e2y;
    var fny = e1z * e2x - e1x * e2z;
    var fnz = e1x * e2y - e1y * e2x;
    n[a] += fnx; n[a + 1] += fny; n[a + 2] += fnz;
    n[b] += fnx; n[b + 1] += fny; n[b + 2] += fnz;
    n[c] += fnx; n[c + 1] += fny; n[c + 2] += fnz;
  }
  for (var v = 0; v < n.length; v += 3) {
    var l = Math.sqrt(n[v] * n[v] + n[v + 1] * n[v + 1] + n[v + 2] * n[v + 2]) || 1;
    n[v] /= l; n[v + 1] /= l; n[v + 2] /= l;
  }
  return n;
}

// mod: {count, pB64, iB64}；color: [r,g,b]；scale: 整体放大系数
// 返回 {p, n, c, i}（与 world 几何格式一致），失败返回 null
function buildGeo(mod, color, scale) {
  try {
    if (!mod || !mod.pB64 || !mod.iB64) return null;
    var pb = decodeBase64(mod.pB64);
    var ib = decodeBase64(mod.iB64);
    var pos = toFloat32(pb, 0);
    var idx = toUint16(ib, 0);
    if (pos.length !== mod.count * 3 || idx.length < 3) return null;

    // 缩放 + 底部贴地（minY -> 0）
    var sc = scale || 1.8;
    var minY = 1e9;
    for (var i = 1; i < pos.length; i += 3) {
      if (pos[i] < minY) minY = pos[i];
    }
    var nrm = computeNormals(pos, idx);
    var col = color || [0.9, 0.7, 0.8];
    var geo = { p: [], n: [], c: [], i: [] };
    var base = 0;
    for (var v = 0; v < pos.length; v += 3) {
      geo.p.push(pos[v] * sc, (pos[v + 1] - minY) * sc, pos[v + 2] * sc);
      geo.n.push(nrm[v], nrm[v + 1], nrm[v + 2]);
      geo.c.push(col[0], col[1], col[2]);
    }
    for (var t = 0; t < idx.length; t++) geo.i.push(idx[t] + base);
    return geo;
  } catch (e) {
    console.warn('[glb] buildGeo failed: ' + (e && e.message));
    return null;
  }
}

module.exports = { buildGeo: buildGeo, decodeBase64: decodeBase64, computeNormals: computeNormals };
