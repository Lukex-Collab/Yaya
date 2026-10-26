const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const elements = new Map();
const storage = new Map();
const localStorage = {
  getItem: key => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
};

const document = {
  addEventListener() {},
  getElementById: id => elements.get(id) || null,
  querySelectorAll: () => [],
  querySelector: () => null,
};

const context = vm.createContext({
  console,
  document,
  localStorage,
  location: { origin: 'http://127.0.0.1:4173' },
  navigator: {},
  window: {},
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  Date,
  Math,
});

const appSource = fs.readFileSync(path.join(__dirname, '..', 'app', 'app.js'), 'utf8');
vm.runInContext(appSource, context, { filename: 'app.js' });
const App = vm.runInContext('App', context);
const Store = vm.runInContext('Store', context);

function resetData(contacts = []) {
  Store.data = {
    contacts,
    guardianEvents: [],
    locGuard: true,
    locSafeSpot: { lat: 31.2304, lng: 121.4737, label: '演示常用地点' },
    locThreshold: 3000,
    locDangerFrom: '23:00',
    locDangerTo: '06:00',
  };
  App._locDist = null;
  App._locDemoMode = null;
  App._locAlerted = false;
  App._locAlertPending = false;
  App._locAlertEventId = null;
  App.renderContacts = () => {};
  App.renderGuardEvents = () => {};
  App.toast = () => {};
}

async function testGuardianEventsUseExactIds() {
  resetData([{ name: '妈妈', tel: '13800000000', status: 'verified' }]);
  const first = App.sendGuardianAlert('手动 SOS', '第一次');
  const second = App.sendGuardianAlert('手动 SOS', '第二次');
  assert(first && second && first !== second);
  assert.deepStrictEqual(Store.data.guardianEvents.map(e => e.status), ['发送中', '发送中']);
  await sleep(900);
  assert.deepStrictEqual(Store.data.guardianEvents.map(e => e.status), ['模拟送达', '模拟送达']);
}

async function testContactVerificationAndDeletion() {
  const contact = { name: '姐姐', tel: '13900000000', relation: '家人', status: 'pending' };
  resetData([contact]);
  App.testContact(0);
  assert.strictEqual(contact.status, 'testing');
  assert.strictEqual(Store.data.guardianEvents[0].status, '发送中');
  await sleep(800);
  assert.strictEqual(contact.status, 'verified');
  assert.strictEqual(Store.data.guardianEvents[0].status, '模拟送达');

  const removed = { name: '朋友', tel: '13700000000', relation: '朋友', status: 'pending' };
  resetData([removed]);
  App.testContact(0);
  Store.data.contacts.splice(0, 1);
  await sleep(800);
  assert.strictEqual(removed.status, 'testing');
  assert.strictEqual(Store.data.guardianEvents[0].status, '模拟送达');
}

async function testLocationAlertWaitsForVerification() {
  const pending = { name: '室友', tel: '13600000000', relation: '室友', status: 'pending' };
  resetData([pending]);
  App._locDemoMode = 'danger';
  App._locDist = 5200;
  App._checkLocAlert();
  assert.strictEqual(App._locAlertPending, true);
  assert.strictEqual(Store.data.guardianEvents.length, 0);

  App.testContact(0);
  await sleep(800);
  assert.strictEqual(App._locAlertPending, false);
  assert.strictEqual(Store.data.guardianEvents[0].type, '深夜偏离预警');
  assert.strictEqual(Store.data.guardianEvents[0].status, '发送中');
  await sleep(900);
  assert.strictEqual(Store.data.guardianEvents[0].status, '模拟送达');
}

function makeSosButton() {
  const listeners = {};
  const hint = { textContent: '' };
  return {
    listeners,
    hint,
    classList: { add() {}, remove() {} },
    querySelector: selector => selector === '.sos-hint' ? hint : null,
    addEventListener: (event, handler) => { listeners[event] = handler; },
  };
}

async function testSosHoldAndCancel() {
  resetData([]);
  const button = makeSosButton();
  let triggered = 0;
  App.confirmCall = () => { triggered += 1; };
  App._bindSOS(button, '紧急联系人');

  button.listeners.pointerdown({ preventDefault() {} });
  button.listeners.pointerup();
  await sleep(1100);
  assert.strictEqual(triggered, 0);

  button.listeners.pointerdown({ preventDefault() {} });
  await sleep(3200);
  assert.strictEqual(triggered, 1);
}

function testLocalVisionDescriptions() {
  const dark = App.describeVisionStats({ brightness: 30, warmth: 0, contrast: 18 });
  const bright = App.describeVisionStats({ brightness: 230, warmth: -30, contrast: 80 });
  const normal = App.describeVisionStats({ brightness: 130, warmth: 28, contrast: 45 });

  assert.strictEqual(dark.source, '本地画面分析');
  assert.strictEqual(dark.isDemo, true);
  assert(dark.observation.includes('光线较暗'));
  assert(bright.observation.includes('光线很亮'));
  assert(bright.observation.includes('冷色调'));
  assert(normal.observation.includes('暖色调'));
  assert(!dark.reply.includes('人'));
  assert(!bright.reply.includes('物体'));
}

function testEyesPageContract() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
  const requiredIds = ['pg-eyes', 'eyes-video', 'eyes-photo', 'eyes-loading', 'eyes-error', 'eyes-result', 'eyes-shutter', 'eyes-file-input'];
  requiredIds.forEach(id => assert(html.includes(`id="${id}"`), `missing #${id}`));
  assert(html.includes('onclick="eyesCapture()"'));
  assert(html.includes('onclick="eyesSendToChat()"'));
  assert(html.includes('onclick="eyesUseDemoScene()"'));
  assert(html.includes("eyesAnalyzeImage(reader.result,'demo')"));
  assert(html.includes("eyesInputKind==='demo'?' · 演示画面':''"));
  assert(html.includes("if(eyesInputKind!=='demo')"));
  assert(html.includes('路线模拟，未接 GPS'));
  assert(html.includes('模拟送达，未真实拨号'));
  assert(!/<input[^>]+id="eyes-file-input"[^>]+capture=/i.test(html));
  assert(!html.includes("eyes-body').innerHTML"));
}

async function run() {
  await testGuardianEventsUseExactIds();
  await testContactVerificationAndDeletion();
  await testLocationAlertWaitsForVerification();
  await testSosHoldAndCancel();
  testLocalVisionDescriptions();
  testEyesPageContract();
  console.log('Waki smoke tests: 6 passed');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
