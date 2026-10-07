// Compiles Oracle text into card data. A grammar, not a list of cards: four ability frames
// (keyword line, "<cost>: <effect>.", "When/Whenever/At <event>, <effect>.", static), one shared
// <filter> grammar, one <object reference> grammar, and effect clauses built from them. Every
// pattern is anchored to the whole clause. A card any clause of which does not parse is `un`,
// with the clause that failed, and no registered deck may contain it.
//
//   node tools/build-cards.mjs            build data/cards.js and data/decks.js
//   node tools/build-cards.mjs --report   also print failing clause shapes, weighted by decks
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './load.mjs';

// The decks this project registers, by MTGJSON fileName (docs/sources.md). Candidates are
// compiled and reported but not registered.
const REGISTER = ['HareRaising_BLB', 'OtterLimits_BLB'];
const CANDIDATES = fs.readdirSync(path.join(ROOT, 'scratch/data')).filter(f => /_[A-Z0-9]+\.json$/.test(f) && f !== 'DeckList.json').map(f => f.replace(/\.json$/, ''));
const FETCHED = '2026-10-03';

export const slug = n => n.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const WORDNUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const numOf = w => { if (w == null) return null; if (/^\d+$/.test(w)) return +w; if (w === 'X') return { v: 'x' }; const n = WORDNUM[w.toLowerCase()]; if (n == null) throw new Fail('number: ' + w); return n; };
class Fail extends Error { constructor(m) { super(m); this.fail = m; } }
const KW = { 'flying': 'flying', 'reach': 'reach', 'first strike': 'firstStrike', 'double strike': 'doubleStrike', 'deathtouch': 'deathtouch', 'lifelink': 'lifelink', 'trample': 'trample', 'vigilance': 'vigilance', 'haste': 'haste', 'menace': 'menace', 'defender': 'defender', 'flash': 'flash', 'hexproof': 'hexproof', 'indestructible': 'indestructible', 'prowess': 'prowess', 'shroud': 'shroud' };
const KWRE = Object.keys(KW).sort((a, b) => b.length - a.length).join('|');
const TYPES = ['Artifact', 'Battle', 'Creature', 'Enchantment', 'Instant', 'Kindred', 'Land', 'Planeswalker', 'Sorcery'];
const SUBTYPE_WORDS = ['Rabbit', 'Otter', 'Bird', 'Frog', 'Wizard', 'Dragon', 'Angel', 'Elf', 'Goblin', 'Zombie', 'Human', 'Soldier', 'Forest', 'Island', 'Mountain', 'Plains', 'Swamp', 'Equipment', 'Aura', 'Food', 'Giant', 'Cat', 'Spider'];

// ---------------------------------------------------------------------------------------------
// The <filter> grammar: "[another|other] [non<type>] <noun> [you control|you don't control|an
// opponent controls] [with ...] [without <kw>] [that's a token or a <Subtype>]"
// ---------------------------------------------------------------------------------------------
const NOUN = { creature: ['Creature'], creatures: ['Creature'], land: ['Land'], lands: ['Land'], artifact: ['Artifact'], enchantment: ['Enchantment'], permanent: null, permanents: null, spell: null, spells: null };
export function parseFilter(str) {
  let s = str.trim(); const f = {};
  let m;
  if ((m = s.match(/^(another|other) (.*)$/))) { f.other = true; s = m[2]; }
  if ((m = s.match(/^basic (.*)$/))) { f.supers = ['Basic']; s = m[1]; }
  if ((m = s.match(/^nonbasic (.*)$/))) { f.notSupers = ['Basic']; s = m[1]; }
  if ((m = s.match(/^non-outlaw (.*)$/))) { f.notSubtypes = ['Assassin', 'Mercenary', 'Pirate', 'Rogue', 'Warlock']; s = m[1]; }   // CR 700.12                                // CR 205.4a
  if ((m = s.match(/^non(land|creature|artifact) (.*)$/))) { f.notTypes = [m[1][0].toUpperCase() + m[1].slice(1)]; s = m[2]; }
  if ((m = s.match(/^creature or planeswalker\b ?(.*)$/))) { f.types = ['Creature', 'Planeswalker']; s = m[1]; }
  else if ((m = s.match(/^creature or artifact\b ?(.*)$/))) { f.types = ['Creature', 'Artifact']; s = m[1]; }
  else if ((m = s.match(/^attacking creatures?\b ?(.*)$/))) { f.types = ['Creature']; f.attacking = true; s = m[1]; }
  else if ((m = s.match(/^(creature|creatures|land|lands|artifact|enchantment|permanent|permanents)\b ?(.*)$/))) { if (NOUN[m[1]]) f.types = NOUN[m[1]]; s = m[2]; }
  else if ((m = s.match(/^([A-Z][a-z]+(?:-[a-z]+)?)\b ?(.*)$/))) { f.subtypes = [m[1].replace(/(?<=[^s])s$/, '').replace(/ves$/, 'f')]; s = m[2]; }   // a creature type, singular or plural ("Mouse", "Lizards", "Elves")
  else if ((m = s.match(/^(token)s?\b ?(.*)$/))) { f.tok = true; s = m[2]; }
  else throw new Fail('filter noun: ' + str);
  for (let guard = 0; s && guard < 8; guard++) {
    if ((m = s.match(/^you control\b ?(.*)$/))) { f.ctrl = 'you'; s = m[1]; continue; }
    if ((m = s.match(/^you don't control\b ?(.*)$/))) { f.ctrl = 'opp'; s = m[1]; continue; }
    if ((m = s.match(/^an opponent controls\b ?(.*)$/))) { f.ctrl = 'opp'; s = m[1]; continue; }
    if ((m = s.match(/^with power (\d+) or less\b ?(.*)$/))) { f.powLE = +m[1]; s = m[2]; continue; }
    if ((m = s.match(/^with power (\d+) or greater\b ?(.*)$/))) { f.powGE = +m[1]; s = m[2]; continue; }
    if ((m = s.match(/^with power or toughness (\d+) or greater\b ?(.*)$/))) { f.ptGE = +m[1]; s = m[2]; continue; }
    if ((m = s.match(/^with toughness greater than its power\b ?(.*)$/))) { f.touGtPow = true; s = m[1]; continue; }
    if ((m = s.match(/^with mana value (\d+) or less\b ?(.*)$/))) { f.mvLE = +m[1]; s = m[2]; continue; }                 // CR 202.3
    if ((m = s.match(/^with total power and toughness (\d+) or less\b ?(.*)$/))) { f.ptSumLE = +m[1]; s = m[2]; continue; }
    if ((m = s.match(/^with an? (\+1\/\+1|[a-z]+) counter on it\b ?(.*)$/))) { f.counter = m[1]; s = m[2]; continue; }
    if ((m = s.match(new RegExp('^with (' + KWRE + ')\\b ?(.*)$')))) { f.kw = KW[m[1]]; s = m[2]; continue; }
    if ((m = s.match(new RegExp('^without (' + KWRE + ')\\b ?(.*)$')))) { f.notKw = KW[m[1]]; s = m[2]; continue; }
    if ((m = s.match(/^that's a token or an? (\w+)\b ?(.*)$/))) { f.tokOrSub = m[1]; s = m[2]; continue; }
    throw new Fail('filter qualifier: ' + s);
  }
  return f;
}

// ---------------------------------------------------------------------------------------------
// Effect clauses. `T` collects target slots in the order the word "target" appears (CR 601.2c);
// `ctx.subj` is what "it"/"that creature" means in this ability.
// ---------------------------------------------------------------------------------------------
function targetSlot(T, phrase) {
  let m;
  if (phrase === 'any target') { T.push({ f: { any: true } }); return { t: T.length - 1 }; }
  // "any other target": other than an earlier target of the same object, or else other than its source.
  if (phrase === 'any other target') { if (T.length) T.push({ f: { any: true }, diff: T.length - 1 }); else T.push({ f: { any: true, other: true } }); return { t: T.length - 1 }; }
  if ((m = phrase.match(/^target (.+?), (.+?), (.+?), or (.+?) you control$/))) { T.push({ f: Object.assign(parseFilter('creature you control'), { subtypes: [m[1], m[2], m[3], m[4]] }) }); return { t: T.length - 1 }; }
  if ((m = phrase.match(/^target (instant or sorcery|creature|land|permanent) card from your graveyard$/))) { T.push({ f: { card: 'grave', own: true, types: m[1] === 'instant or sorcery' ? ['Instant', 'Sorcery'] : m[1] === 'permanent' ? ['Artifact', 'Battle', 'Creature', 'Enchantment', 'Land', 'Planeswalker'] : [cap(m[1])] } }); return { t: T.length - 1 }; }
  if ((m = phrase.match(/^target (noncreature )?spell(?: with mana value (\d+))?$/))) { T.push({ f: Object.assign({ spell: true }, m[1] ? { notTypes: ['Creature'] } : {}, m[2] ? { mvIs: +m[2] } : {}) }); return { t: T.length - 1 }; }
  if (phrase === 'up to one target activated or triggered ability') { T.push({ f: { ability: true }, n: 1, upTo: true }); return { t: T.length - 1 }; }   // CR 115.1b: abilities on the stack   // a spell on the stack (CR 115.1)
  if ((m = phrase.match(/^up to one target artifact, creature, or planeswalker an opponent controls$/))) { T.push({ f: { types: ['Artifact', 'Creature', 'Planeswalker'], ctrl: 'opp' }, n: 1, upTo: true }); return { t: T.length - 1 }; }
  if ((m = phrase.match(/^target (opponent|player)$/))) { T.push({ f: { player: m[1] === 'opponent' ? 'opp' : 'any' } }); return { t: T.length - 1 }; }
  if ((m = phrase.match(/^each of up to (\w+) target (.+)$/))) { T.push({ f: parseFilter(singular(m[2])), n: numOf(m[1]), upTo: true }); return { t: T.length - 1 }; }
  if ((m = phrase.match(/^up to (\w+) target (.+)$/))) { T.push({ f: parseFilter(singular(m[2])), n: numOf(m[1]), upTo: true }); return { t: T.length - 1 }; }
  if ((m = phrase.match(/^target (.+)$/))) { T.push({ f: parseFilter(m[1]) }); return { t: T.length - 1 }; }
  return null;
}
const singular = s => s.replace(/^creatures\b/, 'creature').replace(/^permanents\b/, 'permanent');
function parseRef(T, ctx, phrase) {
  let p = phrase.trim(); if (/^[A-Z][a-z]/.test(p) && !SUBTYPE_WORDS.some(w => p.startsWith(w))) p = p[0].toLowerCase() + p.slice(1);
  const t = targetSlot(T, p); if (t) return t;
  if (p === '~') return 'self';
  if (p === 'enchanted creature') return 'enchanted';
  if (p === 'equipped creature') return 'equipped';
  if (p === 'him' || p === 'her') p = 'it';
  if (p === 'that creature' || p === 'it' || p === 'itself') { if (ctx.it) return ctx.it; throw new Fail('"' + p + '" with nothing to refer to'); }
  if (p === 'that player' && ctx.evPlayer) return 'evPlayer';
  if (p === 'each opponent') return 'eachOpp';
  let m;
  if ((m = p.match(/^each creature (target player) controls$/))) { const r = targetSlot(T, m[1]); return { each: { types: ['Creature'], ctrlOfT: r.t } }; }
  if ((m = p.match(/^each (.+)$/))) return { each: parseFilter(m[1]) };
  if ((m = p.match(/^all (.+)$/))) return { each: parseFilter(singular(m[1])) };
  if ((m = p.match(/^(creatures you control|other creatures you control)$/))) return { each: parseFilter(m[1]) };
  if (p === 'other attacking creatures') return { each: { other: true, types: ['Creature'], attacking: true } };
  throw new Fail('object: ' + p);
}
const PT = /^([+-]\d+|[+-]X)\/([+-]\d+|[+-]X)$/;
const ptVal = v => v.endsWith('X') ? { x: true, sign: v[0] } : +v;
function pumpOf(pt, xv) {
  const m = pt.match(PT); if (!m) throw new Fail('p/t: ' + pt);
  const one = v => { const q = ptVal(v); if (typeof q === 'number') return q; if (!xv) throw new Fail('X with no definition'); return xv; };
  return { p: one(m[1]), t: one(m[2]) };
}
function parseValueWhere(w) {
  if (w === 'the number of creatures you control') return { v: 'creatures' };
  if (w === "the number of creatures that were exiled under your opponents' control this turn") return { v: 'oppExiledCreatures' };
  throw new Fail('value: ' + w);
}
export function parseCond(str, ctx) {
  const c = str.trim(); let m;
  if ((m = c.match(/^you control an? (\w+) or an? (\w+)$/))) return { c: 'control', f: { subtypes: [m[1], m[2]] }, n: 1 };   // "a Swamp or a Mountain" (land types, CR 205.3i)
  if (c === 'you control two or fewer other lands') return { c: 'controlAtMost', f: { types: ['Land'], other: true }, n: 2 };
  if (c === "it's your first, second, or third turn of the game") return { c: 'earlyTurn', n: 3 };
  if (c === '~ entered this turn or if you control a basic land') return { c: 'any', of: [{ c: 'enteredThisTurn' }, { c: 'control', f: { supers: ['Basic'], types: ['Land'] }, n: 1 }] };
  if ((m = c.match(/^you control (four|five|six|seven) or more lands$/))) return { c: 'control', f: { types: ['Land'] }, n: numOf(m[1]) };
  if ((m = c.match(/^you control (a|an|ten or more|two or more) (.+)$/))) { const n = m[1] === 'ten or more' ? 10 : m[1] === 'two or more' ? 2 : 1; return { c: 'control', f: parseFilter(m[2].replace(/^lands$/, 'land')), n: n }; }
  if ((m = c.match(/^creatures you control have total power (\d+) or greater$/))) return { c: 'totalPower', n: +m[1] };
  if (c === 'another creature entered the battlefield under your control this turn') return { c: 'enteredOther' };
  if ((m = c.match(/^it's the first instant spell, the first sorcery spell, or the first (\w+) spell other than (\S+) you've cast this turn$/))) { if (m[1] !== 'Otter') throw new Fail('first-of-kind subtype ' + m[1]); return { c: 'firstOfKind' }; }
  if (c === 'you do') return { c: 'did' };
  if (c === 'this spell was kicked') return { c: 'kicked' };                                           // CR 702.33d
  if ((m = c.match(/^there are (\w+) or more cards in your graveyard$/))) return { c: 'graveCount', n: numOf(m[1]) };
  if (c === 'an opponent lost life this turn') return { c: 'oppLostLife' };
  if (c === 'your life total is greater than your starting life total') return { c: 'lifeOverStart', n: 1 };          // CR 119.1
  if ((m = c.match(/^your life total is at least (\w+) greater than your starting life total$/))) return { c: 'lifeOverStart', n: numOf(m[1]) };
  if (c === 'the gift was promised') return { c: 'giftPromised' };                                  // CR 702.174k
  if (c === 'it had no counters on it') return { c: 'noCounters' };
  if ((m = c.match(/^you've gained (\w+) or more life this turn$/))) return { c: 'gainedAtLeast', n: numOf(m[1]) };
  if (c === 'you gained life this turn') return { c: 'gainedAtLeast', n: 1 };
  if (c === 'you gained and lost life this turn') return { c: 'all', of: [{ c: 'gainedAtLeast', n: 1 }, { c: 'lostLifeThisTurn' }] };
  if (c === "you've lost life this turn") return { c: 'lostLifeThisTurn' };
  if ((m = c.match(/^it's an? ([A-Z]\w+)$/)) && ctx.it === 'ev') return { c: 'evIs', f: { subtypes: [m[1]] } };
  if (c === 'it was a creature') return { c: 'lkiType', type: 'Creature' };
  if (c === 'your life total is less than or equal to half your starting life total') return { c: 'lifeAtMostHalfStart' };
  if (c === "this spell's additional cost was paid") return { c: 'addCostPaid' };
  if ((m = c.match(/^an opponent has (\d+) or less life$/))) return { c: 'oppLifeLE', n: +m[1] };
  if (c === 'you descended this turn') return { c: 'descended' };
  if (c === 'this spell was cast from a graveyard') return { c: 'castFromGrave' };
  if ((m = c.match(/^it has (\w+) or more (\w+) counters on it$/))) return { c: 'counterAtLeast', kind: m[2], n: numOf(m[1]) };                                    // CR 700.11                   // CR 601.2b
  if ((m = c.match(/^its power is exactly (\d+)$/))) return { c: 'selfPowerIs', n: +m[1] };
  if ((m = c.match(/^there are (\w+) or more card types among cards in your graveyard$/))) return { c: 'graveTypes', n: numOf(m[1]) };   // delirium (CR 207.2c ability word)
  if ((m = c.match(/^there are (\w+) or more card types among cards exiled with ~$/))) return { c: 'exiledWithTypes', n: numOf(m[1]) };   // CR 607.2a: linked
  throw new Fail('condition: ' + c);
}
// One effect sentence (no trailing period) → ops.
function parseEffect(T, ctx, sentence) {
  let s = sentence.trim(), m;
  if ((m = s.match(/^Treefolk and Forests you control gain (\w+) until end of turn$/))) return [{ o: 'pump', on: { each: { subtypes: ['Treefolk', 'Forest'], ctrl: 'you' } }, grant: kwList(m[1]) }];
  if ((m = s.match(/^[Tt]ap (.+) and put (a|an|one|two) stun counters? on it$/))) { const on = parseRef(T, ctx, m[1]); return [{ o: 'tap', on: on }, { o: 'counter', on: on, n: numOf(m[2]), kind: 'stun' }]; }
  if (/^Creature cards in your graveyard gain "You may cast this card from your graveyard" until end of turn$/.test(s)) return [{ o: 'graveCastable', types: ['Creature'] }];
  if ((m = s.match(/^(?:Then )?[Ii]f (.+?), (.+)$/))) return [{ o: 'if', cond: parseCond(m[1], ctx), ops: parseEffect(T, ctx, cap(m[2])) }];
  if ((m = s.match(/^Then (.+)$/))) return parseEffect(T, ctx, cap(m[1]));
  if ((m = s.match(/^(.+) and (scry \d+|draw a card|you gain \d+ life)$/))) return parseEffect(T, ctx, m[1]).concat(parseEffect(T, ctx, m[2]));
  if ((m = s.match(/^(.+ counters? on ~) and it deals (\d+) damage to each opponent$/))) return parseEffect(T, ctx, m[1]).concat([{ o: 'damage', from: 'self', n: +m[2], to: 'eachOpp' }]);   // Vivi Ornitier
  if ((m = s.match(/^[Pp]ut that many (\+1\/\+1|[a-z]+) counters on (it|~)$/)) && ctx.evAmount) return [{ o: 'counter', on: 'self', n: { v: 'evAmount' }, kind: m[1] }];   // "that many": the damage just dealt
  if ((m = s.match(/^[Rr]eturn (target .+?) to its owner's hand$/))) return [{ o: 'bounce', on: parseRef(T, ctx, m[1]) }];
  if ((m = s.match(/^[Rr]eturn (target .+ card from your graveyard) to your hand$/))) return [{ o: 'graveToHand', on: parseRef(T, ctx, m[1]) }];
  if ((m = s.match(/^[Cc]ounter (target (?:noncreature )?spell) unless its controller pays (\{[^ ]+\})$/))) return [{ o: 'counterUnless', on: parseRef(T, ctx, m[1]), pay: m[2] }];   // CR 701.6, 118.12a
  if (/^[Yy]ou may attach ~ to it$/.test(s) && ctx.madeToken) return [{ o: 'may', what: 'attachToToken', ops: [{ o: 'attach', on: 'it' }] }];
  if ((m = s.match(/^[Pp]ut (a|an|one|two|three|\d+) \+1\/\+1 counters? on (.+)$/))) { const on = parseRef(T, ctx, m[2]); return [{ o: 'counter', on: on, n: numOf(m[1]), kind: '+1/+1' }]; }
  if ((m = s.match(/^[Dd]ouble the number of \+1\/\+1 counters on (.+)$/))) return [{ o: 'doubleCounters', on: parseRef(T, ctx, m[1]), kind: '+1/+1' }];
  if ((m = s.match(/^[Tt]ap (.+)$/))) return [{ o: 'tap', on: parseRef(T, ctx, m[1]) }];
  if ((m = s.match(/^[Uu]ntil end of turn, (.+?) gains (.+?) and gets (\S+), where X is (.+)$/))) {
    const on = parseRef(T, ctx, m[1]); const x = parseValueWhere(m[4]);
    const grant = kwList(m[2]); const pt = pumpOf(m[3], x); return [{ o: 'pump', on: on, p: pt.p, t: pt.t, grant: grant }];
  }
  if ((m = s.match(/^(.+?) gets? (\S+) and gains? (.+) until end of turn$/))) { const on = parseRef(T, ctx, m[1]); const pt = pumpOf(m[2]); return [{ o: 'pump', on: on, p: pt.p, t: pt.t, grant: kwList(m[3]) }]; }
  if ((m = s.match(/^(.+?) gets? (\S+) until end of turn$/))) { const on = parseRef(T, ctx, m[1]); const pt = pumpOf(m[2]); return [{ o: 'pump', on: on, p: pt.p, t: pt.t }]; }
  if ((m = s.match(/^(.+?) gains your choice of (.+) until end of turn$/))) return [{ o: 'pumpChoice', on: parseRef(T, ctx, m[1]), kws: kwList(m[2].replace(/ or /g, ', ')) }];
  if ((m = s.match(/^(.+?) gains? (.+) until end of turn$/))) return [{ o: 'pump', on: parseRef(T, ctx, m[1]), grant: kwList(m[2]) }];
  if ((m = s.match(/^[Ss]cry (\d+)$/))) return [{ o: 'scry', n: +m[1] }];
  if ((m = s.match(/^[Ss]urveil (\d+)$/))) return [{ o: 'surveil', n: +m[1] }];                         // CR 701.25
  if ((m = s.match(/^[Mm]ill (a card|\w+ cards)$/))) return [{ o: 'mill', n: m[1] === 'a card' ? 1 : numOf(m[1].split(' ')[0]) }];   // CR 701.17
  if ((m = s.match(/^[Yy]ou may (mill a card|mill \w+ cards)$/))) return [{ o: 'may', what: 'mill', ops: parseEffect(T, ctx, cap(m[1])) }];
  if ((m = s.match(/^[Yy]ou may put a (permanent|creature|land) card from among the milled cards into your hand$/))) return [{ o: 'pickMilled', type: m[1] }];   // CR 701.17c
  if ((m = s.match(/^[Uu]ntap (target .+)$/))) return [{ o: 'untap', on: parseRef(T, ctx, m[1]) }];
  if (/^After this phase, there is an additional combat phase$/.test(s)) return [{ o: 'extraCombat' }];   // CR 500.8
  if ((m = s.match(/^(.+?) fights (.+)$/))) return [{ o: 'fight', a: parseRef(T, ctx, m[1]), b: parseRef(T, ctx, m[2]) }];   // CR 701.14
  if ((m = s.match(/^[Ee]xile target card from a graveyard$/))) { T.push({ f: { card: 'grave' } }); return [{ o: 'exile', on: { t: T.length - 1 }, link: true }]; }   // CR 607.2a: linked to "exiled with"
  if ((m = s.match(/^[Ss]earch your library for a basic land card, reveal it, put it into your hand, then shuffle$/))) return [{ o: 'searchBasic', toHand: true }];
  if ((m = s.match(/^[Dd]iscard a card, then draw a card$/))) return [{ o: 'discard', n: 1 }, { o: 'draw', n: 1 }];
  if ((m = s.match(/^[Ss]earch your library for a basic land card, put it onto the battlefield( tapped)?, then shuffle$/))) return [{ o: 'searchBasic', tapped: !!m[1] }];   // CR 701.23
  if ((m = s.match(/^[Uu]ntap that land$/))) return [{ o: 'untapIt' }];
  if ((m = s.match(/^[Cc]reate (a|an|one|two|three|X|\d+) (\d+)\/(\d+) ((?:white|blue|black|red|green|colorless)(?: and (?:white|blue|black|red|green))?) ((?:[A-Z][a-z]+ ?)+?) creature tokens?(?: with ("[^"]+"|.+?))?( that are tapped and attacking)?$/))) {
    ctx.madeToken = true;
    const quoted = m[6] && m[6][0] === '"' ? m[6].slice(1, -1).replace(/,$/, '.') : null;
    const TOKEN_AB = { "This token can't block or be blocked by non-Spirit creatures.": [{ k: 'restrict', block: true }, { k: 'evasion', blockerNot: { types: ['Creature'], notSubtypes: ['Spirit'] } }], 'This token gets +1/+1 for each other Rat you control.': [{ k: 'static', affects: 'self', pv: { v: 'countOthers', f: { subtypes: ['Rat'], ctrl: 'you' } } }], "This token can't block.": [{ k: 'restrict', block: true }], 'Whenever this token attacks, you gain 1 life.': [{ k: 'trig', on: 'attacks', who: 'self', ops: [{ o: 'gain', n: 1 }] }] };                 // a token's own rules text, quoted on the card
    if (quoted && !TOKEN_AB[quoted]) throw new Fail('token ability: ' + quoted);
    const id = ctx.token({ p: +m[2], t: +m[3], color: m[4], sub: m[5], kw: m[6] && !quoted ? kwList(m[6]) : [], ab: quoted ? TOKEN_AB[quoted] : null, abText: quoted });
    return [Object.assign({ o: 'token', id: id, n: numOf(m[1]) }, m[7] ? { tapped: true, attacking: true } : {})];
  }
  if ((m = s.match(/^[Cc]reate (a|an|one|two|three|\d+) Treasure tokens?$/))) return [{ o: 'token', id: ctx.token.treasure(), n: numOf(m[1]) }];
  if (/^[Ss]acrifice (it|~)$/.test(s) && ctx.it === 'self') return [{ o: 'sacrificeSelf' }];
  if ((m = s.match(/^(.+?) if (you've gained .+ this turn|you gained .+ this turn)$/))) return [{ o: 'if', cond: parseCond(m[2], ctx), ops: parseEffect(T, ctx, m[1]) }];
  if ((m = s.match(/^([Dd]estroy .+) if (its power is exactly \d+)$/))) return [{ o: 'if', cond: parseCond(m[2], ctx), ops: parseEffect(T, ctx, cap(m[1])) }];
  if (/^~ explores$/.test(s)) return [{ o: 'explore' }];
  if ((m = s.match(/^[Ee]arthbend (\d+)$/))) { T.push({ f: { types: ['Land'], ctrl: 'you' } }); return [{ o: 'earthbend', on: { t: T.length - 1 }, n: +m[1] }]; }   // CR 701.66a
  if ((m = s.match(/^[Tt]hat land's controller may search their library for a basic land card, put it onto the battlefield, then shuffle$/)) && ctx.it && ctx.it.t != null) return [{ o: 'searchBasic', whoT: ctx.it.t, may: true }];
  if ((m = s.match(/^[Yy]ou may search your library for a basic land card, put it onto the battlefield( tapped)?, then shuffle$/))) return [{ o: 'may', what: 'search', ops: [{ o: 'searchBasic', tapped: !!m[1] }] }];
  if ((m = s.match(/^[Dd]ouble the power of (.+) until end of turn$/))) { const on = parseRef(T, ctx, m[1]); return [{ o: 'pump', on: on, p: { v: 'power', of: on }, t: 0 }]; }   // CR 701.10b
  if ((m = s.match(/^[Aa]dd \{([WUBRG])\}\{\1\}$/))) return [{ o: 'addMana', col: m[1], n: 2 }];
  if ((m = s.match(/^(enchanted creature) fights (up to one target .+)$/i))) return [{ o: 'fight', a: 'enchanted', b: parseRef(T, ctx, m[2]) }];
  if ((m = s.match(/^([Tt]arget opponent) loses (\d+) life$/))) return [{ o: 'loseLife', who: parseRef(T, ctx, m[1].toLowerCase()), n: +m[2] }];
  if ((m = s.match(/^[Rr]eturn ~ to its owner's hand$/))) return [{ o: 'bounce', on: 'self' }];
  if (/^[Tt]ap it$/.test(s) && ctx.it === 'self') return [{ o: 'tap', on: 'self' }];
  if (/^[Ii]ts controller may search their library for a basic land card, put it onto the battlefield tapped, then shuffle$/.test(s) && ctx.it && ctx.it.t != null) return [{ o: 'searchBasic', tapped: true, whoT: ctx.it.t, may: true }];   // Erode
  if (/^[Rr]eturn (?:~|this card) from your graveyard to the battlefield$/.test(s)) return [{ o: 'selfFromGrave' }];
  if (/^[Yy]ou may return (?:~|this card) from your graveyard to the battlefield$/.test(s)) return [{ o: 'may', what: 'returnFromGrave', ops: [{ o: 'selfFromGrave' }] }];   // CR 113.6m: functions in the graveyard
  if ((m = s.match(/^[Rr]emove (a|an|one|two) (-1\/-1|\+1\/\+1|[a-z]+) counters? from ~$/))) return [{ o: 'removeCounter', n: numOf(m[1]), kind: m[2] }];
  if (/^[Yy]ou may discard a card$/.test(s)) return [{ o: 'may', what: 'discard', ops: [{ o: 'discard', n: 1 }] }];
  if (/^[Ss]earch your library for a card, put it into your hand, shuffle, then discard a card at random$/.test(s)) return [{ o: 'tutor' }, { o: 'discardRandom' }];
  if (/^[Ee]xile the top card of your library\. You may play that card until your next end step$/.test(s)) return [{ o: 'impulse', until: 'nextEndStep' }];
  if ((m = s.match(/^[Cc]ounter (target (?:noncreature )?spell(?: with mana value \d+)?)$/))) return [{ o: 'counterTarget', on: parseRef(T, ctx, m[1]) }];   // CR 701.6a
  if ((m = s.match(/^([Tt]arget creature you control) explores$/))) return [{ o: 'explore', on: parseRef(T, ctx, m[1].toLowerCase()) }];
  if (/^[Cc]reate a Map token$/.test(s)) return [{ o: 'token', id: ctx.token.map(), n: 1 }];              // CR 111.10s
  if ((m = s.match(/^[Pp]ut X \+1\/\+1 counters on (.+)$/))) return [{ o: 'counter', on: parseRef(T, ctx, m[1]), n: { v: 'x' }, kind: '+1/+1' }];
  if (/^[Dd]raw half X cards, rounded down$/.test(s)) return [{ o: 'draw', n: { v: 'halfX' } }];   // CR 107.1a
  if ((m = s.match(/^[Ss]huffle ~ and (target .+) into their owners' libraries$/))) return [{ o: 'shuffleIntoLib', on: ['self', parseRef(T, ctx, m[1])] }];
  if (/^[Uu]ntap ~ and transform it$/.test(s)) return [{ o: 'untap', on: 'self' }, { o: 'transform' }];   // CR 701.27
  if (/^[Yy]ou lose that much life$/.test(s) && ctx.evAmount) return [{ o: 'loseLife', who: 'you', n: { v: 'evAmount' } }];
  if (/^[Dd]raw a card for each opponent who lost life this turn$/.test(s)) return [{ o: 'draw', n: { v: 'oppsLostLife' } }];
  if (/^[Ee]ach player draws a card$/.test(s)) return [{ o: 'draw', n: 1, who: 'eachPlayer' }];
  if ((m = s.match(/^([Tt]arget player) mills (\w+) cards$/))) return [{ o: 'mill', n: numOf(m[2]), who: parseRef(T, ctx, m[1].toLowerCase()) }];
  if ((m = s.match(/^[Yy]ou get an emblem with "(.+)"$/))) { const eab = []; if (!parseStatic(m[1], ctx, eab, {})) throw new Fail('emblem: ' + m[1]); return [{ o: 'emblem', ab: eab[0], text: m[1] }]; }   // CR 114
  if ((m = s.match(/^[Uu]ntil end of turn, ~ becomes an? (\d+)\/(\d+) ((?:white|blue|black|red|green)(?: and (?:white|blue|black|red|green))?) ([A-Z]\w+) creature with (.+)$/))) return [{ o: 'animate', on: 'self', p: +m[1], t: +m[2], kws: kwList(m[5]), colors: m[3].split(' and ').map(c => COLOR[c]), subtypes: [m[4]], until: 'eot' }];
  if (/^[Ee]ach opponent sacrifices a creature with the greatest power among creatures they control$/.test(s)) return [{ o: 'sacGreatestPower' }];
  if (/^[Dd]estroy each creature with power (\d+) or less$/.test(s)) return [{ o: 'destroy', on: { each: { types: ['Creature'], powLE: +s.match(/(\d+)/)[1] } } }];
  if ((m = s.match(/^[Rr]eturn up to (\w+) creature cards from your graveyard to your hand$/))) return [{ o: 'chooseFromGrave', types: ['Creature'], n: numOf(m[1]), to: 'hand' }];                                              // CR 701.44a
  if ((m = s.match(/^[Pp]ut its counters on (.+)$/))) return [{ o: 'moveCounters', to: parseRef(T, ctx, m[1]) }];
  if ((m = s.match(/^[Rr]eturn up to one target creature card with mana value X or less from your graveyard to the battlefield, where X is the amount of life you gained this turn$/))) {
    T.push({ f: { card: 'grave', own: true, types: ['Creature'], mvLEv: { v: 'gainedThisTurn' } }, n: 1, upTo: true });
    return [{ o: 'graveToBattlefield', on: { t: T.length - 1 } }];
  }
  if ((m = s.match(/^([Ss]cry \d+) and (put .+)$/))) return parseEffect(T, ctx, m[1]).concat(parseEffect(T, ctx, cap(m[2])));
  if ((m = s.match(/^[Pp]ut (a|an|one|two|three|\d+) ([a-z]+) counters? on (.+)$/))) return [{ o: 'counter', on: parseRef(T, ctx, m[3]), n: numOf(m[1]), kind: m[2] }];
  if ((m = s.match(/^(.+?) gets \+X\/\+X until end of turn, where X is (.+)$/))) { const on = parseRef(T, ctx, m[1]), x = parseValueWhere(m[2]); return [{ o: 'pump', on: on, p: x, t: x }]; }
  if ((m = s.match(/^(?:It|~) deals damage equal to (the number of creatures you control) to (.+)$/))) return [{ o: 'damage', from: 'self', n: parseValueWhere(m[1]), to: parseRef(T, ctx, m[2]) }];
  if ((m = s.match(/^[Dd]estroy (.+)$/))) return [{ o: 'destroy', on: parseRef(T, ctx, m[1]) }];
  if ((m = s.match(/^~ deals damage to that player equal to the number of noncreature spells they've cast this turn$/))) return [{ o: 'damage', from: 'self', n: { v: 'castNoncreature', of: 'evPlayer' }, to: 'evPlayer' }];
  if ((m = s.match(/^(.+?) gains your choice of (.+) until end of turn$/))) return [{ o: 'pumpChoice', on: parseRef(T, ctx, m[1]), kws: kwList(m[2].replace(/ or /g, ', ')) }];
  if ((m = s.match(/^(.+?) deals X damage to (.+) and X damage to itself, where X is its power$/))) {
    const from = parseRef(T, ctx, m[1]); const to = parseRef(T, ctx, m[2]); const n = { v: 'power', of: from };
    return [{ o: 'damage', from: from, n: n, to: to }, { o: 'damage', from: from, n: n, to: from }];
  }
  if ((m = s.match(/^~ becomes an? (\d+)\/(\d+) creature with (.+) and all creature types$/))) return [{ o: 'animate', on: 'self', p: +m[1], t: +m[2], kws: kwList(m[3]), allTypes: true }];
  if (/^It's still a land$/.test(s)) return [];                                                        // a reminder of what "becomes a creature" keeps (CR 205.1b): nothing to do
  if ((m = s.match(/^[Cc]reate an? (Monster|Cursed|Royal|Sorcerer|Virtuous|Wicked|Young Hero) Role token attached to (.+)$/))) { ctx.token.role(m[1]); return [{ o: 'role', role: m[1], on: parseRef(T, ctx, m[2]) }]; }   // CR 111.10j-r
  if ((m = s.match(/^[Dd]iscard up to (\w+) cards, then draw that many cards$/))) return [{ o: 'discardUpTo', n: numOf(m[1]), thenDraw: true }];
  if ((m = s.match(/^(.+?) deals damage equal to its power to (.+)$/))) { const from = parseRef(T, ctx, m[1]); const prevIt = ctx.it; ctx.it = from; const to = parseRef(T, ctx, m[2]); ctx.it = prevIt; return [{ o: 'damage', from: from, n: { v: 'power', of: from }, to: to }]; }
  if ((m = s.match(/^(.+?) deals (\d+) damage to (.+)$/))) {
    const from = parseRef(T, ctx, m[1]); let to;
    if (m[3] === 'each opponent') to = 'eachOpp'; else to = parseRef(T, ctx, m[3]);
    return [{ o: 'damage', from: from, n: +m[2], to: to }];
  }
  if ((m = s.match(/^[Dd]raw (a card|\w+ cards), then discard (a card)$/))) return [{ o: 'draw', n: m[1] === 'a card' ? 1 : numOf(m[1].split(' ')[0]) }, { o: 'discard', n: 1 }];
  if ((m = s.match(/^[Dd]raw (a card|\w+ cards)$/))) return [{ o: 'draw', n: m[1] === 'a card' ? 1 : numOf(m[1].split(' ')[0]) }];
  if ((m = s.match(/^[Yy]ou gain (\d+) life$/))) return [{ o: 'gain', n: +m[1] }];
  if ((m = s.match(/^(.+) and you lose (\d+) life$/))) return parseEffect(T, ctx, m[1]).concat([{ o: 'loseLife', who: 'you', n: +m[2] }]);
  if ((m = s.match(/^[Yy]ou draw (a card|\w+ cards)$/))) return [{ o: 'draw', n: m[1] === 'a card' ? 1 : numOf(m[1].split(' ')[0]) }];
  if ((m = s.match(/^([Tt]hey|[Tt]hat player) loses? (\d+) life$/)) && ctx.evPlayer) return [{ o: 'loseLife', who: 'evPlayer', n: +m[2] }];
  if ((m = s.match(/^([Ee]ach opponent|[Yy]ou) loses? (\d+) life$/))) return [{ o: 'loseLife', who: /^each/i.test(m[1]) ? 'eachOpp' : 'you', n: +m[2] }];   // CR 119.3
  if ((m = s.match(/^([Tt]hey|[Tt]hat player) loses? half their life, rounded up$/)) && ctx.evPlayer) return [{ o: 'loseLife', who: 'evPlayer', half: 'up' }];   // CR 107.1a
  if ((m = s.match(/^[Rr]eturn it to the battlefield( tapped)? under its owner's control(?: with (\w+) stun counters on it)?$/)) && ctx.it === 'self') return [Object.assign({ o: 'returnFromGrave', tapped: !!m[1] }, m[2] ? { ctr: { stun: numOf(m[2]) } } : {})];   // CR 122.1d
  if ((m = s.match(/^(.+?) can't be blocked this turn$/))) return [{ o: 'unblockable', on: parseRef(T, ctx, m[1]) }];
  if ((m = s.match(/^(.+), (.+), and (.+)$/))) return [m[1], m[2], m[3]].flatMap(p => parseEffect(T, ctx, cap(p)));
  throw new Fail('effect: ' + s);
}
const cap = s => s[0].toUpperCase() + s.slice(1);
function kwList(str) {
  const parts = str.replace(/,? and /g, ', ').split(/, /).map(x => x.trim()).filter(Boolean);
  return parts.map(p => { if (!KW[p]) throw new Fail('keyword: ' + p); return KW[p]; });
}
// A whole effect paragraph: some multi-sentence shapes first (anchored to the whole text), then
// sentence by sentence.
function parseEffects(T, ctx, text) {
  let t = text.trim().replace(/\.$/, ''), m;
  if ((m = t.match(/^look at the top card of your library\. If it's a (land) card, you may put it onto the battlefield tapped\. Otherwise, put it into your hand$/i))) return [{ o: 'lookTop', type: 'Land' }];
  if ((m = t.match(/^reveal cards from the top of your library until you reveal a (land) card\. Put that card onto the battlefield tapped and the rest on the bottom of your library in a random order$/i))) return [{ o: 'revealUntil', type: 'Land' }];
  if ((m = t.match(/^exile the top card of your library\. Until the end of your next turn, you may play that card$/i))) return [{ o: 'impulse' }];
  if ((m = t.match(/^exile the top card of your library\. Until end of turn, you may play that card$/i))) return [{ o: 'impulse', until: 'eot' }];
  if ((m = t.match(/^exile a card at random from your graveyard\. You may play that card this turn$/i))) return [{ o: 'graveImpulse' }];
  // Break Out: "Look at the top six cards of your library. You may reveal a creature card from among them. If that card has mana value 2 or less, you may put it onto the battlefield and it gains haste until end of turn. If you didn't put the revealed card onto the battlefield this way, put it into your hand. Put the rest on the bottom of your library in a random order."
  if ((m = t.match(/^look at the top (\w+) cards of your library\. You may reveal an? (creature|land|permanent) card from among them\. If that card has mana value (\d+) or less, you may put it onto the battlefield and it gains (\w+) until end of turn\. If you didn't put the revealed card onto the battlefield this way, put it into your hand\. Put the rest on the bottom of your library in a random order$/i)))
    return [{ o: 'dig', n: numOf(m[1]), type: cap(m[2]), bfMvMax: +m[3], grant: kwList(m[4]), rest: 'bottomRandom' }];
  if ((m = t.match(/^(.+?) deals (\d+) damage to (.+)\. If this spell was kicked, it deals (\d+) damage instead$/i))) {   // CR 702.33e
    const from = parseRef(T, ctx, m[1]), to = parseRef(T, ctx, m[3]);
    return [{ o: 'damage', from: from, n: { v: 'kicked', yes: +m[4], no: +m[2] }, to: to }];
  }
  if ((m = t.match(/^it deals that much damage to (any other target)\. If a player is dealt damage this way, they can't gain life for the rest of the game$/i))) {
    const to = parseRef(T, ctx, m[1]);
    return [{ o: 'damage', from: 'self', n: { v: 'evAmount' }, to: to }, { o: 'noLifeGain', on: to }];
  }
  if ((m = t.match(/^you may have (target opponent) draw a card\. If you do, copy that spell\. You may choose new targets for the copy$/i))) {
    const who = parseRef(T, ctx, m[1]);
    return [{ o: 'may', what: 'oppDrawCopy', ops: [{ o: 'draw', n: 1, who: who }] }, { o: 'if', cond: { c: 'did' }, ops: [{ o: 'copySpell' }] }];
  }
  // "you may pay {B}. If you do, ..." / "you may pay 1 life. If you do, ..." — a payment during resolution (CR 608.2d, 118.12)
  if ((m = t.match(/^you may pay (\{[^ ]+\}|\d+ life)\. If you do, (.+)$/i))) { const ops = parseEffect(T, ctx, cap(m[2])); return [{ o: 'mayPay', mana: /^\{/.test(m[1]) ? m[1] : null, life: /life$/.test(m[1]) ? +m[1].split(' ')[0] : null, ops: ops }]; }
  // Inti: "you may discard a card. When you do, ..." — a reflexive trigger (CR 603.12)
  if ((m = t.match(/^you may discard a card\. When you do, (.+)$/i))) { const T2 = []; const ops = parseEffects(T2, Object.assign({}, ctx, { it: null }), cap(m[1])); return [{ o: 'may', what: 'discard', ops: [{ o: 'discard', n: 1 }, { o: 'reflexive', ab: Object.assign({ k: 'trig', on: 'reflexive', ops: ops }, T2.length ? { tg: T2 } : {}) }] }]; }
  // Inti: "exile the top card of your library. You may play that card until your next end step."
  if (/^exile the top card of your library\. You may play that card until your next end step$/i.test(t)) return [{ o: 'impulse', until: 'nextEndStep' }];
  // Carnage: "return target creature card ... to the battlefield. It gains "..." and "...""
  if ((m = t.match(/^return (target creature card with mana value (\d+) or less from your graveyard) to the battlefield\. It gains "~ attacks each combat if able" and "When ~ deals combat damage to a player, sacrifice it\."$/i))) {
    T.push({ f: { card: 'grave', own: true, types: ['Creature'], mvLE: +m[2] } });
    return [{ o: 'graveToBattlefield', on: { t: T.length - 1 }, grantAb: [{ k: 'mustAttack' }, { k: 'trig', on: 'dealsDamage', combat: true, toPlayer: true, ops: [{ o: 'sacrificeSelf' }] }] }];
  }
  // Erode: "Its controller may search their library for a basic land card, put it onto the battlefield tapped, then shuffle."
  // Tishana's Tidebinder: counter an ability; its permanent loses all abilities while this remains (CR 701.6a, 611.2b)
  if ((m = t.match(/^counter (up to one target activated or triggered ability)\. If an ability of an artifact, creature, or planeswalker is countered this way, that permanent loses all abilities for as long as ~ remains on the battlefield$/i))) return [{ o: 'counterAbility', on: parseRef(T, ctx, m[1].toLowerCase()), loseWhile: true }];
  // The Wondrous Wasp: "tap up to one target creature. It loses all abilities for as long as ~ remains on the battlefield."
  if ((m = t.match(/^tap (up to one target creature)\. It loses all abilities for as long as ~ remains on the battlefield$/i))) { const on = parseRef(T, ctx, m[1].toLowerCase()); return [{ o: 'tap', on: on }, { o: 'loseAbilities', on: on, whileSrc: true }]; }
  // We Say Thee Nay!: the teamwork version asks {4}
  if ((m = t.match(/^counter (target spell) unless its controller pays (\{[^ ]+\})\. Counter that spell unless its controller pays (\{[^ ]+\}) instead if this spell was cast using teamwork$/i))) return [{ o: 'counterUnless', on: parseRef(T, ctx, m[1]), pay: m[2], payIf: { c: 'addCostPaid', pay: m[3] } }];
  // Esper Origins: "If this spell was cast from a graveyard, exile it, then put it onto the battlefield transformed under its owner's control with a finality counter on it."
  if ((m = t.match(/^(.+)\. If this spell was cast from a graveyard, exile it, then put it onto the battlefield transformed under its owner's control with a finality counter on it$/i))) return parseEffects(T, ctx, m[1]).concat([{ o: 'if', cond: { c: 'castFromGrave' }, ops: [{ o: 'exileTransformOnto', ctr: { finality: 1 } }] }]);
  // Earthbender Ascension: "put a quest counter on ~. When you do, if it has four or more quest counters on it, ..." — a reflexive trigger with an intervening "if"
  if ((m = t.match(/^(put a \w+ counter on ~)\. When you do, if (it has \w+ or more \w+ counters on it), (.+)$/i))) { const T2 = []; const ops = parseEffects(T2, Object.assign({}, ctx, { it: null }), cap(m[3])); return parseEffect(T, ctx, cap(m[1])).concat([{ o: 'reflexive', ab: Object.assign({ k: 'trig', on: 'reflexive', cond: parseCond(m[2], ctx), ops: ops }, T2.length ? { tg: T2 } : {}) }]); }
  if (/^reveal the top card of your library\. If it's a permanent card, put it into your hand$/i.test(t)) return [{ o: 'revealTopToHand', type: 'permanent' }];
  // Gix's Command: "Put two +1/+1 counters on up to one creature. It gains lifelink until end of turn." — chosen on resolution (its ruling)
  if ((m = t.match(/^put (\w+) \+1\/\+1 counters on up to one creature\. It gains (\w+) until end of turn$/i))) return [{ o: 'choose', f: { types: ['Creature'] }, upTo: true }, { o: 'counter', on: 'it', n: numOf(m[1]), kind: '+1/+1' }, { o: 'pump', on: 'it', grant: kwList(m[2]) }];
  // Azure Beastbinder: loses all abilities and becomes 2/2 until your next turn (layers 6 and 7b)
  if ((m = t.match(/^(up to one target artifact, creature, or planeswalker an opponent controls) loses all abilities until your next turn\. If it's a creature, it also has base power and toughness (\d+)\/(\d+) until your next turn$/i))) return [{ o: 'loseAbilities', on: parseRef(T, ctx, m[1].toLowerCase()), basePT: [+m[2], +m[3]], until: 'yourNext' }];
  // Vren: "create X 1/1 ... tokens with "...," where X is ..."
  if ((m = t.match(/^(create) X (.+ creature tokens with "[^"]+?),?" where X is (.+)$/i))) { const ops = parseEffect(T, ctx, 'Create X ' + m[2] + '."'); ops[0].n = parseValueWhere(m[3]); return ops; }
  // Deep-Cavern Bat: "look at target opponent's hand. You may exile a nonland card from it until ~ leaves the battlefield." (CR 610.3)
  if ((m = t.match(/^look at (target opponent)'s hand\. You may exile a nonland card from it until ~ leaves the battlefield$/i))) return [{ o: 'handPick', who: parseRef(T, ctx, m[1]), f: { notTypes: ['Land'] }, then: 'exileUntil', look: true, may: true }];
  // Enduring Innocence: "return it to the battlefield under its owner's control. It's an enchantment."
  if (/^return it to the battlefield under its owner's control\. It's an enchantment$/i.test(t) && ctx.it === 'self') return [{ o: 'returnFromGrave', asEnchantment: true }];
  // Belladonna Took: "... if this is the first time this ability has resolved this turn. If it's the second time, ... If it's the third time, ..."
  if ((m = t.match(/^(.+) if this is the first time this ability has resolved this turn\. If it's the second time, (.+)\. If it's the third time, (.+)$/i))) return [{ o: 'nthResolution', branches: [parseEffect(T, ctx, cap(m[1])), parseEffect(T, ctx, cap(m[2])), parseEffect(T, ctx, cap(m[3]))] }];
  // The Last Ronin's Technique: "Create ... tokens. If this spell's sneak cost was paid, they enter tapped and attacking." (CR 702.190)
  if ((m = t.match(/^(create .+ creature tokens)\. If this spell's sneak cost was paid, they enter tapped and attacking$/i))) { const ops = parseEffect(T, ctx, cap(m[1])); ops[0].attackingIf = { c: 'sneakPaid' }; return ops; }
  // Dalkovan Encampment: a delayed trigger for the rest of the turn (CR 603.7b), whose tokens are sacrificed at the next end step.
  if ((m = t.match(/^whenever you attack this turn, (create .+ that are tapped and attacking)\. Sacrifice them at the beginning of the next end step$/i))) { const ops = parseEffect(T, ctx, cap(m[1])); ops[0].sacEnd = true; return [{ o: 'delayed', on: 'attackWith', duration: 'turn', ops: ops }]; }
  // Stock Up / Sleight of Hand: look at the top N, put some into your hand, the rest on the bottom.
  if ((m = t.match(/^look at the top (\w+) cards of your library\. Put (\w+) of them into your hand and the (?:rest|other) on the bottom of your library(?: in any order)?$/i))) return [{ o: 'lookPick', n: numOf(m[1]), take: numOf(m[2]) }];
  // Torch the Tower: bargained instead deals 3 and scry 1 (CR 702.166c).
  if ((m = t.match(/^~ deals (\d+) damage to (target creature or planeswalker)\. If this spell was bargained, instead it deals (\d+) damage to that permanent and you scry (\d+)$/))) {
    const to = parseRef(T, ctx, m[2]);
    return [{ o: 'if', cond: { c: 'bargained' }, ops: [{ o: 'damage', from: 'self', n: +m[3], to: to }, { o: 'scry', n: +m[4] }], else: [{ o: 'damage', from: 'self', n: +m[1], to: to }] }];
  }
  if (/^If a permanent dealt damage by ~ would die this turn, exile it instead$/.test(t)) return [{ o: 'dieExile' }];   // CR 614.1a: a replacement set up by the resolving spell
  // Duress / Cruelclaw's Heist: the revealed hand, the caster's choice, then discard or exile.
  if ((m = t.match(/^(target opponent) reveals their hand\. You choose an? (noncreature, nonland|nonland) card from it\. That player discards that card$/i))) {
    const who = parseRef(T, ctx, m[1].toLowerCase());
    return [{ o: 'handPick', who: who, f: { notTypes: m[2] === 'nonland' ? ['Land'] : ['Creature', 'Land'] }, then: 'discard' }];
  }
  if ((m = t.match(/^(target opponent) reveals their hand\. You choose a nonland card from it\. Exile that card\. If the gift was promised, you may cast that card for as long as it remains exiled, and mana of any type can be spent to cast it$/i))) {
    const who = parseRef(T, ctx, m[1].toLowerCase());
    return [{ o: 'handPick', who: who, f: { notTypes: ['Land'] }, then: 'exile', castIfGift: true }];   // CR 609.4b
  }
  const sentences = t.split(/(?<=\.") (?=[A-Z])|\. (?=[A-Z])/);                                   // a quoted ability ends its sentence inside the quotes
  const ops = [];
  for (const sn of sentences) {
    // "X. Then it deals ..." — "it" is the object the previous sentence acted on.
    const ow = sn.match(/^Otherwise, (.+)$/);                                                    // "If X, A. Otherwise, B."
    if (ow) { const last = ops[ops.length - 1]; if (!last || last.o !== 'if' || last.else) throw new Fail('"Otherwise" with no "if" before it'); last.else = parseEffect(T, ctx, cap(ow[1])); continue; }
    const out = parseEffect(T, ctx, sn);
    const last = out[out.length - 1]; if (last && last.on && typeof last.on === 'object' && last.on.t != null) ctx.it = last.on; else if (last && last.on === 'self' && !ctx.it) ctx.it = 'self';
    ops.push.apply(ops, out);
  }
  return ops;
}

// ---------------------------------------------------------------------------------------------
// Ability frames
// ---------------------------------------------------------------------------------------------
function parseCost(str) {
  const parts = str.split(/, /).map(x => x.trim());
  const cost = { mana: '', tap: false, sacSelf: false };
  for (const p of parts) {
    if (/^(\{[0-9WUBRGCX]\})+$/.test(p)) cost.mana += p;
    else if (p === '{T}') cost.tap = true;
    else if (p === 'Sacrifice ~') cost.sacSelf = true;
    else if (p === 'Sacrifice a token') cost.sacToken = true;
    else if (p === 'Discard a card') cost.discard = 1;
    else if (p === 'Exile ~') cost.exileSelf = true;
    else if (/^Pay (\d+) life$/.test(p)) cost.life = +p.match(/\d+/)[0];                             // CR 119.4
    else if (/^Remove (\w+) (\w+) counters from ~$/.test(p)) { const r = p.match(/^Remove (\w+) (\w+) counters from ~$/); cost.removeCtr = { n: numOf(r[1]), kind: r[2] }; }   // CR 118.3
    else throw new Fail('cost: ' + p);
  }
  return cost;
}
// Trigger events: "<event>, <effect>" — the event is matched by an anchored pattern on a prefix.
const EVENTS = [
  [/^~ enters and when you sacrifice it$/, () => [{ on: 'enters', who: 'self' }, { on: 'sacrificed', who: 'self', lookBack: true }]],
  [/^~ enters$/, () => [{ on: 'enters', who: 'self' }]],
  // "this creature or another creature you control with ...": the qualifier binds both (Fecund Greenshell's ruling counts its own static for itself).
  [/^~ or another (creature or artifact) you control enters$/, m => [{ on: 'enters', who: { or: ['self', Object.assign(parseFilter(m[1]), { other: true, ctrl: 'you' })] } }]],
  [/^you gain life$/, () => [{ on: 'gainLife' }]],
  [/^you draw a card$/, () => [{ on: 'drawCard', you: true }]],
  [/^you discard one or more cards$/, () => [{ on: 'discardBatch', you: true }]],
  [/^you discard a card$/, () => [{ on: 'discarded', you: true }]],
  [/^one or more cards leave your graveyard$/, () => [{ on: 'leftGraveBatch', you: true }]],
  [/^one or more permanent cards are put into your graveyard from anywhere while ~ has an? (-1\/-1|\+1\/\+1) counter on it$/, m => [{ on: 'toGraveBatch', you: true, evCond: { c: 'hasCounter', kind: m[1] } }]],
  [/^you attack$/, () => [{ on: 'attackWith' }]],
  [/^~ enters or attacks$/, () => [{ on: 'enters', who: 'self' }, { on: 'attacks', who: 'self' }]],
  [/^a creature you control or a creature spell you control becomes the target of a spell or ability an opponent controls$/, () => [{ on: 'targeted', ownCreature: true, byOpp: true }]],
  [/^you commit a crime$/, () => [{ on: 'crime', you: true }]],                                                         // CR 700.13
  [/^~ attacks while you control (a creature with power \d+ or greater)$/, m => [{ on: 'attacks', who: 'self', evCond: { c: 'control', f: parseFilter(m[1].replace(/^a /, '')), n: 1 } }]],
  [/^an opponent casts a spell with mana value of the chosen quality$/, () => [{ on: 'cast', spell: null, anyPlayer: true, oppOnly: true, chosenParity: true }]],
  [/^an opponent searches their library$/, () => [{ on: 'search', opp: true }]],
  [/^an opponent draws a card$/, () => [{ on: 'drawCard', opp: true }]],
  [/^an opponent draws their second card each turn$/, () => [{ on: 'drawCard', opp: true, nth: 2 }]],
  [/^the beginning of each end step$/, () => [{ on: 'beginStep', step: 'end' }]],
  [/^(a creature you control) deals combat damage to a player$/, m => [{ on: 'dealsDamage', who: parseFilter(m[1].replace(/^a /, '')), combat: true, toPlayer: true }]],
  [/^one or more (other creatures you control with power \d+ or less) enter$/, m => [{ on: 'enters', who: parseFilter(singular(m[1].replace(/^other /, 'other '))) }]],
  [/^~ or (another creature you control .+) enters$/, m => { const f = parseFilter(m[1]), q = {}; for (const k in f) if (!['other', 'types', 'ctrl', 'subtypes'].includes(k)) q[k] = f[k]; return [{ on: 'enters', who: { or: [Object.keys(q).length ? { self: q } : 'self', f] } }]; }],
  [/^(another creature you control.*) enters$/, m => [{ on: 'enters', who: parseFilter(m[1]) }]],
  [/^~ attacks for the first time each turn$/, () => [{ on: 'attacks', who: 'self', firstEachTurn: true }]],
  [/^~ attacks$/, () => [{ on: 'attacks', who: 'self' }]],
  [/^~ attacks the player with the most life or tied for most life$/, () => [{ on: 'attacks', who: 'self', defMostLife: true }]],
  [/^~ attacks while you have the most life or are tied for most life$/, () => [{ on: 'attacks', who: 'self', youMostLife: true }]],
  [/^the beginning of your end step$/, () => [{ on: 'beginStep', step: 'end', yours: true }]],                         // CR 513.1
  [/^you unlock this door$/, () => [{ on: 'unlock', who: 'self', door: true }]],                                        // CR 709.5h
  [/^~ deals combat damage to a player$/, () => [{ on: 'dealsDamage', combat: true, toPlayer: true }]],
  [/^the beginning of your upkeep$/, () => [{ on: 'beginStep', step: 'upkeep', yours: true }]],                       // CR 503.1a
  [/^(a creature you control.*) attacks$/, m => [{ on: 'attacks', who: parseFilter(m[1].replace(/^a /, '')) }]],
  [/^an? ((?:creature|token|land) you control.*) enters$/, m => [{ on: 'enters', who: parseFilter(m[1]) }]],
  [/^the (first|second|third|fourth|fifth) ([a-z]+) counter is put on ~$/, m => [{ on: 'counterPut', who: 'self', ctrKind: m[2], nth: { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 }[m[1]] }]],
  [/^you cast a noncreature spell$/, () => [{ on: 'cast', spell: { notTypes: ['Creature'] } }]],
  [/^you cast an instant or sorcery spell$/, () => [{ on: 'cast', spell: { types: ['Instant', 'Sorcery'] } }]],
  [/^you cast your second spell each turn$/, () => [{ on: 'cast', spell: null, nth: 2 }]],                                  // flurry (an ability word, CR 207.2c)
  [/^~ becomes level (\d)$/, m => [{ on: 'levelUp', who: 'self', level: +m[1] }]],                                       // CR 716.2a
  [/^you cast a spell$/, () => [{ on: 'cast', spell: null }]],
  [/^~ deals damage$/, () => [{ on: 'dealsDamage' }]],
  [/^~ deals damage to an opponent$/, () => [{ on: 'dealsDamage', toOpp: true }]],
  [/^a player casts a noncreature spell$/, () => [{ on: 'cast', spell: { notTypes: ['Creature'] }, anyPlayer: true }]],
  [/^the beginning of combat on your turn$/, () => [{ on: 'beginStep', step: 'boc', yours: true }]],                  // CR 507.1
  [/^~ becomes the target of a spell or ability you control for the first time each turn$/, () => [{ on: 'targeted', who: 'self', byYou: true, firstEachTurn: true }]],
  [/^~ dies$/, () => [{ on: 'dies', who: 'self', lookBack: true }]],                                                     // CR 603.10a
  [/^you attack with one or more (\w+?)s$/, m => [{ on: 'attackWith', sub: m[1] }]],                                    // CR 508.3c
  [/^~ is dealt damage$/, () => [{ on: 'dealtDamage', who: 'self' }]],
];
// Ability words have no rules meaning (CR 207.2c): "Valiant — Whenever ..." is read as "Whenever ...".
const ABILITY_WORDS = ['adamant', 'addendum', 'alliance', 'battalion', 'bloodrush', 'celebration', 'channel', 'chroma', 'cohort', 'constellation', 'converge', 'coven', 'delirium', 'descend 4', 'descend 8', 'disappear', 'domain', 'eerie', 'eminence', 'enrage', 'fateful hour', 'fathomless descent', 'ferocious', 'flurry', 'formidable', 'grandeur', 'hellbent', 'heroic', 'imprint', 'infusion', 'inspired', 'kinship', 'landfall', 'lieutenant', 'magecraft', 'metalcraft', 'morbid', 'opus', 'pack tactics', 'paradox', 'parley', 'radiance', 'raid', 'rally', 'renew', 'repartee', 'revolt', 'spell mastery', 'strive', 'survival', 'sweep', 'threshold', 'undergrowth', 'valiant', 'vivid', 'void'];
const AW_RE = new RegExp('^(' + ABILITY_WORDS.map(w => w.replace(/ /g, ' ')).join('|') + ') — (.+)$', 'i');
function parseTrigger(line, ctx, out) {
  const m0 = line.match(/^(When|Whenever|At) (.+)$/); if (!m0) return false;
  const rest = m0[2];
  // Find the event: the longest prefix ending before ", " that an event pattern accepts.
  const commas = []; for (let i = rest.indexOf(', '); i >= 0; i = rest.indexOf(', ', i + 1)) commas.push(i);
  for (const ci of commas) {
    const ev = rest.slice(0, ci), body = rest.slice(ci + 2);
    for (const [re, mk] of EVENTS) {
      const m = ev.match(re); if (!m) continue;
      const trigs = mk(m);
      let cond = null, eff = body, oncePerTurn = false;
      if (/\. This ability triggers only once each turn\.?$/.test(eff)) { oncePerTurn = true; eff = eff.replace(/\. This ability triggers only once each turn\.?$/, ''); }
      if (/^if /.test(body)) {                                                                     // CR 603.4: an intervening "if" — the shortest clause that parses as a condition
        for (let i = body.indexOf(', '); i >= 0 && !cond; i = body.indexOf(', ', i + 1)) { try { cond = parseCond(body.slice(3, i), ctx); eff = body.slice(i + 2); } catch (e) { if (!(e instanceof Fail)) throw e; } }
        if (!cond) throw new Fail('intervening if: ' + body);
      }
      for (const tr of trigs) {
        const T = []; const c2 = Object.assign({}, ctx, { it: tr.who && tr.who !== 'self' ? 'ev' : tr.who === 'self' ? 'self' : null });
        if (tr.on === 'cast') { c2.spellEv = true; if (tr.anyPlayer) c2.evPlayer = true; }
        if (tr.on === 'dealsDamage') { c2.evAmount = true; if (tr.toPlayer) c2.evPlayer = true; }
        if (tr.on === 'drawCard' && tr.opp) c2.evPlayer = true;
        if (tr.on === 'discardBatch') c2.evAmount = true;
        if (tr.door) { if (ctx.door == null) throw new Fail('"unlock this door" on a card that is not a Room'); tr.door = ctx.door; }
        const ops = parseEffects(T, c2, cap(eff.replace(/^this creature\b/, '~')));
        const extra = {}; for (const k of ['anyPlayer', 'step', 'yours', 'byYou', 'firstEachTurn', 'sub', 'defMostLife', 'youMostLife', 'door', 'combat', 'toPlayer', 'nth', 'level', 'ctrKind', 'you', 'opp', 'evCond', 'oppOnly', 'chosenParity', 'ownCreature', 'byOpp']) if (tr[k] != null) extra[k] = tr[k];
        out.push(Object.assign({ k: 'trig', on: tr.on, ops: ops }, tr.who ? { who: tr.who } : {}, tr.spell !== undefined ? { spell: tr.spell } : {}, tr.toOpp ? { toOpp: true } : {}, tr.lookBack ? { lookBack: true } : {}, T.length ? { tg: T } : {}, cond ? { cond: cond } : {}, oncePerTurn ? { oncePerTurn: true } : {}, JSON.stringify(ops).includes('selfFromGrave') ? { zone: 'grave' } : {}, extra));   // CR 113.6m: returns this card from the graveyard, so it functions there
      }
      return true;
    }
  }
  throw new Fail('trigger event: ' + rest);
}
function parseStatic(line, ctx, out, d) {
  let m;
  if (line === '~ enters tapped.') { out.push({ k: 'etbTapped' }); return true; }
  if ((m = line.match(/^~ enters tapped unless (.+)\.$/))) { out.push({ k: 'etbTapped', unless: parseCond(m[1], ctx) }); return true; }   // CR 614.1c
  if ((m = line.match(/^As ~ enters, you may pay (\d+) life\. If you don't, it enters tapped\.$/))) { out.push({ k: 'etbPayOrTap', life: +m[1] }); return true; }   // CR 614.12a: a choice made as it enters
  if ((m = line.match(/^~ can't attack or block unless (.+)\.$/))) { out.push({ k: 'restrict', attack: true, block: true, unless: parseCond(m[1], ctx) }); return true; }   // CR 508.1c, 509.1b
  if (line === "~ can't block.") { out.push({ k: 'restrict', block: true }); return true; }
  if (line === "~ can't attack.") { out.push({ k: 'restrict', attack: true }); return true; }
  if ((m = line.match(/^~ gets an additional (\S+) as long as (.+)\.$/))) { const pt = pumpOf(m[1]); out.push({ k: 'static', affects: 'self', p: pt.p, t: pt.t, cond: parseCond(m[2], ctx) }); return true; }
  if (line === 'If an opponent would lose life during your turn, they lose twice that much life instead.') { out.push({ k: 'lifeLossDouble' }); return true; }   // CR 614.1a
  if ((m = line.match(/^~ gets (\S+?)(?: and has (.+?))? as long as (.+)\.$/))) { const pt = pumpOf(m[1]); out.push(Object.assign({ k: 'static', affects: 'self', p: pt.p, t: pt.t, cond: parseCond(m[3], ctx) }, m[2] ? { grant: kwList(m[2]) } : {})); return true; }
  if ((m = line.match(/^As long as (.+?), ~ gets (\S+?)(?: and has (.+))?\.$/))) { const pt = pumpOf(m[2]); out.push(Object.assign({ k: 'static', affects: 'self', p: pt.p, t: pt.t, cond: parseCond(m[1], ctx) }, m[3] ? { grant: kwList(m[3]) } : {})); return true; }
  if ((m = line.match(/^Enchant (creature|creature you control)\.?$/))) { out.push({ k: 'enchant', f: parseFilter(m[1]) }); return true; }
  if ((m = line.match(/^Enchanted creature doesn't untap during its controller's untap step\.$/))) { out.push({ k: 'noUntap', affects: 'enchanted' }); return true; }
  if ((m = line.match(/^(Enchanted|Equipped) creature gets (\S+?)(?: and has (.+))?\.$/))) {
    const pt = pumpOf(m[2]); out.push(Object.assign({ k: 'static', affects: m[1].toLowerCase(), p: pt.p, t: pt.t }, m[3] ? { grant: kwList(m[3]) } : {})); return true;
  }
  if ((m = line.match(/^During your turn, as long as ~ has one or more loyalty counters on (?:him|her|it), (?:he|she|it)'s an? (\d+)\/(\d+) (\w+) creature and has (.+)\.$/))) {   // Kaito: layers 4, 6, 7b
    out.push({ k: 'static', affects: 'self', cond: { c: 'all', of: [{ c: 'yourTurn' }, { c: 'hasCounter', kind: 'loyalty' }] }, setTypes: { types: ['Creature'], subtypes: [m[3]] }, setPT: [+m[1], +m[2]], grant: kwList(m[4]) }); return true;
  }
  if ((m = line.match(/^~ can't be blocked by creatures with power (\d+) or greater\.$/))) { out.push({ k: 'evasion', blockerNot: { powGE: +m[1] } }); return true; }   // CR 509.1b
  if ((m = line.match(/^~ has (.+) as long as (.+)\.$/))) { out.push({ k: 'static', affects: 'self', p: 0, t: 0, grant: kwList(m[1]), cond: parseCond(m[2], ctx) }); return true; }
  if ((m = line.match(/^~ enters with (\w+) (-1\/-1|\+1\/\+1) counters on it\.$/))) { out.push({ k: 'etbCounters', n: numOf(m[1]), kind: m[2] }); return true; }   // CR 614.1c
  if (line === 'If a creature an opponent controls would die, exile it instead.') { out.push({ k: 'oppDieExile' }); return true; }   // CR 614.1a
  if ((m = line.match(/^([A-Z][a-z]+s you control) get (\S+) and have (.+)\.$/)) && !/^Creatures/.test(m[1])) { const pt = pumpOf(m[2]); out.push({ k: 'static', affects: Object.assign(parseFilter(m[1].replace(/ you control$/, '')), { ctrl: 'you' }), p: pt.p, t: pt.t, grant: kwList(m[3]) }); return true; }
  if ((m = line.match(/^Equipped creature gets (\S+) and is an? (\w+) in addition to its other types\.$/))) { const pt = pumpOf(m[1]); out.push({ k: 'static', affects: 'equipped', p: pt.p, t: pt.t, addSubtypes: [m[2]] }); return true; }   // layer 4 and 7c
  if (line === 'You may play an additional land on each of your turns.') { out.push({ k: 'extraLand', n: 1 }); return true; }   // CR 305.2
  if (line === 'You may play lands from your graveyard.') { out.push({ k: 'landsFromGrave' }); return true; }
  if (line === "This spell can't be countered.") { out.push({ k: 'uncounterable' }); return true; }        // CR 113.6g
  if ((m = line.match(/^Affinity for (\w+)s$/))) { out.push({ k: 'affinity', f: { subtypes: [m[1]] } }); return true; }   // CR 702.41a
  if ((m = line.match(/^~'s power is equal to the number of lands you control\.$/))) { out.push({ k: 'cda', p: true, t: false, v: { v: 'lands' } }); return true; }   // CR 604.3
  if ((m = line.match(/^Enchanted creature gets (\S+) and can't be blocked by more than one creature\.$/))) { const pt = pumpOf(m[1]); out.push({ k: 'static', affects: 'enchanted', p: pt.p, t: pt.t, grantAb: [{ k: 'maxBlockers', n: 1 }] }); return true; }   // CR 509.1b
  if (line === 'As ~ enters, choose odd or even.') { out.push({ k: 'enterChoice', what: 'oddEven' }); return true; }   // CR 614.12a
  if ((m = line.match(/^([A-Z][a-z]+s you control) get (\S+)\.$/)) && !/^Creatures/.test(m[1])) { const pt = pumpOf(m[2]); out.push({ k: 'static', affects: Object.assign(parseFilter(m[1].replace(/ you control$/, '')), { ctrl: 'you' }), p: pt.p, t: pt.t }); return true; }   // "Ninjas you control get +1/+1"
  if ((m = line.match(/^(Other creatures you control|Creatures you control) get (\S+)\.$/))) { const pt = pumpOf(m[2]); out.push({ k: 'static', affects: parseFilter(m[1].toLowerCase()), p: pt.p, t: pt.t }); return true; }
  if ((m = line.match(/^As long as (.+?), ~ has (.+)\.$/))) { out.push({ k: 'static', affects: 'self', p: 0, t: 0, grant: kwList(m[2]), cond: parseCond(m[1], ctx) }); return true; }
  if (line === "Your opponents can't cast spells during your turn.") { out.push({ k: 'oppNoCast' }); return true; }   // CR 601.3
  if ((m = line.match(/^(Other creatures you control|Creatures you control) have (.+)\.$/))) { out.push({ k: 'static', affects: parseFilter(m[1].toLowerCase()), grant: kwList(m[2]) }); return true; }
  if ((m = line.match(/^As long as (.+?), (.+)\.$/))) {
    const cond = parseCond(m[1], ctx), body = m[2]; let b;
    if ((b = body.match(/^(?:~|it) gets (\S+) and has (.+)$/))) { const pt = pumpOf(b[1]); out.push({ k: 'static', affects: 'self', p: pt.p, t: pt.t, grant: kwList(b[2]), cond: cond }); return true; }
    if ((b = body.match(/^creatures you control get (\S+)$/))) { const pt = pumpOf(b[1]); out.push({ k: 'static', affects: parseFilter('creatures you control'), p: pt.p, t: pt.t, cond: cond }); return true; }
    throw new Fail('static body: ' + body);
  }
  if ((m = line.match(/^~'s power and toughness are each equal to (.+)\.$/))) { out.push({ k: 'cda', p: true, t: true, v: parseValueWhere(m[1]) }); return true; }   // CR 604.3
  if ((m = line.match(/^This spell costs \{(\d+)\} less to cast if (.+)\.$/))) { out.push({ k: 'costLess', n: +m[1], cond: parseCond(m[2], ctx) }); return true; }
  if ((m = line.match(/^Instant and sorcery spells you cast cost \{(\d+)\} less to cast\.$/))) { out.push({ k: 'costLessFor', n: +m[1], spell: { types: ['Instant', 'Sorcery'] } }); return true; }
  if ((m = line.match(/^You may have ~ enter as a copy of any creature on the battlefield with mana value less than or equal to the amount of mana spent to cast ~, except it's a (\w+) in addition to its other types and it has (\w+)\.$/))) {
    out.push({ k: 'enterAsCopy', except: { addSubtypes: [m[1]], kw: kwList(m[2]) } }); return true;
  }
  return false;
}
function parseLine(line, ctx, d, kw, ab) {
  let m;
  if ((m = line.match(AW_RE))) line = m[2];                                                         // CR 207.2c
  if ((m = line.match(/^[A-Z][\w']+(?: [A-Za-z']+)* — ((?:When|Whenever|At) .+)$/))) line = m[1];      // a flavour word (CR 207.2d): no rules meaning
  if ((m = line.match(/^\[([+−-]?\d+)\]: (.+)$/))) {                                                // CR 606: a loyalty ability
    const n = +m[1].replace('−', '-'), T = [];
    const ops = parseEffects(T, Object.assign({}, ctx, { it: null }), m[2]);
    ab.push(Object.assign({ k: 'act', loyalty: n, sorcery: true, cost: { mana: '', tap: false, sacSelf: false }, ops: ops }, T.length ? { tg: T } : {}));
    return;
  }
  if ((m = line.match(/^Ninjutsu (\{[^ ]+\})$/))) { ab.push({ k: 'act', zone: 'hand', ninjutsu: true, cost: { mana: m[1], tap: false, sacSelf: false, returnUnblocked: true }, ops: [{ o: 'ninjutsuEnter' }] }); return; }   // CR 702.49a
  // A keyword line: "Flying", "Reach, vigilance", "Offspring {2}", "Equip {3}", "Kicker {4}".
  const parts = line.replace(/\.$/, '').split(/, /);
  const HEXFROM = /^hexproof from (instants|sorceries|creatures|artifacts|enchantments)$/i, PLURAL_TYPE = { instants: 'Instant', sorceries: 'Sorcery', creatures: 'Creature', artifacts: 'Artifact', enchantments: 'Enchantment' };
  if (parts.every(p => KW[p.toLowerCase()] || HEXFROM.test(p))) {
    for (const p of parts) { const h = p.match(HEXFROM); if (h) ab.push({ k: 'hexproofFrom', types: [PLURAL_TYPE[h[1].toLowerCase()]] }); else kw[KW[p.toLowerCase()]] = (kw[KW[p.toLowerCase()]] || 0) + 1; }   // CR 702.11d
    return;
  }
  if ((m = line.match(/^Cycling (\{[^ ]+\})$/))) { ab.push({ k: 'act', zone: 'hand', cycling: true, cost: { mana: m[1], tap: false, sacSelf: false, discardSelf: true }, ops: [{ o: 'draw', n: 1 }] }); return; }   // CR 702.29a
  if ((m = line.match(/^Gift a card$/))) { ab.push({ k: 'gift', what: 'card' }); return; }
  if (line === 'Gift a tapped Fish') { ab.push({ k: 'gift', what: 'tappedFish', token: ctx.token({ p: 1, t: 1, color: 'blue', sub: 'Fish' }) }); return; }   // CR 702.174f
  if ((m = line.match(/^Mobilize (\d+)$/))) {                                                     // CR 702.181a
    const id = ctx.token({ p: 1, t: 1, color: 'red', sub: 'Warrior', kw: [] });
    ab.push({ k: 'trig', on: 'attacks', who: 'self', mobilize: +m[1], ops: [{ o: 'token', id: id, n: +m[1], tapped: true, attacking: true, sacEnd: true }] });
    return;
  }
  if (line === 'Ward—Discard a card.') { ab.push({ k: 'trig', on: 'targeted', who: 'self', byOpp: true, ward: true, ops: [{ o: 'wardCounter', discard: 1 }] }); return; }   // CR 702.21a
  if (line === 'Job select') {                                                                        // CR 702.182a
    const id = ctx.token({ p: 1, t: 1, color: 'colorless', sub: 'Hero', kw: [] });
    ab.push({ k: 'trig', on: 'enters', who: 'self', jobSelect: true, ops: [{ o: 'token', id: id, n: 1 }, { o: 'attach', on: 'it' }] }); return;
  }
  if ((m = line.match(/^(?:[A-Z][\w']+ — )?Equip—Pay (\d+) life\. Activate only once each turn\.$/))) { ab.push({ k: 'act', cost: { mana: '', tap: false, sacSelf: false, life: +m[1] }, sorcery: true, oncePerTurn: true, tg: [{ f: { types: ['Creature'], ctrl: 'you' } }], ops: [{ o: 'attach', on: { t: 0 } }], equip: true }); return; }   // CR 702.6a
  if ((m = line.match(/^Ward(?:—Pay (\d+) life| (\{[^ ]+\}))\.?$/))) { ab.push({ k: 'trig', on: 'targeted', who: 'self', byOpp: true, ward: true, ops: [{ o: 'wardCounter', life: m[1] ? +m[1] : null, mana: m[2] || null }] }); return; }   // CR 702.21a
  if ((m = line.match(/^Warp (\{[^ ]+\})$/))) { ab.push({ k: 'warp', cost: m[1] }); return; }        // CR 702.185a
  if ((m = line.match(/^To solve — (.+)\.$/))) { ab.push({ k: 'trig', on: 'beginStep', step: 'end', yours: true, cond: { c: 'all', of: [parseCond(m[1].replace(/^You/, 'you'), ctx), { c: 'notSolved' }] }, solveTrig: true, ops: [{ o: 'solve' }] }); return; }   // CR 719.3a
  if ((m = line.match(/^Solved — (.+)$/))) { const n0 = ab.length; parseLine(m[1], ctx, d, kw, ab); for (let k = n0; k < ab.length; k++) ab[k].solved = true; return; }   // CR 719.3c
  if ((m = line.match(/^Crew (\d+)$/))) { ab.push({ k: 'act', crew: +m[1], cost: { mana: '', tap: false, sacSelf: false, crew: +m[1] }, ops: [{ o: 'becomeCreature' }] }); return; }   // CR 702.122a
  if ((m = line.match(/^(I|II|III|IV|V) — (.+)$/))) { const n = ['I', 'II', 'III', 'IV', 'V'].indexOf(m[1]) + 1, T = []; const ops = parseEffects(T, Object.assign({}, ctx, { it: 'self' }), m[2]); ab.push(Object.assign({ k: 'trig', on: 'lore', who: 'self', chapter: n, ops: ops }, T.length ? { tg: T } : {})); return; }   // CR 714.2b
  if ((m = line.match(/^Flashback (\{[^ ]+\})$/))) { ab.push({ k: 'flashback', cost: m[1] }); return; }   // CR 702.34a
  if ((m = line.match(/^Mayhem (\{[^ ]+\})$/))) { ab.push({ k: 'mayhem', cost: m[1] }); return; }          // CR 702.187b
  if ((m = line.match(/^Sneak (\{[^ ]+\})$/))) { ab.push({ k: 'sneak', cost: m[1] }); return; }   // CR 702.190a
  if ((m = line.match(/^As an additional cost to cast this spell, you may blight (\d+)\.$/))) { ab.push({ k: 'addCost', what: 'blight', n: +m[1], optional: true }); return; }   // CR 701.68a
  if ((m = line.match(/^As an additional cost to cast this spell, discard a card or pay (\d+) life\.$/))) { ab.push({ k: 'addCost', what: 'discardOrLife', life: +m[1] }); return; }
  if ((m = line.match(/^Teamwork (\d+)$/))) { ab.push({ k: 'addCost', what: 'teamwork', n: +m[1], optional: true }); return; }   // CR 702.194a
  if (line === 'Bargain') { ab.push({ k: 'bargain' }); return; }                                   // CR 702.166a
  if ((m = line.match(/^Harmonize (\{[^ ]+\})$/))) { ab.push({ k: 'harmonize', cost: m[1] }); return; }   // CR 702.180a       // CR 702.174a, e
  if ((m = line.match(/^Kicker (\{[^ ]+\})$/))) { ab.push({ k: 'kicker', cost: m[1] }); return; }      // CR 702.33a
  if ((m = line.match(/^Offspring (\{[^ ]+\})$/))) {                                              // CR 702.175a
    ab.push({ k: 'offspring', cost: m[1] });
    ab.push({ k: 'trig', on: 'enters', who: 'self', cond: { c: 'offspringPaid' }, ops: [{ o: 'tokenCopy', of: 'self', except: { pt: [1, 1] } }] });
    return;
  }
  if ((m = line.match(/^Equip (\{[^ ]+\})$/))) {                                                  // CR 702.6a
    ab.push({ k: 'act', cost: { mana: m[1], tap: false, sacSelf: false }, sorcery: true, tg: [{ f: { types: ['Creature'], ctrl: 'you' } }], ops: [{ o: 'attach', on: { t: 0 } }], equip: true });
    return;
  }
  if ((m = line.match(/^(As long as .+?\.) (~ gets an additional .+\.)$/))) { parseLine(m[1], ctx, d, kw, ab); parseLine(m[2], ctx, d, kw, ab); return; }   // Elenda: two statics in one paragraph
  if (parseStatic(line, ctx, ab, d)) return;
  if (parseTrigger(line, ctx, ab)) return;
  if ((m = line.match(/^([^:]+): (.+)$/)) && /\{|Sacrifice|^Remove |^Discard a card$|^Pay \d+ life$|Exile ~/.test(m[1])) {                          // CR 602.1
    const cost = parseCost(m[1]);
    let mm, body = m[2];
    if ((mm = body.match(/^Add \{([WUBRGC])\}(?: or \{([WUBRGC])\})?\.$/))) { ab.push({ k: 'mana', cost: cost, cols: [mm[1]].concat(mm[2] ? [mm[2]] : []) }); return; }   // CR 605.1a
    if ((mm = body.match(/^Add \{([WUBRGC])\}\. Spend this mana only to cast a creature spell\.$/))) { ab.push({ k: 'mana', cost: cost, cols: [mm[1]], only: 'creature' }); return; }   // CR 106.6
    if ((mm = body.match(/^Add \{([WUBRGC])\}(?: or \{([WUBRGC])\})?\. Activate only if (.+)\.$/))) { ab.push({ k: 'mana', cost: cost, cols: [mm[1]].concat(mm[2] ? [mm[2]] : []), cond: parseCond(mm[3], ctx) }); return; }   // the Verges (CR 602.5b)
    if ((mm = body.match(/^Add \{([WUBRGC])\} or \{([WUBRGC])\}\. ~ deals (\d+) damage to you\.$/))) { ab.push({ k: 'mana', cost: cost, cols: [mm[1], mm[2]], selfDamage: +mm[3] }); return; }   // pain lands: the damage is part of the effect
    // Vivi Ornitier: X mana in any combination of two colours (CR 106.1a); X is read as it is activated.
    if ((mm = body.match(/^Add X mana in any combination of \{([WUBRG])\} and\/or \{([WUBRG])\}, where X is ~'s power\. Activate only during your turn and only once each turn\.$/))) { ab.push({ k: 'mana', cost: cost, cols: [mm[1], mm[2]], combo: true, amount: { v: 'power', of: 'self' }, cond: { c: 'yourTurn' }, oncePerTurn: true }); return; }
    if (body === 'Add one mana of any color.') { ab.push({ k: 'mana', cost: cost, cols: ['W', 'U', 'B', 'R', 'G'] }); return; }
    // Activation restrictions (CR 602.5): "Activate only as a sorcery.", "... only once each turn.", "Activate only if <cond>."
    const act = { k: 'act', cost: cost };
    for (;;) {
      if ((mm = body.match(/^(.+?)\s*Activate only as a sorcery\.$/))) { act.sorcery = true; body = mm[1]; continue; }
      if ((mm = body.match(/^(.+?)\s*Activate only once each turn\.$/))) { act.oncePerTurn = true; body = mm[1]; continue; }
      if ((mm = body.match(/^(.+?)\s*Activate only if (.+?) and only once each turn\.$/))) { act.cond = parseCond(mm[2], ctx); act.oncePerTurn = true; body = mm[1]; continue; }
      if ((mm = body.match(/^(.+?)\s*Activate only if (.+?)\.$/))) { act.cond = parseCond(mm[2], ctx); body = mm[1]; continue; }
      break;
    }
    const T = []; const ops = parseEffects(T, Object.assign({}, ctx, { it: null }), body);
    ab.push(Object.assign(act, { ops: ops }, T.length ? { tg: T } : {}));
    return;
  }
  if ((d.types.includes('Instant') || d.types.includes('Sorcery')) && (m = line.match(/^(.+)\. If the gift was promised, instead (.+)\.$/)) && !ab.some(a => a.k === 'spell')) {
    const T1 = [], T2 = [];
    const ops1 = parseEffects(T1, Object.assign({}, ctx, { it: null }), m[1]), ops2 = parseEffects(T2, Object.assign({}, ctx, { it: null }), cap(m[2]));
    ab.push(Object.assign({ k: 'spell', ops: ops1 }, T1.length ? { tg: T1 } : {}, { gift: Object.assign({ ops: ops2 }, T2.length ? { tg: T2 } : {}) }));
    return;
  }
  if (d.types.includes('Instant') || d.types.includes('Sorcery')) {
    // A later paragraph of the same spell (a delirium rider) may say "that creature" about an earlier target.
    const sp = ab.find(a => a.k === 'spell');
    const T = sp && sp.tg ? sp.tg.slice() : [], n0 = T.length;
    const c2 = Object.assign({}, ctx, { it: ctx.spellIt || null });
    const ops = parseEffects(T, c2, line);
    ctx.spellIt = c2.it;
    if (sp) { if (sp.modes) throw new Fail('a paragraph after a modal spell\'s modes'); sp.ops.push.apply(sp.ops, ops); if (T.length > n0) sp.tg = T; }   // later paragraphs' targets follow in order (CR 601.2c)
    else ab.push(Object.assign({ k: 'spell', ops: ops }, T.length ? { tg: T } : {}));
    return;
  }
  throw new Fail('ability: ' + line);
}

// ---------------------------------------------------------------------------------------------
// A card
// ---------------------------------------------------------------------------------------------
const BASIC_MANA = { Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G' };
export function normalize(text, name) {
  const short = name.includes(',') ? name.split(',')[0] : null;
  let t = text.replace(/\s*\([^)]*\)/g, '');                                                       // reminder text is display-only (CLAUDE.md regime 3)
  t = t.split(name).join('~'); if (short) t = t.replace(new RegExp('\\b' + short + '\\b(?!,)', 'g'), '~');
  t = t.replace(/\b[Tt]his (creature|artifact|land|Aura|enchantment|permanent|Equipment|Class|Case|Vehicle|Saga)\b/g, '~');
  return t.split('\n').map(l => l.trim()).filter(Boolean);
}
// `alt`: the other face of an Adventure or Omen card (CR 715, 720), compiled as its own set of
// characteristics the card has only while it is on the stack as that spell.
// A Room (CR 709.5): two doors under one shared type line, each compiled as its own face; every
// ability is tagged with its door, and exists on the battlefield only while that door is unlocked.
function compileRoom(c, b, tokens) {
  const full = c.faceName + ' // ' + b.faceName;
  const doors = [c, b].map((f, i) => compileCard(Object.assign({}, f, { name: f.faceName, layout: 'normal', faceName: null }), tokens, null, { door: i }));
  const d = { id: slug(full), name: full, mana: doors.map(x => x.mana).join(' // '), colors: [...new Set(doors.flatMap(x => x.colors))], types: c.types || [], subtypes: c.subtypes || [], supers: c.supertypes || [],
    power: null, toughness: null, typeLine: c.type, text: doors.map(x => x.text).join('\n'), kw: {}, ab: [], layout: 'room' };
  d.doors = doors.map(x => ({ name: x.name, mana: x.mana, colors: x.colors, types: x.types, subtypes: x.subtypes, supers: x.supers, typeLine: x.typeLine, text: x.text, kw: x.kw, ab: x.ab, kind: 'door' }));
  const bad = doors.find(x => x.un);
  if (bad) { d.un = bad.name + ': ' + bad.un; d.doors.forEach(x => { x.ab = []; }); return d; }
  if (doors.some(x => Object.keys(x.kw).length)) { d.un = 'a keyword on a Room door'; return d; }
  d.ab = doors.flatMap((x, i) => x.ab.map(a => Object.assign({ door: i }, a)));
  return d;
}
export function compileCard(c, tokens, alt, room) {
  if (c.layout === 'split' && alt && (c.subtypes || []).includes('Room')) return compileRoom(c, alt, tokens);
  const faceName = c.faceName || c.name;
  const d = {
    id: slug(c.name), name: c.name, mana: c.manaCost || '', colors: c.colors || [], types: c.types || [], subtypes: c.subtypes || [], supers: c.supertypes || [],
    power: c.power != null ? (c.power === '*' ? '*' : +c.power) : null, toughness: c.toughness != null ? (c.toughness === '*' ? '*' : +c.toughness) : null,
    typeLine: c.type, text: c.text || '', kw: {}, ab: [], layout: c.layout,
  };
  if (c.loyalty != null) d.loyalty = +c.loyalty;                                                 // CR 306.5a
  if (alt) d.name = faceName;
  const twoPart = c.layout === 'adventure' && alt;
  if (c.layout === 'transform' && alt) {                                                          // CR 712: front face everywhere but a transformed permanent
    const front = compileCard(Object.assign({}, c, { name: faceName, layout: 'normal' }), tokens), back = compileCard(Object.assign({}, alt, { name: alt.faceName, layout: 'normal', manaCost: '' }), tokens);
    const dd = Object.assign(front, { id: slug(c.name), layout: 'transform' });
    dd.back = { name: back.name, colors: alt.colorIndicator || back.colors, types: back.types, subtypes: back.subtypes, supers: back.supers, power: back.power, toughness: back.toughness, typeLine: back.typeLine, text: back.text, kw: back.kw, ab: back.ab };
    if (back.un && !dd.un) dd.un = alt.faceName + ': ' + back.un;
    if (dd.un) { dd.ab = []; dd.kw = {}; dd.back.ab = []; }
    return dd;
  }
  if (c.layout !== 'normal' && c.layout !== 'class' && c.layout !== 'case' && !twoPart) { d.un = 'layout ' + c.layout + ' is not compiled'; return d; }
  const ctx = { token: tokens, name: faceName, door: room ? room.door : null };
  try {
    for (const st of d.subtypes) if (BASIC_MANA[st]) d.ab.push({ k: 'mana', cost: { tap: true }, cols: [BASIC_MANA[st]] });   // CR 305.6: intrinsic
    const lines = normalize(d.text, faceName);
    for (let i = 0; i < lines.length; i++) {
      // A modal spell: "Choose one —" then bullet lines, one mode each (CR 700.2).
      const mm = lines[i].match(/^Choose (one|two|one or both) —$/);
      if (mm && (d.types.includes('Instant') || d.types.includes('Sorcery'))) {
        if (mm[1] === 'one or both') throw new Fail('modal "choose one or both" is not compiled');
        const modes = [];
        while (i + 1 < lines.length && /^• /.test(lines[i + 1])) {
          const text = lines[++i].slice(2), T = [];
          const ops = parseEffects(T, Object.assign({}, ctx, { it: null }), text);
          modes.push(Object.assign({ text: text, ops: ops }, T.length ? { tg: T } : {}));
        }
        if (modes.length < 2) throw new Fail('modal spell with fewer than two modes');
        if (mm[1] === 'two' && modes.some(x => x.tg)) throw new Fail('"choose two" with a targeted mode');
        d.ab.push(Object.assign({ k: 'spell', modes: modes }, mm[1] === 'two' ? { choose: 2 } : {}));
        continue;
      }
      const mt = lines[i].match(/^(Whenever .+), choose one that hasn't been chosen —$/);
      if (mt) {                                                                                     // CR 700.2: a modal triggered ability; each mode once per object
        const modes = [];
        while (i + 1 < lines.length && /^• /.test(lines[i + 1])) { const text = lines[++i].slice(2), T = []; const ops = parseEffects(T, Object.assign({}, ctx, { it: 'self' }), text.replace(/Gollum/g, '~')); if (T.length) throw new Fail('a targeted mode in a modal trigger'); modes.push({ text: text, ops: ops }); }
        const tmp = []; parseTrigger(mt[1] + ', draw a card.', ctx, tmp);
        d.ab.push(Object.assign(tmp[0], { ops: [], modes: modes, uniqueModes: true }));
        continue;
      }
      // CR 716.2a: "[Cost]: Level N" — an activated ability (as a sorcery, only at level N-1); the abilities after it exist from level N.
      const lv = c.layout === 'class' && lines[i].match(/^(\{[^:]+\}): Level (\d)$/);
      if (lv) { ctx.level = +lv[2]; d.ab.push({ k: 'act', cost: { mana: lv[1], tap: false, sacSelf: false }, sorcery: true, levelUp: +lv[2], ops: [{ o: 'levelUp', n: +lv[2] }] }); continue; }
      const n0 = d.ab.length;
      parseLine(lines[i], ctx, d, d.kw, d.ab);
      if (ctx.level) for (let k = n0; k < d.ab.length; k++) d.ab[k].level = ctx.level;
    }
    if (c.layout === 'class' && !ctx.level) throw new Fail('a Class with no level bar');
  } catch (e) {
    if (!(e instanceof Fail)) throw e;
    d.un = e.fail; d.kw = {}; d.ab = [];
  }
  if (twoPart) {
    const a = compileCard(Object.assign({}, alt, { name: alt.faceName, layout: 'normal' }), tokens);
    const kind = (alt.subtypes || []).includes('Omen') ? 'omen' : (alt.subtypes || []).includes('Adventure') ? 'adventure' : null;
    if (!kind) d.un = d.un || 'two-part card whose second face is neither an Adventure nor an Omen';
    if (a.un && !d.un) d.un = alt.faceName + ': ' + a.un;
    d.alt = { kind: kind, name: a.name, mana: a.mana, colors: a.colors, types: a.types, subtypes: a.subtypes, supers: a.supers, power: null, toughness: null, typeLine: a.typeLine, text: a.text, kw: a.kw, ab: a.ab };
    if (d.un) { d.kw = {}; d.ab = []; d.alt.ab = []; }
  }
  return d;
}
const COLOR = { white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G', colorless: null };
// Role tokens (CR 111.10j-r): each is defined by the rules, so its abilities are written here from
// that rule's text. A Role this table lacks fails the card's compile.
const ROLES = {
  Monster: { text: 'Enchant creature\nEnchanted creature gets +1/+1 and has trample.', ab: [{ k: 'enchant', f: { types: ['Creature'] } }, { k: 'static', affects: 'enchanted', p: 1, t: 1, grant: ['trample'] }] },   // CR 111.10k
};
function tokenMaker(pack) {
  const mk = function (t) {
    const kws = t.kw || [];
    const cols = t.color.split(' and ').map(c => COLOR[c]).filter(Boolean);
    const id = 'token-' + t.sub.trim().toLowerCase().replace(/ /g, '-') + '-' + t.p + '-' + t.t + '-' + (cols.join('') || 'c').toLowerCase() + kws.map(k => '-' + k.toLowerCase()).join('');
    const KWTEXT = { flying: 'Flying', lifelink: 'Lifelink', haste: 'Haste', vigilance: 'Vigilance', trample: 'Trample', deathtouch: 'Deathtouch', menace: 'Menace', reach: 'Reach', prowess: 'Prowess' };
    if (t.ab) { const id2 = id + '-' + t.abText.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, ''); if (!pack[id2]) pack[id2] = { id: id2, name: t.sub.trim(), token: true, mana: '', colors: cols, types: ['Creature'], subtypes: t.sub.trim().split(' '), supers: [], power: t.p, toughness: t.t, typeLine: 'Token Creature — ' + t.sub.trim(), text: t.abText, kw: {}, ab: t.ab, layout: 'token' }; return id2; }
    if (!pack[id]) pack[id] = { id: id, name: t.sub.trim(), token: true, mana: '', colors: cols, types: ['Creature'], subtypes: t.sub.trim().split(' '), supers: [], power: t.p, toughness: t.t, typeLine: 'Token Creature — ' + t.sub.trim(), text: kws.map(k => KWTEXT[k]).join(', '), kw: Object.fromEntries(kws.map(k => [k, 1])), ab: [], layout: 'token' };
    return id;
  };
  mk.map = function () {
    const id = 'token-map';
    if (!pack[id]) pack[id] = { id: id, name: 'Map', token: true, mana: '', colors: [], types: ['Artifact'], subtypes: ['Map'], supers: [], power: null, toughness: null, typeLine: 'Token Artifact — Map', text: '{1}, {T}, Sacrifice this token: Target creature you control explores. Activate only as a sorcery.', kw: {}, ab: [{ k: 'act', cost: { mana: '{1}', tap: true, sacSelf: true }, sorcery: true, tg: [{ f: { types: ['Creature'], ctrl: 'you' } }], ops: [{ o: 'explore', on: { t: 0 } }] }], layout: 'token' };
    return id;
  };
  mk.treasure = function () {                                                                     // CR 111.10a
    const id = 'token-treasure';
    if (!pack[id]) pack[id] = { id: id, name: 'Treasure', token: true, mana: '', colors: [], types: ['Artifact'], subtypes: ['Treasure'], supers: [], power: null, toughness: null, typeLine: 'Token Artifact — Treasure', text: '{T}, Sacrifice this token: Add one mana of any color.', kw: {}, ab: [{ k: 'mana', cost: { tap: true, sacSelf: true }, cols: ['W', 'U', 'B', 'R', 'G'] }], layout: 'token' };
    return id;
  };
  mk.role = function (name) {
    const r = ROLES[name]; if (!r) throw new Fail('Role token not defined: ' + name);
    const id = 'token-role-' + name.toLowerCase().replace(/ /g, '-');
    if (!pack[id]) pack[id] = { id: id, name: name + ' Role', token: true, mana: '', colors: [], types: ['Enchantment'], subtypes: ['Aura', 'Role'], supers: [], power: null, toughness: null, typeLine: 'Token Enchantment — Aura Role', text: r.text, kw: {}, ab: r.ab, layout: 'token' };
    return id;
  };
  return mk;
}

// ---------------------------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------------------------
export function build() {
  const cards = {}, decks = {}, fails = {};
  const mkToken = tokenMaker(cards);
  for (const file of CANDIDATES) {
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'scratch/data', file + '.json'), 'utf8')).data;
    const main = {};
    for (const c of raw.mainBoard) {
      const d = cards[slug(c.name)] || compileCard(c, mkToken);
      cards[d.id] = d;
      main[d.id] = (main[d.id] || 0) + c.count;
    }
    const reg = REGISTER.includes(file);
    const deck = { id: slug(raw.name), file: file, name: raw.name, product: raw.type, set: raw.code, released: raw.releaseDate, fetched: FETCHED, source: 'https://mtgjson.com/api/v5/decks/' + file + '.json', registered: reg, format: raw.type + ' (preconstructed)', min: raw.type === 'Starter Kit' ? 60 : 40, main: Object.entries(main).map(([id, n]) => ({ id: id, n: n })) };
    const un = deck.main.filter(e => cards[e.id].un);
    deck.compiles = !un.length;
    if (reg && un.length) { deck.registered = false; deck.refused = un.map(e => e.id + ': ' + cards[e.id].un); }
    for (const e of un) { const k = cards[e.id].un.replace(/[0-9]+/g, 'N'); (fails[k] = fails[k] || { decks: new Set(), cards: new Set() }).decks.add(file); fails[k].cards.add(e.id); }
    decks[file] = deck;
  }
  // Championship decks (PLAN D15): the picks of tools/fetch-championship.mjs, with Oracle text from
  // MTGJSON AtomicCards. A deck registers only when every card in its main deck compiles in full.
  const champFiles = fs.readdirSync(path.join(ROOT, 'scratch/data')).filter(f => /^championship-.+\.json$/.test(f));
  if (champFiles.length) {
    const atomic = JSON.parse(fs.readFileSync(path.join(ROOT, 'scratch/data/AtomicCards.json'), 'utf8')).data;
    const byFace = {};
    for (const k in atomic) { byFace[k] = atomic[k]; for (const f of atomic[k]) if (f.faceName && !byFace[f.faceName]) byFace[f.faceName] = atomic[k]; }
    for (const f of champFiles) {
      const ev = JSON.parse(fs.readFileSync(path.join(ROOT, 'scratch/data', f), 'utf8'));
      for (const pick of ev.picks) {
        const main = {};
        for (const e of pick.main) {
          const faces = byFace[e.name] || byFace[e.name.split(' // ')[0]];
          if (!faces) throw new Error('card not in AtomicCards: ' + e.name + ' (' + pick.archetype + ')');
          const face = faces[0], full = faces.length > 1 ? faces.map(x => x.faceName).join(' // ') : face.name;
          const id = slug(full);
          if (!cards[id]) { const c = compileCard(Object.assign({}, face, { name: full, layout: faces.length > 1 ? face.layout : (face.layout || 'normal') }), mkToken, faces.length > 1 ? faces[1] : null); c.id = id; cards[id] = c; }
          main[id] = (main[id] || 0) + e.n;
        }
        const key = 'champ-' + ev.era + '-' + slug(pick.archetype);
        const deck = { id: slug(pick.archetype) + '-' + ev.era, file: f, name: pick.archetype, product: ev.name, set: ev.era.toUpperCase(), era: ev.era, released: ev.date, fetched: ev.fetched, source: ev.sources[0], sources: ev.sources, player: pick.player, rank: pick.rank, players: pick.players, registered: true, format: 'Standard — ' + ev.name, min: 60, main: Object.entries(main).map(([id, n]) => ({ id: id, n: n })), side: pick.side };
        const un = deck.main.filter(e => cards[e.id].un);
        deck.compiles = !un.length;
        if (un.length) { deck.registered = false; deck.refused = un.map(e => e.id + ': ' + cards[e.id].un); }
        for (const e of un) { const k = cards[e.id].un.replace(/[0-9]+/g, 'N'); (fails[k] = fails[k] || { decks: new Set(), cards: new Set() }).decks.add(key); fails[k].cards.add(e.id); }
        decks[key] = deck;
      }
    }
  }
  for (const id in decks) decks[id].tokens = [...new Set(decks[id].main.flatMap(e => JSON.stringify(cards[e.id].ab).match(/token-[a-z0-9-]+/g) || []))];
  const byId = {}; for (const k in decks) { const id = decks[k].era ? decks[k].id : decks[k].id + '-' + decks[k].set.toLowerCase(); byId[id] = Object.assign(decks[k], { id: id }); }
  return { cards: cards, decks: byId, fails: fails };
}

if (process.argv[1] && process.argv[1].endsWith('build-cards.mjs')) {
  const { cards, decks, fails } = build();
  const head = '// GENERATED by tools/build-cards.mjs from MTGJSON deck files (docs/sources.md). Do not edit.\n';
  fs.writeFileSync(path.join(ROOT, 'data/cards.js'), head + 'window.MF.cards = ' + JSON.stringify(cards, null, 0).replace(/\},"/g, '},\n"') + ';\n');
  fs.writeFileSync(path.join(ROOT, 'data/decks.js'), head + 'window.MF.decks = ' + JSON.stringify(decks, null, 1) + ';\n');
  const reg = Object.values(decks).filter(d => d.registered);
  const all = Object.values(cards).filter(c => !c.token);
  console.log(`cards: ${all.length} compiled ${all.filter(c => !c.un).length}, un ${all.filter(c => c.un).length}; decks: ${Object.keys(decks).length}, compile in full ${Object.values(decks).filter(d => d.compiles).length}, registered ${reg.length} (${reg.map(d => d.name + ' ' + d.set).join(', ')})`);
  for (const d of Object.values(decks)) if (d.refused) console.log('REFUSED registration ' + d.name + ':\n  ' + d.refused.join('\n  '));
  if (process.argv.includes('--report')) {
    const rows = Object.entries(fails).map(([k, v]) => ({ k: k, decks: v.decks.size, cards: [...v.cards] })).sort((a, b) => b.decks - a.decks);
    console.log('\nfailing clause shapes, weighted by candidate decks that need them:');
    for (const r of rows) console.log(String(r.decks).padStart(3), r.k.slice(0, 110), ' [' + r.cards.slice(0, 4).join(', ') + (r.cards.length > 4 ? ', …' : '') + ']');
  }
}
