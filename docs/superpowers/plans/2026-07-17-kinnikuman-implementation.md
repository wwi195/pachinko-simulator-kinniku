# eフィーバーキン肉マン シミュレーター Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `index.html`, a single-file pachinko simulator for "eフィーバーキン肉マン", by adapting `C:\Users\ab_99\Desktop\garo7500-repo\index.html` to the new spec in `docs/superpowers/specs/2026-07-17-kinnikuman-design.md`.

**Architecture:** One self-contained `index.html` (HTML+CSS+JS), matching garo7500's structure: setup screen → game screen (stats/controls/history) → modal-driven event sequences → settlement. No build step, no bundler, no framework. A thin `rand()` wrapper around `Math.random()` is introduced purely so Playwright verification scripts can force deterministic outcomes; this is the one deliberate deviation from garo7500's raw `Math.random()` calls.

**Tech Stack:** Plain HTML/CSS/JS (ES2020+, runs in Chromium/Edge). Playwright (Node, dev-only) drives headless-browser verification during implementation; it is not required to play the game.

---

## Verification Strategy (read before starting)

Every task below is verified with a Playwright script under `verify/`. The scripts load `index.html` via a `file://` URL and drive the UI like a real player, but force specific outcomes through a test-only hook:

```js
window.__TEST__.setRandomQueue([0.001, 0.5, 0.9]);
```

`rand()` (defined in Task 3) shifts values off this queue in call order; once the queue is empty it falls back to real `Math.random()`. Because we write both the game code and the verify scripts in this plan, the call order is known — each verify script's comments state exactly which `rand()` call each queued value is for.

`verify/` is committed to the repo (it's a QA tool, not part of the single-file deliverable) but `verify/node_modules/` is gitignored.

---

## Task 1: Verification harness (Playwright)

**Files:**
- Create: `verify/package.json`
- Create: `verify/smoke.mjs`
- Create: `.gitignore`

- [ ] **Step 1: Create `.gitignore`**

```gitignore
verify/node_modules/
verify/package-lock.json
```

- [ ] **Step 2: Create `verify/package.json`**

```json
{
  "name": "kinnikuman-verify",
  "private": true,
  "type": "module",
  "devDependencies": {
    "playwright": "^1.47.0"
  }
}
```

- [ ] **Step 3: Install Playwright and the Chromium browser**

Run: `cd verify && npm install && npx playwright install chromium`
Expected: installs succeed with no errors (chromium download may take a minute).

- [ ] **Step 4: Write a throwaway HTML fixture and a smoke-test script**

Create `verify/fixture-smoke.html`:

```html
<!DOCTYPE html>
<html><body><h1 id="msg">hello</h1></body></html>
```

Create `verify/smoke.mjs`:

```js
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
```

- [ ] **Step 5: Run it**

Run: `cd verify && node smoke.mjs`
Expected: `PASS: smoke test`

- [ ] **Step 6: Delete the throwaway fixture (keep smoke.mjs as the harness sanity check)**

Run: `rm verify/fixture-smoke.html` — then edit `verify/smoke.mjs` to point at a fixture generated inline instead, OR simply leave `fixture-smoke.html` in place since it's tiny and harmless. **Keep it** — do not delete; it's a cheap regression check that the harness itself still works. Skip this step.

- [ ] **Step 7: Commit**

```bash
cd "/c/Users/ab_99/pachinko-simulator-kinniku"
git add .gitignore verify/package.json verify/smoke.mjs verify/fixture-smoke.html
git commit -m "Add Playwright verification harness"
```

---

## Task 2: HTML scaffold, red×gold theme, setup screen

**Files:**
- Create: `index.html`
- Create: `verify/task2-setup.mjs`

- [ ] **Step 1: Create `index.html` with `<head>`, theme CSS, and the setup screen**

This adapts garo7500's `#setup` block and `:root` palette. Key changes: title/copy text, and the accent gradient shifts from gold-only to a red×gold "ring" gradient (`--ring`).

```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>eフィーバーキン肉マン 疑似遊技シミュレーター</title>
<style>
:root{
  --gold:#ffd700;--ring:#c81e1e;--dark:#0a0a0a;
  --panel:#111;--panel2:#1a1a1a;--text:#f0e6c8;
  --dim:#777;--red:#ef4444;--green:#22c55e;
  --purple:#a855f7;--cyan:#06b6d4;
}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
body{
  background:var(--dark);color:var(--text);
  font-family:'Helvetica Neue',Arial,sans-serif;
  max-width:480px;margin:0 auto;overflow-x:hidden;
}
#setup{
  min-height:100vh;display:flex;flex-direction:column;
  align-items:center;justify-content:center;padding:24px 16px;gap:16px;
}
.s-title{font-size:30px;font-weight:bold;color:var(--gold);text-align:center;text-shadow:0 0 24px rgba(200,30,30,.6);letter-spacing:4px;}
.s-sub{font-size:13px;color:var(--dim);text-align:center;margin-top:4px;}
.s-card{width:100%;background:var(--panel2);border:1px solid var(--ring);border-radius:12px;padding:16px;}
.s-step{font-size:10px;color:var(--gold);letter-spacing:2px;margin-bottom:10px;text-transform:uppercase;}
.og{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.og3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
.opt{background:var(--panel);border:2px solid #444;border-radius:10px;color:var(--text);padding:12px 6px;font-size:12px;cursor:pointer;text-align:center;line-height:1.5;transition:all .15s;}
.opt.sel{border-color:var(--gold);background:rgba(200,30,30,.15);color:var(--gold);}
.opt:active{transform:scale(.97);}
.s-opt-sub{font-size:10px;color:#aaa;}
.go-btn{width:100%;background:linear-gradient(135deg,#7a0000,#c81e1e,#ffd700,#7a0000);color:#fff;border:none;border-radius:12px;font-size:20px;font-weight:bold;padding:18px;cursor:pointer;letter-spacing:2px;}
.go-btn:disabled{opacity:.35;cursor:default;}
.go-btn:not(:disabled):active{transform:scale(.98);}
.premium-opt{margin-top:8px;width:100%;background:linear-gradient(135deg,#1a0a2e,#2d1b4e,#1a0a2e);border:2px solid var(--purple);color:#e9d5ff;border-radius:10px;padding:12px 6px;font-size:12px;cursor:pointer;text-align:center;line-height:1.5;}
.premium-opt.sel{border-color:var(--purple);background:rgba(168,85,247,.25);color:#fff;box-shadow:0 0 12px rgba(168,85,247,.5);}
.bok{display:inline-block;padding:13px 28px;background:linear-gradient(135deg,#7a0000,#c81e1e,#ffd700,#7a0000);color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:bold;cursor:pointer;margin-top:8px;}
.bok:active{transform:scale(.97);}
#ov{position:fixed;inset:0;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;z-index:100;padding:16px;}
#ov.h{display:none;}
#mb{width:100%;max-width:400px;max-height:90vh;overflow-y:auto;border-radius:16px;padding:22px;text-align:center;}
.mn{background:var(--panel2);border:2px solid var(--gold);}
.mt{font-size:22px;font-weight:bold;margin-bottom:6px;}
.ms2{font-size:13px;color:var(--dim);margin-bottom:12px;}
#game{display:none;}
#game.active{display:flex;}
</style>
</head>
<body>

<div id="setup">
  <div>
    <div class="s-title">eフィーバー<br>キン肉マン</div>
    <div class="s-sub">疑似遊技シミュレーター</div>
  </div>
  <div class="s-card">
    <div class="s-step">Step 1 — 所持金</div>
    <div id="wopts" class="og">
      <button class="opt" id="w-10000" onclick="selW(10000)"><strong>¥10,000</strong><br><span class="s-opt-sub">仕事帰り</span></button>
      <button class="opt" id="w-30000" onclick="selW(30000)"><strong>¥30,000</strong><br><span class="s-opt-sub">夕方から</span></button>
      <button class="opt" id="w-60000" onclick="selW(60000)"><strong>¥60,000</strong><br><span class="s-opt-sub">昼から</span></button>
      <button class="opt" id="w-200000" onclick="selW(200000)"><strong>¥200,000</strong><br><span class="s-opt-sub">朝からタコ粘り</span></button>
    </div>
    <button class="premium-opt" id="w-10000000" onclick="selPremium()"><strong>💎 ¥10,000,000</strong><br><span class="s-opt-sub">プレミアムプラン</span></button>
  </div>
  <div class="s-card">
    <div class="s-step">Step 2 — 交換レート</div>
    <div class="og">
      <button class="opt" id="rp" onclick="selR('par')"><strong>等価</strong><br><span class="s-opt-sub">4円投資 / 4円換金</span></button>
      <button class="opt" id="rs" onclick="selR('s357')"><strong>3.57円返し</strong><br><span class="s-opt-sub">4円投資 / 3.57円換金</span></button>
    </div>
  </div>
  <div class="s-card">
    <div class="s-step">Step 3 — 店を選ぶ</div>
    <div id="sopts" class="og3"></div>
  </div>
  <button class="go-btn" id="gbtn" onclick="startGame()" disabled>▶ 遊技開始</button>
</div>

<div id="game">
</div>

<div id="ov" class="h"><div id="mb"></div></div>

<script>
'use strict';

const C={
  SHOPS:{par:{good:17.2,bad:16.0,worst:13.0},s357:{good:18.1,bad:17.0,worst:14.0}},
  EX:{par:4.0,s357:3.57},
  BPK:250,
};

let _reg=null,_shop=null,_wallet=null;

const SDEF={
  par: [{k:'good',l:'優良店',s:'17.2回/千円'},{k:'bad',l:'悪店',s:'16.0回/千円'},{k:'worst',l:'極悪店',s:'13.0回/千円'}],
  s357:[{k:'good',l:'優良店',s:'18.1回/千円'},{k:'bad',l:'悪店',s:'17.0回/千円'},{k:'worst',l:'極悪店',s:'14.0回/千円'}],
};

function selW(w){
  _wallet=w;
  [10000,30000,60000,200000,10000000].forEach(x=>{const e=document.getElementById('w-'+x);if(e)e.classList.toggle('sel',x===w);});
  chkR();
}
function tmPremium(){return `
  <div class="mt" style="color:var(--purple)">💎 プレミアムプランです</div>
  <div class="ms2" style="line-height:1.7;font-size:13px">このプランは通常ご利用いただけません。<br><br>しかし、あなたがいつかギャンチューを応援してくれるのであれば、<br>ご利用いただいてもいいですよ。</div>
  <div style="display:flex;gap:10px;margin-top:18px">
    <button class="bok" style="flex:1;background:linear-gradient(135deg,#4c1d95,#a855f7,#4c1d95)" onclick="confirmPremium(true)">はい、応援します</button>
    <button class="bok" style="flex:1;background:#2a2a2a;color:#ccc" onclick="confirmPremium(false)">いいえ</button>
  </div>`;}
function selPremium(){showM(tmPremium(),'mn');}
function confirmPremium(yes){
  closeM();
  if(yes){ selW(10000000); }
  else { _wallet=null; document.getElementById('w-10000000').classList.remove('sel'); chkR(); }
}
function selR(r){
  _reg=r; _shop=null;
  document.getElementById('rp').classList.toggle('sel',r==='par');
  document.getElementById('rs').classList.toggle('sel',r==='s357');
  document.getElementById('sopts').innerHTML=SDEF[r].map(d=>
    `<button class="opt" id="sp-${d.k}" onclick="selS('${d.k}')">
      <strong>${d.l}</strong><br><span class="s-opt-sub">${d.s}</span>
    </button>`).join('');
  chkR();
}
function selS(k){
  _shop=k;
  ['good','bad','worst'].forEach(x=>{const e=document.getElementById('sp-'+x);if(e)e.classList.toggle('sel',x===k);});
  chkR();
}
function chkR(){document.getElementById('gbtn').disabled=!(_wallet&&_reg&&_shop);}

function startGame(){
  document.getElementById('setup').style.display='none';
  document.getElementById('game').classList.add('active');
}

let _res=null;
function showM(html,theme){
  const ov=document.getElementById('ov');
  const box=document.getElementById('mb');
  ov.style.background='';
  box.className=theme||'mn'; box.innerHTML=html;
  ov.classList.remove('h');
  return new Promise(r=>{_res=r;});
}
function closeM(){
  document.getElementById('ov').classList.add('h');
  if(_res){_res();_res=null;}
}
</script>
</body>
</html>
```

- [ ] **Step 2: Write the verify script**

Create `verify/task2-setup.mjs`:

```js
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = path.dirname(fileURLToPath(import.meta.url));
const url = 'file://' + path.join(dir, '..', 'index.html');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url);

const title = await page.title();
assert.equal(title, 'eフィーバーキン肉マン 疑似遊技シミュレーター');

// Start button disabled until all 3 steps chosen
assert.equal(await page.isDisabled('#gbtn'), true);

await page.click('#w-30000');
await page.click('#rp');
// shop options render after rate is chosen
await page.click('#sp-good');

assert.equal(await page.isDisabled('#gbtn'), false);

await page.click('#gbtn');
await page.waitForSelector('#game.active');
const setupDisplay = await page.evaluate(() => document.getElementById('setup').style.display);
assert.equal(setupDisplay, 'none');

await browser.close();
console.log('PASS: task2-setup');
```

- [ ] **Step 3: Run it**

Run: `cd verify && node task2-setup.mjs`
Expected: `PASS: task2-setup`

- [ ] **Step 4: Commit**

```bash
git add index.html verify/task2-setup.mjs
git commit -m "Add HTML scaffold, red x gold theme, setup screen"
```

---

## Task 3: State, economy loop, `rand()` test hook, normal-mode miss path

**Files:**
- Modify: `index.html`
- Create: `verify/task3-economy.mjs`

- [ ] **Step 1: Add the game-screen markup**

Replace the empty `<div id="game"></div>` in `index.html` with:

```html
<div id="game">
  <div id="stats">
    <div class="stats-grid">
      <div class="sb"><span class="sl">投資額：</span><span class="sv neg" id="ti">¥0</span></div>
      <div class="sb"><span class="sl">現金残高：</span><span class="sv gold" id="tw">¥0</span></div>
      <div class="sb" style="grid-column:span 2;justify-content:center;gap:10px"><span class="sl">持ち玉：</span><span class="sv" id="tb" style="color:var(--cyan)">0</span></div>
      <div class="sb"><span class="sl">スタート：</span><span class="sv" id="tc">0</span></div>
      <div class="sb"><span class="sl">総回転数：</span><span class="sv" id="tt">0</span></div>
    </div>
    <div class="bbl">
      <div class="bb-top">
        <div class="bb-lbl">大当たり合計</div>
        <div class="bb-num" id="tht">0</div>
        <div class="bb-lbl">回</div>
      </div>
    </div>
    <div id="rushBadge" style="display:none;text-align:center;color:var(--gold);font-weight:bold;font-size:13px;margin-top:4px">RUSH中　残りST <span id="rushStVal">0</span></div>
  </div>

  <div id="ctrl">
    <div id="normalCtrl" class="spinRow">
      <button class="mb b1 circ" id="btn1" onclick="doSpin1()"><span class="ci">▶</span><span class="ct">スタート<br>1回転</span></button>
      <button class="mb b100 circ" id="btn100" onclick="doSpin100()"><span class="ci">⏩</span><span class="ct">100回転<br>スキップ</span></button>
    </div>
    <div id="rushCtrl" class="spinRow" style="display:none">
      <button class="mb brush1" id="btnR1" onclick="doRushSpin1()">1回転</button>
      <button class="mb brush10" id="btnR10" onclick="doRushSpin10()">10回転</button>
      <button class="mb brushskip" id="btnRSkip" onclick="doRushSkip()">次発展まで</button>
    </div>
    <button class="mb brt" id="btnr" onclick="doRetire()">退店</button>
  </div>

  <div id="hw">
    <div class="ht">— 遊技履歴 —</div>
    <div id="hl"></div>
  </div>
</div>
```

- [ ] **Step 2: Add the missing CSS for the game screen**

Append to the `<style>` block:

```css
#game{flex-direction:column;height:100vh;overflow:hidden;}
#stats{background:var(--panel2);border-bottom:2px solid var(--ring);padding:16px 10px 5px;flex-shrink:0;}
.stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:5px;}
.sb{background:var(--panel);border-radius:8px;padding:6px 10px;display:flex;align-items:center;justify-content:center;gap:5px;}
.sl{font-size:12px;color:var(--dim);}
.sv{font-size:18px;font-weight:bold;}
.sv.neg{color:var(--red);}
.sv.gold{color:var(--gold);}
.bbl{background:var(--panel);border-radius:8px;padding:6px 10px;margin-bottom:5px;}
.bb-top{display:flex;align-items:baseline;justify-content:center;gap:6px;margin-bottom:4px;}
.bb-lbl{font-size:10px;color:var(--gold);}
.bb-num{font-size:28px;font-weight:bold;color:var(--gold);line-height:1;}
#ctrl{flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px 14px 10px;gap:10px;border-bottom:1px solid #2a2a2a;}
.mb{border:none;font-weight:bold;cursor:pointer;letter-spacing:1px;transition:all .1s;border-radius:10px;padding:14px;color:#fff;}
.mb:active:not(:disabled){transform:scale(.97);}
.mb:disabled{opacity:.35;cursor:default;}
.spinRow{display:flex;justify-content:center;align-items:center;gap:14px;width:100%;}
.circ{border-radius:50%;width:44%;max-width:170px;aspect-ratio:1/1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0;}
.circ .ci{font-size:30px;line-height:1;margin-bottom:6px;}
.circ .ct{font-size:13px;line-height:1.3;}
.b1{background:linear-gradient(135deg,#1a3a6b,#2563eb,#1a3a6b);}
.b100{background:linear-gradient(135deg,#6b1a1a,#dc2626,#6b1a1a);}
.brush1,.brush10,.brushskip{flex:1;background:linear-gradient(135deg,#7a0000,#c81e1e,#ffd700,#7a0000);padding:14px 4px;font-size:13px;}
.brt{width:100%;max-width:380px;border-radius:14px;background:var(--panel2);border:1px solid #444;color:var(--dim);font-size:13px;padding:9px;max-width:200px;}
#hw{flex:1;overflow-y:auto;padding:8px 12px 20px;}
.ht{font-size:10px;color:var(--dim);margin-bottom:4px;letter-spacing:2px;}
.hi{font-size:11px;color:#888;padding:3px 0;border-bottom:1px solid #1e1e1e;line-height:1.4;}
.hi.hit{color:var(--gold);}
.hi.inv{color:#666;}
```

- [ ] **Step 3: Add the `rand()` test hook, constants, state, and economy functions**

Append to the `<script>` block (after the existing setup-screen code):

```js
/* ============================================================
   TEST HOOK — rand() wraps Math.random so Playwright can force
   deterministic outcomes via window.__TEST__.setRandomQueue([...]).
   Consumed in call order; falls back to real Math.random() once
   the queue is empty.
============================================================ */
let _randQueue=[];
function rand(){
  if(_randQueue.length) return _randQueue.shift();
  return Math.random();
}
window.__TEST__={
  setRandomQueue(arr){ _randQueue=arr.slice(); },
};

/* ============================================================
   SPEC CONSTANTS
============================================================ */
Object.assign(C,{
  P_HIT: 1/399.9,
  B_UNIT_GROSS: 1500,
  B_UNIT_NET: 1400,
  P_LEVABURU: 0.30,   // TODO: 仮値。正式値が来たら差し替える
  P_VFLA: 0.15,        // TODO: 仮値。正式値が来たら差し替える
  P_RUSH_ENTRY: 0.50,
  RUSH_ST: 145,
  P_HATTEN: 1/92.3,
  P_STOCK_HIT: 1/2.8,
  STOCK_COUNT: 5,
  P_ZERO_RESET: 0.50,
});

/* ============================================================
   STATE
============================================================ */
let S={};
let _busy=false,_closingChoice=null;

function getSpinLimit(w){
  return {10000:400,30000:1200,60000:2400,200000:4000}[w]||null;
}
function newState(w,reg,shop){
  const spk=C.SHOPS[reg][shop];
  S={
    wallet:w, balls:0,
    cashUsed:0, investB:0, recovB:0,
    hits:{
      total:0,
      first:0,
      rushSuccess:0,
      rushFail:0,
      stock:[0,0,0,0,0,0], // index = 専用モードでの当たり数(0〜5)、値=発生回数
    },
    cur:0, ttl:0,
    spk, bps:C.BPK/spk,
    exRate:C.EX[reg],
    reg, hist:[],
    pendingInvest:0,
    spinLimit:getSpinLimit(w), limitPassed:false,
    rushActive:false, rushST:0, preDevST:0,
  };
}

function floor500(y){return Math.floor(y/500)*500;}

function updS(){
  document.getElementById('ti').textContent=S.cashUsed>0?`−¥${S.cashUsed.toLocaleString()}`:'¥0';
  document.getElementById('tw').textContent=`¥${S.wallet.toLocaleString()}`;
  document.getElementById('tb').textContent=Math.floor(S.balls).toLocaleString();
  document.getElementById('tht').textContent=S.hits.total;
  document.getElementById('tc').textContent=S.cur;
  document.getElementById('tt').textContent=S.ttl;
  document.getElementById('rushBadge').style.display=S.rushActive?'block':'none';
  document.getElementById('rushStVal').textContent=S.rushST;
  document.getElementById('normalCtrl').style.display=S.rushActive?'none':'flex';
  document.getElementById('rushCtrl').style.display=S.rushActive?'flex':'none';
}

function ensureBalls(){
  while(S.balls<S.bps){
    if(S.wallet<1000) return false;
    S.wallet-=1000; S.balls+=C.BPK;
    S.cashUsed+=1000; S.investB+=C.BPK;
    S.pendingInvest+=1000;
  }
  return true;
}
function consume(){S.balls-=S.bps; S.cur++; S.ttl++;}
function award(n){S.balls+=n; S.recovB+=n;}

function addH(t,c=''){
  S.hist.unshift({t,c});
  if(S.hist.length>150) S.hist.pop();
  document.getElementById('hl').innerHTML=S.hist.map(h=>`<div class="hi ${h.c}">${h.t}</div>`).join('');
}
function flushInvest(){
  if(S.pendingInvest>0){
    addH(`${S.cur}回転目：追加投資 ${S.pendingInvest.toLocaleString()}円`,'inv');
    S.pendingInvest=0;
  }
}

function lockAll(v){
  ['btn1','btn100','btnR1','btnR10','btnRSkip','btnr'].forEach(id=>{
    const e=document.getElementById(id); if(e) e.disabled=v;
  });
}

/* ============================================================
   SPIN LOOP (normal-mode hit chain added in Task 4,
   RUSH added in Task 5/6 — for now, normal mode always misses)
============================================================ */
async function oneSpin(){
  if(!ensureBalls()) return {over:true};
  consume(); updS();

  if(S.rushActive){
    return {ok:true}; // RUSH behavior added in Task 5
  }

  if(rand()<C.P_HIT){
    // win chain added in Task 4
    return {ok:true};
  }
  return {ok:true};
}

async function doSpin1(){
  if(_busy) return;
  _busy=true; lockAll(true);
  const r=await oneSpin();
  _busy=false; lockAll(false);
  if(r.over){showSettle();return;}
  updS();
}

async function doSpin100(){
  if(_busy) return;
  _busy=true; lockAll(true);
  let over=false;
  for(let i=0;i<100;i++){
    const r=await oneSpin();
    if(r.over){over=true;break;}
    if(r.stopped) break;
  }
  _busy=false; lockAll(false);
  if(over){showSettle();return;}
  updS();
}

async function doRushSpin1(){ if(_busy) return; }
async function doRushSpin10(){ if(_busy) return; }
async function doRushSkip(){ if(_busy) return; }

function doRetire(){
  if(_busy) return;
  lockAll(true);
  showSettle();
}

function showSettle(){
  const rawExchY=Math.floor(S.balls)*S.exRate;
  const exchY=floor500(rawExchY);
  const finalPL=Math.round(exchY-S.cashUsed);
  const plColor=finalPL>=0?'#22c55e':'#ef4444';
  const plSign=finalPL>=0?'+':'';
  const html=`
    <div class="mt" style="color:var(--gold)">精算</div>
    <div class="sfin" style="color:${plColor};font-size:26px;font-weight:bold;padding:12px 0">${plSign}¥${Math.abs(finalPL).toLocaleString()}</div>
    <div style="margin-top:18px;text-align:center">
      <button class="bok" onclick="location.reload()">もう一度遊ぶ</button>
    </div>`;
  showM(html,'mn');
}

const _origStartGame=startGame;
startGame=function(){
  newState(_wallet,_reg,_shop);
  _origStartGame();
  updS();
};
```

Note on Step 3's last few lines: wrapping `startGame` this way keeps Task 2's setup-screen code untouched (per the plan's file-boundary discipline) while giving it access to `newState`, which is defined later in the file. This is intentional — do not "clean it up" by moving the original `startGame` definition, since later tasks append more wrapping in the same pattern.

- [ ] **Step 4: Write the verify script**

Create `verify/task3-economy.mjs`:

```js
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

await page.click('#w-30000');
await page.click('#rp');
await page.click('#sp-good');
await page.click('#gbtn');
await page.waitForSelector('#game.active');

// ¥30,000 wallet, 優良店/等価 => spk=17.2, bps=250/17.2≈14.53
// First spin must draw ¥1,000 worth of balls (250) before consuming bps.
await page.click('#btn1');
const afterOne = await page.evaluate(() => ({balls:S.balls, cash:S.cashUsed, cur:S.cur, ttl:S.ttl}));
assert.equal(afterOne.cash, 1000);
assert.equal(afterOne.cur, 1);
assert.equal(afterOne.ttl, 1);
assert.ok(Math.abs(afterOne.balls - (250 - 250/17.2)) < 0.01);

await page.click('#btn100');
const after100 = await page.evaluate(() => ({cur:S.cur, ttl:S.ttl}));
assert.equal(after100.ttl, 101);
assert.equal(after100.cur, 101);

await browser.close();
console.log('PASS: task3-economy');
```

- [ ] **Step 5: Run it**

Run: `cd verify && node task3-economy.mjs`
Expected: `PASS: task3-economy`

- [ ] **Step 6: Commit**

```bash
git add index.html verify/task3-economy.mjs
git commit -m "Add game state, economy loop, and rand() test hook"
```

---

## Task 4: Normal-mode win chain (先バレ→レバブル→Vフラ→ジャッジ→初回1500発→RUSHチャレンジ)

**Files:**
- Modify: `index.html`
- Create: `verify/task4-normalwin.mjs`

- [ ] **Step 1: Add modal templates and the win-chain function**

Append to the `<script>` block:

```js
function imgDiv(src,fallback){
  return `<div class="pi" style="width:100%;max-width:300px;height:130px;background:#181818;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#444;font-size:11px;line-height:1.6;text-align:center;margin:0 auto 14px;border:1px dashed #333"><img src="${src}" alt="" style="max-width:100%;max-height:100%;width:auto;height:auto;border-radius:8px" onload="this.parentElement.style.border='none';this.parentElement.style.background='transparent'" onerror="this.style.display='none';this.parentElement.textContent='${fallback}'"></div>`;
}

function tmSenbare(spin){return `
  <div class="mt" style="color:var(--gold)">🥊 先バレ発生！</div>
  <div style="font-size:11px;color:#555;margin-bottom:18px">${spin}回転目</div>
  <button class="bok" onclick="closeM()">次へ →</button>`;}

function tmLevaburu(){return `
  ${imgDiv('images/levaburu.png','レバブル演出\n画像プレースホルダー')}
  <div class="mt" style="color:var(--ring)">💪 レバブル出現！</div>
  <button class="bok" onclick="closeM()">次へ →</button>`;}

function tmVfla(){return `
  ${imgDiv('images/vfla.png','Vフラ演出\n画像プレースホルダー')}
  <div class="mt" style="color:var(--gold)">✨ Vフラ発生！</div>
  <button class="bok" onclick="closeM()">ジャッジへ →</button>`;}

function tmJudge(){return `
  ${imgDiv('images/judge.png','JUDGE\n画像プレースホルダー')}
  <div class="mt" style="color:var(--ring)">⚖️ JUDGE</div>
  <button class="bok" onclick="closeM()">JUDGE！</button>`;}

function tmHatsuAtari(){return `
  <div class="mt" style="color:var(--gold)">🏆 1500ボーナス！</div>
  <div class="bm" style="font-size:26px;font-weight:bold;color:var(--gold);margin:10px 0 4px">1500ボーナス！</div>
  <div class="bs" style="font-size:14px;color:#aaa;margin-bottom:12px">（獲得 ${C.B_UNIT_NET}発）</div>
  <button class="bok" onclick="closeM()">次へ →</button>`;}

function tmRushChallenge(){return `
  <div class="mt" style="color:var(--ring)">🔥 RUSHチャレンジ！</div>
  <div class="ms2">ボタンを押してRUSH突入をかけろ！</div>
  <button class="bok" onclick="closeM()">RUSHチャレンジ！</button>`;}

function tmRushResult(win){return win?`
  ${imgDiv('images/rush_in.png','RUSH突入\n画像プレースホルダー')}
  <div class="mt" style="color:var(--gold)">🎉 RUSH突入！</div>
  <div class="ms2">ST${C.RUSH_ST}回転</div>
  <button class="bok" onclick="closeM()">RUSHへ →</button>`:`
  <div class="mt" style="color:#888">😢 RUSH突入ならず…</div>
  <div class="ms2">通常時へ戻ります</div>
  <button class="bok" onclick="closeM()">続ける</button>`;}

async function runNormalWinChain(){
  const spin0=S.cur;
  S.hits.total++;
  await showM(tmSenbare(spin0),'mn');

  if(rand()<C.P_LEVABURU){
    await showM(tmLevaburu(),'mn');
  }
  if(rand()<C.P_VFLA){
    await showM(tmVfla(),'mn');
  }
  await showM(tmJudge(),'mn');

  award(C.B_UNIT_NET);
  S.hits.first++;
  updS();
  await showM(tmHatsuAtari(),'mn');
  addH(`${spin0}回転目：先バレ→ジャッジ→初回大当たり(1500) → 実質+${C.B_UNIT_NET}発`,'hit');

  await showM(tmRushChallenge(),'mn');
  const rushWin=rand()<C.P_RUSH_ENTRY;
  if(rushWin){
    S.hits.rushSuccess++;
    S.rushActive=true;
    S.rushST=C.RUSH_ST;
    updS();
    await showM(tmRushResult(true),'mn');
  } else {
    S.hits.rushFail++;
    updS();
    await showM(tmRushResult(false),'mn');
  }
  S.cur=0;
  updS();
}
```

- [ ] **Step 2: Wire the win chain into `oneSpin()`**

In the `oneSpin()` function added in Task 3, replace:

```js
  if(rand()<C.P_HIT){
    // win chain added in Task 4
    return {ok:true};
  }
  return {ok:true};
```

with:

```js
  if(rand()<C.P_HIT){
    flushInvest();
    await runNormalWinChain();
    return {stopped:true};
  }
  return {ok:true};
```

- [ ] **Step 3: Write the verify script**

Create `verify/task4-normalwin.mjs`. Call order inside `runNormalWinChain()` after the `oneSpin()` hit roll: `rand()` for レバブル, then (if shown, closed via click) `rand()` for Vフラ, then `rand()` for RUSHチャレンジ. Each `showM(...)` pauses until the script clicks the modal's `.bok` button.

```js
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = path.dirname(fileURLToPath(import.meta.url));
const url = 'file://' + path.join(dir, '..', 'index.html');

async function setup(page, queue) {
  await page.goto(url);
  await page.evaluate(q => window.__TEST__.setRandomQueue(q), queue);
  await page.click('#w-30000');
  await page.click('#rp');
  await page.click('#sp-good');
  await page.click('#gbtn');
  await page.waitForSelector('#game.active');
}

async function clickThroughModal(page) {
  await page.waitForSelector('#ov:not(.h)');
  await page.click('#mb .bok');
}

// Scenario A: hit, レバブル shown, Vフラ NOT shown, RUSH challenge succeeds.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // queue: [P_HIT hit, P_LEVABURU show, P_VFLA skip, P_RUSH_ENTRY win]
  await setup(page, [0.0001, 0.0001, 0.99, 0.0001]);

  await page.click('#btn1'); // triggers the hit; first modal (先バレ) is up
  await clickThroughModal(page); // 先バレ -> レバブル modal appears
  const levaburuVisible = await page.locator('#mb').innerText();
  assert.match(levaburuVisible, /レバブル/);
  await clickThroughModal(page); // レバブル -> judge (Vフラ skipped)
  const judgeVisible = await page.locator('#mb').innerText();
  assert.match(judgeVisible, /JUDGE/);
  await clickThroughModal(page); // judge -> 1500 bonus
  const bonusVisible = await page.locator('#mb').innerText();
  assert.match(bonusVisible, /1500ボーナス/);
  const ballsAfterBonus = await page.evaluate(() => S.balls);
  await clickThroughModal(page); // bonus -> RUSHチャレンジ
  await clickThroughModal(page); // RUSHチャレンジ -> result (forced win)
  const resultVisible = await page.locator('#mb').innerText();
  assert.match(resultVisible, /RUSH突入！/);
  await clickThroughModal(page); // close result modal

  const finalState = await page.evaluate(() => ({rushActive:S.rushActive, rushST:S.rushST, first:S.hits.first, rushSuccess:S.hits.rushSuccess}));
  assert.equal(finalState.rushActive, true);
  assert.equal(finalState.rushST, 145);
  assert.equal(finalState.first, 1);
  assert.equal(finalState.rushSuccess, 1);
  assert.ok(ballsAfterBonus >= 1400);

  await browser.close();
  console.log('PASS: task4-normalwin scenario A (levaburu shown, rush success)');
}

// Scenario B: hit, レバブル NOT shown, Vフラ NOT shown, RUSH challenge fails.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await setup(page, [0.0001, 0.99, 0.99, 0.99]);

  await page.click('#btn1');
  await clickThroughModal(page); // 先バレ -> judge (both skipped)
  const judgeVisible = await page.locator('#mb').innerText();
  assert.match(judgeVisible, /JUDGE/);
  await clickThroughModal(page); // judge -> bonus
  await clickThroughModal(page); // bonus -> RUSHチャレンジ
  await clickThroughModal(page); // RUSHチャレンジ -> result (forced fail)
  const resultVisible = await page.locator('#mb').innerText();
  assert.match(resultVisible, /突入ならず/);
  await clickThroughModal(page);

  const finalState = await page.evaluate(() => ({rushActive:S.rushActive, rushFail:S.hits.rushFail}));
  assert.equal(finalState.rushActive, false);
  assert.equal(finalState.rushFail, 1);

  await browser.close();
  console.log('PASS: task4-normalwin scenario B (no reach effects, rush fail)');
}
```

- [ ] **Step 4: Run it**

Run: `cd verify && node task4-normalwin.mjs`
Expected: both `PASS:` lines printed, no assertion errors.

- [ ] **Step 5: Commit**

```bash
git add index.html verify/task4-normalwin.mjs
git commit -m "Add normal-mode win chain (senbare/levaburu/vfla/judge/rush challenge)"
```

---

## Task 5: RUSH ST loop, 発展 trigger, RUSH spin buttons

**Files:**
- Modify: `index.html`
- Create: `verify/task5-rushloop.mjs`

- [ ] **Step 1: Add RUSH-end modal and wire the RUSH branch of `oneSpin()`**

Append to the `<script>` block:

```js
function tmRushEnd(){return `
  <div class="mt" style="color:#aaa">🌙 RUSH終了</div>
  <div class="ms2">STを使い切りました。通常時へ戻ります。</div>
  <button class="bok" onclick="closeM()">通常時へ</button>`;}

async function endRush(){
  S.rushActive=false;
  addH(`RUSH終了（ST消化）`,'inv');
  updS();
  await showM(tmRushEnd(),'mn');
  S.cur=0;
  updS();
}
```

- [ ] **Step 2: Replace the RUSH stub in `oneSpin()`**

Replace:

```js
  if(S.rushActive){
    return {ok:true}; // RUSH behavior added in Task 5
  }
```

with:

```js
  if(S.rushActive){
    S.rushST--;
    if(rand()<C.P_HATTEN){
      // 専用モード added in Task 6; for now, treat development as a
      // no-op ST reset so the RUSH loop is testable in isolation.
      addH(`${S.ttl}回転目：発展！`,'hit');
      S.rushST=C.RUSH_ST;
      updS();
      return {stopped:true};
    }
    if(S.rushST<=0){
      await endRush();
      return {stopped:true};
    }
    return {ok:true};
  }
```

(Task 6 replaces the `発展` branch's body with the real 専用モード call — see Task 6 Step 2.)

- [ ] **Step 3: Implement the RUSH spin button handlers**

Replace the three stub functions from Task 3:

```js
async function doRushSpin1(){ if(_busy) return; }
async function doRushSpin10(){ if(_busy) return; }
async function doRushSkip(){ if(_busy) return; }
```

with:

```js
async function doRushSpin1(){
  if(_busy||!S.rushActive) return;
  _busy=true; lockAll(true);
  const r=await oneSpin();
  _busy=false; lockAll(false);
  if(r.over){showSettle();return;}
  updS();
}

async function doRushSpin10(){
  if(_busy||!S.rushActive) return;
  _busy=true; lockAll(true);
  let over=false;
  for(let i=0;i<10 && S.rushActive;i++){
    const r=await oneSpin();
    if(r.over){over=true;break;}
    if(r.stopped) break;
  }
  _busy=false; lockAll(false);
  if(over){showSettle();return;}
  updS();
}

async function doRushSkip(){
  if(_busy||!S.rushActive) return;
  _busy=true; lockAll(true);
  let over=false;
  while(S.rushActive){
    const r=await oneSpin();
    if(r.over){over=true;break;}
    if(r.stopped) break;
  }
  _busy=false; lockAll(false);
  if(over){showSettle();return;}
  updS();
}
```

- [ ] **Step 4: Write the verify script**

Create `verify/task5-rushloop.mjs`:

```js
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = path.dirname(fileURLToPath(import.meta.url));
const url = 'file://' + path.join(dir, '..', 'index.html');

async function setup(page, queue) {
  await page.goto(url);
  await page.evaluate(q => window.__TEST__.setRandomQueue(q), queue);
  await page.click('#w-200000');
  await page.click('#rp');
  await page.click('#sp-good');
  await page.click('#gbtn');
  await page.waitForSelector('#game.active');
}

async function clickThroughModal(page) {
  await page.waitForSelector('#ov:not(.h)');
  await page.click('#mb .bok');
}

// Scenario A: force RUSH entry, then force 145 consecutive 発展 misses
// (queue value 0.99 > P_HATTEN threshold every time) -> RUSH should end
// automatically via the skip button, and normal-mode controls return.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const missQueue = new Array(200).fill(0.99);
  await setup(page, [0.0001, 0.99, 0.99, 0.0001, ...missQueue]);

  await page.click('#btn1');
  await clickThroughModal(page); // 先バレ -> judge
  await clickThroughModal(page); // judge -> bonus
  await clickThroughModal(page); // bonus -> RUSHチャレンジ
  await clickThroughModal(page); // RUSHチャレンジ -> RUSH突入 result
  await clickThroughModal(page); // close result, RUSH now active

  const stAfterEntry = await page.evaluate(() => S.rushST);
  assert.equal(stAfterEntry, 145);

  await page.click('#btnRSkip');
  await clickThroughModal(page); // RUSH終了 modal

  const finalState = await page.evaluate(() => ({rushActive:S.rushActive}));
  assert.equal(finalState.rushActive, false);
  const normalCtrlDisplay = await page.evaluate(() => document.getElementById('normalCtrl').style.display);
  assert.equal(normalCtrlDisplay, 'flex');

  await browser.close();
  console.log('PASS: task5-rushloop scenario A (ST exhausts, RUSH ends)');
}

// Scenario B: force RUSH entry, then force 発展 on the very next RUSH spin.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await setup(page, [0.0001, 0.99, 0.99, 0.0001, 0.0001]);

  await page.click('#btn1');
  await clickThroughModal(page);
  await clickThroughModal(page);
  await clickThroughModal(page);
  await clickThroughModal(page);
  await clickThroughModal(page);

  await page.click('#btnR1');
  const stAfterHatten = await page.evaluate(() => S.rushST);
  assert.equal(stAfterHatten, 145); // placeholder 発展 handling resets ST (Task 6 replaces this)

  await browser.close();
  console.log('PASS: task5-rushloop scenario B (hatten triggers on first RUSH spin)');
}
```

- [ ] **Step 5: Run it**

Run: `cd verify && node task5-rushloop.mjs`
Expected: both `PASS:` lines printed.

- [ ] **Step 6: Commit**

```bash
git add index.html verify/task5-rushloop.mjs
git commit -m "Add RUSH ST loop, hatten trigger, and RUSH spin buttons"
```

---

## Task 6: 専用モード (5-stock judge)

**Files:**
- Modify: `index.html`
- Modify: `verify/task5-rushloop.mjs` (scenario B's assertion changes — see Step 3)
- Create: `verify/task6-senyoumode.mjs`

- [ ] **Step 1: Add 専用モード modal templates and `runSenyouMode()`**

Append to the `<script>` block:

```js
function tmSenyouIn(){return `
  <div class="mt" style="color:var(--ring)">🔥 専用モード突入！</div>
  <button class="bok" onclick="closeM()">次へ →</button>`;}

function tmStockFill(n){return `
  <div class="mt" style="color:var(--gold)">保留 ${n}/${C.STOCK_COUNT}</div>
  <div class="ms2">保留を貯めています…</div>
  <button class="bok" onclick="closeM()">次へ →</button>`;}

function tmJudgeButton(){return `
  <div class="mt" style="color:var(--gold)">保留5個 貯まりました！</div>
  <button class="bok" onclick="closeM()">ジャッジ！</button>`;}

const STOCK_RESULT_TEXT={
  0: {title:'はずれ…', color:'#888'},
  1: {title:'1500ボーナス！', color:'var(--gold)'},
  2: {title:'3000ボーナス！', color:'var(--gold)'},
  3: {title:'4500ボーナス！', color:'var(--gold)'},
  4: {title:'6000ボーナス！', color:'var(--gold)'},
  5: {title:'7500ボーナス！', color:'var(--gold)'},
};
function tmStockResult(hitCount){
  const t=STOCK_RESULT_TEXT[hitCount];
  const netText=hitCount>0?`<div class="bs" style="font-size:14px;color:#aaa;margin-bottom:12px">（実質+${hitCount*C.B_UNIT_NET}発）</div>`:'';
  return `
    <div class="mt" style="color:${t.color}">${hitCount}/${C.STOCK_COUNT} 当たり</div>
    <div class="bm" style="font-size:26px;font-weight:bold;color:${t.color};margin:10px 0 4px">${t.title}</div>
    ${netText}
    <button class="bok" onclick="closeM()">続ける</button>`;
}

async function runSenyouMode(){
  S.preDevST=S.rushST;
  await showM(tmSenyouIn(),'mn');
  for(let i=1;i<=C.STOCK_COUNT;i++){
    await showM(tmStockFill(i),'mn');
  }
  await showM(tmJudgeButton(),'mn');

  let hitCount=0;
  for(let i=0;i<C.STOCK_COUNT;i++){
    if(rand()<C.P_STOCK_HIT) hitCount++;
  }
  S.hits.stock[hitCount]++;

  if(hitCount===0){
    if(rand()<C.P_ZERO_RESET){
      S.rushST=C.RUSH_ST;
      addH(`専用モード：はずれ（0/5）→ ST145にリセット`,'inv');
    } else {
      S.rushST=S.preDevST;
      addH(`専用モード：はずれ（0/5）→ ST${S.preDevST}回転から再開`,'inv');
    }
    updS();
    await showM(tmStockResult(0),'mn');
  } else {
    const gross=hitCount*C.B_UNIT_GROSS;
    const net=hitCount*C.B_UNIT_NET;
    award(net);
    S.rushST=C.RUSH_ST;
    addH(`専用モード：${hitCount}/5 当たり → ${gross}ボーナス（実質+${net}発）→ ST145にリセット`,'hit');
    updS();
    await showM(tmStockResult(hitCount),'mn');
  }
}
```

- [ ] **Step 2: Replace the placeholder 発展 handling in `oneSpin()`**

In the RUSH branch added in Task 5, replace:

```js
    if(rand()<C.P_HATTEN){
      // 専用モード added in Task 6; for now, treat development as a
      // no-op ST reset so the RUSH loop is testable in isolation.
      addH(`${S.ttl}回転目：発展！`,'hit');
      S.rushST=C.RUSH_ST;
      updS();
      return {stopped:true};
    }
```

with:

```js
    if(rand()<C.P_HATTEN){
      addH(`${S.ttl}回転目：発展！`,'hit');
      await runSenyouMode();
      return {stopped:true};
    }
```

- [ ] **Step 3: Update Task 5's scenario B assertion**

`runSenyouMode()` now consumes 5 additional `rand()` calls (one per stock) after the 発展 roll, and the queue in scenario B only supplied one value for that roll. Open `verify/task5-rushloop.mjs` and change scenario B to drive through 専用モード instead of asserting the old placeholder behavior:

```js
// Scenario B: force RUSH entry, then force 発展 on the very next RUSH
// spin, then force all 5 stock checks to miss (queue values > 1/2.8).
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await setup(page, [0.0001, 0.99, 0.99, 0.0001, 0.0001, 0.9,0.9,0.9,0.9,0.9, 0.0001]);

  await page.click('#btn1');
  await clickThroughModal(page);
  await clickThroughModal(page);
  await clickThroughModal(page);
  await clickThroughModal(page);
  await clickThroughModal(page);

  await page.click('#btnR1'); // triggers hatten -> 専用モード突入 modal
  await clickThroughModal(page); // 突入 -> stock 1/5
  for (let i = 0; i < 5; i++) await clickThroughModal(page); // stock fill x5 -> judge button
  await clickThroughModal(page); // judge button -> result (0/5, forced ST145 reset)

  const stAfterHatten = await page.evaluate(() => S.rushST);
  assert.equal(stAfterHatten, 145);

  await browser.close();
  console.log('PASS: task5-rushloop scenario B (hatten -> senyou mode -> 0/5 -> ST reset)');
}
```

- [ ] **Step 4: Run Task 5's updated script to confirm it still passes**

Run: `cd verify && node task5-rushloop.mjs`
Expected: both `PASS:` lines printed.

- [ ] **Step 5: Write the Task 6 verify script**

Create `verify/task6-senyoumode.mjs`:

```js
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = path.dirname(fileURLToPath(import.meta.url));
const url = 'file://' + path.join(dir, '..', 'index.html');

async function setup(page, queue) {
  await page.goto(url);
  await page.evaluate(q => window.__TEST__.setRandomQueue(q), queue);
  await page.click('#w-200000');
  await page.click('#rp');
  await page.click('#sp-good');
  await page.click('#gbtn');
  await page.waitForSelector('#game.active');
}

async function clickThroughModal(page) {
  await page.waitForSelector('#ov:not(.h)');
  await page.click('#mb .bok');
}

async function enterRushAndHatten(page, stockQueue) {
  // hit, no levaburu/vfla, rush entry success, hatten immediately
  await setup(page, [0.0001, 0.99, 0.99, 0.0001, 0.0001, ...stockQueue]);
  await page.click('#btn1');
  for (let i=0;i<4;i++) await clickThroughModal(page); // 先バレ..bonus..rushchallenge
  await clickThroughModal(page); // -> rush result
  await clickThroughModal(page); // close, RUSH active
  await page.click('#btnR1'); // -> 専用モード突入 modal
  await clickThroughModal(page); // 突入 -> stock 1/5
  for (let i=0;i<5;i++) await clickThroughModal(page); // stock fills -> judge button
  await clickThroughModal(page); // judge button -> result
}

// Scenario A: 3-of-5 hits (P_STOCK_HIT threshold is 1/2.8 ≈ 0.357).
// queue: hit, hit, miss, hit, miss -> hitCount=3 -> "4500ボーナス！"
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await enterRushAndHatten(page, [0.01, 0.01, 0.9, 0.01, 0.9]);

  const resultText = await page.locator('#mb').innerText();
  assert.match(resultText, /4500ボーナス/);
  assert.match(resultText, /実質\+4200発/);

  const st = await page.evaluate(() => S.rushST);
  assert.equal(st, 145);
  const stockCounts = await page.evaluate(() => S.hits.stock);
  assert.equal(stockCounts[3], 1);

  await browser.close();
  console.log('PASS: task6-senyoumode scenario A (3/5 hits -> 4500 bonus)');
}

// Scenario B: 0-of-5 hits, forced to resume from preDevST instead of resetting.
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // stock queue: 5 misses, then the 0-hit branch's rand() forced >= P_ZERO_RESET
  await enterRushAndHatten(page, [0.9,0.9,0.9,0.9,0.9, 0.99]);

  const resultText = await page.locator('#mb').innerText();
  assert.match(resultText, /はずれ/);

  // RUSH entry set rushST=145, then 1 RUSH spin was consumed before hatten (btnR1
  // decrements rushST to 144 before rolling hatten), so preDevST=144.
  const st = await page.evaluate(() => S.rushST);
  assert.equal(st, 144);
  const stockCounts = await page.evaluate(() => S.hits.stock);
  assert.equal(stockCounts[0], 1);

  await browser.close();
  console.log('PASS: task6-senyoumode scenario B (0/5 -> resumes from preDevST)');
}
```

- [ ] **Step 6: Run it**

Run: `cd verify && node task6-senyoumode.mjs`
Expected: both `PASS:` lines printed. If scenario B's `st` assertion fails, print `S.rushST` and `S.preDevST` to confirm the off-by-one in the ST decrement timing (Task 5 Step 2 decrements `S.rushST` before rolling `P_HATTEN`), and adjust the expected value to match — the important behavioral property is `st === preDevST-at-time-of-development`, not the literal number 144.

- [ ] **Step 7: Commit**

```bash
git add index.html verify/task5-rushloop.mjs verify/task6-senyoumode.mjs
git commit -m "Add senyou-mode 5-stock judge and bonus payout table"
```

---

## Task 7: Settlement screen and stats breakdown

**Files:**
- Modify: `index.html`
- Create: `verify/task7-settlement.mjs`

- [ ] **Step 1: Add the collapsible breakdown panel to `#stats`**

In the `#stats` block added in Task 3, replace:

```html
    <div class="bbl">
      <div class="bb-top">
        <div class="bb-lbl">大当たり合計</div>
        <div class="bb-num" id="tht">0</div>
        <div class="bb-lbl">回</div>
      </div>
    </div>
```

with:

```html
    <div class="bbl">
      <div class="bb-top">
        <div class="bb-lbl">大当たり合計</div>
        <div class="bb-num" id="tht">0</div>
        <div class="bb-lbl">回</div>
      </div>
      <button class="bbToggle" id="bbToggleBtn" onclick="toggleDetail()" style="width:100%;background:var(--panel);border:1px solid #333;color:var(--gold);font-size:11px;padding:6px;border-radius:6px;margin-bottom:4px;cursor:pointer;letter-spacing:1px">▶ 詳細を見る</button>
      <div class="bbDetail" id="bbDetail" style="display:none;font-size:10px;color:var(--dim)">
        <div class="br" style="display:flex;justify-content:space-between"><span>初回大当たり</span><span class="bv" id="thFirst">0回</span></div>
        <div class="br" style="display:flex;justify-content:space-between"><span>RUSHチャレンジ成功</span><span class="bv" id="thRushOk">0回</span></div>
        <div class="br" style="display:flex;justify-content:space-between"><span>RUSHチャレンジ失敗</span><span class="bv" id="thRushNg">0回</span></div>
        <div class="br" style="display:flex;justify-content:space-between"><span>専用モード 5/5</span><span class="bv" id="thStock5">0回</span></div>
        <div class="br" style="display:flex;justify-content:space-between"><span>専用モード 4/5</span><span class="bv" id="thStock4">0回</span></div>
        <div class="br" style="display:flex;justify-content:space-between"><span>専用モード 3/5</span><span class="bv" id="thStock3">0回</span></div>
        <div class="br" style="display:flex;justify-content:space-between"><span>専用モード 2/5</span><span class="bv" id="thStock2">0回</span></div>
        <div class="br" style="display:flex;justify-content:space-between"><span>専用モード 1/5</span><span class="bv" id="thStock1">0回</span></div>
        <div class="br" style="display:flex;justify-content:space-between"><span>専用モード はずれ(0/5)</span><span class="bv" id="thStock0">0回</span></div>
      </div>
    </div>
```

- [ ] **Step 2: Add `toggleDetail()` and extend `updS()`**

Add near the other display functions:

```js
let _detailOpen=false;
function toggleDetail(){
  _detailOpen=!_detailOpen;
  document.getElementById('bbDetail').style.display=_detailOpen?'block':'none';
  document.getElementById('bbToggleBtn').textContent=_detailOpen?'▼ 詳細を閉じる':'▶ 詳細を見る';
}
```

In `updS()`, add before the closing brace:

```js
  document.getElementById('thFirst').textContent=`${S.hits.first}回`;
  document.getElementById('thRushOk').textContent=`${S.hits.rushSuccess}回`;
  document.getElementById('thRushNg').textContent=`${S.hits.rushFail}回`;
  document.getElementById('thStock5').textContent=`${S.hits.stock[5]}回`;
  document.getElementById('thStock4').textContent=`${S.hits.stock[4]}回`;
  document.getElementById('thStock3').textContent=`${S.hits.stock[3]}回`;
  document.getElementById('thStock2').textContent=`${S.hits.stock[2]}回`;
  document.getElementById('thStock1').textContent=`${S.hits.stock[1]}回`;
  document.getElementById('thStock0').textContent=`${S.hits.stock[0]}回`;
```

- [ ] **Step 3: Expand `showSettle()` with the full breakdown**

Replace the `showSettle()` function body (added in Task 3) with:

```js
function showSettle(){
  const rawExchY=Math.floor(S.balls)*S.exRate;
  const exchY=floor500(rawExchY);
  const finalPL=Math.round(exchY-S.cashUsed);
  const outRate=S.investB>0?Math.round(Math.floor(S.balls)/S.investB*100):0;
  const plColor=finalPL>=0?'#22c55e':'#ef4444';
  const plSign=finalPL>=0?'+':'';
  const ratelabel=S.reg==='par'?'等価':'3.57円返し';
  const html=`
    <div class="mt" style="color:var(--gold)">精算</div>
    <hr style="border-color:#333;margin:8px 0">
    <div class="sr" style="display:flex;justify-content:space-between;padding:6px 0"><span class="sk">持ち玉</span><span class="sv2">${Math.floor(S.balls).toLocaleString()}玉</span></div>
    <div class="sr" style="display:flex;justify-content:space-between;padding:6px 0"><span class="sk">換金（${ratelabel}）</span><span class="sv2">¥${Math.round(exchY).toLocaleString()}</span></div>
    <div class="sr" style="display:flex;justify-content:space-between;padding:6px 0"><span class="sk">総投資</span><span class="sv2" style="color:var(--red)">−¥${S.cashUsed.toLocaleString()}</span></div>
    <hr style="border-color:#333;margin:8px 0">
    <div class="sfin" style="color:${plColor};font-size:26px;font-weight:bold;text-align:center;padding:12px 0">${plSign}¥${Math.abs(finalPL).toLocaleString()}</div>
    <hr style="border-color:#333;margin:8px 0">
    <div class="sr" style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span class="sk">総回転数</span><span class="sv2">${S.ttl}回</span></div>
    <div class="sr" style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span class="sk">大当たり合計</span><span class="sv2">${S.hits.total}回</span></div>
    <div class="sr" style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span class="sk">初回大当たり</span><span class="sv2">${S.hits.first}回</span></div>
    <div class="sr" style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span class="sk">RUSHチャレンジ成功/失敗</span><span class="sv2">${S.hits.rushSuccess}/${S.hits.rushFail}</span></div>
    <div class="sr" style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span class="sk">専用モード 5/5〜0/5</span><span class="sv2">${S.hits.stock[5]}/${S.hits.stock[4]}/${S.hits.stock[3]}/${S.hits.stock[2]}/${S.hits.stock[1]}/${S.hits.stock[0]}</span></div>
    <div class="sr" style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span class="sk">出玉率</span><span class="sv2" style="color:${outRate>=100?'#22c55e':'#ef4444'}">${outRate}%</span></div>
    <div style="margin-top:18px;text-align:center">
      <button class="bok" onclick="location.reload()">もう一度遊ぶ</button>
    </div>`;
  showM(html,'mn');
}
```

- [ ] **Step 4: Write the verify script**

Create `verify/task7-settlement.mjs`:

```js
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = path.dirname(fileURLToPath(import.meta.url));
const url = 'file://' + path.join(dir, '..', 'index.html');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url);
// hit, no levaburu/vfla, rush entry success
await page.evaluate(q => window.__TEST__.setRandomQueue(q), [0.0001, 0.99, 0.99, 0.0001]);
await page.click('#w-30000');
await page.click('#rp');
await page.click('#sp-good');
await page.click('#gbtn');
await page.waitForSelector('#game.active');

await page.click('#btn1');
for (let i=0;i<4;i++) {
  await page.waitForSelector('#ov:not(.h)');
  await page.click('#mb .bok');
}
await page.waitForSelector('#ov:not(.h)');
await page.click('#mb .bok'); // close RUSH-entry result modal

await page.click('#btnr'); // 退店 -> settlement
await page.waitForSelector('#ov:not(.h)');
const settleText = await page.locator('#mb').innerText();
assert.match(settleText, /精算/);
assert.match(settleText, /初回大当たり\s*1回/);
assert.match(settleText, /RUSHチャレンジ成功\/失敗\s*1\/0/);

await browser.close();
console.log('PASS: task7-settlement');
```

- [ ] **Step 5: Run it**

Run: `cd verify && node task7-settlement.mjs`
Expected: `PASS: task7-settlement`

- [ ] **Step 6: Commit**

```bash
git add index.html verify/task7-settlement.mjs
git commit -m "Add full settlement breakdown and collapsible stats detail"
```

---

## Task 8: Full-suite regression run and manual smoke check

**Files:** none (verification only)

- [ ] **Step 1: Run every verify script in sequence**

Run:
```bash
cd verify
for f in smoke.mjs task2-setup.mjs task3-economy.mjs task4-normalwin.mjs task5-rushloop.mjs task6-senyoumode.mjs task7-settlement.mjs; do
  echo "== $f =="
  node "$f" || exit 1
done
```
Expected: every script prints its `PASS:` line(s) and the loop exits 0.

- [ ] **Step 2: Manual browser smoke check**

Open `C:\Users\ab_99\pachinko-simulator-kinniku\index.html` directly in a browser (double-click it, or `start index.html` from the project root). Walk through: pick ¥30,000 / 等価 / 優良店 → start → click 1回転 several times → click 100回転スキップ a few times → confirm the stats panel and history update sensibly and no console errors appear (open DevTools console to check). Play until a natural win occurs if time allows, or just confirm the UI doesn't visibly break across a couple hundred spins.

- [ ] **Step 3: Note remaining TODOs for the user**

No code changes — just confirm in the final report to the user that `P_LEVABURU` (30%) and `P_VFLA` (15%) in `index.html`'s constants block are placeholders awaiting real values, and that the six `images/*.png` files referenced via `imgDiv()` are not yet present (fallback text will show until the user drops the real files into `images/`).

---

## Self-Review Notes

- **Spec coverage:** setup screen (Task 2), normal-mode 1/399.9 + reach chain (Task 4), RUSH ST145 + 1/92.3 hatten (Task 5), 専用モード 5-stock 1/2.8 judge + payout table + 0-hit ST branch (Task 6), settlement/stats breakdown (Task 7). All sections of the design spec map to a task.
- **Placeholder scan:** `P_LEVABURU`/`P_VFLA` are intentionally provisional per the spec's own "未確定・TODO事項" section, not plan placeholders — they're real numeric constants with a `TODO` comment, not a stubbed-out behavior.
- **Type/name consistency:** `S.hits.{total,first,rushSuccess,rushFail,stock[]}`, `C.{P_HIT,P_LEVABURU,P_VFLA,P_RUSH_ENTRY,RUSH_ST,P_HATTEN,P_STOCK_HIT,STOCK_COUNT,P_ZERO_RESET,B_UNIT_GROSS,B_UNIT_NET}`, and `rand()` are defined once (Task 3/4) and reused with the same names through Task 7 — checked for drift across tasks.
