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

// Start button disabled until all 3 steps chosen
assert.equal(await page.isDisabled('#gbtn'), true);

await page.click('#w-30000');
await page.click('#rp');
// shop options render after rate is chosen
await page.click('#sp-good');

assert.equal(await page.isDisabled('#gbtn'), false);

await page.click('#gbtn');
await page.waitForSelector('#game.active');
const setupDisplay = await page.evaluate(() => document.getElementById('setup').style.display);
assert.equal(setupDisplay, 'none');

await browser.close();
console.log('PASS: task2-setup');
