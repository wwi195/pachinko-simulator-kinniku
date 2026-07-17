import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const url = 'file://' + path.join(dir, 'fixture-smoke.html');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url);
const text = await page.textContent('#msg');
await browser.close();

if (text !== 'hello') {
  console.error(`FAIL: expected "hello", got "${text}"`);
  process.exit(1);
}
console.log('PASS: smoke test');
