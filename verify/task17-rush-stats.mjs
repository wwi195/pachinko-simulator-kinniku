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

const browser = await chromium.launch();
const page = await browser.newPage();

// hit, senbare, no levaburu/vfla, reliability-win, rush entry success (1 normal spin consumed)
await setup(page, [0.0001, 0.0001, 0.99, 0.99, 0.0001, 0.0001]);
await page.click('#btn1');
for (let i = 0; i < 5; i++) await clickThroughModal(page); // -> RUSH active

// Right after entering RUSH: gross total should already include the initial 1500,
// and hits.total should be 1 (the initial jackpot).
let state = await page.evaluate(() => ({
  gross: S.rushGrossTotal, total: S.hits.total, cur: S.cur, ttl: S.ttl,
}));
assert.equal(state.gross, 1500);
assert.equal(state.total, 1);
const curBeforeRush = state.cur;
const ttlBeforeRush = state.ttl;

const rushGrossDisplay = await page.locator('#rushGrossVal').textContent();
assert.equal(rushGrossDisplay, '1,500');

// Spend a handful of RUSH spins that don't hit 発展 (forced miss on P_HATTEN).
await page.evaluate(() => window.__TEST__.setRandomQueue(new Array(10).fill(0.99)));
for (let i = 0; i < 5; i++) await page.click('#btnR1');

state = await page.evaluate(() => ({ cur: S.cur, ttl: S.ttl }));
assert.equal(state.cur, curBeforeRush, 'ST spins must not bump スタート (S.cur)');
assert.equal(state.ttl, ttlBeforeRush, 'ST spins must not bump 総回転数 (S.ttl)');

// Force 発展 -> senyou mode with a 3/5 hit (4500 gross) -> gross total accumulates,
// hits.total counts this ST win too, and S.cur/S.ttl still unaffected.
await page.evaluate(q => window.__TEST__.setRandomQueue(q), [
  0.0001, // P_HATTEN triggers
  0.01, 0.01, 0.9, 0.01, 0.9, // stock: hit, hit, miss, hit, miss -> 3/5
]);
await page.click('#btnR1');
for (let i = 0; i < 5; i++) await clickThroughModal(page); // 突入 -> stock fills -> judge button
await clickThroughModal(page); // judge button -> あたり
await clickThroughModal(page); // あたり -> V画像 (3/5 >= 2)
await clickThroughModal(page); // V画像 -> result

state = await page.evaluate(() => ({
  gross: S.rushGrossTotal, total: S.hits.total, cur: S.cur, ttl: S.ttl,
}));
assert.equal(state.gross, 1500 + 4500); // initial 1500 + this senyou-mode win's 4500
assert.equal(state.total, 2); // initial hit + this ST win, both counted
assert.equal(state.cur, curBeforeRush);
assert.equal(state.ttl, ttlBeforeRush);

await browser.close();
console.log('PASS: task17-rush-stats');
