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

// Scenario A: only 先バレ shows (levaburu/vfla skipped), reliability roll
// (P_SENBARE=0.90) fails -> miss. No award, no hit stats, S.cur not reset.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // queue: [P_HIT hit, senbare show, levaburu skip, vfla skip, reliability roll FAIL]
  await setup(page, [0.0001, 0.0001, 0.99, 0.99, 0.95]);

  await page.click('#btn1');
  await clickThroughModal(page); // 先バレ -> judge
  await clickThroughModal(page); // judge -> miss result
  const missText = await page.locator('#mb').innerText();
  assert.match(missText, /残念/);
  await clickThroughModal(page); // close miss modal

  const state = await page.evaluate(() => ({
    total: S.hits.total, first: S.hits.first, cur: S.cur, balls: S.balls,
  }));
  assert.equal(state.total, 0);
  assert.equal(state.first, 0);
  assert.equal(state.cur, 1); // spin count keeps accumulating, not reset
  // No bonus awarded: balls reflect only the ¥1,000 draw minus one spin's
  // consumption (same formula as task3-economy.mjs), nowhere near +1400.
  assert.ok(Math.abs(state.balls - (250 - 250 / 17)) < 0.01);

  await browser.close();
  console.log('PASS: senbare-only miss (10% case) awards nothing and does not reset spin count');
}

// Scenario B: none of 先バレ/レバブル/Vフラ show at all -> P_RELIABILITY_NONE
// (0.50) baseline used for the win/miss roll. Force a win here.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // queue: [P_HIT hit, senbare skip, levaburu skip, vfla skip, reliability roll WIN]
  await setup(page, [0.0001, 0.99, 0.99, 0.99, 0.0001]);

  await page.click('#btn1');
  await clickThroughModal(page); // judge (no reach effects shown) -> bonus
  const bonusText = await page.locator('#mb').innerText();
  assert.match(bonusText, /1500ボーナス/);

  const state = await page.evaluate(() => ({ total: S.hits.total, first: S.hits.first }));
  assert.equal(state.total, 1);
  assert.equal(state.first, 1);

  await browser.close();
  console.log('PASS: no-reach-effect win uses the 50% baseline reliability');
}

// Scenario C: Vフラ shown -> guaranteed win + guaranteed RUSH, no RUSHチャレンジ modal.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // queue: [P_HIT hit, senbare skip, levaburu skip, vfla show, reliability roll (irrelevant, always <1)]
  await setup(page, [0.0001, 0.99, 0.99, 0.0001, 0.99999]);

  await page.click('#btn1');
  await clickThroughModal(page); // vfla -> judge
  await clickThroughModal(page); // judge -> bonus
  await clickThroughModal(page); // bonus -> RUSH突入 result directly (no challenge modal)
  const resultText = await page.locator('#mb').innerText();
  assert.match(resultText, /RUSH突入！/);

  const state = await page.evaluate(() => ({
    rushActive: S.rushActive, rushSuccess: S.hits.rushSuccess, rushFail: S.hits.rushFail,
  }));
  assert.equal(state.rushActive, true);
  assert.equal(state.rushSuccess, 1);
  assert.equal(state.rushFail, 0);

  await browser.close();
  console.log('PASS: vfla guarantees win and bypasses the RUSH challenge roll');
}

console.log('PASS: task14-reliability');
