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

console.log('PASS: task15-ranking');
