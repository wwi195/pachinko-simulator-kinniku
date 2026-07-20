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

// Scenario A: hit, レバブル shown, Vフラ NOT shown, RUSH challenge succeeds.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // queue: [P_HIT hit, P_SENBARE show, P_LEVABURU show, P_VFLA skip, P_RUSH_ENTRY win]
  await setup(page, [0.0001, 0.0001, 0.0001, 0.99, 0.0001]);

  await page.click('#btn1'); // triggers the hit; first modal (先バレ) is up
  await clickThroughModal(page); // 先バレ -> レバブル modal appears
  const levaburuVisible = await page.locator('#mb').innerText();
  assert.match(levaburuVisible, /レバブル/);
  await clickThroughModal(page); // レバブル -> judge (Vフラ skipped)
  const judgeVisible = await page.locator('#mb').innerText();
  assert.match(judgeVisible, /JUDGE/);
  await clickThroughModal(page); // judge -> 1500 bonus
  const bonusVisible = await page.locator('#mb').innerText();
  assert.match(bonusVisible, /1500ボーナス/);
  const ballsAfterBonus = await page.evaluate(() => S.balls);
  await clickThroughModal(page); // bonus -> RUSHチャレンジ
  await clickThroughModal(page); // RUSHチャレンジ -> result (forced win)
  const resultVisible = await page.locator('#mb').innerText();
  assert.match(resultVisible, /RUSH突入！/);
  await clickThroughModal(page); // close result modal

  const finalState = await page.evaluate(() => ({rushActive:S.rushActive, rushST:S.rushST, first:S.hits.first, rushSuccess:S.hits.rushSuccess}));
  assert.equal(finalState.rushActive, true);
  assert.equal(finalState.rushST, 145);
  assert.equal(finalState.first, 1);
  assert.equal(finalState.rushSuccess, 1);
  assert.ok(ballsAfterBonus >= 1400);

  await browser.close();
  console.log('PASS: task4-normalwin scenario A (levaburu shown, rush success)');
}

// Scenario B: hit, レバブル NOT shown, Vフラ NOT shown, RUSH challenge fails.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await setup(page, [0.0001, 0.0001, 0.99, 0.99, 0.99]);

  await page.click('#btn1');
  await clickThroughModal(page); // 先バレ -> judge (both skipped)
  const judgeVisible = await page.locator('#mb').innerText();
  assert.match(judgeVisible, /JUDGE/);
  await clickThroughModal(page); // judge -> bonus
  await clickThroughModal(page); // bonus -> RUSHチャレンジ
  await clickThroughModal(page); // RUSHチャレンジ -> result (forced fail)
  const resultVisible = await page.locator('#mb').innerText();
  assert.match(resultVisible, /突入ならず/);
  await clickThroughModal(page);

  const finalState = await page.evaluate(() => ({rushActive:S.rushActive, rushFail:S.hits.rushFail}));
  assert.equal(finalState.rushActive, false);
  assert.equal(finalState.rushFail, 1);

  await browser.close();
  console.log('PASS: task4-normalwin scenario B (no reach effects, rush fail)');
}
