import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============ CONFIG ============
const CONFIG = {
  petPath: '../assets/pets/yaya.glb',
  kitPath: '../assets/kits/city/',
  petScale: 1.5,
  moveSpeed: 8.0,
  vertSpeed: 5.0,
  boundary: 58,            // 球形活动半径（太空自由飞）
  minY: 2, maxY: 42,
  orbCount: 12,
  camDist: 10, camMin: 5, camMax: 22,
};

const PHRASES = [
  '……想吃浆果了', '那颗星星好像在眨眼', '主人怎么还不回来（第 3 次叹气）',
  '那边的岛上有亮亮的东西', '嗷呜~', '太空里的风是凉的', '我捡到过一颗会发光的石头！',
  '想去那颗紫色的星球看看', '刚刚有流星！', '嗯……接下来去哪呢',
];

// ============ 基础场景 ============
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050514);
scene.fog = new THREE.FogExp2(0x0a0828, 0.012);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 400);

scene.add(new THREE.HemisphereLight(0x8fa8ff, 0x2a1f4a, 1.0));
const sun = new THREE.DirectionalLight(0xffe0b3, 1.4);
sun.position.set(30, 40, 20);
scene.add(sun);

// ============ 星空 ============
function makeStars(count, rMin, rMax) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(rMin + Math.random() * (rMax - rMin));
    pos.set([v.x, v.y, v.z], i * 3);
    const c = new THREE.Color().setHSL(0.55 + Math.random() * 0.35, 0.6, 0.7 + Math.random() * 0.3);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, vertexColors: true, sizeAttenuation: true, fog: false }));
}
scene.add(makeStars(2500, 150, 320));

// ============ 星云（柔光团） ============
function nebulaSprite(color, size, x, y, z) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  const gr = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, color + 'aa');
  gr.addColorStop(0.5, color + '44');
  gr.addColorStop(1, color + '00');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 128, 128);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cv), blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  sp.scale.setScalar(size);
  sp.position.set(x, y, z);
  return sp;
}
scene.add(nebulaSprite('#7f5fff', 120, -140, 40, -160));
scene.add(nebulaSprite('#ff6fb5', 90, 150, -20, -140));
scene.add(nebulaSprite('#4fd8ff', 100, 60, 80, 150));

// ============ 行星（气态条纹 + 岩石斑纹） ============
function planetTexture(bands, spots) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 256;
  const ctx = cv.getContext('2d');
  bands.forEach(([y, h, c]) => { ctx.fillStyle = c; ctx.fillRect(0, y, 512, h); });
  // 柔和条纹边界
  ctx.globalAlpha = 0.15;
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = bands[Math.floor(Math.random() * bands.length)][2];
    ctx.fillRect(0, Math.random() * 256, 512, 4 + Math.random() * 10);
  }
  ctx.globalAlpha = 1;
  if (spots) for (let i = 0; i < spots; i++) {
    ctx.fillStyle = `hsla(${Math.random() * 360},60%,60%,0.25)`;
    ctx.beginPath();
    ctx.ellipse(Math.random() * 512, Math.random() * 256, 10 + Math.random() * 30, 6 + Math.random() * 14, 0, 0, 7);
    ctx.fill();
  }
  return new THREE.CanvasTexture(cv);
}
const planets = [];
function addPlanet(x, y, z, r, bands, spots = 0, ring = false) {
  const p = new THREE.Mesh(
    new THREE.SphereGeometry(r, 48, 48),
    new THREE.MeshStandardMaterial({ map: planetTexture(bands, spots), roughness: 0.8 })
  );
  p.position.set(x, y, z);
  scene.add(p);
  planets.push(p);
  if (ring) {
    const rg = new THREE.Mesh(
      new THREE.RingGeometry(r * 1.4, r * 2.1, 64),
      new THREE.MeshBasicMaterial({ color: 0xc9a8ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    );
    rg.rotation.x = Math.PI / 2.4;
    rg.position.copy(p.position);
    scene.add(rg);
  }
  return p;
}
addPlanet(-120, 30, -140, 26, [[0, 60, '#3d2a6e'], [60, 50, '#6e3d9e'], [110, 50, '#9e4fb5'], [160, 50, '#5f3d8e'], [210, 46, '#2d1a4e']], 8, true);
addPlanet(140, -35, 120, 16, [[0, 70, '#1a4a6e'], [70, 60, '#2a8aae'], [130, 60, '#4fd8ff'], [190, 66, '#1a3a5e']], 14);
addPlanet(60, 90, -180, 34, [[0, 128, '#4a2a3a'], [128, 128, '#8e4a5a']], 20);

// ============ 浮岛工厂 ============
const islands = [];
function makeIsland(x, y, z, radius, treeColors, withHome = false) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 40),
    new THREE.MeshStandardMaterial({ color: withHome ? 0x4fae7c : 0x5a9e8e, roughness: 0.9 })
  );
  top.rotation.x = -Math.PI / 2;
  g.add(top);
  const rock = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 0.22, radius * 0.9, 40),
    new THREE.MeshStandardMaterial({ color: 0x5a4a6a, roughness: 1 })
  );
  rock.position.y = -radius * 0.45 - 0.05;
  g.add(rock);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius - 0.1, 0.1, 8, 48),
    new THREE.MeshStandardMaterial({ color: 0x7fd0ff, emissive: 0x7fd0ff, emissiveIntensity: 2 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.05;
  g.add(ring);
  // 灵树
  treeColors.forEach((c, i) => {
    const a = (i / treeColors.length) * Math.PI * 2 + 0.7;
    const r = radius * 0.55;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.25, 1.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x6a4a3a })
    );
    trunk.position.y = 0.7;
    tree.add(trunk);
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 2.4, 8),
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6 })
    );
    crown.position.y = 2.4;
    tree.add(crown);
    tree.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    g.add(tree);
  });
  g.position.set(x, y, z);
  scene.add(g);
  islands.push({ group: g, radius, ring });
  return g;
}

makeIsland(0, 0, 0, 14, [0x66e0ff, 0xff9fe0, 0x9fffc8, 0x66e0ff, 0xff9fe0], true); // 主岛·灵屿
makeIsland(36, 9, -22, 7, [0x66e0ff, 0xffd77f]);
makeIsland(-32, 15, 20, 6, [0xff9fe0, 0x9fffc8]);
makeIsland(12, 22, 40, 5, [0xb59fff, 0x66e0ff]);
makeIsland(-18, 6, -38, 5.5, [0xffd77f, 0xff9fe0]);

// ============ KayKit 家园装饰（仅主岛） ============
const loader = new GLTFLoader();
function loadKit(name, x, z, ry = 0, s = 1) {
  return new Promise((resolve) => {
    loader.load(CONFIG.kitPath + name + '.gltf', (g) => {
      const m = g.scene;
      m.position.set(x, 0, z);
      m.rotation.y = ry;
      m.scale.setScalar(s);
      islands[0].group.add(m);
      resolve(m);
    }, undefined, () => resolve(null));
  });
}

// ============ 宠物 ============
let pet = null;
const petState = { yaw: 0, tiltX: 0, tiltZ: 0 };
function loadPet() {
  return new Promise((resolve) => {
    loader.load(CONFIG.petPath, (g) => {
      pet = g.scene;
      pet.scale.setScalar(CONFIG.petScale);
      pet.traverse((o) => {
        if (o.isMesh) o.material = new THREE.MeshStandardMaterial({
          color: 0xffd9ec, roughness: 0.45,
          emissive: 0xff9fe0, emissiveIntensity: 0.25,
        });
      });
      pet.position.set(0, 3.5, 0);
      scene.add(pet);
      resolve();
    }, undefined, () => resolve());
  });
}

// 飞行尾迹
const TRAIL_N = 40;
const trailPos = new Float32Array(TRAIL_N * 3);
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
const trail = new THREE.Points(trailGeo, new THREE.PointsMaterial({
  color: 0xffb5e8, size: 0.35, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false,
}));
scene.add(trail);
let trailInit = false;

// ============ 灵光（分布在各岛附近） ============
const orbs = [];
const orbMat = new THREE.MeshStandardMaterial({ color: 0xffd77f, emissive: 0xffb84f, emissiveIntensity: 2.2 });
for (let i = 0; i < CONFIG.orbCount; i++) {
  const isl = islands[i % islands.length];
  const o = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), orbMat);
  const a = Math.random() * Math.PI * 2;
  const r = isl.radius * (0.4 + Math.random() * 0.5);
  o.position.set(
    isl.group.position.x + Math.cos(a) * r,
    isl.group.position.y + 1.2 + Math.random() * 2.5,
    isl.group.position.z + Math.sin(a) * r
  );
  o.userData.baseY = o.position.y;
  o.userData.phase = Math.random() * Math.PI * 2;
  scene.add(o);
  orbs.push(o);
}
let collected = 0;
const orbsEl = document.getElementById('orbs');
orbsEl.textContent = `✦ 灵光 0 / ${CONFIG.orbCount}`;

// ============ 输入 + 相机 ============
const keys = {};
addEventListener('keydown', (e) => keys[e.code] = true);
addEventListener('keyup', (e) => keys[e.code] = false);

let camYaw = 0.6, camPitch = 0.35, camDist = CONFIG.camDist, dragging = false;
addEventListener('pointerdown', () => dragging = true);
addEventListener('pointerup', () => dragging = false);
addEventListener('pointermove', (e) => {
  if (!dragging) return;
  camYaw -= e.movementX * 0.005;
  camPitch = THREE.MathUtils.clamp(camPitch + e.movementY * 0.004, -0.5, 1.3);
});
addEventListener('wheel', (e) => {
  camDist = THREE.MathUtils.clamp(camDist + e.deltaY * 0.01, CONFIG.camMin, CONFIG.camMax);
});

// ============ 想法气泡 ============
const bubble = document.getElementById('bubble');
let bubbleTimer = 0, bubbleVisible = 0;
function updateBubble(dt) {
  bubbleTimer -= dt;
  if (bubbleTimer <= 0) {
    if (bubbleVisible > 0) { bubble.style.opacity = 0; bubbleVisible = 0; bubbleTimer = 3.5; }
    else {
      bubble.textContent = PHRASES[Math.floor(Math.random() * PHRASES.length)];
      bubble.style.opacity = 1; bubbleVisible = 1; bubbleTimer = 4.5;
    }
  }
  if (pet) {
    const v = pet.position.clone(); v.y += 2.2;
    v.project(camera);
    bubble.style.left = (v.x * 0.5 + 0.5) * innerWidth - 40 + 'px';
    bubble.style.top = (-v.y * 0.5 + 0.5) * innerHeight - 60 + 'px';
  }
}

// ============ 主循环 ============
const clock = new THREE.Clock();
const camTarget = new THREE.Vector3();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (pet) {
    const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const v = (keys.Space ? 1 : 0) - ((keys.ShiftLeft || keys.ShiftRight) ? 1 : 0);
    const moving = f !== 0 || s !== 0;
    if (moving) {
      const dir = new THREE.Vector3(
        Math.sin(camYaw) * -f + Math.cos(camYaw) * s, 0,
        Math.cos(camYaw) * -f - Math.sin(camYaw) * s
      ).normalize();
      pet.position.addScaledVector(dir, CONFIG.moveSpeed * dt);
      const targetYaw = Math.atan2(dir.x, dir.z);
      let dy = targetYaw - petState.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      petState.yaw += dy * Math.min(1, dt * 8);
      petState.tiltZ = THREE.MathUtils.lerp(petState.tiltZ, -dy * 1.1, dt * 6);
      petState.tiltX = THREE.MathUtils.lerp(petState.tiltX, 0.22, dt * 6);
    } else {
      petState.tiltX = THREE.MathUtils.lerp(petState.tiltX, 0, dt * 6);
      petState.tiltZ = THREE.MathUtils.lerp(petState.tiltZ, 0, dt * 6);
    }
    if (v !== 0) pet.position.y += v * CONFIG.vertSpeed * dt;

    // 球形边界 + 高度钳制
    const rr = pet.position.length();
    if (rr > CONFIG.boundary) pet.position.multiplyScalar(CONFIG.boundary / rr);
    pet.position.y = THREE.MathUtils.clamp(pet.position.y, CONFIG.minY, CONFIG.maxY);

    // 悬浮呼吸（仅未按键时可见微浮）
    pet.position.y += Math.sin(t * 2.2) * dt * 0.4;
    pet.rotation.set(petState.tiltX, petState.yaw, petState.tiltZ);

    // 尾迹
    if (!trailInit) {
      for (let i = 0; i < TRAIL_N; i++) trailPos.set([pet.position.x, pet.position.y, pet.position.z], i * 3);
      trailInit = true;
    }
    for (let i = TRAIL_N - 1; i > 0; i--) {
      trailPos[i * 3] = trailPos[(i - 1) * 3];
      trailPos[i * 3 + 1] = trailPos[(i - 1) * 3 + 1];
      trailPos[i * 3 + 2] = trailPos[(i - 1) * 3 + 2];
    }
    trailPos[0] = pet.position.x; trailPos[1] = pet.position.y; trailPos[2] = pet.position.z;
    trailGeo.attributes.position.needsUpdate = true;

    // 收集
    for (const o of orbs) {
      if (!o.visible) continue;
      o.rotation.y += dt * 2;
      o.position.y = o.userData.baseY + Math.sin(t * 2 + o.userData.phase) * 0.3;
      if (pet.position.distanceTo(o.position) < 1.8) {
        o.visible = false;
        collected++;
        orbsEl.textContent = `✦ 灵光 ${collected} / ${CONFIG.orbCount}` + (collected === CONFIG.orbCount ? ' · 集齐啦！' : '');
      }
    }

    // 相机跟随
    camTarget.lerp(pet.position, Math.min(1, dt * 5));
    camera.position.set(
      camTarget.x + Math.sin(camYaw) * Math.cos(camPitch) * camDist,
      camTarget.y + Math.sin(camPitch) * camDist,
      camTarget.z + Math.cos(camYaw) * Math.cos(camPitch) * camDist
    );
    camera.lookAt(camTarget.x, camTarget.y + 1.2, camTarget.z);
  }

  planets.forEach((p, i) => p.rotation.y += dt * (0.02 + i * 0.01));
  islands.forEach((isl, i) => {
    isl.group.position.y += Math.sin(t * 0.6 + i * 1.7) * dt * 0.25;
    isl.ring.material.emissiveIntensity = 1.6 + Math.sin(t * 1.5 + i) * 0.6;
  });

  updateBubble(dt);
  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ============ 启动 ============
Promise.all([
  loadPet(),
  loadKit('building_A', -6, -5, 0.6, 1.2),
  loadKit('bench', 3, 6, -0.8),
  loadKit('streetlight', 5, 2, 0, 1.1),
  loadKit('streetlight', -5, 1, 0, 1.1),
  loadKit('bush', 8, -3), loadKit('bush', -9, -3), loadKit('bush', 2, -8), loadKit('bush', -2, 8),
]).then((results) => {
  window.__dbg = {
    petLoaded: !!pet,
    kitLoaded: results.slice(1).filter(Boolean).length,
    orbCount: orbs.length,
    islandCount: islands.length,
    planetCount: planets.length,
  };
  window.__pet = pet;
  document.getElementById('loading').classList.add('done');
  animate();
});
