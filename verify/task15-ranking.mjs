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

// Scenario A: retiring normally (no 闇パチ) records the balls-at-settlement
// value into the ranking and shows it as ランクイン on an empty ranking.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await setup(page, new Array(20).fill(0.999999)); // force misses so balls stay simple

  await page.click('#btn1'); // one miss spin, just to move state forward
  await page.click('#btnr'); // 退店 -> settlement
  await page.waitForSelector('#ov:not(.h)');
  const settleText = await page.locator('#mb').innerText();
  assert.match(settleText, /最高出玉ランキング/);
  assert.match(settleText, /ランクイン/);

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kinnikuRankingV1')));
  assert.equal(stored.length, 1);
  const expectedBalls = await page.evaluate(() => Math.floor(S.balls));
  assert.equal(stored[0].balls, expectedBalls);

  await browser.close();
  console.log('PASS: normal retirement records a ranking entry');
}

// Scenario B: entering 闇パチ (choosing to continue past closing time)
// excludes that session from the ranking.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await setup(page, new Array(20).fill(0.999999));

  // Force S.ttl straight to the spin limit so handleClosingTime() fires on next spin.
  await page.evaluate(() => { S.ttl = S.spinLimit; });
  await page.click('#btn1'); // triggers closing-time prompt
  await page.waitForSelector('#ov:not(.h)');
  const promptText = await page.locator('#mb').innerText();
  assert.match(promptText, /ランキングの対象外/);
  await page.click('button:has-text("はい（闇パチへ）")');
  await clickThroughModal(page); // close the 闇パチ突入 flavor modal

  await page.click('#btnr'); // 退店 -> settlement, should now be excluded
  await page.waitForSelector('#ov:not(.h)');
  const settleText = await page.locator('#mb').innerText();
  assert.match(settleText, /対象外/);

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kinnikuRankingV1') || '[]'));
  assert.equal(stored.length, 0);

  await browser.close();
  console.log('PASS: choosing 闇パチ excludes the session from ranking');
}

// Scenario C: the anytime ランキング button shows persisted entries without
// recording a new one.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url);
  await page.evaluate(() => {
    localStorage.setItem('kinnikuRankingV1', JSON.stringify([
      { balls: 50000, date: '2026/1/1' },
      { balls: 30000, date: '2026/1/2' },
    ]));
  });
  await page.reload();
  await page.waitForSelector('#game.active');

  await page.click('#btnRank');
  await page.waitForSelector('#ov:not(.h)');
  const rankText = await page.locator('#mb').innerText();
  assert.match(rankText, /50,000玉/);
  assert.match(rankText, /30,000玉/);

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kinnikuRankingV1')));
  assert.equal(stored.length, 2); // unchanged, just viewing

  await browser.close();
  console.log('PASS: ランキング button shows persisted entries without recording');
}

console.log('PASS: task15-ranking');
