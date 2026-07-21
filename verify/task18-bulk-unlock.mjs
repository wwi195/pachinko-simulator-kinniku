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

// Scenario A: reaching 闇パチ + 5連以上 + 獲得出玉1万発 sets the permanent
// unlock flag, persists it to localStorage, and logs it to history.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url);
  await page.waitForSelector('#game.active');

  const before = await page.evaluate(() => _bulkUnlocked);
  assert.equal(before, false);

  await page.evaluate(() => {
    S.limitPassed = true;
    S.renchan = 5;
    S.rushGrossTotal = 10000;
    updS();
  });

  const after = await page.evaluate(() => _bulkUnlocked);
  assert.equal(after, true);
  const stored = await page.evaluate(() => localStorage.getItem('kinnikuBulkUnlockedV1'));
  assert.equal(stored, '1');
  const histText = await page.locator('#hl').innerText();
  assert.match(histText, /保留5個一気貯めが使えるようになった/);

  await browser.close();
  console.log('PASS: reaching 闇パチ+5連+1万発 sets the permanent unlock flag');
}

// Scenario A2: falling short of any one condition does not unlock it.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url);
  await page.waitForSelector('#game.active');

  await page.evaluate(() => {
    S.limitPassed = false; // not in 闇パチ
    S.renchan = 5;
    S.rushGrossTotal = 10000;
    updS();
  });
  assert.equal(await page.evaluate(() => _bulkUnlocked), false);

  await browser.close();
  console.log('PASS: missing 闇パチ alone keeps the feature locked');
}

// Scenario B: with the flag pre-set via localStorage (simulating a past
// session), a brand new session shows the bulk button even at renchan=1,
// well under the in-session renchan>=6 threshold.
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
