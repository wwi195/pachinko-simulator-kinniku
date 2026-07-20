import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = path.dirname(fileURLToPath(import.meta.url));
const url = 'file://' + path.join(dir, '..', 'index.html');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url);

// Force every spin to miss: rand() always falls through to a queue
// of high values so P_HIT (1/399.9) never triggers.
await page.evaluate(() => window.__TEST__.setRandomQueue(new Array(500).fill(0.999999)));
await page.waitForSelector('#game.active');

// Fixed ¥100,000 wallet, default spk=17 (bps=250/17≈14.71).
// First spin must draw ¥1,000 worth of balls (250) before consuming bps.
await page.click('#btn1');
const afterOne = await page.evaluate(() => ({balls:S.balls, cash:S.cashUsed, cur:S.cur, ttl:S.ttl}));
assert.equal(afterOne.cash, 1000);
assert.equal(afterOne.cur, 1);
assert.equal(afterOne.ttl, 1);
assert.ok(Math.abs(afterOne.balls - (250 - 250/17)) < 0.01);

await page.click('#btn100');
const after100 = await page.evaluate(() => ({cur:S.cur, ttl:S.ttl}));
assert.equal(after100.ttl, 101);
assert.equal(after100.cur, 101);

await browser.close();
console.log('PASS: task3-economy');
