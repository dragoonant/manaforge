// The page sweep (PLAN D25): plays random, mixed and AI games inside the real page in Chromium and
// draws every decision state from the seat that acts — the board, the prompt, the log — as a player
// would see it, hovering cards for the zoom readout and opening card menus now and then. A drawing
// error (js/ui.js sends it to the crash modal), any page error, an engine or AI throw, and
// "undefined", "NaN", "null" or "[object" in the prompt or a menu are failures. Keeps going after
// one: one line per distinct failure, with the count and a bug report for the shortest game that
// hit it, which tools/replay-report.mjs replays.
//
// The one tool that needs more than Node (PLAN D25): Playwright and its Chromium. In this folder:
//   npm install --no-save playwright && npx playwright install chromium
//
//   node tools/page-sweep.mjs [--games N] [--seed S] [--ms budget] [--deck ID] [--out file.json] [--chromium path]
//   node tools/page-sweep.mjs --selftest      (a planted fault in the Pass label must be caught)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { ROOT } from './load.mjs';
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); }
catch (e) { throw new Error('tools/page-sweep.mjs needs Playwright (PLAN D25). In ' + ROOT + ' run:\n  npm install --no-save playwright && npx playwright install chromium\n(' + e.message.split('\n')[0] + ')'); }
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const selftest = process.argv.includes('--selftest');
const games = selftest ? 2 : +arg('games', 20), seed0 = +arg('seed', 1), ms = +arg('ms', 0), only = arg('deck', null), outFile = arg('out', null), exe = arg('chromium', null);

const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const pageErrors = []; page.on('pageerror', e => pageErrors.push(e));
await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href);
await page.waitForFunction(() => window.MF && MF.ui && MF.main);
await page.evaluate(() => { if (MF.anim.on) MF.anim.toggle(); });   // no motion: states are drawn back to back
if (selftest) await page.evaluate(() => { MF.text.passLabel = () => { throw new Error('planted fault'); }; });

// One game, played and drawn inside the page. Returns its failures and the number of states drawn.
function playOne({ seed, only }) {
  let rs = seed * 31 + 7; const rnd = n => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs % n; };
  const ids = Object.values(MF.decks).filter(d => d.registered).map(d => d.id), cmd = id => !!MF.decks[id].commanders;   // CR 903: a Commander deck plays only another Commander deck
  const a = only || ids[rnd(ids.length)], same = ids.filter(x => cmd(x) === cmd(a)), b = same[rnd(same.length)];
  const decks = [a, b], acts = [], fails = [], pol = [rnd(3), rnd(3)];   // per seat: 0 random, 1 mixed, 2 the AI
  let s = MF.newGame({ seed: seed, decks: decks }), states = 0, crashed = null;
  MF.main.crash = err => { crashed = err; };                                                   // the page's crash modal, caught instead
  const bad = /\bundefined\b|\bNaN\b|\[object|\bnull\b/;
  const fail = (e, who, what) => fails.push({ what: what, msg: String(e && e.message || e), stack: String(e && e.stack || ''), report: { v: 1, seed: seed, decks: decks, human: who, actions: acts.slice(), log: null } });
  const draw = who => {
    states++; crashed = null;
    try { MF.ui.begin({ seed: seed, decks: decks, human: who }, s); } catch (e) { crashed = e; }
    clearTimeout(MF.ui.timer);                                                                 // the sweep plays both seats itself
    MF.ui.actions = acts.slice();
    if (!crashed) { const p = document.querySelector('.prompt'); if (p && bad.test(p.innerText)) crashed = new Error('suspicious words in the prompt: ' + p.innerText.replace(/\s+/g, ' ').slice(0, 160)); }
    if (!crashed && rnd(6) === 0) {                                                            // hover a few cards: the zoom readout
      const els = [...document.querySelectorAll('[data-cid]')];
      for (let k = 0; k < 3 && els.length && !crashed; k++) try { els[rnd(els.length)].dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); } catch (e) { crashed = e; }
    }
    if (!crashed && rnd(5) === 0) {                                                            // open a card's menu, as a click on a card with several actions does
      const els = [...document.querySelectorAll('[data-acts]')].filter(el => JSON.parse(el.getAttribute('data-acts')).length > 1);
      if (els.length) {
        try {
          MF.ui.menu = { x: 10, y: 10, items: JSON.parse(els[rnd(els.length)].getAttribute('data-acts')) };
          MF.ui.begin({ seed: seed, decks: decks, human: who }, s); clearTimeout(MF.ui.timer);
          const m = document.querySelector('.cmenu'); if (m && bad.test(m.innerText)) crashed = new Error('suspicious words in a menu: ' + m.innerText.replace(/\s+/g, ' ').slice(0, 160));
        } catch (e) { crashed = e; }
        MF.ui.menu = null;
      }
    }
    if (crashed) fail(crashed, who, 'page');
  };
  try {
    for (let n = 0; s.winner == null && s.turn <= 30 && n < 5000 && fails.length < 4; n++) {
      const who = MF.whoActs(s), L = MF.legalActions(s);
      if (s.pending || L.some(l => l.type !== 'pass')) draw(who);                              // a decision: what the page shows its player
      let act;
      if (pol[who] === 2 || (pol[who] === 1 && rnd(10) < 4)) act = MF.ai.choose(s);
      else {
        const can = rnd(25) === 0 ? L : L.filter(l => l.type !== 'cancel' && l.id !== 'undo');   // a cancel now and then: the page offers it
        const np = can.filter(l => l.type !== 'pass' && l.id !== 'done' && l.id !== 'no');
        act = (np.length && rnd(3) > 0) ? np[rnd(np.length)] : can.find(l => l.type === 'pass' || l.id === 'done') || can[rnd(can.length)] || L[0];
      }
      acts.push(act); s = MF.apply(s, act);
    }
    if (s.winner != null) draw(0);                                                             // the result screen
  } catch (e) { fail(e, 0, 'engine'); }                                                        // the last action threw, or the AI threw choosing the next
  MF.ui.stop();
  return { fails: fails, states: states };
}

const t0 = Date.now(), found = {}; let states = 0, g;
for (g = 0; g < games; g++) {
  if (ms && Date.now() - t0 > ms) break;
  const r = await page.evaluate(playOne, { seed: seed0 * 10000 + g, only: only });
  states += r.states;
  for (const f of r.fails.concat(pageErrors.splice(0).map(e => ({ what: 'page error', msg: e.message, stack: String(e.stack), report: null })))) {
    const at = (f.stack.split('\n').find(l => /js\/\w+\.js:\d+/.test(l)) || '').match(/js\/\w+\.js:\d+/);
    const k = f.what + ': ' + f.msg.replace(/\d+/g, 'N').slice(0, 110) + ' @ ' + (at ? at[0] : '?');
    const o = found[k] = found[k] || { n: 0, stack: f.stack.split('\n').slice(0, 6).join('\n'), report: null };
    o.n++; if (f.report && (!o.report || f.report.actions.length < o.report.actions.length)) o.report = f.report;
  }
}
await browser.close();
const out = Object.entries(found).map(([k, o]) => ({ failure: k, n: o.n, stack: o.stack, report: o.report }));
if (outFile) fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
if (selftest) {
  const ok = out.some(o => /planted fault/.test(o.failure));
  console.log(`selftest: ${g} games, ${states} states drawn; the planted fault ${ok ? 'was caught -> PASS' : 'was NOT caught -> FAIL'}`);
  process.exit(ok ? 0 : 1);
}
console.log(`${g} games, ${states} states drawn, ${((Date.now() - t0) / 1000).toFixed(0)}s: ${out.length ? out.length + ' distinct failures' : 'no failures'}`);
for (const o of out) console.log(`  [${o.n}] ${o.failure}\n     report: ${!o.report ? '(a page error outside a game step)' : JSON.stringify(o.report).length > 4000 ? '(long; --out writes it)' : JSON.stringify(o.report)}`);
process.exit(out.length ? 1 : 0);
