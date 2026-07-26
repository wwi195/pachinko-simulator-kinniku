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

// Scenario A: legacy-format ranking data (no `renchan` field) is discarded on load.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url);
  await page.evaluate(() => {
    localStorage.setItem('kinnikuRankingV1', JSON.stringify([
      { balls: 50000, date: '2026/1/1' }, // legacy shape: no renchan field
    ]));
  });
  await page.reload();
  await page.waitForSelector('#game.active');

  const stored = await page.evaluate(() => loadRanking());
  assert.deepEqual(stored, []);
  const raw = await page.evaluate(() => localStorage.getItem('kinnikuRankingV1'));
  assert.equal(raw, '[]');

  await browser.close();
  console.log('PASS: legacy ranking data (no renchan field) is discarded on load');
}

// Scenario B: recordRanking stores renchan and renderRankingList shows it.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url);
  await page.waitForSelector('#game.active');

  const result = await page.evaluate(() => recordRanking(4500, 3));
  assert.equal(result.entry.balls, 4500);
  assert.equal(result.entry.renchan, 3);
  assert.equal(result.madeList, true);

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kinnikuRankingV1')));
  assert.equal(stored.length, 1);
  assert.equal(stored[0].balls, 4500);
  assert.equal(stored[0].renchan, 3);

  const rendered = await page.evaluate(() => renderRankingList(loadRanking()));
  assert.match(rendered, /4,500玉 \(3連\)/);

  await browser.close();
  console.log('PASS: recordRanking stores renchan and renderRankingList shows it');
}

// Scenario C: the anytime ランキング button shows persisted entries (with
// renchan) and the updated description text, without recording a new entry.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url);
  await page.evaluate(() => {
    localStorage.setItem('kinnikuRankingV1', JSON.stringify([
      { balls: 50000, renchan: 8, date: '2026/1/1' },
      { balls: 30000, renchan: 4, date: '2026/1/2' },
    ]));
  });
  await page.reload();
  await page.waitForSelector('#game.active');

  await page.click('#btnRank');
  await page.waitForSelector('#ov:not(.h)');
  const rankText = await page.locator('#mb').innerText();
  assert.match(rankText, /RUSH終了時の獲得出玉/);
  assert.match(rankText, /50,000玉 \(8連\)/);
  assert.match(rankText, /30,000玉 \(4連\)/);

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kinnikuRankingV1')));
  assert.equal(stored.length, 2); // unchanged, just viewing

  await browser.close();
  console.log('PASS: ランキング button shows persisted entries with renchan, no new record');
}

// Scenario D: RUSH ending normally (no 闇パチ) records this RUSH's gross
// balls + renchan into the ranking, and shows it on the RUSH-end screen.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // hit, senbare, no levaburu/vfla, reliability-win, rush entry success
  await setup(page, [0.0001, 0.0001, 0.99, 0.99, 0.0001, 0.0001]);
  await page.click('#btn1');
  for (let i = 0; i < 5; i++) await clickThroughModal(page); // -> RUSH active (renchan=1, gross=1500)

  await page.evaluate(() => { S.rushST = 1; }); // force ST exhaustion on next non-発展 spin
  await page.evaluate(q => window.__TEST__.setRandomQueue(q), [0.99]); // P_HATTEN miss
  await page.click('#btnR1');
  await page.waitForSelector('#ov:not(.h)');
  const endText = await page.locator('#mb').innerText();
  assert.match(endText, /RUSH終了/);
  assert.match(endText, /最高出玉ランキング/);
  assert.match(endText, /ランクイン/);
  assert.match(endText, /1,500玉 \(1連\)/);

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kinnikuRankingV1')));
  assert.equal(stored.length, 1);
  assert.equal(stored[0].balls, 1500);
  assert.equal(stored[0].renchan, 1);

  await browser.close();
  console.log('PASS: RUSH ending normally records gross balls + renchan into ranking');
}

// Scenario E: a RUSH that ends while 闇パチ is active (S.limitPassed) is
// excluded from the ranking, and the RUSH-end screen says so.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await setup(page, new Array(20).fill(0.999999)); // force misses so the closing prompt fires cleanly
  await page.evaluate(() => { S.ttl = S.spinLimit; });
  await page.click('#btn1'); // triggers closing-time prompt
  await page.waitForSelector('#ov:not(.h)');
  await page.click('button:has-text("はい（闇パチへ）")');
  await clickThroughModal(page); // close 闇パチ突入 flavor modal

  // hit, senbare, no levaburu/vfla, reliability-win, rush entry success
  await page.evaluate(q => window.__TEST__.setRandomQueue(q), [0.0001, 0.0001, 0.99, 0.99, 0.0001, 0.0001]);
  await page.click('#btn1');
  for (let i = 0; i < 5; i++) await clickThroughModal(page); // -> RUSH active during 闇パチ

  await page.evaluate(() => { S.rushST = 1; });
  await page.evaluate(q => window.__TEST__.setRandomQueue(q), [0.99]);
  await page.click('#btnR1');
  await page.waitForSelector('#ov:not(.h)');
  const endText = await page.locator('#mb').innerText();
  assert.match(endText, /対象外/);

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kinnikuRankingV1') || '[]'));
  assert.equal(stored.length, 0);

  await browser.close();
  console.log('PASS: a RUSH ending during 闇パチ is excluded from ranking');
}

// Scenario F: the settlement screen no longer shows any ranking block.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await setup(page, new Array(5).fill(0.999999)); // force misses so retirement is trivial
  await page.click('#btn1');
  await page.click('#btnr'); // 退店 -> settlement
  await page.waitForSelector('#ov:not(.h)');
  const settleText = await page.locator('#mb').innerText();
  assert.doesNotMatch(settleText, /最高出玉ランキング/);

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kinnikuRankingV1') || '[]'));
  assert.equal(stored.length, 0); // retirement no longer records anything

  await browser.close();
  console.log('PASS: settlement screen no longer shows a ranking block');
}

console.log('PASS: task15-ranking');
