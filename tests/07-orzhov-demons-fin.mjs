// Orzhov Demons (Pro Tour Final Fantasy, #28): one behaviour test per new card or rule.
import { MF, test, eq, ok, setup, find, pt, has, logs, cast, activate, resolveAll, toStep, answer, tgt, player } from './harness.mjs';
const B = 'swamp', W = 'plains', R = 'mountain';
const door = (s, id, k) => { const a = MF.legalActions(s).find(l => l.type === 'cast' && MF.view(s).cards[l.iid].id === id && l.door === k); if (!a) throw new Error('cannot cast door ' + k + ' of ' + id); return MF.apply(s, a); };
const unlock = (s, id, k) => { const a = MF.legalActions(s).find(l => l.type === 'unlock' && s.cards[l.iid].id === id && l.door === k); if (!a) throw new Error('cannot unlock door ' + k + ' of ' + id); return MF.apply(s, a); };

test('Elenda: hexproof from instants (CR 702.11d) — an opponent’s instant cannot target her; their sorcery-speed effects and my own instants can', () => {
  let s = setup({ me: { hand: ['lightning-strike'], bf: [R, R, 'warren-elder'] }, opp: { bf: ['elenda-saint-of-dusk'] } });
  s = MF.apply(s, MF.legalActions(s).find(a => a.type === 'cast'));
  const ids = s.pending.q.opts.map(o => o.id);
  ok(!ids.includes(tgt(find(s, 'elenda-saint-of-dusk'))), 'Elenda is not offered'); ok(ids.includes(tgt(find(s, 'warren-elder'))), 'the Elder is');
  let t = setup({ me: { hand: ['lightning-strike'], bf: [R, R, 'elenda-saint-of-dusk'] } });
  t = MF.apply(t, MF.legalActions(t).find(a => a.type === 'cast'));
  ok(t.pending.q.opts.some(o => o.id === tgt(find(t, 'elenda-saint-of-dusk'))), 'my own instant can target her');
});
test('Elenda: +1/+1 and menace above starting life; an additional +5/+5 at 10 or more above (CR 119.1)', () => {
  let s = setup({ me: { bf: ['elenda-saint-of-dusk'], life: 20 } });
  eq(pt(s, find(s, 'elenda-saint-of-dusk')), [4, 4]); ok(!has(s, find(s, 'elenda-saint-of-dusk'), 'menace'), 'no menace at 20');
  s = setup({ me: { bf: ['elenda-saint-of-dusk'], life: 21 } });
  eq(pt(s, find(s, 'elenda-saint-of-dusk')), [5, 5]); ok(has(s, find(s, 'elenda-saint-of-dusk'), 'menace'), 'menace at 21');
  s = setup({ me: { bf: ['elenda-saint-of-dusk'], life: 30 } });
  eq(pt(s, find(s, 'elenda-saint-of-dusk')), [10, 10]);
});
test('Bloodletter of Aclazotz: an opponent loses twice the life on my turn; the damage itself is unchanged (its ruling)', () => {
  let s = setup({ me: { hand: ['lightning-strike'], bf: [R, R, 'bloodletter-of-aclazotz'] } });
  s = cast(s, 'lightning-strike', player(1)); s = resolveAll(s);
  eq(s.players[1].life, 14, '3 damage, 6 life lost'); eq(logs(s, 'damage')[0].n, 3); eq(logs(s, 'damage')[0].lost, 6);
  let t = setup({ me: { hand: ['lightning-strike'], bf: [R, R] }, opp: { bf: ['bloodletter-of-aclazotz'] } });
  t = cast(t, 'lightning-strike', player(1)); t = resolveAll(t);
  eq(t.players[1].life, 17, 'my Strike at its controller: not doubled (it is not their opponent losing life)');
});
test('Pest Control: destroys each nonland permanent with mana value 1 or less', () => {
  let s = setup({ me: { hand: ['pest-control'], bf: [W, B, 'heartfire-hero', 'warren-elder'] }, opp: { bf: ['heartfire-hero', R] } });
  s = cast(s, 'pest-control'); s = resolveAll(s);
  eq(s.bf.map(i => s.cards[i].id).sort(), ['mountain', 'plains', 'swamp', 'warren-elder'].sort());
});
test('Pest Control: cycling {2} from the hand (CR 702.29a) — discard it, draw a card', () => {
  let s = setup({ me: { hand: ['pest-control'], bf: [B, B], lib: ['opt', B] } });
  s = activate(s, 'pest-control'); s = resolveAll(s);
  ok(s.players[0].grave.some(i => s.cards[i].id === 'pest-control'), 'discarded'); ok(s.players[0].hand.some(i => s.cards[i].id === 'opt'), 'drew Opt'); eq(logs(s, 'cycle').length, 1);
});
test('Preacher of the Schism: tied for most life → both triggers; most life → only the draw; least life → only the token', () => {
  const run = (me, them) => {
    let s = setup({ me: { bf: ['preacher-of-the-schism'], life: me, lib: ['opt', B, B] }, opp: { life: them } });
    const p = find(s, 'preacher-of-the-schism');
    s = toStep(s, 'attackers'); s = answer(s, [p, 'done']); s = resolveAll(s, q => q.opts[0].id);
    return { tok: s.bf.filter(i => s.cards[i].id === 'token-vampire-1-1-w-lifelink').length, drew: s.players[0].hand.length, life: s.players[0].life };
  };
  eq(run(20, 20), { tok: 1, drew: 1, life: 19 }); eq(run(25, 20), { tok: 0, drew: 1, life: 24 }); eq(run(10, 20), { tok: 1, drew: 0, life: 10 });
});
test('Unholy Annex // Ritual Chamber: cast one door (CR 709.3), it enters unlocked (709.5d); the end step drains only with a Demon', () => {
  let s = setup({ me: { hand: ['unholy-annex-ritual-chamber'], bf: [B, B, B], lib: ['opt', B, B, B] } });
  eq(MF.chars(s, find(s, 'unholy-annex-ritual-chamber')).mv, 8, 'mana value in the hand: both halves (CR 709.4b)');
  ok(!MF.legalActions(s).some(a => a.type === 'cast' && a.door === 1), 'Ritual Chamber needs five mana');
  s = door(s, 'unholy-annex-ritual-chamber', 0); s = answer(s, []); s = resolveAll(s);
  const r = find(s, 'unholy-annex-ritual-chamber', 'bf');
  eq(MF.chars(s, r).name, 'Unholy Annex'); eq(MF.chars(s, r).mv, 3, 'only the unlocked door');
  s = toStep(s, 'end'); s = resolveAll(s);
  eq(s.players[0].hand.length, 1, 'drew'); eq(s.players[0].life, 18, 'no Demon: lose 2');
});
test('Ritual Chamber: unlocking is a special action (CR 709.5e); "when you unlock this door" makes a 6/6 Demon; then the Annex drains', () => {
  let s = setup({ me: { bf: [B, B, B, B, B, { id: 'unholy-annex-ritual-chamber' }], lib: ['opt', B, B, B] }, opp: { life: 20 } });
  const r = find(s, 'unholy-annex-ritual-chamber');
  s.cards[r].unlocked = [true, false];
  s = unlock(s, 'unholy-annex-ritual-chamber', 1); s = answer(s, []);
  eq(s.stack.length, 1, 'the unlock trigger is on the stack; the unlock itself used none'); s = resolveAll(s);
  const demon = s.bf.find(i => s.cards[i].id === 'token-demon-6-6-b-flying'); ok(demon != null, 'Demon token'); eq(pt(s, demon), [6, 6]); ok(has(s, demon, 'flying'), 'flying');
  eq(MF.chars(s, r).name, 'Unholy Annex // Ritual Chamber');
  s = toStep(s, 'end'); s = resolveAll(s);
  eq(s.players[1].life, 18); eq(s.players[0].life, 22);
});
test('A Room put onto the battlefield without being cast has both doors locked: no name, no abilities, mana value 0', () => {
  let s = setup({ me: { bf: ['unholy-annex-ritual-chamber', 'heartfire-hero'], lib: [B, B, B] } });
  const r = find(s, 'unholy-annex-ritual-chamber');
  eq(MF.chars(s, r).name, ''); eq(MF.chars(s, r).mv, 0); ok(MF.chars(s, r).ab.every(a => a.k === 'locked'), 'no abilities');
  s = toStep(s, 'end', 'done'); eq(s.stack.length, 0, 'the Annex does not trigger');
});
test('Duress: the hand is revealed and named in the log; I choose a noncreature, nonland card; they discard it', () => {
  let s = setup({ me: { hand: ['duress'], bf: [B] }, opp: { hand: ['lightning-strike', 'quaketusk-boar', R] } });
  s = cast(s, 'duress', player(1));
  s = resolveAll(s, q => { eq(q.opts.map(o => MF.view(s).cards[o.iid].id), ['lightning-strike'], 'only the instant is offered'); return q.opts[0].id; });
  ok(s.players[1].grave.some(i => s.cards[i].id === 'lightning-strike'), 'discarded'); eq(logs(s, 'revealHand')[0].cs.length, 3);
  let t = setup({ me: { hand: ['duress'], bf: [B] }, opp: { hand: ['quaketusk-boar', R] } });
  t = cast(t, 'duress', player(1)); t = resolveAll(t);
  eq(t.players[1].hand.length, 2, 'nothing to take: no question'); eq(logs(t, 'handPickNone').length, 1);
});
test('Cut Down: only a creature with total power and toughness 5 or less', () => {
  let s = setup({ me: { hand: ['cut-down'], bf: [B] }, opp: { bf: ['warren-elder', 'quaketusk-boar'] } });
  s = MF.apply(s, MF.legalActions(s).find(a => a.type === 'cast'));
  eq(s.pending.q.opts.map(o => o.id), [tgt(find(s, 'warren-elder'))]);
});
test('Unstoppable Slasher: combat damage → the player loses half their life, rounded up; it returns once with two stun counters (CR 122.1d)', () => {
  let s = setup({ me: { bf: ['unstoppable-slasher'] }, opp: { life: 21 } });
  const k = find(s, 'unstoppable-slasher');
  s = toStep(s, 'attackers'); s = answer(s, [k, 'done']); s = toStep(s, 'damage'); s = resolveAll(s);
  eq(s.players[1].life, 9, '21 - 2 = 19, then half rounded up (10) is lost');
  let t = setup({ me: { hand: ['cut-down'], bf: [B, 'unstoppable-slasher'] } });
  t = cast(t, 'cut-down', tgt(find(t, 'unstoppable-slasher'))); t = resolveAll(t);
  const back = find(t, 'unstoppable-slasher', 'bf');
  ok(t.cards[back].tapped, 'tapped'); eq(t.cards[back].ctr.stun, 2);
  for (const left of [1, 0]) { t = toStep(t, 'end'); t = toStep(t, 'upkeep'); while (t.ap !== 0) { t = toStep(t, 'end'); t = toStep(t, 'upkeep'); } ok(t.cards[back].tapped, 'still tapped'); eq(t.cards[back].ctr.stun, left); }
  t = toStep(t, 'end'); t = toStep(t, 'upkeep'); while (t.ap !== 0) { t = toStep(t, 'end'); t = toStep(t, 'upkeep'); }
  ok(!t.cards[back].tapped, 'untaps once the counters are gone');
});
test('Unstoppable Slasher: with counters on it, it does not return', () => {
  let s = setup({ me: { hand: ['cut-down'], bf: [B, { id: 'unstoppable-slasher', ctr: { stun: 1 } }] } });
  s = cast(s, 'cut-down', tgt(find(s, 'unstoppable-slasher'))); s = resolveAll(s);
  ok(s.players[0].grave.some(i => s.cards[i].id === 'unstoppable-slasher'), 'stays in the graveyard');
});
test('Cruelclaw’s Heist: gift a card (CR 702.174j: before its other effects); exile their nonland card; cast it with mana of any type', () => {
  let s = setup({ me: { hand: ['cruelclaws-heist'], bf: [B, B, B, B] }, opp: { hand: ['lightning-strike', R], lib: ['opt', R] } });
  s = cast(s, 'cruelclaws-heist', 'yes', player(1));
  s = resolveAll(s, q => { eq(q.opts.length, 2, 'Lightning Strike and the drawn Opt'); return q.opts.find(o => MF.view(s).cards[o.iid].id === 'lightning-strike').id; });
  ok(s.players[1].hand.some(i => s.cards[i].id === 'opt'), 'the gift: they drew first');
  const ls = find(s, 'lightning-strike', 'exile');
  ok(MF.legalActions(s).some(a => a.type === 'cast' && a.iid === ls), 'I may cast it with black mana');
  s = cast(s, 'lightning-strike', player(1)); s = resolveAll(s);
  eq(s.players[1].life, 17);
  let t = setup({ me: { hand: ['cruelclaws-heist'], bf: [B, B, B, B] }, opp: { hand: ['lightning-strike'] } });
  t = cast(t, 'cruelclaws-heist', 'no', player(1)); t = resolveAll(t, q => q.opts[0].id);
  ok(!MF.legalActions(t).some(a => a.type === 'cast'), 'no gift: it stays exiled, not castable');
});
