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

// force a miss so btn1 doesn't open a modal and blocking interaction
const missQueue = new Array(5).fill(0.99);

{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await setup(page, missQueue);

  await page.click('#btn1');
  const hasClass = await page.evaluate(() => document.getElementById('btn1').classList.contains('btnPress'));
  assert.equal(hasClass, true, 'btn1 should get .btnPress class on click');

  await browser.close();
  console.log('PASS: btn1 press effect class applied');
}

{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await setup(page, missQueue);

  await page.click('#btn100');
  const hasClass = await page.evaluate(() => document.getElementById('btn100').classList.contains('btnPress'));
  assert.equal(hasClass, true, 'btn100 should get .btnPress class on click');

  await browser.close();
  console.log('PASS: btn100 press effect class applied');
}

console.log('PASS: task11-button-fx');
