# ランキング方式変更 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ランキングの記録・表示を「退店時の持ち玉数（セッション単位）」から「RUSH終了時の獲得出玉＋連チャン数（RUSH単位）」に変更する。

**Architecture:** 単一ファイル `index.html` 内の既存関数を直接改修する。データ層（`loadRanking`/`saveRanking`/`recordRanking`/`renderRankingList`/`showRanking`）→ 記録トリガーの移設（`endRush`/`tmRushEnd`）→ 精算画面からの表示削除（`showSettle`）の順で進める。テストは `verify/task15-ranking.mjs` を都度拡張し、Playwrightのheadless Chromiumで `window.__TEST__.setRandomQueue()` を使った決定論的シナリオとして検証する。

**Tech Stack:** 素のJS（ビルド不要の単一HTML）、Playwright（`verify/`配下、開発時検証専用）。

**参照:** 設計書 `docs/superpowers/specs/2026-07-26-ranking-rework-design.md`

---

## 現状の該当コード（参考）

- `RANK_KEY`, `loadRanking`, `saveRanking`, `recordRanking`, `renderRankingList`, `showRanking` は `index.html` の353〜387行目付近
- `tmRushEnd`, `endRush` は472〜498行目付近
- `showSettle` は828〜878行目付近（`recordRanking` 呼び出しと `rankHtml` ブロックを含む）
- `tmClosingTime` は325〜335行目（「対象外になります」の文言）

行番号はこのプラン作成時点のものです。前のタスクでの編集により多少ズレる可能性があるため、実装時は `Grep` で関数名を再検索してから編集すること。

---

### Task 1: ランキングのデータ層を「獲得出玉＋連チャン数」形式に変更する

**Files:**
- Modify: `index.html`（`loadRanking`, `recordRanking`, `renderRankingList`, `showRanking`）
- Test: `verify/task15-ranking.mjs`（全面書き換え）

- [ ] **Step 1: `verify/task15-ranking.mjs` を新しいデータ層シナリオに全面書き換える**

このタスクではまずデータ層（記録・保存・描画）だけを検証する3シナリオに絞る。RUSH終了フックと精算画面からの削除は Task 2・3 で追記する。

```javascript
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

// Scenario A: legacy-format ranking data (no `renchan` field) is discarded on load.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url);
  await page.evaluate(() => {
    localStorage.setItem('kinnikuRankingV1', JSON.stringify([
      { balls: 50000, date: '2026/1/1' }, // legacy shape: no renchan field
    ]));
  });
  await page.reload();
  await page.waitForSelector('#game.active');

  const stored = await page.evaluate(() => loadRanking());
  assert.deepEqual(stored, []);
  const raw = await page.evaluate(() => localStorage.getItem('kinnikuRankingV1'));
  assert.equal(raw, '[]');

  await browser.close();
  console.log('PASS: legacy ranking data (no renchan field) is discarded on load');
}

// Scenario B: recordRanking stores renchan and renderRankingList shows it.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url);
  await page.waitForSelector('#game.active');

  const result = await page.evaluate(() => recordRanking(4500, 3));
  assert.equal(result.entry.balls, 4500);
  assert.equal(result.entry.renchan, 3);
  assert.equal(result.madeList, true);

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kinnikuRankingV1')));
  assert.equal(stored.length, 1);
  assert.equal(stored[0].balls, 4500);
  assert.equal(stored[0].renchan, 3);

  const rendered = await page.evaluate(() => renderRankingList(loadRanking()));
  assert.match(rendered, /4,500玉 \(3連\)/);

  await browser.close();
  console.log('PASS: recordRanking stores renchan and renderRankingList shows it');
}

// Scenario C: the anytime ランキング button shows persisted entries (with
// renchan) and the updated description text, without recording a new entry.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url);
  await page.evaluate(() => {
    localStorage.setItem('kinnikuRankingV1', JSON.stringify([
      { balls: 50000, renchan: 8, date: '2026/1/1' },
      { balls: 30000, renchan: 4, date: '2026/1/2' },
    ]));
  });
  await page.reload();
  await page.waitForSelector('#game.active');

  await page.click('#btnRank');
  await page.waitForSelector('#ov:not(.h)');
  const rankText = await page.locator('#mb').innerText();
  assert.match(rankText, /RUSH終了時の獲得出玉/);
  assert.match(rankText, /50,000玉 \(8連\)/);
  assert.match(rankText, /30,000玉 \(4連\)/);

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kinnikuRankingV1')));
  assert.equal(stored.length, 2); // unchanged, just viewing

  await browser.close();
  console.log('PASS: ランキング button shows persisted entries with renchan, no new record');
}

console.log('PASS: task15-ranking');
```

- [ ] **Step 2: テストを実行し、失敗することを確認する**

Run: `cd verify && node task15-ranking.mjs`
Expected: FAIL — Scenario A は `loadRanking()` が旧形式をそのまま返すため `deepEqual` で失敗、Scenario B は `recordRanking` が第2引数を無視するため `renchan` が `undefined`、Scenario C はテキストに `RUSH終了時の獲得出玉` も `(8連)` も含まれず失敗する。

- [ ] **Step 3: `index.html` の `loadRanking` を、旧形式データを検知したら破棄するように変更する**

`index.html` 内、現在の `loadRanking`（353〜359行目付近）:

```javascript
function loadRanking(){
  try{
    const raw=localStorage.getItem(RANK_KEY);
    return raw?JSON.parse(raw):[];
  }catch(e){ return []; }
}
```

を次のように変更する:

```javascript
function loadRanking(){
  try{
    const raw=localStorage.getItem(RANK_KEY);
    if(!raw) return [];
    const list=JSON.parse(raw);
    if(list.some(r=>typeof r.renchan!=='number')){
      saveRanking([]);
      return [];
    }
    return list;
  }catch(e){ return []; }
}
```

- [ ] **Step 4: `recordRanking` に `renchan` パラメータを追加する**

現在の `recordRanking`:

```javascript
function recordRanking(balls){
  const list=loadRanking();
  const d=new Date();
  const entry={balls, date:`${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`};
  list.push(entry);
  list.sort((a,b)=>b.balls-a.balls);
  const trimmed=list.slice(0,10);
  saveRanking(trimmed);
  return {list:trimmed, entry, madeList:trimmed.includes(entry)};
}
```

を次のように変更する:

```javascript
function recordRanking(balls, renchan){
  const list=loadRanking();
  const d=new Date();
  const entry={balls, renchan, date:`${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`};
  list.push(entry);
  list.sort((a,b)=>b.balls-a.balls);
  const trimmed=list.slice(0,10);
  saveRanking(trimmed);
  return {list:trimmed, entry, madeList:trimmed.includes(entry)};
}
```

- [ ] **Step 5: `renderRankingList` に連チャン数の表示を追加する**

現在の `renderRankingList`:

```javascript
function renderRankingList(list, highlightEntry){
  if(list.length===0) return `<div class="ms2" style="text-align:center">まだ記録がありません</div>`;
  return list.map((r,i)=>{
    const isNew=r===highlightEntry;
    return `<div class="sr" style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px${isNew?';color:var(--gold);font-weight:bold':''}"><span class="sk">${i+1}位${isNew?' 🆕':''}</span><span class="sv2">${r.balls.toLocaleString()}玉 <span style="font-size:10px;color:var(--dim)">${r.date}</span></span></div>`;
  }).join('');
}
```

を次のように変更する（`玉数` の直後に `(◯連)` を追加）:

```javascript
function renderRankingList(list, highlightEntry){
  if(list.length===0) return `<div class="ms2" style="text-align:center">まだ記録がありません</div>`;
  return list.map((r,i)=>{
    const isNew=r===highlightEntry;
    return `<div class="sr" style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px${isNew?';color:var(--gold);font-weight:bold':''}"><span class="sk">${i+1}位${isNew?' 🆕':''}</span><span class="sv2">${r.balls.toLocaleString()}玉 (${r.renchan}連) <span style="font-size:10px;color:var(--dim)">${r.date}</span></span></div>`;
  }).join('');
}
```

- [ ] **Step 6: `showRanking` の説明文を更新する**

現在の `showRanking`:

```javascript
function showRanking(){
  const html=`
    <div class="mt" style="color:var(--gold)">🏆 最高出玉ランキング</div>
    <div class="ms2">所持金以内・2800回転（闇パチ移行前）での記録</div>
    ${renderRankingList(loadRanking())}
    <button class="bok" onclick="closeM()" style="margin-top:14px">閉じる</button>`;
  showM(html,'mn');
}
```

を次のように変更する（説明文のみ変更）:

```javascript
function showRanking(){
  const html=`
    <div class="mt" style="color:var(--gold)">🏆 最高出玉ランキング</div>
    <div class="ms2">RUSH終了時の獲得出玉（闇パチ中終了を除く）</div>
    ${renderRankingList(loadRanking())}
    <button class="bok" onclick="closeM()" style="margin-top:14px">閉じる</button>`;
  showM(html,'mn');
}
```

- [ ] **Step 7: テストを実行し、成功することを確認する**

Run: `cd verify && node task15-ranking.mjs`
Expected: PASS — 3シナリオすべて成功し、最後に `PASS: task15-ranking` が出力される。

- [ ] **Step 8: コミットする**

```bash
git add index.html verify/task15-ranking.mjs
git commit -m "Rework ranking data model to store renchan alongside balls"
```

---

### Task 2: RUSH終了時にランキング記録・表示を行う（闇パチ中は対象外）

**Files:**
- Modify: `index.html`（`tmRushEnd`, `endRush`）
- Test: `verify/task15-ranking.mjs`（シナリオ追記）

- [ ] **Step 1: Task 1で作成した `verify/task15-ranking.mjs` の末尾（`console.log('PASS: task15-ranking');` の直前）に、以下の2シナリオを追記する**

```javascript
// Scenario D: RUSH ending normally (no 闇パチ) records this RUSH's gross
// balls + renchan into the ranking, and shows it on the RUSH-end screen.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // hit, senbare, no levaburu/vfla, reliability-win, rush entry success
  await setup(page, [0.0001, 0.0001, 0.99, 0.99, 0.0001, 0.0001]);
  await page.click('#btn1');
  for (let i = 0; i < 5; i++) await clickThroughModal(page); // -> RUSH active (renchan=1, gross=1500)

  await page.evaluate(() => { S.rushST = 1; }); // force ST exhaustion on next non-発展 spin
  await page.evaluate(q => window.__TEST__.setRandomQueue(q), [0.99]); // P_HATTEN miss
  await page.click('#btnR1');
  await page.waitForSelector('#ov:not(.h)');
  const endText = await page.locator('#mb').innerText();
  assert.match(endText, /RUSH終了/);
  assert.match(endText, /最高出玉ランキング/);
  assert.match(endText, /ランクイン/);
  assert.match(endText, /1,500玉 \(1連\)/);

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kinnikuRankingV1')));
  assert.equal(stored.length, 1);
  assert.equal(stored[0].balls, 1500);
  assert.equal(stored[0].renchan, 1);

  await browser.close();
  console.log('PASS: RUSH ending normally records gross balls + renchan into ranking');
}

// Scenario E: a RUSH that ends while 闇パチ is active (S.limitPassed) is
// excluded from the ranking, and the RUSH-end screen says so.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await setup(page, new Array(20).fill(0.999999)); // force misses so the closing prompt fires cleanly
  await page.evaluate(() => { S.ttl = S.spinLimit; });
  await page.click('#btn1'); // triggers closing-time prompt
  await page.waitForSelector('#ov:not(.h)');
  await page.click('button:has-text("はい（闇パチへ）")');
  await clickThroughModal(page); // close 闇パチ突入 flavor modal

  // hit, senbare, no levaburu/vfla, reliability-win, rush entry success
  await page.evaluate(q => window.__TEST__.setRandomQueue(q), [0.0001, 0.0001, 0.99, 0.99, 0.0001, 0.0001]);
  await page.click('#btn1');
  for (let i = 0; i < 5; i++) await clickThroughModal(page); // -> RUSH active during 闇パチ

  await page.evaluate(() => { S.rushST = 1; });
  await page.evaluate(q => window.__TEST__.setRandomQueue(q), [0.99]);
  await page.click('#btnR1');
  await page.waitForSelector('#ov:not(.h)');
  const endText = await page.locator('#mb').innerText();
  assert.match(endText, /対象外/);

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kinnikuRankingV1') || '[]'));
  assert.equal(stored.length, 0);

  await browser.close();
  console.log('PASS: a RUSH ending during 闇パチ is excluded from ranking');
}
```

- [ ] **Step 2: テストを実行し、追記した2シナリオが失敗することを確認する**

Run: `cd verify && node task15-ranking.mjs`
Expected: FAIL — `endRush()` がまだランキングを記録しないため、Scenario Dは `最高出玉ランキング` を含まず失敗、Scenario Eも同様に失敗する（Scenario A〜Cは引き続きPASS）。

- [ ] **Step 3: `tmRushEnd` に `rankHtml` 引数を追加する**

現在の `tmRushEnd`（472〜485行目付近）:

```javascript
function tmRushEnd(renchan,rushStock,totalBalls){
  const rows=[1,2,3,4,5].map(n=>
    `<div class="sr" style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px"><span class="sk">${n*C.B_UNIT_GROSS}ボーナス</span><span class="sv2">${rushStock[n]}回</span></div>`
  ).join('');
  const units=totalBalls/C.B_UNIT_GROSS;
  return `
  <div class="mt" style="color:#aaa">🌙 RUSH終了</div>
  <div class="ms2">STを使い切りました。通常時へ戻ります。</div>
  <hr style="border-color:#333;margin:8px 0">
  <div class="sr" style="display:flex;justify-content:space-between;padding:6px 0"><span class="sk">連チャン数</span><span class="sv2" style="color:var(--gold);font-weight:bold">${renchan}連</span></div>
  ${rows}
  <hr style="border-color:#333;margin:8px 0">
  <div class="sr" style="display:flex;justify-content:space-between;padding:6px 0"><span class="sk">総獲得出玉</span><span class="sv2" style="color:var(--gold);font-weight:bold">${totalBalls.toLocaleString()}発（1500×${units}）</span></div>
  <button class="bok" onclick="closeM()">通常時へ</button>`;}
```

を次のように変更する（`rankHtml` 引数を追加し、ボタンの直前に挿入）:

```javascript
function tmRushEnd(renchan,rushStock,totalBalls,rankHtml){
  const rows=[1,2,3,4,5].map(n=>
    `<div class="sr" style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px"><span class="sk">${n*C.B_UNIT_GROSS}ボーナス</span><span class="sv2">${rushStock[n]}回</span></div>`
  ).join('');
  const units=totalBalls/C.B_UNIT_GROSS;
  return `
  <div class="mt" style="color:#aaa">🌙 RUSH終了</div>
  <div class="ms2">STを使い切りました。通常時へ戻ります。</div>
  <hr style="border-color:#333;margin:8px 0">
  <div class="sr" style="display:flex;justify-content:space-between;padding:6px 0"><span class="sk">連チャン数</span><span class="sv2" style="color:var(--gold);font-weight:bold">${renchan}連</span></div>
  ${rows}
  <hr style="border-color:#333;margin:8px 0">
  <div class="sr" style="display:flex;justify-content:space-between;padding:6px 0"><span class="sk">総獲得出玉</span><span class="sv2" style="color:var(--gold);font-weight:bold">${totalBalls.toLocaleString()}発（1500×${units}）</span></div>
  ${rankHtml}
  <button class="bok" onclick="closeM()">通常時へ</button>`;}
```

- [ ] **Step 4: `endRush` でランキングを記録し、`rankHtml` を組み立てて `tmRushEnd` に渡す**

現在の `endRush`（487〜498行目付近）:

```javascript
async function endRush(){
  S.rushActive=false;
  const finalRenchan=S.renchan;
  const rushStock=S.rushStock;
  const totalBalls=rushStock.reduce((sum,cnt,hitCount)=>sum+cnt*hitCount*C.B_UNIT_GROSS,0);
  addH(`RUSH終了（ST消化）　${finalRenchan}連チャンで終了`,'inv');
  S.renchan=0;
  updS();
  await showM(tmRushEnd(finalRenchan,rushStock,totalBalls),'mn');
  S.cur=0;
  updS();
}
```

を次のように変更する:

```javascript
async function endRush(){
  S.rushActive=false;
  const finalRenchan=S.renchan;
  const rushStock=S.rushStock;
  const totalBalls=rushStock.reduce((sum,cnt,hitCount)=>sum+cnt*hitCount*C.B_UNIT_GROSS,0);
  addH(`RUSH終了（ST消化）　${finalRenchan}連チャンで終了`,'inv');

  // 闇パチ（居座り継続）中に終了したRUSHはランキング対象外。
  let rankHtml;
  if(S.limitPassed){
    rankHtml=`
      <hr style="border-color:#333;margin:8px 0">
      <div class="mt" style="font-size:16px;color:var(--gold)">🏆 最高出玉ランキング</div>
      <div class="ms2" style="color:#888">闇パチ中のため今回は対象外です</div>`;
  } else {
    const {list, entry, madeList}=recordRanking(totalBalls, finalRenchan);
    rankHtml=`
      <hr style="border-color:#333;margin:8px 0">
      <div class="mt" style="font-size:16px;color:var(--gold)">🏆 最高出玉ランキング</div>
      ${madeList?'<div class="ms2" style="color:var(--gold)">ランクイン！</div>':''}
      ${renderRankingList(list, entry)}`;
  }

  S.renchan=0;
  updS();
  await showM(tmRushEnd(finalRenchan,rushStock,totalBalls,rankHtml),'mn');
  S.cur=0;
  updS();
}
```

- [ ] **Step 5: テストを実行し、全シナリオが成功することを確認する**

Run: `cd verify && node task15-ranking.mjs`
Expected: PASS — Scenario A〜Eすべて成功。

- [ ] **Step 6: コミットする**

```bash
git add index.html verify/task15-ranking.mjs
git commit -m "Record ranking entries at RUSH end instead of retirement"
```

---

### Task 3: 精算画面からランキング表示を削除し、閉店時の文言を更新する

**Files:**
- Modify: `index.html`（`showSettle`, `tmClosingTime`）
- Test: `verify/task15-ranking.mjs`（シナリオ追記）

- [ ] **Step 1: `verify/task15-ranking.mjs` の末尾（`console.log('PASS: task15-ranking');` の直前）に以下のシナリオを追記する**

```javascript
// Scenario F: the settlement screen no longer shows any ranking block.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await setup(page, new Array(5).fill(0.999999)); // force misses so retirement is trivial
  await page.click('#btn1');
  await page.click('#btnr'); // 退店 -> settlement
  await page.waitForSelector('#ov:not(.h)');
  const settleText = await page.locator('#mb').innerText();
  assert.doesNotMatch(settleText, /最高出玉ランキング/);

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kinnikuRankingV1') || '[]'));
  assert.equal(stored.length, 0); // retirement no longer records anything

  await browser.close();
  console.log('PASS: settlement screen no longer shows a ranking block');
}
```

- [ ] **Step 2: テストを実行し、追記したシナリオが失敗することを確認する**

Run: `cd verify && node task15-ranking.mjs`
Expected: FAIL — `showSettle()` がまだ `最高出玉ランキング` ブロックを表示するため失敗する（Scenario A〜EはPASSのまま）。

- [ ] **Step 3: `showSettle` からランキング関連コードを削除する**

現在の `showSettle` 冒頭〜`rankHtml`計算部分（828〜850行目付近）:

```javascript
function showSettle(){
  const rawExchY=Math.floor(S.balls)*S.exRate;
  const exchY=floor500(rawExchY);
  const finalPL=Math.round(exchY-S.cashUsed);
  const outRate=S.investB>0?Math.round(Math.floor(S.balls)/S.investB*100):0;
  const plColor=finalPL>=0?'#22c55e':'#ef4444';
  const plSign=finalPL>=0?'+':'';

  // 闇パチ（居座り継続）を経由した場合はランキング対象外。
  let rankHtml;
  if(S.limitPassed){
    rankHtml=`
      <hr style="border-color:#333;margin:8px 0">
      <div class="mt" style="font-size:16px;color:var(--gold)">🏆 最高出玉ランキング</div>
      <div class="ms2" style="color:#888">闇パチを経由したため今回は対象外です</div>`;
  } else {
    const {list, entry, madeList}=recordRanking(Math.floor(S.balls));
    rankHtml=`
      <hr style="border-color:#333;margin:8px 0">
      <div class="mt" style="font-size:16px;color:var(--gold)">🏆 最高出玉ランキング</div>
      ${madeList?'<div class="ms2" style="color:var(--gold)">ランクイン！</div>':''}
      ${renderRankingList(list, entry)}`;
  }

  const html=`
```

を次のように変更する（`rankHtml` 計算ブロックを丸ごと削除）:

```javascript
function showSettle(){
  const rawExchY=Math.floor(S.balls)*S.exRate;
  const exchY=floor500(rawExchY);
  const finalPL=Math.round(exchY-S.cashUsed);
  const outRate=S.investB>0?Math.round(Math.floor(S.balls)/S.investB*100):0;
  const plColor=finalPL>=0?'#22c55e':'#ef4444';
  const plSign=finalPL>=0?'+':'';

  const html=`
```

続けて、`showSettle` 末尾の `${rankHtml}` 参照（873行目付近）:

```javascript
    ${rankHtml}
    <div style="margin-top:18px;text-align:center">
      <button class="bok" onclick="location.reload()">もう一度遊ぶ</button>
    </div>`;
  showM(html,'mn');
}
```

を次のように変更する（`${rankHtml}` の行を削除）:

```javascript
    <div style="margin-top:18px;text-align:center">
      <button class="bok" onclick="location.reload()">もう一度遊ぶ</button>
    </div>`;
  showM(html,'mn');
}
```

- [ ] **Step 4: `tmClosingTime` の文言を、RUSH単位の除外ルールに合わせて更新する**

現在の `tmClosingTime`（325〜335行目付近）にある該当の1行:

```javascript
    <span style="color:#f87171">※闇パチへ進むと、ここまでの出玉は最高出玉ランキングの対象外になります</span>
```

を次のように変更する:

```javascript
    <span style="color:#f87171">※闇パチ中に終了したRUSHは、最高出玉ランキングの対象外になります</span>
```

- [ ] **Step 5: テストを実行し、全シナリオが成功することを確認する**

Run: `cd verify && node task15-ranking.mjs`
Expected: PASS — Scenario A〜Fすべて成功し、最後に `PASS: task15-ranking` が出力される。

- [ ] **Step 6: コミットする**

```bash
git add index.html verify/task15-ranking.mjs
git commit -m "Remove ranking block from settlement screen, update closing-time wording"
```

---

### Task 4: 全体回帰テストとGitHubへのpush

**Files:** なし（検証とpushのみ）

- [ ] **Step 1: 既存の全verifyスクリプトを実行し、他機能に回帰がないことを確認する**

Run:
```bash
cd verify
for f in task*.mjs; do echo "== $f =="; node "$f" || exit 1; done
node smoke.mjs
```
Expected: 全スクリプトが `PASS` で終了する。1つでも `FAIL`/例外が出た場合は、そのスクリプト名と失敗理由を確認し、Task 1〜3の変更内容に立ち戻って原因を特定してから修正する（対症療法的なテスト側の書き換えはしない）。

- [ ] **Step 2: `git status` で作業ツリーがコミット済みであることを確認する**

Run: `git status`
Expected: `nothing to commit, working tree clean`（Task 1〜3で全てコミット済みのはず）。もし未コミットの変更が残っていた場合は内容を確認し、適切なコミットメッセージで追加コミットする。

- [ ] **Step 3: リモート（GitHub）にpushする**

Run: `git push`
Expected: `origin/master` に今回の3コミットが反映される。pushはユーザーに変更内容を明示的に伝えた上で実行すること。
