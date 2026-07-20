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

async function enterRushAndHatten(page, stockQueue) {
  // hit, senbare shown, no levaburu/vfla, rush entry success, hatten immediately
  await setup(page, [0.0001, 0.0001, 0.99, 0.99, 0.0001, 0.0001, ...stockQueue]);
  await page.click('#btn1');
  // win chain produces exactly 5 modals: 先バレ, judge, bonus(初回大当たり),
  // RUSHチャレンジ, RUSH突入 result -- matching task5-rushloop.mjs scenario A/B.
  for (let i=0;i<5;i++) await clickThroughModal(page); // -> RUSH active
  await page.click('#btnR1'); // -> 専用モード突入 modal
  await clickThroughModal(page); // 突入 -> stock 1/5
  for (let i=0;i<5;i++) await clickThroughModal(page); // stock fills -> judge button
  await clickThroughModal(page); // judge button -> result
}

// Scenario A: 3-of-5 hits (P_STOCK_HIT threshold is 1/2.8 ≈ 0.357).
// queue: hit, hit, miss, hit, miss -> hitCount=3 -> "4500ボーナス！"
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await enterRushAndHatten(page, [0.01, 0.01, 0.9, 0.01, 0.9]);

  const atariText = await page.locator('#mb').innerText();
  assert.match(atariText, /あたり/);
  await clickThroughModal(page); // あたり -> V画像 (hitCount=3 >= 2)
  const vText = await page.locator('#mb').innerText();
  assert.match(vText, /V3000/);
  await clickThroughModal(page); // V画像 -> result

  const resultText = await page.locator('#mb').innerText();
  assert.match(resultText, /4500ボーナス/);
  assert.match(resultText, /実質\+4200発/);

  const st = await page.evaluate(() => S.rushST);
  assert.equal(st, 145);
  const stockCounts = await page.evaluate(() => S.hits.stock);
  assert.equal(stockCounts[3], 1);

  await browser.close();
  console.log('PASS: task6-senyoumode scenario A (3/5 hits -> 4500 bonus)');
}

// Scenario B: 0-of-5 hits, forced to resume from preDevST instead of resetting.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // stock queue: 5 misses, then the 0-hit branch's rand() forced >= P_ZERO_RESET
  await enterRushAndHatten(page, [0.9,0.9,0.9,0.9,0.9, 0.99]);

  const resultText = await page.locator('#mb').innerText();
  assert.match(resultText, /はずれ/);

  // RUSH entry set rushST=145, then 1 RUSH spin was consumed before hatten (btnR1
  // decrements rushST to 144 before rolling hatten), so preDevST=144.
  const st = await page.evaluate(() => S.rushST);
  assert.equal(st, 144);
  const stockCounts = await page.evaluate(() => S.hits.stock);
  assert.equal(stockCounts[0], 1);

  await browser.close();
  console.log('PASS: task6-senyoumode scenario B (0/5 -> resumes from preDevST)');
}
