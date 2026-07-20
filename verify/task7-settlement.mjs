import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = path.dirname(fileURLToPath(import.meta.url));
const url = 'file://' + path.join(dir, '..', 'index.html');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url);
// hit, senbare shown, no levaburu/vfla, rush entry success
await page.evaluate(q => window.__TEST__.setRandomQueue(q), [0.0001, 0.0001, 0.99, 0.99, 0.0001]);
await page.click('#w-30000');
await page.click('#rp');
await page.click('#sp-good');
await page.click('#gbtn');
await page.waitForSelector('#game.active');

await page.click('#btn1');
for (let i=0;i<4;i++) {
  await page.waitForSelector('#ov:not(.h)');
  await page.click('#mb .bok');
}
await page.waitForSelector('#ov:not(.h)');
await page.click('#mb .bok'); // close RUSH-entry result modal

await page.click('#btnr'); // 退店 -> settlement
await page.waitForSelector('#ov:not(.h)');
const settleText = await page.locator('#mb').innerText();
assert.match(settleText, /精算/);
assert.match(settleText, /初回大当たり\s*1回/);
assert.match(settleText, /RUSHチャレンジ成功\/失敗\s*1\/0/);

await browser.close();
console.log('PASS: task7-settlement');
