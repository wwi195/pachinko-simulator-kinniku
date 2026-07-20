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
  await setup(page, [0.0001, 0.0001, 0.99, 0.99, 0.0001, 0.0001, 0.0001, ...stockQueue]);
  await page.click('#btn1');
  for (let i = 0; i < 5; i++) await clickThroughModal(page); // -> RUSH active
  await page.click('#btnR1');
  await clickThroughModal(page); // 突入 -> stock 1/5
  for (let i = 0; i < 5; i++) await clickThroughModal(page); // stock fills -> judge button
  await clickThroughModal(page); // judge button -> あたり (or result if 0/5)
}

// Scenario A: 1-of-5 hit (1500 bonus) -> あたり画面は出るがV画像はスキップされ、直接結果画面へ
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await enterRushAndHatten(page, [0.01, 0.9, 0.9, 0.9, 0.9]); // 1 hit

  const atariText = await page.locator('#mb').innerText();
  assert.match(atariText, /あたり/);
  await clickThroughModal(page); // あたり -> result (no V image for 1500)

  const resultText = await page.locator('#mb').innerText();
  assert.match(resultText, /1500ボーナス/);
  assert.doesNotMatch(resultText, /V\d+/);

  await browser.close();
  console.log('PASS: 1/5 hit skips V-image, goes straight to result');
}

// Scenario B: 5-of-5 hits (7500 bonus) -> V6000 image shown
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await enterRushAndHatten(page, [0.01, 0.01, 0.01, 0.01, 0.01]); // 5 hits

  await clickThroughModal(page); // あたり -> V画像
  const vText = await page.locator('#mb').innerText();
  assert.match(vText, /V6000/);
  await clickThroughModal(page); // V画像 -> result

  const resultText = await page.locator('#mb').innerText();
  assert.match(resultText, /7500ボーナス/);

  await browser.close();
  console.log('PASS: 5/5 hit shows V6000 image before result');
}

console.log('PASS: task12-atari-vimage');
