// Mardu (Bloodghast), Arena top-ranked Standard after the Hobbit release.
import { MF, test, eq, ok, setup, find, findAll, pt, has, logs, cast, activate, resolveAll, toStep, answer, tgt, player } from './harness.mjs';
const W = 'plains', B = 'swamp', R = 'mountain';
const lands = (n, id) => Array(n).fill(id);

test('Marauding Mako: discarding two at once (cleanup) is one trigger for two counters (CR 603.2c)', () => {
  let s = setup({ me: { hand: lands(9, R), bf: ['marauding-mako'] } });
  s = toStep(s, 'attackers'); s = answer(s, ['done']); s = toStep(s, 'cleanup');
  s = answer(s, [q => q.opts[0].id, q => q.opts[0].id]); s = resolveAll(s);
  eq(logs(s, 'trigger').filter(e => e.c === 'marauding-mako').length, 1); eq(s.cards[find(s, 'marauding-mako')].ctr['+1/+1'], 2);
});
test('Iron-Shield Elf: discard a card — indestructible until end of turn, and tap it', () => {
  let s = setup({ me: { hand: [R], bf: ['iron-shield-elf'] } });
  s = activate(s, 'iron-shield-elf', null, find(s, 'mountain', 'hand')); s = resolveAll(s);
  const e = find(s, 'iron-shield-elf'); ok(has(s, e, 'indestructible') && s.cards[e].tapped, 'indestructible and tapped');
});
test('Moonshadow: enters with six -1/-1 counters; permanent cards put into my graveyard together remove one', () => {
  let s = setup({ me: { hand: ['moonshadow', 'seed-of-hope'], bf: [B, 'forest', 'forest'], lib: [R, R, 'opt'] } });
  s = cast(s, 'moonshadow'); s = resolveAll(s);
  const m = find(s, 'moonshadow', 'bf'); eq(pt(s, m), [1, 1]);
  s = cast(s, 'seed-of-hope'); s = resolveAll(s, 'none');
  eq(s.cards[m].ctr['-1/-1'], 5, 'two lands milled at once: one counter removed');
});
test('Bloodghast: can’t block; haste while an opponent has 10 or less life; landfall returns it from the graveyard (CR 113.6m)', () => {
  let s = setup({ me: { hand: [B], grave: ['bloodghast'] }, opp: { life: 10 } });
  s = MF.apply(s, MF.legalActions(s).find(a => a.type === 'land')); s = resolveAll(s, 'yes');
  const g = find(s, 'bloodghast', 'bf'); ok(has(s, g, 'haste'), 'haste'); ok(MF.restricted(s, g, 'block'), 'can’t block');
});
test('Hardened Academic: a card leaving my graveyard puts a +1/+1 counter on target creature I control', () => {
  let s = setup({ me: { hand: [B], bf: ['hardened-academic'], grave: ['bloodghast'] } });
  s = MF.apply(s, MF.legalActions(s).find(a => a.type === 'land')); s = resolveAll(s, 'yes', tgt(find(s, 'hardened-academic')));
  eq(pt(s, find(s, 'hardened-academic')), [3, 2]);
});
test('Cool but Rude: whenever I attack, I may discard to draw; at level 2, each discard deals 2 to each opponent', () => {
  let s = setup({ me: { hand: [R, R], bf: [{ id: 'cool-but-rude' }, 'iron-shield-elf', R, R], lib: ['opt', R] } });
  s.cards[find(s, 'cool-but-rude')].level = 2;
  s = toStep(s, 'attackers'); s = answer(s, [find(s, 'iron-shield-elf'), 'done']); s = resolveAll(s, 'yes', q => q.opts[0].id);
  eq(s.players[0].hand.length, 2, 'discarded one, drew one'); eq(s.players[1].life, 18, 'level 2: 2 damage');
});
test('Practiced Offense: a +1/+1 counter on each creature target player controls, double strike or lifelink; flashback, then exiled (CR 702.34a)', () => {
  let s = setup({ me: { grave: ['practiced-offense'], bf: ['warren-elder', 'iron-shield-elf', W, W] } });
  const a = MF.legalActions(s).find(l => l.via === 'flashback'); ok(a, 'flashback from the graveyard');
  s = MF.apply(s, a); s = answer(s, [player(0), tgt(find(s, 'warren-elder'))]); s = resolveAll(s, 'doubleStrike');
  eq(pt(s, find(s, 'warren-elder')), [3, 3]); eq(pt(s, find(s, 'iron-shield-elf')), [4, 2]); ok(has(s, find(s, 'warren-elder'), 'doubleStrike'), 'double strike');
  ok(s.players[0].exile.some(i => s.cards[i].id === 'practiced-offense'), 'exiled after flashback');
});
test('Carnage: returns a creature card of mana value 3 or less that must attack and is sacrificed when it hits a player; mayhem after a discard', () => {
  let s = setup({ me: { hand: ['carnage-crimson-chaos'], bf: [B, B, R, R], grave: ['iron-shield-elf'] } });
  s = cast(s, 'carnage-crimson-chaos'); s = resolveAll(s, tgt(find(s, 'iron-shield-elf', 'grave')));
  const e = find(s, 'iron-shield-elf', 'bf'); s.cards[e].ctlTurn = 0;
  s = toStep(s, 'attackers');
  ok(!s.pending.q.opts.some(o => o.id === 'done'), 'it must attack (CR 508.1d)');
  s = answer(s, [e, 'done']); s = toStep(s, 'eoc'); s = resolveAll(s);
  ok(s.players[0].grave.some(i => s.cards[i].id === 'iron-shield-elf'), 'sacrificed after dealing combat damage');
  let t = setup({ me: { hand: ['carnage-crimson-chaos'], bf: ['iron-shield-elf', B, R] } });
  t = activate(t, 'iron-shield-elf', null, find(t, 'carnage-crimson-chaos', 'hand')); t = resolveAll(t);
  ok(MF.legalActions(t).some(a => a.via === 'mayhem'), 'mayhem: castable from the graveyard after being discarded this turn');
});
test('Inti: whenever I attack I may discard; when I do, a reflexive trigger (CR 603.12) puts a counter and trample on an attacker; the discard exiles a card to play', () => {
  let s = setup({ me: { hand: [R], bf: ['inti-seneschal-of-the-sun', 'warren-elder'], lib: ['opt', R] } });
  const e = find(s, 'warren-elder');
  s = toStep(s, 'attackers'); s = answer(s, [e, 'done']); s = resolveAll(s, 'yes', q => q.opts[0].id, q => q.opts[0].id, tgt(e));
  eq(pt(s, e), [3, 3]); ok(has(s, e, 'trample'), 'trample'); eq(s.players[0].exile.length, 1, 'the top card exiled to play');
});
test('Erode: destroy target creature or planeswalker; its controller may search for a basic land, tapped', () => {
  let s = setup({ me: { hand: ['erode'], bf: [W] }, opp: { bf: ['quaketusk-boar'], lib: ['mountain', 'opt'] } });
  s = cast(s, 'erode', tgt(find(s, 'quaketusk-boar'))); s = resolveAll(s, 'yes', q => q.opts.find(o => o.iid != null).id);
  ok(s.bf.some(i => s.cards[i].id === 'mountain' && s.cards[i].ctrl === 1 && s.cards[i].tapped), 'their Mountain, tapped');
});
