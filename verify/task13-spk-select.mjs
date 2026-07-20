import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = path.dirname(fileURLToPath(import.meta.url));
const url = 'file://' + path.join(dir, '..', 'index.html');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url);
await page.evaluate(() => window.__TEST__.setRandomQueue(new Array(50).fill(0.999999))); // force misses
await page.waitForSelector('#game.active');

// Default is 17, changeable before the first spin.
assert.equal(await page.inputValue('#spkSel'), '17');
await page.selectOption('#spkSel', '13');
const afterSelect = await page.evaluate(() => ({ spk: S.spk, bps: S.bps }));
assert.equal(afterSelect.spk, 13);
assert.ok(Math.abs(afterSelect.bps - 250 / 13) < 0.001);

// First spin locks the dropdown for the rest of the session.
await page.click('#btn1');
const afterSpin = await page.evaluate(() => S.spkLocked);
assert.equal(afterSpin, true);
assert.equal(await page.isDisabled('#spkSel'), true);

// Attempting to change it programmatically after lock has no effect.
await page.evaluate(() => changeSpk(17));
const spkStillLocked = await page.evaluate(() => S.spk);
assert.equal(spkStillLocked, 13);

await browser.close();
console.log('PASS: task13-spk-select');
