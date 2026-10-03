// The card-test harness. Builds an exact board, plays through MF.apply only, and asserts side
// effects (handoff 6: assert the side effect, not the resolution).
import { loadEngine } from '../tools/load.mjs';
export const MF = loadEngine();
const tests = [];
export function test(name, f) { tests.push({ name, f }); }
export function runAll(filter) {
  let fail = 0, n = 0;
  for (const t of tests) {
    if (filter && !t.name.toLowerCase().includes(filter.toLowerCase())) continue;
    n++;
    try { t.f(); }
    catch (e) { fail++; console.log('FAIL ' + t.name + '\n   ' + (e.stack || e).split('\n').slice(0, 4).join('\n   ')); }
  }
  console.log(`${n - fail}/${n} tests pass`);
  return fail;
}
export function eq(a, b, what) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((what || 'value') + ': expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
export function ok(c, what) { if (!c) throw new Error('expected: ' + what); }

const ids = Object.values(MF.decks).filter(d => d.registered).map(d => d.id);
// A game past the mulligan, in seat 0's first main phase on turn 3, with the zones replaced by
// exactly what the test names. bf entries: 'id' or { id, tapped, sick, ctr }.
export function setup(o) {
  let s = MF.newGame({ seed: o.seed || 5, decks: [ids[0], ids[1]] });
  s = MF.apply(s, { type: 'answer', id: s.pending.q.who === 0 ? 'me' : 'opp' });
  while (s.pending && s.pending.q.kind === 'mulligan') s = MF.apply(s, { type: 'answer', id: 'keep' });
  while (!(s.priority === 0 && s.step === 'main1' && !s.pending)) s = MF.apply(s, s.pending ? { type: 'answer', id: s.pending.q.opts[0].id } : { type: 'pass' });
  s = MF.clone(s);
  for (const k in s.cards) { const c = s.cards[k]; if (c.zone !== 'moved') { c.zone = 'moved'; c.to = null; } }
  s.bf = []; s.stack = []; s.trigs = []; s.effects = []; s.log.push({ t: 'turn', turn: 3, who: 0, n: 3 });
  s.turn = 3; s.firstTurn = false; s.ap = 0;
  for (const seat of [0, 1]) {
    const spec = (seat === 0 ? o.me : o.opp) || {}, p = s.players[seat];
    p.hand = []; p.lib = []; p.grave = []; p.exile = []; p.life = spec.life || 20; p.landsPlayed = 0; p.pool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
    p.h = { cast: 0, castInstant: 0, castSorcery: 0, castOtter: 0, entered: 0, gained: 0, died: 0, attackedWith: 0 };
    const mk = (e, zone) => {
      const id = typeof e === 'string' ? e : e.id;
      if (!MF.cards[id]) throw new Error('no such card ' + id);
      const iid = s.nid++;
      s.cards[iid] = { iid: iid, id: id, owner: seat, ctrl: seat, zone: zone, ts: s.ts++, tapped: !!e.tapped, dmg: 0, dt: false, ctr: Object.assign({}, e.ctr || {}), att: null, ctlTurn: e.sick ? s.turn : 0, tok: !!MF.cards[id].token };
      return iid;
    };
    for (const e of spec.hand || []) p.hand.push(mk(e, 'hand'));
    for (const e of spec.lib || Array(10).fill(seat === 0 ? 'plains' : 'island')) p.lib.push(mk(e, 'lib'));
    for (const e of spec.grave || []) p.grave.push(mk(e, 'grave'));
    for (const e of spec.bf || []) { const i = mk(e, 'bf'); s.bf.push(i); if (e.att != null) s.cards[i].attTo = e.att; }
  }
  // attachments: { id, att: index into the same seat's bf list }
  for (const iid of s.bf) { const c = s.cards[iid]; if (c.attTo != null) { const seatBf = s.bf.filter(i => s.cards[i].ctrl === c.ctrl); c.att = seatBf[c.attTo]; delete c.attTo; } }
  s.step = o.step || 'main1'; s.sub = 1; s.priority = 0; s.passes = 0; s.combat = null; s.pending = null; s.todo = [];
  return MF.run(s);
}
export const find = (s, id, zone, seat) => { const v = MF.view(s); const k = Object.keys(v.cards).map(Number).find(i => v.cards[i].id === id && v.cards[i].zone !== 'moved' && (zone == null || v.cards[i].zone === zone) && (seat == null || v.cards[i].ctrl === seat)); if (k == null) throw new Error('no ' + id + ' in ' + zone); return k; };
export const findAll = (s, id, zone, seat) => Object.keys(s.cards).map(Number).filter(i => s.cards[i].id === id && s.cards[i].zone !== 'moved' && (zone == null || s.cards[i].zone === zone) && (seat == null || s.cards[i].ctrl === seat));
export const pt = (s, iid) => { const c = MF.chars(s, iid); return [c.p, c.t]; };
export const has = (s, iid, kw) => !!MF.chars(s, iid).kw[kw];
export const logs = (s, t) => s.log.filter(e => e.t === t);

// Answer whatever is pending with the next scripted answer; a function answers from the question.
// When the script runs out: a payment is paid by the solver; anything else is an error, so a
// question the test did not expect is caught.
export function answer(s, script) {
  while (s.pending) {
    const q = s.pending.q;
    let a;
    if (script.length) { const x = script.shift(); a = typeof x === 'function' ? x(q, s) : x; }
    else if (q.kind === 'pay') a = 'auto';
    else return s;
    if (!q.opts.some(o => o.id === a)) throw new Error('answer ' + JSON.stringify(a) + ' is not an option for ' + q.kind + ': ' + JSON.stringify(q.opts.map(o => o.id)));
    s = MF.apply(s, { type: 'answer', id: a });
  }
  return s;
}
export function cast(s, id, ...script) {
  const iid = find(s, id, null, null);
  const a = MF.legalActions(s).find(l => l.type === 'cast' && MF.view(s).cards[l.iid].id === id);
  if (!a) throw new Error('cannot cast ' + id + ': ' + MF.whyNot(s, s.priority, iid));
  return answer(MF.apply(s, a), script);
}
export function play(s, id) { const a = MF.legalActions(s).find(l => l.type === 'land' && s.cards[l.iid].id === id); if (!a) throw new Error('cannot play land ' + id); return MF.apply(s, a); }
export function activate(s, id, abIdx, ...script) {
  const a = MF.legalActions(s).find(l => l.type === 'act' && s.cards[l.iid].id === id && (abIdx == null || l.ab === abIdx));
  if (!a) throw new Error('cannot activate ' + id);
  return answer(MF.apply(s, a), script);
}
// Both players pass until the stack is empty (answering any pending question from the script).
export function resolveAll(s, ...script) {
  for (let g = 0; g < 200; g++) {
    s = answer(s, script);
    if (s.pending) throw new Error('unexpected question while resolving: ' + s.pending.q.kind);
    if (!s.stack.length) return s;
    s = MF.apply(s, { type: 'pass' });
  }
  throw new Error('resolveAll did not settle');
}
// Pass until the game reaches a step (and someone has priority or a question is pending there).
export function toStep(s, step, ...script) {
  for (let g = 0; g < 400; g++) {
    s = answer(s, script);
    if (s.step === step && (s.pending || s.priority != null)) return s;
    if (s.pending) throw new Error('unexpected question on the way to ' + step + ': ' + s.pending.q.kind);
    s = MF.apply(s, { type: 'pass' });
  }
  throw new Error('never reached ' + step);
}
export const tgt = iid => 'c' + iid;
export const player = seat => 'p' + seat;
