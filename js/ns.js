// The one namespace. Every other file reads window.MF and throws on its own if a dependency is
// missing; there are no silent fallbacks (CLAUDE.md hard rule 10).
window.MF = {};

// Seeded RNG (mulberry32). The generator's state lives in the game state, so a game is a pure
// function of its seed and its action list.
(function () {
  'use strict';
  const MF = window.MF;
  MF.rand = function (s) {
    let t = (s.rng = (s.rng + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  MF.randInt = function (s, n) { return Math.floor(MF.rand(s) * n); };
  MF.shuffle = function (s, arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = MF.randInt(s, i + 1); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  };
  // Mana symbols. A cost is { W, U, B, R, G, C, g (generic), x (number of {X}) }.
  MF.COLORS = ['W', 'U', 'B', 'R', 'G'];
  MF.COLOR_NAME = { W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green', C: 'colorless' };
  MF.parseMana = function (str) {
    const c = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, g: 0, x: 0 };
    if (!str) return c;
    for (const m of str.matchAll(/\{([^}]+)\}/g)) {
      const t = m[1];
      if (/^\d+$/.test(t)) c.g += +t;
      else if (t === 'X') c.x++;
      else if (c[t] != null && t !== 'g' && t !== 'x') c[t]++;
      else if (/^[WUBRG]\/[WUBRG]$/.test(t)) (c.h = c.h || []).push(t[0] + t[2]);            // CR 107.4e: a hybrid symbol, paid with either colour
      else throw new Error('mana symbol not supported: {' + t + '}');
    }
    return c;
  };
  MF.hybridWays = function (c) {
    if (!c.h || !c.h.length) return [c];
    let ways = [Object.assign({}, c, { h: [] })];
    for (const h of c.h) ways = ways.flatMap(w => [h[0], h[1]].map(k => Object.assign({}, w, { [k]: w[k] + 1 })));
    return ways;
  };
  MF.manaValue = c => c.g + c.W + c.U + c.B + c.R + c.G + c.C + (c.h ? c.h.length : 0);   // CR 202.3f: each hybrid symbol counts one
  MF.manaStr = function (c) {
    let s = '';
    for (let i = 0; i < c.x; i++) s += '{X}';
    if (c.g || (!c.x && !MF.manaValue(c))) s += '{' + c.g + '}';
    for (const k of ['W', 'U', 'B', 'R', 'G', 'C']) for (let i = 0; i < c[k]; i++) s += '{' + k + '}';
    for (const h of c.h || []) s += '{' + h[0] + '/' + h[1] + '}';
    return s;
  };
})();
