import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = path.dirname(fileURLToPath(import.meta.url));
const url = 'file://' + path.join(dir, '..', 'index.html');

async function setup(page, queue) {
  await page.goto(url);
  await page.evaluate(q => window.__TEST__.setRandomQueue(q), queue);
  await page.waitForSelector('#game.active');
}

async function clickThroughModal(page) {
  await page.waitForSelector('#ov:not(.h)');
  await page.click('#mb .bok');
}

async function enterRushThenHatten(page, extraQueueAfterEntry) {
  // hit, senbare, no levaburu/vfla, reliability-win, rush entry success, hatten immediately
  await setup(page, [0.0001, 0.0001, 0.99, 0.99, 0.0001, 0.0001, 0.0001, ...extraQueueAfterEntry]);
  await page.click('#btn1');
  for (let i = 0; i < 5; i++) await clickThroughModal(page); // -> RUSH active
}

// Scenario A: renchan >= 6 -> bulk-fill button appears and works.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // stock queue below (all misses -> 0/5) is irrelevant to what we're testing here.
  await enterRushThenHatten(page, [0.9, 0.9, 0.9, 0.9, 0.9, 0.99]);
  await page.evaluate(() => { S.renchan = 6; });

  await page.click('#btnR1'); // triggers hatten -> 専用モード突入 modal
  await page.waitForSelector('#ov:not(.h)');
  const entryText = await page.locator('#mb').innerText();
  assert.match(entryText, /一気に貯める/);

  await page.click('button:has-text("保留5個を一気に貯める")');
  await page.waitForSelector('#ov:not(.h)');
  const afterBulk = await page.locator('#mb').innerText();
  assert.match(afterBulk, /保留 5\/5/); // jumped straight to 5/5, skipping 1/5-4/5

  await clickThroughModal(page); // stock 5/5 -> judge button
  const judgeText = await page.locator('#mb').innerText();
  assert.match(judgeText, /保留5個 貯まりました/);

  await browser.close();
  console.log('PASS: renchan>=6 shows a working bulk-fill button that skips straight to 5/5');
}

// Scenario B: renchan < 6 -> no bulk-fill button, fill happens one by one (1/5..5/5).
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await enterRushThenHatten(page, [0.9, 0.9, 0.9, 0.9, 0.9, 0.99]);
  // renchan is 1 here (set by the initial hit), well under the threshold.

  await page.click('#btnR1');
  await page.waitForSelector('#ov:not(.h)');
  const entryText = await page.locator('#mb').innerText();
  assert.doesNotMatch(entryText, /一気に貯める/);

  await clickThroughModal(page); // 突入 -> stock 1/5
  const firstFill = await page.locator('#mb').innerText();
  assert.match(firstFill, /保留 1\/5/);

  await browser.close();
  console.log('PASS: renchan<6 has no bulk-fill option, fills one by one as before');
}

console.log('PASS: task16-bulk-stock');
