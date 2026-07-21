import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = path.dirname(fileURLToPath(import.meta.url));
const url = 'file://' + path.join(dir, '..', 'index.html');

async function clickThroughModal(page) {
  await page.waitForSelector('#ov:not(.h)');
  await page.click('#mb .bok');
}

async function freshPage(browser) {
  const page = await browser.newPage();
  await page.goto(url);
  await page.waitForSelector('#game.active');
  return page;
}

// The three unlock conditions are OR'd together - any single one, on its own,
// permanently unlocks the bulk-fill button.
const soloConditions = [
  { label: '闇パチ (S.limitPassed) alone', setup: () => { S.limitPassed = true; } },
  { label: '5連以上 (S.renchan>=5) alone', setup: () => { S.renchan = 5; } },
  { label: '獲得出玉1万発 (S.rushGrossTotal>=10000) alone', setup: () => { S.rushGrossTotal = 10000; } },
];

for (const cond of soloConditions) {
  const browser = await chromium.launch();
  const page = await freshPage(browser);

  assert.equal(await page.evaluate(() => _bulkUnlocked), false);
  await page.evaluate(cond.setup);
  await page.evaluate(() => updS());

  const unlocked = await page.evaluate(() => _bulkUnlocked);
  assert.equal(unlocked, true, `${cond.label} should unlock the feature`);
  const stored = await page.evaluate(() => localStorage.getItem('kinnikuBulkUnlockedV1'));
  assert.equal(stored, '1');
  const histText = await page.locator('#hl').innerText();
  assert.match(histText, /保留5個一気貯めが使えるようになった/);

  await browser.close();
  console.log(`PASS: ${cond.label} unlocks and persists the flag`);
}

// None of the three conditions true -> stays locked.
{
  const browser = await chromium.launch();
  const page = await freshPage(browser);

  await page.evaluate(() => {
    S.limitPassed = false;
    S.renchan = 1;
    S.rushGrossTotal = 0;
    updS();
  });
  assert.equal(await page.evaluate(() => _bulkUnlocked), false);

  await browser.close();
  console.log('PASS: none of the three conditions met keeps the feature locked');
}

// A flag set in an earlier session (via localStorage) shows the bulk button
// even at renchan=1 in a brand new session, well under the in-session
// renchan>=6 threshold.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url);
  await page.evaluate(() => localStorage.setItem('kinnikuBulkUnlockedV1', '1'));
  await page.reload();
  await page.waitForSelector('#game.active');

  // hit, senbare, no levaburu/vfla, reliability-win, rush entry success, hatten immediately
  await page.evaluate(q => window.__TEST__.setRandomQueue(q), [0.0001, 0.0001, 0.99, 0.99, 0.0001, 0.0001, 0.0001]);
  await page.click('#btn1');
  for (let i = 0; i < 5; i++) await clickThroughModal(page); // -> RUSH active

  await page.click('#btnR1'); // triggers hatten -> 専用モード突入 modal
  await page.waitForSelector('#ov:not(.h)');
  const entryText = await page.locator('#mb').innerText();
  assert.match(entryText, /一気に貯める/);
  const renchan = await page.evaluate(() => S.renchan);
  assert.equal(renchan, 1);

  await browser.close();
  console.log('PASS: a previously-unlocked flag shows the button even at renchan=1');
}

console.log('PASS: task18-bulk-unlock');
