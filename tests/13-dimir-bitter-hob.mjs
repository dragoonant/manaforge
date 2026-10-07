// Dimir (Bitter Triumph), Arena top-ranked Standard after the Hobbit release.
import { MF, test, eq, ok, setup, find, findAll, pt, has, logs, cast, activate, resolveAll, toStep, answer, tgt, player } from './harness.mjs';
const U = 'island', B = 'swamp', G = 'forest';
const lands = (n, id) => Array(n).fill(id);

test('Requiting Hex: blight 1 as an optional additional cost (CR 701.68); if paid, gain 2', () => {
  let s = setup({ me: { hand: ['requiting-hex'], bf: ['quaketusk-boar', B] }, opp: { bf: ['warren-elder'] } });
  s = cast(s, 'requiting-hex', 'yes', find(s, 'quaketusk-boar'), tgt(find(s, 'warren-elder'))); s = resolveAll(s);
  eq(s.cards[find(s, 'quaketusk-boar')].ctr['-1/-1'], 1); eq(s.players[0].life, 22); ok(s.players[1].grave.some(i => s.cards[i].id === 'warren-elder'), 'destroyed');
  let t = setup({ me: { hand: ['requiting-hex'], bf: ['quaketusk-boar', B] }, opp: { bf: ['warren-elder'] } });
  t = cast(t, 'requiting-hex', 'no', tgt(find(t, 'warren-elder'))); t = resolveAll(t); eq(t.players[0].life, 20);
});
test('Spyglass Siren: a Map token (CR 111.10s) — {1},{T}, sacrifice: target creature you control explores', () => {
  let s = setup({ me: { hand: ['spyglass-siren'], bf: [U, U], lib: ['opt', U] } });
  s = cast(s, 'spyglass-siren'); s = resolveAll(s);
  const map = find(s, 'token-map', 'bf'), siren = find(s, 'spyglass-siren');
  s = activate(s, 'token-map', null, tgt(siren)); s = resolveAll(s, 'top');
  eq(pt(s, siren), [2, 2], 'explored: a +1/+1 counter'); ok(!s.bf.includes(map), 'the Map was sacrificed');
});
test('Tishana’s Tidebinder: counters an ability on the stack; that creature loses all abilities while the Tidebinder remains', () => {
  let s = setup({ me: { hand: ['tishanas-tidebinder'], bf: lands(3, U) }, opp: { bf: ['keen-eyed-curator', G], grave: ['opt'] } });
  s = MF.clone(s); s.priority = 1; s = MF.run(s);
  s = activate(s, 'keen-eyed-curator', null, q => q.opts[0].id); s = MF.apply(s, { type: 'pass' });
  s = cast(s, 'tishanas-tidebinder'); s = resolveAll(s, q => q.opts.find(o => o.lid != null).id);
  eq(logs(s, 'countered').length, 1); ok(s.players[1].grave.some(i => s.cards[i].id === 'opt'), 'nothing was exiled');
  const k = find(s, 'keen-eyed-curator'); ok(MF.chars(s, k).ab.every(a => a.k === 'locked'), 'the Curator lost all abilities');
});
test('Shoot the Sheriff: only a non-outlaw creature (CR 700.12)', () => {
  let s = setup({ me: { hand: ['shoot-the-sheriff'], bf: [B, B] }, opp: { bf: ['azure-beastbinder', 'warren-elder'] } });
  s = MF.apply(s, MF.legalActions(s).find(a => a.type === 'cast'));
  eq(s.pending.q.opts.map(o => o.id), [tgt(find(s, 'warren-elder'))], 'the Rogue is an outlaw');
});
test('We Say Thee Nay!: teamwork (CR 702.194) — tap power 2 or more, and they must pay {4} instead of {2}', () => {
  let s = setup({ me: { hand: ['lightning-strike'], bf: ['mountain', 'mountain', 'mountain', 'mountain'] }, opp: { hand: ['we-say-thee-nay'], bf: [U, U, 'warren-elder'] } });
  s = cast(s, 'lightning-strike', player(1)); s = MF.apply(s, { type: 'pass' });
  s = cast(s, 'we-say-thee-nay', 'yes', find(s, 'warren-elder'), 'done', tgt(s.stack[0].iid)); s = MF.apply(s, { type: 'pass' }); s = MF.apply(s, { type: 'pass' });
  eq(s.pending, null, 'two lands left: {4} can’t be paid, so nothing is asked'); s = resolveAll(s);
  eq(s.players[1].life, 20); ok(s.cards[find(s, 'warren-elder')].tapped, 'the Elder was tapped for teamwork');
});
test('Bitter Triumph: discard a card or pay 3 life as it is cast; destroys a creature or planeswalker', () => {
  let s = setup({ me: { hand: ['bitter-triumph', 'opt'], bf: [B, B] }, opp: { bf: [{ id: 'kaito-bane-of-nightmares', ctr: { loyalty: 3 } }] } });
  s = cast(s, 'bitter-triumph', 'life', tgt(find(s, 'kaito-bane-of-nightmares'))); s = resolveAll(s);
  eq(s.players[0].life, 17); ok(s.players[1].grave.some(i => s.cards[i].id === 'kaito-bane-of-nightmares'), 'the planeswalker is destroyed');
  let t = setup({ me: { hand: ['bitter-triumph', 'opt'], bf: [B, B] }, opp: { bf: ['warren-elder'] } });
  t = cast(t, 'bitter-triumph', 'discard', find(t, 'opt'), tgt(find(t, 'warren-elder'))); t = resolveAll(t);
  eq(t.players[0].life, 20); ok(t.players[0].grave.some(i => t.cards[i].id === 'opt'), 'discarded');
});
test('The Wondrous Wasp: taps a creature, which loses all abilities while the Wasp remains (CR 611.2b)', () => {
  let s = setup({ me: { hand: ['the-wondrous-wasp', 'cut-down'], bf: [U, U, B] }, opp: { bf: ['quaketusk-boar'] } });
  const b = find(s, 'quaketusk-boar');
  s = cast(s, 'the-wondrous-wasp'); s = resolveAll(s, tgt(b));
  ok(s.cards[b].tapped && !has(s, b, 'trample'), 'tapped, no trample');
  s = cast(s, 'cut-down', tgt(find(s, 'the-wondrous-wasp'))); s = resolveAll(s);
  ok(has(s, b, 'trample'), 'its abilities are back once the Wasp is gone');
});
test('Spell Snare: only a spell with mana value 2', () => {
  let s = setup({ me: { hand: ['lightning-strike', 'opt'], bf: ['mountain', 'mountain', U] }, opp: { hand: ['spell-snare'], bf: [U] } });
  s = cast(s, 'opt'); s = MF.apply(s, { type: 'pass' });
  ok(!MF.legalActions(s).some(a => a.type === 'cast'), 'Opt has mana value 1: no target');
});
test('Wan Shi Tong: X +1/+1 counters and half X cards (CR 107.3m); an opponent searching grows it and draws', () => {
  let s = setup({ me: { hand: ['wan-shi-tong-librarian'], bf: lands(6, U), lib: ['opt', U, U, U] }, opp: { hand: ['bushwhack'], bf: [G], lib: ['forest', 'opt'] } });
  s = cast(s, 'wan-shi-tong-librarian', 4); s = resolveAll(s);
  const w = find(s, 'wan-shi-tong-librarian', 'bf'); eq(pt(s, w), [5, 5]); eq(s.players[0].hand.length, 2);
  s = MF.clone(s); s.priority = 1; s.ap = 1; s = MF.run(s);
  s = cast(s, 'bushwhack', 0); s = resolveAll(s, q => q.opts.find(o => o.iid != null).id);
  eq(pt(s, w), [6, 6]); eq(s.players[0].hand.length, 3);
});
test('Dream Beavers: each opponent loses 1, I gain 1, scry 1', () => {
  let s = setup({ me: { hand: ['dream-beavers'], bf: [B], lib: ['opt', U] } });
  s = cast(s, 'dream-beavers'); s = resolveAll(s, 'top');
  eq(s.players[1].life, 19); eq(s.players[0].life, 21);
});
