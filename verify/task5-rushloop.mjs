import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = path.dirname(fileURLToPath(import.meta.url));
const url = 'file://' + path.join(dir, '..', 'index.html');

async function setup(page, queue) {
  await page.goto(url);
  await page.evaluate(q => window.__TEST__.setRandomQueue(q), queue);
  await page.click('#w-200000');
  await page.click('#rp');
  await page.click('#sp-good');
  await page.click('#gbtn');
  await page.waitForSelector('#game.active');
}

async function clickThroughModal(page) {
  await page.waitForSelector('#ov:not(.h)');
  await page.click('#mb .bok');
}

// Scenario A: force RUSH entry, then force 145 consecutive 発展 misses
// (queue value 0.99 > P_HATTEN threshold every time) -> RUSH should end
// automatically via the skip button, and normal-mode controls return.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const missQueue = new Array(200).fill(0.99);
  await setup(page, [0.0001, 0.99, 0.99, 0.0001, ...missQueue]);

  await page.click('#btn1');
  await clickThroughModal(page); // 先バレ -> judge
  await clickThroughModal(page); // judge -> bonus
  await clickThroughModal(page); // bonus -> RUSHチャレンジ
  await clickThroughModal(page); // RUSHチャレンジ -> RUSH突入 result
  await clickThroughModal(page); // close result, RUSH now active

  const stAfterEntry = await page.evaluate(() => S.rushST);
  assert.equal(stAfterEntry, 145);

  await page.click('#btnRSkip');
  await clickThroughModal(page); // RUSH終了 modal

  const finalState = await page.evaluate(() => ({rushActive:S.rushActive}));
  assert.equal(finalState.rushActive, false);
  const normalCtrlDisplay = await page.evaluate(() => document.getElementById('normalCtrl').style.display);
  assert.equal(normalCtrlDisplay, 'flex');

  await browser.close();
  console.log('PASS: task5-rushloop scenario A (ST exhausts, RUSH ends)');
}

// Scenario B: force RUSH entry, then force 発展 on the very next RUSH spin.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await setup(page, [0.0001, 0.99, 0.99, 0.0001, 0.0001]);

  await page.click('#btn1');
  await clickThroughModal(page);
  await clickThroughModal(page);
  await clickThroughModal(page);
  await clickThroughModal(page);
  await clickThroughModal(page);

  await page.click('#btnR1');
  const stAfterHatten = await page.evaluate(() => S.rushST);
  assert.equal(stAfterHatten, 145); // placeholder 発展 handling resets ST (Task 6 replaces this)

  await browser.close();
  console.log('PASS: task5-rushloop scenario B (hatten triggers on first RUSH spin)');
}
