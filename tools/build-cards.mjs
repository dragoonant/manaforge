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
  if ((m = s.match(/^basic (.*)$/))) { f.supers = ['Basic']; s = m[1]; }                                // CR 205.4a
  if ((m = s.match(/^non(land|creature|artifact) (.*)$/))) { f.notTypes = [m[1][0].toUpperCase() + m[1].slice(1)]; s = m[2]; }
  if ((m = s.match(/^(creature|creatures|land|lands|artifact|enchantment|permanent|permanents)\b ?(.*)$/))) { if (NOUN[m[1]]) f.types = NOUN[m[1]]; s = m[2]; }
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
    if ((m = s.match(/^with a \+1\/\+1 counter on it\b ?(.*)$/))) { f.counter = '+1/+1'; s = m[1]; continue; }
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
  if (p === 'that creature' || p === 'it' || p === 'itself') { if (ctx.it) return ctx.it; throw new Fail('"' + p + '" with nothing to refer to'); }
  if (p === 'that player' && ctx.evPlayer) return 'evPlayer';
  if (p === 'each opponent') return 'eachOpp';
  let m;
  if ((m = p.match(/^each (.+)$/))) return { each: parseFilter(m[1]) };
  if ((m = p.match(/^(creatures you control|other creatures you control)$/))) return { each: parseFilter(m[1]) };
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
  throw new Fail('condition: ' + c);
}
// One effect sentence (no trailing period) → ops.
function parseEffect(T, ctx, sentence) {
  let s = sentence.trim(), m;
  if ((m = s.match(/^(?:Then )?[Ii]f (.+?), (.+)$/))) return [{ o: 'if', cond: parseCond(m[1], ctx), ops: parseEffect(T, ctx, cap(m[2])) }];
  if ((m = s.match(/^Then (.+)$/))) return parseEffect(T, ctx, cap(m[1]));
  if ((m = s.match(/^(.+) and (scry \d+|draw a card|you gain \d+ life)$/))) return parseEffect(T, ctx, m[1]).concat(parseEffect(T, ctx, m[2]));
  if ((m = s.match(/^[Pp]ut (a|an|one|two|three|\d+) \+1\/\+1 counters? on (.+)$/))) { const on = parseRef(T, ctx, m[2]); return [{ o: 'counter', on: on, n: numOf(m[1]), kind: '+1/+1' }]; }
  if ((m = s.match(/^[Dd]ouble the number of \+1\/\+1 counters on (.+)$/))) return [{ o: 'doubleCounters', on: parseRef(T, ctx, m[1]), kind: '+1/+1' }];
  if ((m = s.match(/^[Tt]ap (.+)$/))) return [{ o: 'tap', on: parseRef(T, ctx, m[1]) }];
  if ((m = s.match(/^[Uu]ntil end of turn, (.+?) gains (.+?) and gets (\S+), where X is (.+)$/))) {
    const on = parseRef(T, ctx, m[1]); const x = parseValueWhere(m[4]);
    const grant = kwList(m[2]); const pt = pumpOf(m[3], x); return [{ o: 'pump', on: on, p: pt.p, t: pt.t, grant: grant }];
  }
  if ((m = s.match(/^(.+?) gets? (\S+) and gains (.+) until end of turn$/))) { const on = parseRef(T, ctx, m[1]); const pt = pumpOf(m[2]); return [{ o: 'pump', on: on, p: pt.p, t: pt.t, grant: kwList(m[3]) }]; }
  if ((m = s.match(/^(.+?) gets? (\S+) until end of turn$/))) { const on = parseRef(T, ctx, m[1]); const pt = pumpOf(m[2]); return [{ o: 'pump', on: on, p: pt.p, t: pt.t }]; }
  if ((m = s.match(/^(.+?) gains your choice of (.+) until end of turn$/))) return [{ o: 'pumpChoice', on: parseRef(T, ctx, m[1]), kws: kwList(m[2].replace(/ or /g, ', ')) }];
  if ((m = s.match(/^(.+?) gains? (.+) until end of turn$/))) return [{ o: 'pump', on: parseRef(T, ctx, m[1]), grant: kwList(m[2]) }];
  if ((m = s.match(/^[Ss]cry (\d+)$/))) return [{ o: 'scry', n: +m[1] }];
  if ((m = s.match(/^[Ss]urveil (\d+)$/))) return [{ o: 'surveil', n: +m[1] }];                         // CR 701.25
  if ((m = s.match(/^[Ss]earch your library for a basic land card, put it onto the battlefield( tapped)?, then shuffle$/))) return [{ o: 'searchBasic', tapped: !!m[1] }];   // CR 701.23
  if ((m = s.match(/^[Uu]ntap that land$/))) return [{ o: 'untapIt' }];
  if ((m = s.match(/^[Cc]reate (a|an|one|two|three|\d+) (\d+)\/(\d+) (white|blue|black|red|green|colorless) (\w+) creature tokens?$/))) {
    const id = ctx.token({ p: +m[2], t: +m[3], color: m[4], sub: m[5] });
    return [{ o: 'token', id: id, n: numOf(m[1]) }];
  }
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
  if ((m = s.match(/^(.+?) can't be blocked this turn$/))) return [{ o: 'unblockable', on: parseRef(T, ctx, m[1]) }];
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
  const sentences = t.split(/\. (?=[A-Z])/);
  const ops = [];
  for (const sn of sentences) {
    // "X. Then it deals ..." — "it" is the object the previous sentence acted on.
    const out = parseEffect(T, ctx, sn);
    const last = out[out.length - 1]; if (last && last.on && typeof last.on === 'object' && last.on.t != null) ctx.it = last.on;
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
    else if (/^Pay (\d+) life$/.test(p)) cost.life = +p.match(/\d+/)[0];                             // CR 119.4
    else throw new Fail('cost: ' + p);
  }
  return cost;
}
// Trigger events: "<event>, <effect>" — the event is matched by an anchored pattern on a prefix.
const EVENTS = [
  [/^~ enters and when you sacrifice it$/, () => [{ on: 'enters', who: 'self' }, { on: 'sacrificed', who: 'self', lookBack: true }]],
  [/^~ enters$/, () => [{ on: 'enters', who: 'self' }]],
  [/^~ or (another creature you control .+) enters$/, m => [{ on: 'enters', who: { or: ['self', parseFilter(m[1])] } }]],
  [/^(another creature you control.*) enters$/, m => [{ on: 'enters', who: parseFilter(m[1]) }]],
  [/^~ attacks$/, () => [{ on: 'attacks', who: 'self' }]],
  [/^(a creature you control.*) attacks$/, m => [{ on: 'attacks', who: parseFilter(m[1].replace(/^a /, '')) }]],
  [/^you cast a noncreature spell$/, () => [{ on: 'cast', spell: { notTypes: ['Creature'] } }]],
  [/^you cast a spell$/, () => [{ on: 'cast', spell: null }]],
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
      let cond = null, eff = body;
      if (/^if /.test(body)) {                                                                     // CR 603.4: an intervening "if" — the shortest clause that parses as a condition
        for (let i = body.indexOf(', '); i >= 0 && !cond; i = body.indexOf(', ', i + 1)) { try { cond = parseCond(body.slice(3, i), ctx); eff = body.slice(i + 2); } catch (e) { if (!(e instanceof Fail)) throw e; } }
        if (!cond) throw new Fail('intervening if: ' + body);
      }
      for (const tr of trigs) {
        const T = []; const c2 = Object.assign({}, ctx, { it: tr.who && tr.who !== 'self' ? 'ev' : tr.who === 'self' ? 'self' : null });
        if (tr.on === 'cast') { c2.spellEv = true; if (tr.anyPlayer) c2.evPlayer = true; }
        const ops = parseEffects(T, c2, cap(eff.replace(/^this creature\b/, '~')));
        const extra = {}; for (const k of ['anyPlayer', 'step', 'yours', 'byYou', 'firstEachTurn', 'sub']) if (tr[k] != null) extra[k] = tr[k];
        out.push(Object.assign({ k: 'trig', on: tr.on, ops: ops }, tr.who ? { who: tr.who } : {}, tr.spell !== undefined ? { spell: tr.spell } : {}, tr.toOpp ? { toOpp: true } : {}, tr.lookBack ? { lookBack: true } : {}, T.length ? { tg: T } : {}, cond ? { cond: cond } : {}, extra));
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
  if ((m = line.match(/^Enchant (creature)\.?$/))) { out.push({ k: 'enchant', f: parseFilter(m[1]) }); return true; }
  if ((m = line.match(/^Enchanted creature doesn't untap during its controller's untap step\.$/))) { out.push({ k: 'noUntap', affects: 'enchanted' }); return true; }
  if ((m = line.match(/^(Enchanted|Equipped) creature gets (\S+?)(?: and has (.+))?\.$/))) {
    const pt = pumpOf(m[2]); out.push(Object.assign({ k: 'static', affects: m[1].toLowerCase(), p: pt.p, t: pt.t }, m[3] ? { grant: kwList(m[3]) } : {})); return true;
  }
  if ((m = line.match(/^(Other creatures you control|Creatures you control) have (.+)\.$/))) { out.push({ k: 'static', affects: parseFilter(m[1].toLowerCase()), grant: kwList(m[2]) }); return true; }
  if ((m = line.match(/^As long as (.+?), (.+)\.$/))) {
    const cond = parseCond(m[1], ctx), body = m[2]; let b;
    if ((b = body.match(/^~ gets (\S+) and has (.+)$/))) { const pt = pumpOf(b[1]); out.push({ k: 'static', affects: 'self', p: pt.p, t: pt.t, grant: kwList(b[2]), cond: cond }); return true; }
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
  // A keyword line: "Flying", "Reach, vigilance", "Offspring {2}", "Equip {3}", "Kicker {4}".
  const parts = line.replace(/\.$/, '').split(/, /);
  if (parts.every(p => KW[p.toLowerCase()])) { for (const p of parts) kw[KW[p.toLowerCase()]] = (kw[KW[p.toLowerCase()]] || 0) + 1; return; }
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
  if (parseStatic(line, ctx, ab, d)) return;
  if (parseTrigger(line, ctx, ab)) return;
  if ((m = line.match(/^([^:]+): (.+)$/)) && /\{|Sacrifice/.test(m[1])) {                          // CR 602.1
    const cost = parseCost(m[1]);
    let mm, body = m[2];
    if ((mm = body.match(/^Add \{([WUBRGC])\}(?: or \{([WUBRGC])\})?\.$/))) { ab.push({ k: 'mana', cost: cost, cols: [mm[1]].concat(mm[2] ? [mm[2]] : []) }); return; }   // CR 605.1a
    if ((mm = body.match(/^Add \{([WUBRGC])\}\. Spend this mana only to cast a creature spell\.$/))) { ab.push({ k: 'mana', cost: cost, cols: [mm[1]], only: 'creature' }); return; }   // CR 106.6
    if ((mm = body.match(/^Add \{([WUBRGC])\}(?: or \{([WUBRGC])\})?\. Activate only if (.+)\.$/))) { ab.push({ k: 'mana', cost: cost, cols: [mm[1]].concat(mm[2] ? [mm[2]] : []), cond: parseCond(mm[3], ctx) }); return; }   // the Verges (CR 602.5b)
    if ((mm = body.match(/^Add \{([WUBRGC])\} or \{([WUBRGC])\}\. ~ deals (\d+) damage to you\.$/))) { ab.push({ k: 'mana', cost: cost, cols: [mm[1], mm[2]], selfDamage: +mm[3] }); return; }   // pain lands: the damage is part of the effect
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
  if (d.types.includes('Instant') || d.types.includes('Sorcery')) {
    const T = []; const ops = parseEffects(T, Object.assign({}, ctx, { it: null }), line);
    const sp = ab.find(a => a.k === 'spell');
    if (sp) { sp.ops.push.apply(sp.ops, ops); if (T.length) throw new Fail('targets in a second paragraph'); }
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
  t = t.replace(/\b[Tt]his (creature|artifact|land|Aura|enchantment|permanent|Equipment)\b/g, '~');
  return t.split('\n').map(l => l.trim()).filter(Boolean);
}
// `alt`: the other face of an Adventure or Omen card (CR 715, 720), compiled as its own set of
// characteristics the card has only while it is on the stack as that spell.
export function compileCard(c, tokens, alt) {
  const faceName = c.faceName || c.name;
  const d = {
    id: slug(c.name), name: c.name, mana: c.manaCost || '', colors: c.colors || [], types: c.types || [], subtypes: c.subtypes || [], supers: c.supertypes || [],
    power: c.power != null ? (c.power === '*' ? '*' : +c.power) : null, toughness: c.toughness != null ? (c.toughness === '*' ? '*' : +c.toughness) : null,
    typeLine: c.type, text: c.text || '', kw: {}, ab: [], layout: c.layout,
  };
  if (alt) d.name = faceName;
  const twoPart = c.layout === 'adventure' && alt;
  if (c.layout !== 'normal' && !twoPart) { d.un = 'layout ' + c.layout + ' is not compiled'; return d; }
  const ctx = { token: tokens, name: faceName };
  try {
    for (const st of d.subtypes) if (BASIC_MANA[st]) d.ab.push({ k: 'mana', cost: { tap: true }, cols: [BASIC_MANA[st]] });   // CR 305.6: intrinsic
    for (const line of normalize(d.text, faceName)) parseLine(line, ctx, d, d.kw, d.ab);
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
    const id = 'token-' + t.sub.toLowerCase() + '-' + t.p + '-' + t.t + '-' + (COLOR[t.color] || 'c').toLowerCase();
    if (!pack[id]) pack[id] = { id: id, name: t.sub, token: true, mana: '', colors: COLOR[t.color] ? [COLOR[t.color]] : [], types: ['Creature'], subtypes: [t.sub], supers: [], power: t.p, toughness: t.t, typeLine: 'Token Creature — ' + t.sub, text: '', kw: {}, ab: [], layout: 'token' };
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
