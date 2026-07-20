import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = path.dirname(fileURLToPath(import.meta.url));
const url = 'file://' + path.join(dir, '..', 'index.html');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url);

const title = await page.title();
assert.equal(title, 'eフィーバーキン肉マン 疑似遊技シミュレーター');

// Setup screen is gone; the game is active immediately on load.
const gameActive = await page.evaluate(() => document.getElementById('game').classList.contains('active'));
assert.equal(gameActive, true);
assert.equal(await page.locator('#setup').count(), 0);

// Fixed wallet, default spk 17, dropdown enabled pre-spin.
const initial = await page.evaluate(() => ({ wallet: S.wallet, spk: S.spk, spkLocked: S.spkLocked }));
assert.equal(initial.wallet, 100000);
assert.equal(initial.spk, 17);
assert.equal(initial.spkLocked, false);
assert.equal(await page.isDisabled('#spkSel'), false);
assert.equal(await page.inputValue('#spkSel'), '17');

await browser.close();
console.log('PASS: task2-setup');
