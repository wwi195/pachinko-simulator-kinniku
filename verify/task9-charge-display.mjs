import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const url = 'file://' + path.join(dir, '..', 'index.html');

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);

await page.evaluate(() => {
  S.hits.charge = 3;
  S.hits.chargeRush = 1;
  updS();
});

const chargeText = await page.evaluate(() => document.getElementById('thCharge')?.textContent ?? 'MISSING');
const chargeRushText = await page.evaluate(() => document.getElementById('thChargeRush')?.textContent ?? 'MISSING');

await browser.close();

if (errors.length) {
  console.error('FAIL: console/page errors:', errors);
  process.exit(1);
}
if (chargeText !== '3回' || chargeRushText !== '1回') {
  console.error(`FAIL: thCharge=${chargeText} thChargeRush=${chargeRushText}`);
  process.exit(1);
}
console.log('PASS: charge stats display wired correctly');
