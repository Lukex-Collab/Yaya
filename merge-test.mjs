import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ss = (n) => path.join(__dirname, n);
const base = 'file:///' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: ss('merge-01-home.png') });
console.log('✓ Home');

// Switch to game tab
await page.click('.tab-btn[data-tab="game"]');
await page.waitForTimeout(400);
await page.screenshot({ path: ss('merge-02-game.png') });
console.log('✓ Game tab');

// Switch to handbook
await page.click('.tab-btn[data-tab="handbook"]');
await page.waitForTimeout(400);
await page.screenshot({ path: ss('merge-03-handbook.png') });
console.log('✓ Handbook tab');

// Back to game, click unlocked world card
await page.click('.tab-btn[data-tab="game"]');
await page.waitForTimeout(300);
await page.click('.game-world-card[data-world="home"]');
await page.waitForTimeout(600);
await page.screenshot({ path: ss('merge-04-house-click.png') });
console.log('✓ House click → returns to yaya tab');

await browser.close();
console.log('\nAll screenshots captured!');
