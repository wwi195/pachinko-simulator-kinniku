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

async function checkImgLoaded(page, label) {
  await page.waitForSelector('#mb img');
  const result = await page.evaluate(() => {
    const img = document.querySelector('#mb img');
    return { src: img.getAttribute('src'), complete: img.complete, natW: img.naturalWidth };
  });
  assert.ok(result.complete && result.natW > 0, `${label}: image failed to load (${result.src})`);
  console.log(`OK: ${label} loaded (${result.src}, naturalWidth=${result.natW})`);
}

// hit -> senbare -> levaburu(img) -> vfla(img) -> judge(no img) -> bonus -> rushChallenge -> rush_in(img)
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await setup(page, [0.0001, 0.0001, 0.0001, 0.0001, 0.0001]);

  await page.click('#btn1');
  await clickThroughModal(page); // 先バレ -> levaburu
  await checkImgLoaded(page, 'levaburu');
  await clickThroughModal(page); // levaburu -> vfla
  await checkImgLoaded(page, 'vfla');
  await clickThroughModal(page); // vfla -> judge (no image)
  await clickThroughModal(page); // judge -> bonus
  await clickThroughModal(page); // bonus -> RUSHチャレンジ
  await clickThroughModal(page); // RUSHチャレンジ -> result (forced win)
  await checkImgLoaded(page, 'rush_in');

  await browser.close();
}

// enter rush, hatten, fill stock 5x -> judge button screen shows hozon_judge(img)
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await setup(page, [0.0001, 0.0001, 0.99, 0.99, 0.0001, 0.0001, 0.01,0.01,0.9,0.01,0.9]);

  await page.click('#btn1');
  for (let i = 0; i < 5; i++) await clickThroughModal(page); // -> RUSH active
  await page.click('#btnR1'); // -> 専用モード突入 modal
  await clickThroughModal(page); // 突入 -> stock 1/5
  for (let i = 0; i < 5; i++) await clickThroughModal(page); // stock fills -> judge button
  await checkImgLoaded(page, 'hozon_judge'); // judge button screen (before pressing ジャッジ！)

  await browser.close();
}

console.log('PASS: task10-images-render');
