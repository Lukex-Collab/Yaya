import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = 'file:///' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

let ok = 0, total = 0;

// 1. Tabs
total++;
await page.click('.tab-btn[data-tab="game"]');
await page.waitForTimeout(300);
if (await page.evaluate(() => document.getElementById('tab-game').classList.contains('active'))) ok++;
console.log(ok === total ? '✓' : '✗', 'Game tab');

total++;
await page.click('.tab-btn[data-tab="handbook"]');
await page.waitForTimeout(300);
if (await page.evaluate(() => document.getElementById('tab-handbook').classList.contains('active'))) ok++;
console.log(ok === total ? '✓' : '✗', 'Handbook tab');

total++;
await page.click('.tab-btn[data-tab="yaya"]');
await page.waitForTimeout(300);
if (await page.evaluate(() => document.getElementById('tab-yaya').classList.contains('active'))) ok++;
console.log(ok === total ? '✓' : '✗', 'Yaya tab');

// 2. Shield
total++;
await page.click('#btn-shield');
await page.waitForTimeout(400);
if (await page.evaluate(() => document.getElementById('sheet-shield').classList.contains('on'))) ok++;
console.log(ok === total ? '✓' : '✗', 'Shield opens');

total++;
await page.click('#btn-sheet-close');
await page.waitForTimeout(300);
if (await page.evaluate(() => !document.getElementById('sheet-shield').classList.contains('on'))) ok++;
console.log(ok === total ? '✓' : '✗', 'Shield closes');

// 3. Settings
total++;
await page.click('#btn-gear');
await page.waitForTimeout(400);
if (await page.evaluate(() => document.getElementById('page-settings').classList.contains('open'))) ok++;
console.log(ok === total ? '✓' : '✗', 'Settings opens');

total++;
await page.click('#page-settings .page-back');
await page.waitForTimeout(300);
if (await page.evaluate(() => !document.getElementById('page-settings').classList.contains('open'))) ok++;
console.log(ok === total ? '✓' : '✗', 'Settings closes');

// 4. Calendar
total++;
await page.click('#btn-blackboard');
await page.waitForTimeout(400);
if (await page.evaluate(() => document.getElementById('popover-calendar').classList.contains('on'))) ok++;
console.log(ok === total ? '✓' : '✗', 'Calendar popover');

total++;
await page.click('#popover-mask');
await page.waitForTimeout(300);
if (await page.evaluate(() => !document.getElementById('popover-calendar').classList.contains('on'))) ok++;
console.log(ok === total ? '✓' : '✗', 'Calendar closes');

// 5. Click yaya → headpat
total++;
await page.click('#yaya-container');
await page.waitForTimeout(500);
if (await page.evaluate(() => document.getElementById('yaya-video').src.includes('yaya-headpat'))) ok++;
console.log(ok === total ? '✓' : '✗', 'Click → headpat video');

// 6. Text input + reply
await page.click('#btn-kbd');
await page.waitForTimeout(200);
await page.type('#text-input', '你好牙牙');
total++;
await page.click('#btn-send');
await page.waitForTimeout(1500);
if (await page.evaluate(() => document.querySelectorAll('#drawer-messages .d-bubble.yy').length > 0)) ok++;
console.log(ok === total ? '✓' : '✗', 'Chat reply');

// 7. Background image loaded
total++;
if (await page.evaluate(() => {
  const el = document.querySelector('.scene-sky');
  const bg = el ? getComputedStyle(el).backgroundImage : '';
  return bg.includes('yaya-bg.png');
})) ok++;
console.log(ok === total ? '✓' : '✗', 'Background image');

console.log('\n' + ok + '/' + total + ' passed');

await page.screenshot({ path: path.join(__dirname, 'final-check.png') });
await browser.close();
