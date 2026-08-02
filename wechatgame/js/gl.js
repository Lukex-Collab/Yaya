// gl.js - 原生 WebGL1 渲染层 + mat4 + 程序化几何 (CommonJS)
// 零外部依赖，所有 API 均为微信小游戏原生接口

// ============ mat4 (列主序 Float32Array(16)) ============
var mat4 = {
  create: function () { var m = new Float32Array(16); m[0]=m[5]=m[10]=m[15]=1; return m; },
  identity: function (o) { o.fill(0); o[0]=o[5]=o[10]=o[15]=1; return o; },
  ortho: function (o, l, r, b, t, n, f) {
    var lr=1/(l-r), bt=1/(b-t), nf=1/(n-f);
    o[0]=-2*lr; o[1]=0; o[2]=0; o[3]=0;
    o[4]=0; o[5]=-2*bt; o[6]=0; o[7]=0;
    o[8]=0; o[9]=0; o[10]=2*nf; o[11]=0;
    o[12]=(l+r)*lr; o[13]=(t+b)*bt; o[14]=(f+n)*nf; o[15]=1;
    return o;
  },
  lookAt: function (o, ex, ey, ez, cx, cy, cz, ux, uy, uz) {
    var zx=ex-cx, zy=ey-cy, zz=ez-cz;
    var zl=1/Math.sqrt(zx*zx+zy*zy+zz*zz); zx*=zl; zy*=zl; zz*=zl;
    var xx=uy*zz-uz*zy, xy=uz*zx-ux*zz, xz=ux*zy-uy*zx;
    var xl=Math.sqrt(xx*xx+xy*xy+xz*xz);
    if (xl) { xl=1/xl; xx*=xl; xy*=xl; xz*=xl; } else { xx=xy=xz=0; }
    var yx=zy*xz-zz*xy, yy=zz*xx-zx*xz, yz=zx*xy-zy*xx;
    o[0]=xx; o[1]=yx; o[2]=zx; o[3]=0;
    o[4]=xy; o[5]=yy; o[6]=zy; o[7]=0;
    o[8]=xz; o[9]=yz; o[10]=zz; o[11]=0;
    o[12]=-(xx*ex+xy*ey+xz*ez);
    o[13]=-(yx*ex+yy*ey+yz*ez);
    o[14]=-(zx*ex+zy*ey+zz*ez);
    o[15]=1;
    return o;
  },
  multiply: function (o, a, b) {
    var a00=a[0],a01=a[1],a02=a[2],a03=a[3],a10=a[4],a11=a[5],a12=a[6],a13=a[7],
        a20=a[8],a21=a[9],a22=a[10],a23=a[11],a30=a[12],a31=a[13],a32=a[14],a33=a[15];
    var b0,b1,b2,b3;
    b0=b[0];b1=b[1];b2=b[2];b3=b[3];
    o[0]=b0*a00+b1*a10+b2*a20+b3*a30; o[1]=b0*a01+b1*a11+b2*a21+b3*a31;
    o[2]=b0*a02+b1*a12+b2*a22+b3*a32; o[3]=b0*a03+b1*a13+b2*a23+b3*a33;
    b0=b[4];b1=b[5];b2=b[6];b3=b[7];
    o[4]=b0*a00+b1*a10+b2*a20+b3*a30; o[5]=b0*a01+b1*a11+b2*a21+b3*a31;
    o[6]=b0*a02+b1*a12+b2*a22+b3*a32; o[7]=b0*a03+b1*a13+b2*a23+b3*a33;
    b0=b[8];b1=b[9];b2=b[10];b3=b[11];
    o[8]=b0*a00+b1*a10+b2*a20+b3*a30; o[9]=b0*a01+b1*a11+b2*a21+b3*a31;
    o[10]=b0*a02+b1*a12+b2*a22+b3*a32; o[11]=b0*a03+b1*a13+b2*a23+b3*a33;
    b0=b[12];b1=b[13];b2=b[14];b3=b[15];
    o[12]=b0*a00+b1*a10+b2*a20+b3*a30; o[13]=b0*a01+b1*a11+b2*a21+b3*a31;
    o[14]=b0*a02+b1*a12+b2*a22+b3*a32; o[15]=b0*a03+b1*a13+b2*a23+b3*a33;
    return o;
  },
  invert: function (o, a) {
    var a00=a[0],a01=a[1],a02=a[2],a03=a[3],a10=a[4],a11=a[5],a12=a[6],a13=a[7],
        a20=a[8],a21=a[9],a22=a[10],a23=a[11],a30=a[12],a31=a[13],a32=a[14],a33=a[15],
        b00=a00*a11-a01*a10,b01=a00*a12-a02*a10,b02=a00*a13-a03*a10,b03=a01*a12-a02*a11,
        b04=a01*a13-a03*a11,b05=a02*a13-a03*a12,b06=a20*a31-a21*a30,b07=a20*a32-a22*a30,
        b08=a20*a33-a23*a30,b09=a21*a32-a22*a31,b10=a21*a33-a23*a31,b11=a22*a33-a23*a32,
        det=b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06;
    if (!det) return null; det=1/det;
    o[0]=(a11*b11-a12*b10+a13*b09)*det; o[1]=(a02*b10-a01*b11-a03*b09)*det;
    o[2]=(a31*b05-a32*b04+a33*b03)*det; o[3]=(a22*b04-a21*b05-a23*b03)*det;
    o[4]=(a12*b08-a10*b11-a13*b07)*det; o[5]=(a00*b11-a02*b08+a03*b07)*det;
    o[6]=(a32*b02-a30*b05-a33*b01)*det; o[7]=(a20*b05-a22*b02+a23*b01)*det;
    o[8]=(a10*b10-a11*b08+a13*b06)*det; o[9]=(a01*b08-a00*b10-a03*b06)*det;
    o[10]=(a30*b04-a31*b02+a33*b00)*det; o[11]=(a21*b02-a20*b04-a23*b00)*det;
    o[12]=(a11*b07-a10*b09-a12*b06)*det; o[13]=(a00*b09-a01*b07+a02*b06)*det;
    o[14]=(a31*b01-a30*b03-a32*b00)*det; o[15]=(a20*b03-a21*b01+a22*b00)*det;
    return o;
  },
  // model = T * Ry * S
  model: function (o, px, py, pz, rotY, sc) {
    var c=Math.cos(rotY), s=Math.sin(rotY);
    o[0]=sc*c; o[1]=0; o[2]=sc*s; o[3]=0;
    o[4]=0; o[5]=sc; o[6]=0; o[7]=0;
    o[8]=-sc*s; o[9]=0; o[10]=sc*c; o[11]=0;
    o[12]=px; o[13]=py; o[14]=pz; o[15]=1;
    return o;
  }
};

// ============ WebGL 初始化 ============
function initGL(canvas) {
  var gl = canvas.getContext('webgl', { antialias: true, alpha: false, premultipliedAlpha: false });
  if (!gl) gl = canvas.getContext('experimental-webgl');
  if (!gl) throw new Error('WebGL not supported');
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.clearColor(0.55, 0.72, 0.85, 1.0);
  return gl;
}

function compile(gl, type, src) {
  var sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    var log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error('Shader compile error: ' + log + '\n' + src);
  }
  return sh;
}

function link(gl, vs, fs) {
  var p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error('Program link error: ' + gl.getProgramInfoLog(p));
  }
  return p;
}

var VS3D = [
  'attribute vec3 aPos;',
  'attribute vec3 aNor;',
  'attribute vec3 aCol;',
  'uniform mat4 uVP;',
  'uniform mat4 uModel;',
  'varying vec3 vCol;',
  'varying vec3 vNor;',
  'varying vec3 vWP;',
  'void main(){',
  '  vec4 wp = uModel * vec4(aPos,1.0);',
  '  vWP = wp.xyz;',
  '  vNor = mat3(uModel) * aNor;',
  '  vCol = aCol;',
  '  gl_Position = uVP * wp;',
  '}'
].join('\n');

var FS3D = [
  'precision mediump float;',
  'varying vec3 vCol;',
  'varying vec3 vNor;',
  'varying vec3 vWP;',
  'uniform vec3 uLightDir;',
  'uniform vec3 uTint;',
  'uniform vec3 uFogColor;',
  'uniform vec2 uFogRange;',
  'uniform vec3 uCamPos;',
  'uniform float uAlpha;',
  'void main(){',
  '  vec3 n = normalize(vNor);',
  '  float lam = clamp(dot(n, normalize(uLightDir)), 0.0, 1.0);',
  '  float lit = 0.5 + 0.5 * lam;',
  '  vec3 c = vCol * lit * uTint;',
  '  float d = length(vWP - uCamPos);',
  '  float f = clamp((d - uFogRange.x) / max(uFogRange.y - uFogRange.x, 0.001), 0.0, 1.0);',
  '  c = mix(c, uFogColor, f);',
  '  gl_FragColor = vec4(c, uAlpha);',
  '}'
].join('\n');

var VSUI = [
  'attribute vec2 aPos;',
  'attribute vec4 aCol;',
  'uniform mat4 uProj;',
  'varying vec4 vC;',
  'void main(){ vC = aCol; gl_Position = uProj * vec4(aPos,0.0,1.0); }'
].join('\n');

var FSUI = [
  'precision mediump float;',
  'varying vec4 vC;',
  'void main(){ gl_FragColor = vC; }'
].join('\n');

function make3DProgram(gl) {
  var p = link(gl, VS3D, FS3D);
  return {
    program: p,
    aPos: gl.getAttribLocation(p, 'aPos'),
    aNor: gl.getAttribLocation(p, 'aNor'),
    aCol: gl.getAttribLocation(p, 'aCol'),
    uVP: gl.getUniformLocation(p, 'uVP'),
    uModel: gl.getUniformLocation(p, 'uModel'),
    uLightDir: gl.getUniformLocation(p, 'uLightDir'),
    uTint: gl.getUniformLocation(p, 'uTint'),
    uFogColor: gl.getUniformLocation(p, 'uFogColor'),
    uFogRange: gl.getUniformLocation(p, 'uFogRange'),
    uCamPos: gl.getUniformLocation(p, 'uCamPos'),
    uAlpha: gl.getUniformLocation(p, 'uAlpha')
  };
}

function makeUIProgram(gl) {
  var p = link(gl, VSUI, FSUI);
  return {
    program: p,
    aPos: gl.getAttribLocation(p, 'aPos'),
    aCol: gl.getAttribLocation(p, 'aCol'),
    uProj: gl.getUniformLocation(p, 'uProj')
  };
}

// ---- 纹理化 UI（2D canvas 覆盖层合成用）----
var VSTEX = [
  'attribute vec2 aPos;',
  'attribute vec2 aUV;',
  'uniform mat4 uProj;',
  'varying vec2 vUV;',
  'void main(){ vUV = aUV; gl_Position = uProj * vec4(aPos, 0.0, 1.0); }'
].join('\n');

var FSTEX = [
  'precision mediump float;',
  'varying vec2 vUV;',
  'uniform sampler2D uTex;',
  'uniform float uAlpha;',
  'void main(){ vec4 c = texture2D(uTex, vUV); gl_FragColor = vec4(c.rgb, c.a * uAlpha); }'
].join('\n');

function makeTexProgram(gl) {
  var p = link(gl, VSTEX, FSTEX);
  return {
    program: p,
    aPos: gl.getAttribLocation(p, 'aPos'),
    aUV: gl.getAttribLocation(p, 'aUV'),
    uProj: gl.getUniformLocation(p, 'uProj'),
    uTex: gl.getUniformLocation(p, 'uTex'),
    uAlpha: gl.getUniformLocation(p, 'uAlpha')
  };
}

// 全屏纹理 quad：把离屏 canvas 内容贴到屏幕。上传时开 UNPACK_FLIP_Y_WEBGL，
// 因此 UV (0,0)=画布左上角，(1,1)=右下角。
function TexQuad(gl) {
  this.gl = gl;
  this.vbo = gl.createBuffer();
  this.ibo = gl.createBuffer();
  this.tex = gl.createTexture();
  this.count = 0;
}

TexQuad.prototype.upload = function (w, h) {
  var gl = this.gl;
  var p = [
    0, 0,  0, 1,
    w, 0,  1, 1,
    w, h,  1, 0,
    0, h,  0, 0
  ];
  var idx = [0, 1, 2, 0, 2, 3];
  this.count = idx.length;
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(p), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
};

TexQuad.prototype.draw = function (prog, alpha) {
  var gl = this.gl;
  if (this.count === 0) return;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, this.tex);
  gl.useProgram(prog.program);
  gl.uniform1i(prog.uTex, 0);
  gl.uniform1f(prog.uAlpha, alpha == null ? 1 : alpha);
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
  gl.enableVertexAttribArray(prog.aPos);
  gl.vertexAttribPointer(prog.aPos, 2, gl.FLOAT, false, 4 * 4, 0);
  gl.enableVertexAttribArray(prog.aUV);
  gl.vertexAttribPointer(prog.aUV, 2, gl.FLOAT, false, 4 * 4, 2 * 4);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
  gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
};

// ============ 几何生成 (append 到外部数组) ============
// arrays = { p:[], n:[], c:[], i:[] }  base index 自动
function pushV(arrays, x, y, z, nx, ny, nz, r, g, b) {
  var idx = arrays.p.length / 3;
  arrays.p.push(x, y, z);
  arrays.n.push(nx, ny, nz);
  arrays.c.push(r, g, b);
  return idx;
}

function buildBox(a, cx, cy, cz, sx, sy, sz, col) {
  var hx = sx / 2, hy = sy / 2, hz = sz / 2;
  var r = col[0], g = col[1], b = col[2];
  var faces = [
    // +X
    [[hx,-hy,-hz],[hx,hy,-hz],[hx,hy,hz],[hx,-hy,hz],[1,0,0]],
    // -X
    [[-hx,-hy,hz],[-hx,hy,hz],[-hx,hy,-hz],[-hx,-hy,-hz],[-1,0,0]],
    // +Y
    [[-hx,hy,-hz],[-hx,hy,hz],[hx,hy,hz],[hx,hy,-hz],[0,1,0]],
    // -Y
    [[-hx,-hy,hz],[-hx,-hy,-hz],[hx,-hy,-hz],[hx,-hy,hz],[0,-1,0]],
    // +Z
    [[hx,-hy,hz],[hx,hy,hz],[-hx,hy,hz],[-hx,-hy,hz],[0,0,1]],
    // -Z
    [[-hx,-hy,-hz],[-hx,hy,-hz],[hx,hy,-hz],[hx,-hy,-hz],[0,0,-1]]
  ];
  // fix -X face typo by recomputing cleanly
  faces[1] = [[-hx,-hy,hz],[-hx,hy,hz],[-hx,hy,-hz],[-hx,-hy,-hz],[-1,0,0]];
  for (var f = 0; f < faces.length; f++) {
    var fc = faces[f], nrm = fc[4];
    var i0 = pushV(a, cx+fc[0][0], cy+fc[0][1], cz+fc[0][2], nrm[0],nrm[1],nrm[2], r,g,b);
    var i1 = pushV(a, cx+fc[1][0], cy+fc[1][1], cz+fc[1][2], nrm[0],nrm[1],nrm[2], r,g,b);
    var i2 = pushV(a, cx+fc[2][0], cy+fc[2][1], cz+fc[2][2], nrm[0],nrm[1],nrm[2], r,g,b);
    var i3 = pushV(a, cx+fc[3][0], cy+fc[3][1], cz+fc[3][2], nrm[0],nrm[1],nrm[2], r,g,b);
    a.i.push(i0,i1,i2, i0,i2,i3);
  }
}

function buildCone(a, cx, cy, cz, rad, h, seg, col) {
  var r = col[0], g = col[1], b = col[2];
  var apex = pushV(a, cx, cy + h, cz, 0, 1, 0, r, g, b);
  var ring = [];
  var slope = rad / Math.sqrt(rad * rad + h * h);
  for (var k = 0; k < seg; k++) {
    var ang = (k / seg) * Math.PI * 2;
    var px = Math.cos(ang) * rad, pz = Math.sin(ang) * rad;
    var nx = Math.cos(ang) * (1 - slope), nz = Math.sin(ang) * (1 - slope), ny = slope;
    var nl = Math.sqrt(nx*nx+ny*ny+nz*nz); nx/=nl; ny/=nl; nz/=nl;
    ring.push(pushV(a, cx+px, cy, cz+pz, nx, ny, nz, r, g, b));
  }
  for (var k2 = 0; k2 < seg; k2++) {
    var c0 = ring[k2], c1 = ring[(k2 + 1) % seg];
    a.i.push(apex, c1, c0); // side
    // bottom
    var bc = pushV(a, cx, cy, cz, 0, -1, 0, r*0.7, g*0.7, b*0.7);
    a.i.push(bc, c0, c1);
  }
}

function buildCyl(a, cx, cy, cz, rad, h, seg, col) {
  var r = col[0], g = col[1], b = col[2];
  var top = [], bot = [];
  for (var k = 0; k < seg; k++) {
    var ang = (k / seg) * Math.PI * 2;
    var px = Math.cos(ang) * rad, pz = Math.sin(ang) * rad;
    top.push(pushV(a, cx+px, cy+h, cz+pz, Math.cos(ang),0,Math.sin(ang), r,g,b));
    bot.push(pushV(a, cx+px, cy, cz+pz, Math.cos(ang),0,Math.sin(ang), r*0.8,g*0.8,b*0.8));
  }
  var tc = pushV(a, cx, cy+h, cz, 0,1,0, r,g,b);
  var bc2 = pushV(a, cx, cy, cz, 0,-1,0, r*0.6,g*0.6,b*0.6);
  for (var k2 = 0; k2 < seg; k2++) {
    var n = (k2 + 1) % seg;
    a.i.push(top[k2], top[n], bot[n], top[k2], bot[n], bot[k2]); // side
    a.i.push(tc, top[n], top[k2]); // top cap
    a.i.push(bc2, bot[k2], bot[n]); // bottom cap
  }
}

function buildSphere(a, cx, cy, cz, rad, rings, sectors, col) {
  var r = col[0], g = col[1], b = col[2];
  var grid = [];
  for (var i = 0; i <= rings; i++) {
    var row = [];
    var v = i / rings, theta = v * Math.PI;
    for (var j = 0; j <= sectors; j++) {
      var u = j / sectors, phi = u * Math.PI * 2;
      var nx = Math.sin(theta) * Math.cos(phi);
      var ny = Math.cos(theta);
      var nz = Math.sin(theta) * Math.sin(phi);
      row.push(pushV(a, cx+nx*rad, cy+ny*rad, cz+nz*rad, nx,ny,nz, r,g,b));
    }
    grid.push(row);
  }
  for (var i2 = 0; i2 < rings; i2++) {
    for (var j2 = 0; j2 < sectors; j2++) {
      var p0 = grid[i2][j2], p1 = grid[i2][j2+1], p2 = grid[i2+1][j2+1], p3 = grid[i2+1][j2];
      a.i.push(p0,p1,p2, p0,p2,p3);
    }
  }
}

// 2D UI: 三角展开圆 (TRIANGLES), arrays2 = { p:[], c:[] }
function buildCircle2D(a, cx, cy, rad, seg, col4) {
  var cc = a.p.length / 2;
  a.p.push(cx, cy); a.c.push(col4[0],col4[1],col4[2],col4[3]);
  var first = -1, prev = -1;
  for (var k = 0; k <= seg; k++) {
    var ang = (k / seg) * Math.PI * 2;
    var idx = a.p.length / 2;
    a.p.push(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad);
    a.c.push(col4[0],col4[1],col4[2],col4[3]);
    if (k === 0) first = idx; else { a.i2.push(cc, prev, idx); }
    prev = idx;
  }
}
function buildRect2D(a, x, y, w, h, col4) {
  var i0 = a.p.length/2; a.p.push(x,y); a.c.push(col4[0],col4[1],col4[2],col4[3]);
  var i1 = a.p.length/2; a.p.push(x+w,y); a.c.push(col4[0],col4[1],col4[2],col4[3]);
  var i2 = a.p.length/2; a.p.push(x+w,y+h); a.c.push(col4[0],col4[1],col4[2],col4[3]);
  var i3 = a.p.length/2; a.p.push(x,y+h); a.c.push(col4[0],col4[1],col4[2],col4[3]);
  a.i2.push(i0,i1,i2, i0,i2,i3);
}

// ============ Mesh ============
function Mesh(gl) {
  this.gl = gl;
  this.vbo = gl.createBuffer();
  this.nbo = gl.createBuffer();
  this.cbo = gl.createBuffer();
  this.ibo = gl.createBuffer();
  this.count = 0;
}
Mesh.prototype.upload = function (pos, nor, col, idx) {
  var gl = this.gl;
  this.count = idx.length;
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, this.nbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nor), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, this.cbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(col), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
};
Mesh.prototype.draw = function (prog) {
  var gl = this.gl;
  if (this.count === 0) return;
  gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
  gl.enableVertexAttribArray(prog.aPos);
  gl.vertexAttribPointer(prog.aPos, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, this.nbo);
  gl.enableVertexAttribArray(prog.aNor);
  gl.vertexAttribPointer(prog.aNor, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, this.cbo);
  gl.enableVertexAttribArray(prog.aCol);
  gl.vertexAttribPointer(prog.aCol, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
  gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
};

// UI mesh (interleaved pos2+col4 -> two buffers)
function UIMesh(gl) {
  this.gl = gl;
  this.pbo = gl.createBuffer();
  this.cbo = gl.createBuffer();
  this.count = 0;
}
UIMesh.prototype.upload = function (pos, col, idx) {
  var gl = this.gl;
  this.count = idx.length;
  gl.bindBuffer(gl.ARRAY_BUFFER, this.pbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, this.cbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(col), gl.DYNAMIC_DRAW);
  this._idx = new Uint16Array(idx);
  if (!this._ibo) this._ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this._idx, gl.DYNAMIC_DRAW);
};
UIMesh.prototype.draw = function (prog) {
  var gl = this.gl;
  if (this.count === 0) return;
  gl.bindBuffer(gl.ARRAY_BUFFER, this.pbo);
  gl.enableVertexAttribArray(prog.aPos);
  gl.vertexAttribPointer(prog.aPos, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, this.cbo);
  gl.enableVertexAttribArray(prog.aCol);
  gl.vertexAttribPointer(prog.aCol, 4, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ibo);
  gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
};

module.exports = {
  mat4: mat4,
  initGL: initGL,
  make3DProgram: make3DProgram,
  makeUIProgram: makeUIProgram,
  makeTexProgram: makeTexProgram,
  TexQuad: TexQuad,
  buildBox: buildBox,
  buildCone: buildCone,
  buildCyl: buildCyl,
  buildSphere: buildSphere,
  buildCircle2D: buildCircle2D,
  buildRect2D: buildRect2D,
  Mesh: Mesh,
  UIMesh: UIMesh
};
