// The opponent. It plays through legalActions/apply like a human and keeps no copy of any rule.
//
// Every candidate — every legal action at priority, every answer to its own question — is rolled
// forward to the SAME horizon (the end of the current turn, after cleanup) and scored there, and
// `pass` is scored the same way (handoff 7.5: the untap-and-draw windfall). In the roll-out the
// seat that is not thinking follows simple policies: it passes, and it blocks by a heuristic.
// The search runs on a determinized copy: both libraries are reshuffled, so the AI cannot use
// the order of either library (handoff 11.8.6).
(function () {
  'use strict';
  const MF = window.MF;
  const P = (s, seat) => s.players[seat];
  const I = (s, iid) => s.cards[iid];

  // ---------------------------------------------------------------------------------------------
  // The evaluator. Board presence persists in Magic (handoff 11.8.5): power, toughness and
  // evasion on the battlefield, cards in hand, lands, and life with a low-life cliff.
  // ---------------------------------------------------------------------------------------------
  const W = { emptyLibrary: 150, colorAccess: 0.9, pactUnpaid: 400, landInHand: 0.7, life: 1.0, lowLife: 6, lowLifeExtra: 1.2, card: 2.2, land: 1.6, landCap: 7, pow: 1.4, tou: 0.6, evasion: 0.6, creature: 1.0, perm: 0.8, untappedBlocker: 0.25, counter: 0.0, openInstant: 1.2, rollAttack: 1, waitWindows: 1 };
  MF.aiWeights = W;
  const lifeScore = l => l * W.life - (l < W.lowLife ? (W.lowLife - l) * W.lowLifeExtra : 0);
  function permValue(s, iid) {
    const ch = MF.chars(s, iid);
    if (ch.types.includes('Land')) return 0;
    if (ch.types.includes('Creature')) {
      const k = ch.kw;
      let v = W.creature + Math.max(0, ch.p) * W.pow + Math.max(0, ch.t) * W.tou;
      if (k.flying || k.trample || k.menace || ch.unblockable) v += Math.max(0, ch.p) * W.evasion;
      if (k.firstStrike || k.doubleStrike || k.deathtouch || k.lifelink) v += 0.8;
      return v;
    }
    return W.perm + (ch.subtypes.includes('Aura') ? 0.6 : 0);
  }
  MF.aiPermValue = permValue;
  // A card that wins with an empty library in hand or on the battlefield (Thassa's Oracle, PLAN D24).
  const isLibraryWin = d => /win the game/.test(d.text || '') && /librar/.test(d.text || '');
  function winsOnEmpty(s, seat) { return P(s, seat).hand.concat(s.bf.filter(i => I(s, i).ctrl === seat)).some(i => isLibraryWin(MF.def(s, i))); }
  function evalFor(s, me) {
    if (s.winner != null) return s.winner === me ? 1000 : s.winner === 'draw' ? 0 : -1000;
    let v = 0;
    for (const seat of [me, 1 - me]) {
      const p = P(s, seat), sign = seat === me ? 1 : -1;
      let x = lifeScore(p.life);
      for (const iid of p.hand) x += MF.def(s, iid).types.includes('Land') ? W.landInHand : W.card;   // a land is worth more on the battlefield than in hand (handoff 11.8.2)
      let lands = 0;
      for (const iid of s.bf) {
        const c = I(s, iid); if (c.ctrl !== seat) continue;
        if (MF.isType(s, iid, 'Land')) lands++;
        else x += permValue(s, iid);
        // Enchanted by an opponent's Aura: the Aura's effect is mostly already in the numbers.
        const ch = MF.chars(s, iid);
        if (ch.noUntap && c.tapped) x -= permValue(s, iid) * 0.8;
      }
      x += Math.min(lands, W.landCap) * W.land + Math.max(0, lands - W.landCap) * 0.3;
      // Colours its permanents can make (PLAN D22): a colourless land is not a coloured one, so City of
      // Traitors is not worth keeping over every second land drop in a five-colour deck.
      const cols = new Set();
      for (const iid of s.bf) { if (I(s, iid).ctrl !== seat) continue; for (const a of MF.chars(s, iid).ab) if (a.k === 'mana' && !a.zone && !a.special) for (const k of MF.manaCols(s, seat, iid, a)) if (k !== 'C') cols.add(k); }
      x += cols.size * W.colorAccess;
      // A Pact due at this player's next upkeep (CR 603.7): the roll-out ends before it, so the loss is
      // counted here when the mana it asks for isn't there — every mana source this player controls, untapped.
      const owed = [].concat((s.delayed || []).map(d => ({ ctrl: d.ctrl, ab: d.ab })), (s.trigs || []).map(t => ({ ctrl: t.ctrl, ab: t.inl })), s.stack.filter(L => L.kind === 'trig').map(L => ({ ctrl: L.ctrl, ab: L.inl })));   // still delayed, triggered, or on the stack at the horizon
      for (const d of owed) if (d.ab && typeof d.ab === 'object') for (const op of d.ab.ops || []) if (op.o === 'payOrLose' && d.ctrl === seat) {
        const srcs = s.bf.filter(i => I(s, i).ctrl === seat && MF.chars(s, i).ab.some(a => a.k === 'mana' && !a.zone && a.cost && a.cost.tap)).length;
        if (srcs < MF.manaValue(MF.parseMana(op.cost))) x -= W.pactUnpaid;
      }
      if (p.lib.length < 3) x -= (3 - p.lib.length) * 4;
      // An empty library at the horizon (CR 704.5b): its owner loses at their next draw unless something
      // wins first (Thassa's Oracle). Brain Freeze's mill-out is scored here (PLAN D24).
      if (p.lib.length === 0 && !winsOnEmpty(s, seat)) x -= W.emptyLibrary;
      // My turn has just ended at the horizon: an instant-speed card I could still cast with my untapped
      // lands is a threat the opponent must play around (TODO: the AI rarely held mana for a trick).
      // Only then — deciding on the opponent's turn, the horizon is my untap, and holding is worth nothing.
      if (seat === me && s.ap !== me) {
        const open = s.bf.filter(i => I(s, i).ctrl === me && !I(s, i).tapped && MF.isType(s, i, 'Land')).length;
        let held = 0;
        for (const iid of p.hand) { const d = MF.def(s, iid); if ((d.types.includes('Instant') || d.kw.flash) && MF.manaValue(MF.parseMana(d.mana)) <= open && held < 2) held++; }
        x += held * W.openInstant;
      }
      v += sign * x;
    }
    return v;
  }
  MF.aiEval = evalFor;

  // ---------------------------------------------------------------------------------------------
  // Policies: answers that need no search, used for the seat that is not thinking and for
  // questions too small to be worth a roll-out.
  // ---------------------------------------------------------------------------------------------
  const isLand = (s, iid) => MF.def(s, iid).types.includes('Land');
  function keepValue(s, iid) {                                                                // how much a card in hand is worth keeping
    const d = MF.def(s, iid), lands = s.bf.filter(i => I(s, i).ctrl === I(s, iid).owner && MF.isType(s, i, 'Land')).length;
    if (d.types.includes('Land')) return lands < 5 ? 5 - lands * 0.6 : 0.5;
    const mv = MF.manaValue(MF.parseMana(d.mana));
    return 3 + (mv <= lands + 1 ? 1 : -0.4 * (mv - lands));
  }
  // Which way an effect points: harmful ops want the opponent's things, helpful ops want mine.
  function slotIsHarmful(ab, slot) {
    const uses = [];
    const walk = ops => { for (const op of ops || []) { for (const k of ['on', 'to', 'from', 'who']) if (op[k] && op[k].t === slot) uses.push(op.o + ':' + k); walk(op.ops); } };
    walk(ab.ops);
    return uses.some(u => /^(destroy|tap|damage:to|unblockable:never|handPick|loseLife)/.test(u));
  }
  function abilityOfSource(s, q) {
    const c = I(s, q.src); if (!c) return null;
    if (q.srcKind === 'spell' || q.srcKind === 'copy') return MF.def(s, q.src).ab.find(a => a.k === 'spell');
    if (q.srcKind === 'aura') return { ops: [{ o: MF.def(s, q.src).ab.some(a => a.k === 'noUntap' || (a.k === 'trig' && a.ops.some(o => o.o === 'tap'))) ? 'tap' : 'pump', on: { t: 0 } }] };
    if (q.srcKind === 'ab') { const top = s.todo[0]; return MF.chars(s, q.src).ab[top && top.ab != null ? top.ab : 0]; }
    if (q.srcKind === 'trig') return null;
    return null;
  }
  function targetPolicy(s, q) {
    const me = q.who;
    const ab = abilityOfSource(s, q);
    let harmful = ab ? slotIsHarmful(ab, q.slot) : null;
    const opts = q.opts.filter(o => o.id !== 'done');
    if (harmful == null) {                                                                    // a trigger: guess from whose things are offered
      const theirs = opts.filter(o => (o.iid != null && I(s, o.iid).ctrl !== me) || (o.seat != null && o.seat !== me));
      harmful = theirs.length === opts.length;
    }
    const score = o => {
      if (o.seat != null) return harmful ? (o.seat !== me ? 3 : -50) : (o.seat === me ? 1 : -50);
      if (o.lid != null) return o.ctrl !== me ? 3 : -50;                                          // an ability on the stack: counter the opponent's
      const mine = I(s, o.iid).ctrl === me, v = permValue(s, o.iid);
      return harmful ? (mine ? -50 - v : v) : (mine ? v + (s.combat && s.combat.attackers.includes(o.iid) ? 3 : 0) : -50);
    };
    const best = opts.slice().sort((a, b) => score(b) - score(a))[0];
    if (q.upTo && q.picked.length && best && score(best) < 0) return 'done';
    return best ? best.id : 'done';
  }
  // The defender's heuristic: block when the blocker survives, trade when it is worth it, chump
  // only to stay alive.
  function blockPolicy(s, q) {
    const me = q.who, cb = s.combat, life = P(s, me).life;
    if (!q.opts.some(o => o.id === 'done') && Object.keys(q.assign).length) {                 // an illegal declaration (a lone blocker on a menace attacker): complete the pair, or take blockers back — never add elsewhere, or it loops
      const lone = cb.attackers.filter(a => MF.chars(s, a).kw.menace && Object.values(q.assign).filter(t => t === a).length === 1);
      const fix = q.opts.find(o => o.iid != null && lone.includes(o.att));
      return fix ? fix.id : 'undo';
    }
    const incoming = cb.attackers.filter(a => !Object.values(q.assign).includes(a)).reduce((t, a) => t + Math.max(0, MF.chars(s, a).p), 0);
    let best = null, bs = 0.5;
    for (const o of q.opts) {
      if (o.iid == null) continue;
      const b = MF.chars(s, o.iid), a = MF.chars(s, o.att);
      if (a.kw.menace) {                                                                       // CR 702.111b: only worth starting if a second blocker can join
        const others = q.opts.filter(x => x.att === o.att && x.iid !== o.iid).length + Object.values(q.assign).filter(t => t === o.att).length;
        if (others < 1) continue;
      }
      const dies = a.p >= b.t || (a.kw.deathtouch && a.p > 0), kills = b.p >= a.t || (b.kw.deathtouch && b.p > 0);
      let v = 0;
      if (!dies && kills) v = 6 + permValue(s, o.att);
      else if (!dies) v = 2 + a.p * 0.3;
      else if (kills) v = permValue(s, o.att) - permValue(s, o.iid) + 0.5;
      else v = incoming >= life ? 4 + a.p : -10;                                               // a chump block only to survive
      if (a.kw.trample && dies) v -= 1;
      if (v > bs) { bs = v; best = o.id; }
    }
    if (best) return best;
    if (q.opts.some(o => o.id === 'done')) return 'done';
    const any = q.opts.find(o => o.id !== 'undo');
    return any ? any.id : 'undo';                                                              // a lone blocker on a menace attacker: take it back
  }
  // The attacker's heuristic, for the roll-out: a requirement first (CR 508.1d), then every creature no
  // untapped creature of the defender could block and kill. Without it a roll-out never attacks, and
  // a pre-combat pump (prowess, a trick) is worth nothing at the horizon.
  function attackPolicy(s, q) {
    const m = q.opts.find(o => o.iid != null && MF.chars(s, o.iid).ab.some(a => a.k === 'mustAttack'));
    if (m) return m.id;
    if (!q.opts.some(o => o.id === 'done')) return q.opts[0].id;
    if (!W.rollAttack) return 'done';
    const foes = s.bf.filter(i => I(s, i).ctrl !== q.who && MF.isType(s, i, 'Creature'));
    const safe = o => {
      if (o.iid == null) return false;
      const a = MF.chars(s, o.iid);
      if (a.p <= 0) return false;
      return foes.every(b => { if (!MF.canBlock(s, b, o.iid)) return true; const bc = MF.chars(s, b); return bc.p < a.t && !(bc.kw.deathtouch && bc.p > 0); });
    };
    const o = q.opts.find(safe);
    return o ? o.id : 'done';
  }
  function policyAnswer(s0, q) {
    const me = q.who, s = MF.view(s0);
    switch (q.kind) {
      case 'first': return 'me';
      case 'mulligan': {
        const lands = P(s, me).hand.filter(i => isLand(s, i)).length, n = P(s, me).hand.length;
        return (q.mulls >= 2 || (lands >= 2 && lands <= n - 2)) ? 'keep' : 'mull';
      }
      case 'bottom': case 'discardHand': case 'discard':
        return q.opts.slice().sort((a, b) => keepValue(s, a.iid) - keepValue(s, b.iid))[0].id;
      case 'pay': return 'auto';
      case 'spend': return q.opts[0].id;
      case 'x': return q.opts[q.opts.length - 1].id;
      case 'offspring': case 'kicker': return 'yes';
      case 'chooseKw': return q.opts[0].id;
      case 'payLifeOrTap': return P(s, me).life > 8 ? 'pay' : 'tapped';
      case 'surveil': { const lands = s.bf.filter(i => I(s, i).ctrl === me && MF.isType(s, i, 'Land')).length; const land = MF.def(s, q.opts[0].iid).types.includes('Land'); return land && lands >= 5 ? 'grave' : 'top'; }
      case 'search': return q.opts[0].id;
      case 'mode': return q.opts[0].id;
      case 'pickMilled': case 'dig': { const c = q.opts.filter(o => o.iid != null).sort((a, b) => keepValue(s, b.iid) - keepValue(s, a.iid))[0]; return c ? c.id : 'none'; }
      case 'discardUpTo': return 'done';
      case 'gift': return q.opts.some(o => o.id === 'no') ? 'no' : q.opts[0].id;
      case 'bargain': return 'none';
      case 'enterChoice': {
        if (q.what === 'creatureType') {                                                        // the type most of its creature cards share
          const n = {}; for (const i of P(s, me).hand.concat(P(s, me).lib, P(s, me).grave)) { const d = MF.def(s, i); if (d.types.includes('Creature')) for (const st of d.subtypes) n[st] = (n[st] || 0) + 1; }
          const best = q.opts.map(o => o.id).filter(t => n[t]).sort((a, b) => n[b] - n[a])[0];
          return best || q.opts[0].id;
        }
        if (q.what === 'color') {                                                               // Painter's Servant: the colour its own cards ask for most
          const need = { W: 0, U: 0, B: 0, R: 0, G: 0 };
          for (const i of P(s, me).hand.concat(P(s, me).lib)) for (const k in need) need[k] += (MF.def(s, i).mana.match(new RegExp('\\{' + k + '\\}', 'g')) || []).length;
          return Object.keys(need).sort((a, b) => need[b] - need[a])[0];
        }
        if (q.what !== 'basicType') return 'odd';
        const need = { W: 0, U: 0, B: 0, R: 0, G: 0 };                                        // the color its hand and library ask for most
        for (const i of P(s, me).hand.concat(P(s, me).lib)) for (const k in need) need[k] += (MF.def(s, i).mana.match(new RegExp('\{' + k + '\}', 'g')) || []).length;
        const best = Object.keys(need).sort((a, b) => need[b] - need[a])[0];
        return { W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest' }[best];
      }
      case 'discardOrSac': return q.opts.some(o => o.id === 'discard') ? 'discard' : 'sac';
      case 'sacrificeCost': return q.opts.slice().sort((a, b) => permValue(s, a.iid) - permValue(s, b.iid))[0].id;
      case 'spreeMode': return q.chosen.length ? 'done' : q.opts[0].id;
      case 'phyrexian': return q.opts.some(o => o.id === 'mana') ? 'mana' : 'life';
      case 'mayDiscard': { const c = q.opts.filter(o => o.iid != null).sort((a, b) => keepValue(s, a.iid) - keepValue(s, b.iid))[0]; return c && keepValue(s, c.iid) < 3 ? c.id : 'none'; }
      case 'exileFromGrave': return q.opts.slice().sort((a, b) => keepValue(s, a.iid) + (LINE_PIECE(MF.def(s, a.iid)) ? 100 : 0) - keepValue(s, b.iid) - (LINE_PIECE(MF.def(s, b.iid)) ? 100 : 0))[0].id;   // escape's cost: never a piece of a win line (PLAN D24)
      case 'manaYield': { const need = { W: 0, U: 0, B: 0, R: 0, G: 0 }; for (const i of P(s, me).hand.concat(P(s, me).grave)) for (const k in need) need[k] += (MF.def(s, i).mana.match(new RegExp('\\{' + k + '\\}', 'g')) || []).length; return q.opts.slice().sort((a, b) => [...b.id].reduce((n, k) => n + (need[k] || 0), 0) - [...a.id].reduce((n, k) => n + (need[k] || 0), 0))[0].id; }   // Lion's Eye Diamond: the colour its hand and graveyard ask for
      case 'forage': return q.opts.some(o => o.id === 'exile') ? 'exile' : 'food';
      case 'leyline': return 'yes';
      case 'freeEquip': return 'free';
      case 'tapCost': case 'craftMaterial': return q.opts.slice().sort((a, b) => keepValue(s, a.iid) - keepValue(s, b.iid))[0].id;
      case 'chooseName': { const opp = s.players[1 - q.who]; const names = new Set(opp.lib.concat(opp.hand, s.bf.filter(i => I(s, i).ctrl !== q.who)).map(i => MF.def(s, i)).filter(d => d.types.includes('Land') && d.ab.some(a => a.k === 'act')).map(d => d.name)); const o = q.opts.find(o2 => names.has(o2.id)); return o ? o.id : q.opts[0].id; }
      case 'digOnto': { const c = q.opts.filter(o => o.iid != null).sort((a, b) => keepValue(s, b.iid) - keepValue(s, a.iid))[0]; return c ? c.id : 'done'; }
      case 'hybrid': return q.opts[q.opts.length - 1].id;
      case 'manaColor': { const need = { W: 0, U: 0, B: 0, R: 0, G: 0 }; for (const i of P(s, me).hand) for (const k in need) need[k] += (MF.def(s, i).mana.match(new RegExp('\\{' + k + '\\}', 'g')) || []).length; const offered = q.opts.map(o => o.id); return offered.slice().sort((a, b) => (need[b] || 0) - (need[a] || 0))[0]; }   // of the colours offered, the one its hand asks for most
      case 'tutorUpTo': { const c = q.opts.filter(o => o.iid != null).sort((a, b) => keepValue(s, b.iid) - keepValue(s, a.iid))[0]; return c ? c.id : 'done'; }
      case 'removeCounterKind': { const o = q.opts.find(o2 => o2.id !== 'none' && o2.id !== '+1/+1') || q.opts.find(o2 => o2.id !== 'none'); return o ? o.id : 'none'; }
      case 'mayPay': return 'yes';
      // PLAN D22
      case 'pactPay': return 'pay';                                                             // declining loses the game
      case 'repeat': return P(s, me).life > 12 ? 'yes' : 'no';                                  // Ad Nauseam: keep a cushion of life
      case 'taintedTake': return keepValue(s, q.c) >= 3 ? 'take' : 'next';
      case 'chooseCardName': {                                                                  // Demonic Consultation: with a library-empty win in hand or play, name a card not in the library; otherwise the best card in it
        const lib = new Set(P(s, me).lib.map(i => MF.def(s, i).name));
        const wins = P(s, me).hand.concat(s.bf.filter(i => I(s, i).ctrl === me)).some(i => /win the game/.test(MF.def(s, i).text || ''));
        if (wins) { const o = q.opts.find(o2 => !lib.has(o2.id)); return o.id; }
        const best = P(s, me).lib.slice().sort((a, b) => keepValue(s, b) - keepValue(s, a))[0];
        return best != null ? MF.def(s, best).name : q.opts[0].id;
      }
      case 'limdul': return 'keep';
      case 'orderCards': return q.opts.slice().sort((a, b) => keepValue(s, b.iid) - keepValue(s, a.iid))[0].id;
      case 'oppPicks': return q.to === 'hand' ? q.opts.slice().sort((a, b) => keepValue(s, a.iid) - keepValue(s, b.iid))[0].id : q.opts.slice().sort((a, b) => keepValue(s, b.iid) - keepValue(s, a.iid))[0].id;   // the opponent gives the worst card to the hand, the best to the graveyard
      case 'altExileBlue': return q.opts.slice().sort((a, b) => keepValue(s, a.iid) - keepValue(s, b.iid))[0].id;
      case 'gemstone': return 'yes';
      case 'gemstoneExile': return q.opts.slice().sort((a, b) => keepValue(s, a.iid) - keepValue(s, b.iid))[0].id;
      case 'moxDiamond': { const c = q.opts.filter(o => o.iid != null)[0]; return c ? c.id : 'none'; }
      case 'addCostYes': return 'no';
      case 'blightOn': return q.opts.slice().sort((a, b) => permValue(s, a.iid) - permValue(s, b.iid))[0].id;
      case 'teamworkTap': return q.opts.some(o => o.id === 'done') ? 'done' : q.opts.filter(o => o.iid != null).sort((a, b) => MF.chars(s, b.iid).p - MF.chars(s, a.iid).p)[0].id;
      case 'crewTap': return q.opts.some(o => o.id === 'done') ? 'done' : q.opts.filter(o => o.iid != null).sort((a, b) => MF.chars(s, a.iid).p - MF.chars(s, b.iid).p)[0].id;   // smallest first
      case 'discardOrLife': return q.opts.some(o => o.id === 'life') && P(s, me).life > 10 ? 'life' : q.opts[0].id;
      case 'attackWhom': return q.opts[0].id;
      case 'ninjutsuReturn': case 'sacrificeOne': return q.opts.slice().sort((a, b) => permValue(s, a.iid) - permValue(s, b.iid))[0].id;
      case 'chooseObj': { const mine = q.opts.filter(o => o.iid != null && I(s, o.iid).ctrl === me).sort((a, b) => permValue(s, b.iid) - permValue(s, a.iid)); return mine.length ? mine[0].id : 'none'; }
      case 'chooseFromGrave': { const c = q.opts.filter(o => o.iid != null).sort((a, b) => keepValue(s, b.iid) - keepValue(s, a.iid))[0]; return c ? c.id : 'done'; }
      case 'exploreGrave': return MF.def(s, q.card).types.includes('Land') ? 'top' : keepValue(s, q.card) < 3 ? 'grave' : 'top';
      case 'wardPay': return P(s, me).life > (q.life || 0) + 5 ? 'pay' : 'decline';
      case 'sneakReturn': case 'sacToken': return q.opts.slice().sort((a, b) => permValue(s, a.iid) - permValue(s, b.iid))[0].id;
      case 'harmonizeTap': { const c = q.opts.filter(o => o.iid != null).sort((a, b) => b.p - a.p)[0]; return c ? c.id : 'none'; }
      case 'manaCombo': return q.opts[0].id;
      case 'payOrCounter': return 'pay';
      case 'lookPick': return q.opts.slice().sort((a, b) => keepValue(s, b.iid) - keepValue(s, a.iid))[0].id;
      case 'handPick': { const c = q.opts.filter(o => o.iid != null).sort((a, b) => MF.manaValue(MF.parseMana(MF.def(s, b.iid).mana)) - MF.manaValue(MF.parseMana(MF.def(s, a.iid).mana)))[0]; return c ? c.id : 'none'; }   // the most expensive card
      case 'trigOrder': return q.opts[0].id;
      case 'legend': return q.opts[0].id;
      case 'scry': { const lands = s.bf.filter(i => I(s, i).ctrl === me && MF.isType(s, i, 'Land')).length; const land = isLand(s, q.opts[0].iid); return (land ? lands < 6 : true) ? 'top' : 'bottom'; }
      case 'scryOrder': return q.opts[0].id;
      case 'lookTop': return 'yes';
      case 'may': return 'yes';
      case 'newTargets': return 'keep';
      // Kujo's Commander deck (PLAN D21)
      case 'scionPick': return q.opts.slice().sort((a, b) => keepValue(s, a.iid) - keepValue(s, b.iid))[0].id;   // the less useful card to the graveyard
      case 'thassaTop': { const c = q.opts.filter(o => o.iid != null).sort((a, b) => keepValue(s, b.iid) - keepValue(s, a.iid))[0]; return c ? c.id : 'none'; }
      case 'braidsSac': return 'no';
      case 'braidsMatch': { const c = q.opts.filter(o => o.iid != null).sort((a, b) => permValue(s, a.iid) - permValue(s, b.iid))[0]; return c && P(s, me).life <= 10 ? c.id : 'no'; }
      case 'millOrder': return (q.opts.find(o => o.what === 'millDouble') || q.opts[0]).id;   // doubling first always mills fewer: 2n + 4 < 2(n + 4)
      case 'imprint': { const c = q.opts.filter(o => o.iid != null).sort((a, b) => keepValue(s, a.iid) - keepValue(s, b.iid))[0]; return c ? c.id : 'no'; }
      case 'enterAsCopy': return q.opts.filter(o => o.iid != null).sort((a, b) => permValue(s, b.iid) - permValue(s, a.iid))[0].id;
      case 'assign': return q.trample ? q.opts[q.opts.length - 1].id : q.opts[0].id;      // trample: lethal to the blocker, the rest to the player
      case 'target': return targetPolicy(s, q);
      case 'block': return blockPolicy(s, q);
      case 'attack': return attackPolicy(s, q);
      default: return undefined;
    }
  }
  MF.aiPolicy = policyAnswer;
  function defaultAct(s) {
    if (s.pending) {
      const q = s.pending.q, a = policyAnswer(s, q);
      if (a !== undefined) return { type: 'answer', id: a };
      return { type: 'answer', id: q.opts[0].id };
    }
    return { type: 'pass' };
  }
  MF.aiDefault = defaultAct;

  function determinize(s, salt) {
    const c = MF.clone(s);
    c.rng = (c.rng ^ (0x9E3779B9 + salt * 7919)) | 0;
    for (const p of c.players) MF.shuffle(c, p.lib);
    return c;
  }
  // Roll forward with policies to the end of the turn the decision was made in.
  function rolloutState(s, me, turn0, st) {
    let guard = 0;
    while (s.winner == null && s.turn === turn0 && guard++ < 600) { s = MF.apply(s, defaultAct(s)); st.n++; }
    return s;
  }
  function rollout(s, me, turn0, st) { return evalFor(rolloutState(s, me, turn0, st), me); }
  // Kinds where every answer is worth a roll-out when the AI itself is asked.
  const SEARCH_KINDS = { addCostYes: 1, attackWhom: 1, wardPay: 1, bargain: 1, payOrCounter: 1, gift: 1, handPick: 1, mode: 1, target: 1, attack: 1, block: 1, may: 1, enterAsCopy: 1, offspring: 1, kicker: 1, chooseKw: 1, x: 1, lookTop: 1 };

  const OPP_WINDOWS = { boc: 1, attackers: 1, blockers: 1, end: 1 };
  const MAX_CANDIDATES = 12;
  function candidates(s, legal) {
    const seen = new Set(), out = [];
    for (const a of legal) {
      if (a.type === 'cancel' || a.id === 'undo' || a.type === 'mana') continue;   // mana is made inside a payment; nothing it plays cares about a pool before one
      const key = a.type + ':' + (a.iid != null ? I(s, a.iid).id + '@' + I(s, a.iid).zone : '') + ':' + (a.ab != null ? a.ab : '') + ':' + (a.id != null ? a.id : '') + ':' + (a.door != null ? 'door' + a.door : '') + (a.alt ? 'alt' : '');
      if (seen.has(key)) continue; seen.add(key); out.push(a);
    }
    return out;
  }


  // ---------------------------------------------------------------------------------------------
  // PLAN D24: the championship Commander decks. Two things a one-turn roll-out cannot see.
  //  1. Threats on the stack: what an opponent's spell sets up (a tutor, Ad Nauseam, Underworld
  //     Breach, a commander) shows on the board only later. Stopping one is worth its threat value.
  //  2. Win lines: a few cards that win together, each played out first in the engine on a
  //     determinized copy (the opponent passing); the AI commits only to a line that wins there.
  // ---------------------------------------------------------------------------------------------
  const opsOf = d => JSON.stringify(d.ab.concat(d.alt ? d.alt.ab : []));
  const hasOp = (d, o) => opsOf(d).includes('"o":"' + o + '"');
  const isEnabler = d => hasOp(d, 'consultation') || hasOp(d, 'taintedPact');
  const isBreach = d => d.ab.some(a => a.k === 'breach');
  const isLED = d => d.ab.some(a => a.k === 'mana' && a.cost && a.cost.discardHand);
  const isFreeze = d => d.ab.some(a => a.k === 'storm') && hasOp(d, 'mill');
  const LINE_PIECE = d => isLibraryWin(d) || isEnabler(d) || isBreach(d) || isLED(d) || isFreeze(d);
  function threatOf(s, L, me) {
    if (L.kind !== 'spell') {                                                                    // an ability: Thassa's Oracle's trigger, a tutor's activation
      const src = MF.cards[L.srcId] || {};
      if (isLibraryWin(src)) return P(s, L.ctrl).lib.length <= 6 ? 400 : 20;
      return /Search your library/.test(src.text || '') ? 15 : 2;
    }
    const d = MF.cards[L.id], t = d.text || '';
    if (isLibraryWin(d)) return P(s, L.ctrl).lib.length <= 6 ? 400 : 40;
    if (isEnabler(d)) return winsOnEmpty(s, L.ctrl) || P(s, L.ctrl).hand.length > 0 ? 120 : 40;
    if (isBreach(d) || hasOp(d, 'adNauseam') || hasOp(d, 'extraTurn') || /Food Chain/.test(d.name)) return 60;
    if (isFreeze(d)) return 25;
    if ((L.t || []).flat().some(r => r && r.c != null && s.stack.some(M => M.kind === 'spell' && M.iid === r.c && M.ctrl === me))) {   // it targets my spell: a counterspell
      const mine = s.stack.find(M => M.kind === 'spell' && (L.t || []).flat().some(r => r && r.c === M.iid));
      return 5 + threatOf(s, mine, 1 - me);
    }
    if (s.cards[L.iid] && L.from === 'command') return 15;                                         // a commander
    if (/Search your library for a card/.test(t)) return 30;
    if (/Search your library/.test(t)) return 12;
    if (/[Dd]raw (two|three|X|seven) cards/.test(t)) return 10;
    return 0;
  }
  // Did this spell or ability resolve between log index i0 and the end of the roll-out?
  const resolvedAfter = (r, L, i0) => r.log.slice(i0).some(e => (e.t === 'resolve' && L.kind === 'spell' && e.c === L.id && e.who === L.ctrl) || (e.t === 'resolveAb' && L.kind !== 'spell' && e.c === L.srcId && e.who === L.ctrl));

  // Run a line in the engine: `next(s)` gives my action (undefined: the policy's answer; null: the line
  // is done); the other seat passes and answers by policy. Returns the final state, or null on a refusal.
  function runLine(s, me, next, limit) {
    for (let k = 0; k < limit && s.winner == null; k++) {
      const who = MF.whoActs(s); if (who == null) return s;
      let a = who === me ? next(s) : defaultAct(s);
      if (a === null) return s;
      if (a === undefined) a = defaultAct(s);
      try { s = MF.apply(s, a); } catch (e) { return null; }
    }
    return s;
  }
  // A payment inside a line: tap for the coloured part first, and pay generic mana with a source whose
  // colours the rest of the line doesn't need (the solver's proposal may tap an Island Oracle needs).
  function linePay(s, me, q, reserve) {
    const taps = q.opts.filter(o => typeof o.id === 'string' && o.id.startsWith('tap:'));
    if (!taps.length) return 'auto';
    const need = q.need, col = ['W', 'U', 'B', 'R', 'G', 'C'].find(k => need[k] > (s.players[me].pool[k] || 0));
    if (col) { const o = taps.find(t => t.col === col) || taps.find(t => String(t.col).includes(col)); if (o) return o.id; }   // a multi-mana source offers its multisets ("UUU")
    const spare = taps.find(t => ![...String(t.col)].some(k => reserve.includes(k))) || taps[0];
    return spare.id;
  }
  const pipsOf = (s, iids) => iids.flatMap(i => (MF.def(s, i).mana.match(/\{[WUBRG]\}/g) || []).map(x => x[1]));
  const castOf = (s, me, pred, vias) => MF.legalActions(s).find(a => a.type === 'cast' && pred(MF.def(s, a.iid)) && (vias ? vias.includes(a.via || 'plain') : true));
  // A line under way is read from the game, not remembered: this turn's casts include one of its pieces.
  const castThisTurn = (s, me, pred) => (P(s, me).h.castList || []).some(e => { const d = Object.values(MF.cards).find(c => c.name === e.name); return d && pred(d); });
  const mainEmpty = (s, me) => s.ap === me && (s.step === 'main1' || s.step === 'main2') && !s.stack.length && s.priority === me && !s.pending;
  const LINES = [
    { // Thassa's Oracle with Demonic Consultation or Tainted Pact: exile the library, then win as Oracle enters (CR 104.2b).
      name: 'oracle',
      applies: (s, me) => P(s, me).hand.some(i => isLibraryWin(MF.def(s, i))) && (P(s, me).hand.some(i => isEnabler(MF.def(s, i))) || castThisTurn(s, me, isEnabler) || P(s, me).lib.length === 0),
      next: (s, me) => {
        if (s.pending) {
          const q = s.pending.q;
          if (q.kind === 'taintedTake') return { type: 'answer', id: 'next' };
          if (q.kind === 'pay' && q.who === me) return { type: 'answer', id: linePay(s, me, q, pipsOf(s, P(s, me).hand.filter(i => isLibraryWin(MF.def(s, i))))) };
          return undefined;
        }
        if (s.priority !== me) return undefined;
        if (s.stack.length) return { type: 'pass' };
        if (P(s, me).lib.length > 0) { const a = castOf(s, me, isEnabler); return a || null; }
        const o = castOf(s, me, isLibraryWin); return o || null;
      },
      wins: (r, me) => r.winner === me,
      underway: (s, me) => castThisTurn(s, me, isEnabler),
    },
    { // Underworld Breach, Lion's Eye Diamond and Brain Freeze: escape both again and again; storm grows until a Brain Freeze mills the opponent's library away.
      name: 'breach',
      applies: (s, me) => { const all = P(s, me).hand.concat(P(s, me).grave, s.bf.filter(i => I(s, i).ctrl === me)); return all.some(i => isLED(MF.def(s, i))) && all.some(i => isFreeze(MF.def(s, i))) && all.some(i => isBreach(MF.def(s, i))); },
      next: (s, me) => {
        const opp = 1 - me, storm = s.players.reduce((n, p) => n + p.h.cast, 0), oppLib = P(s, opp).lib.length;
        if (s.pending) {
          const q = s.pending.q;
          const v = MF.view(s);                                                                   // the spell being cast exists in the question's view (CLAUDE.md rule 4)
          if (q.kind === 'target' && q.src != null && v.cards[q.src] && isFreeze(MF.def(v, q.src))) return { type: 'answer', id: 'p' + (3 * (storm + 1) >= oppLib || P(s, me).lib.length < 3 * storm + 8 ? opp : me) };   // the Brain Freeze that kills, or fuel for escape (never decking itself)
          if (q.kind === 'newTargets') return { type: 'answer', id: 'keep' };
          if (q.kind === 'pay' && q.who === me) return { type: 'answer', id: linePay(s, me, q, ['U']) };
          return undefined;
        }
        if (s.priority !== me) return undefined;
        if (s.stack.length) return { type: 'pass' };
        if (oppLib === 0) return null;
        if (!s.bf.some(i => I(s, i).ctrl === me && isBreach(MF.def(s, i)))) { const b = castOf(s, me, isBreach); return b || null; }
        // Each turn of the loop: Lion's Eye Diamond for three mana, Brain Freeze (escaped) to refill the
        // graveyard or to kill, Lion's Eye Diamond escaped again. Storm counts every spell this turn.
        const freeze = castOf(s, me, isFreeze, ['plain', 'escape']);
        if (freeze && 3 * (storm + 1) >= oppLib) return freeze;
        const led = s.bf.find(i => I(s, i).ctrl === me && isLED(MF.def(s, i)));
        if (led != null) { const m = MF.legalActions(s).find(a => a.type === 'mana' && a.iid === led); if (m) return m; }
        if (freeze) return freeze;
        const ledCast = castOf(s, me, isLED, ['plain', 'escape']); if (ledCast) return ledCast;
        return null;
      },
      wins: (r, me) => r.winner === me || P(r, 1 - me).lib.length === 0,
      underway: (s, me) => s.bf.some(i => I(s, i).ctrl === me && isBreach(MF.def(s, i))) && castThisTurn(s, me, d => isLED(d) || isFreeze(d)),
    },
  ];
  // The first line that wins when played out from here, and its next action now.
  function planLine(s, me) {
    if (s.winner != null || me == null) return null;
    for (const line of LINES) {
      if (!line.applies(s, me)) continue;
      if (s.ap === me && line.underway(s, me)) { const a = line.next(s, me); if (a) return a; continue; }   // committed: follow it (its own questions; the rest by policy)
      if (!s.pending && !s.stack.length && !mainEmpty(s, me)) continue;                             // a line starts in my main phase (Oracle and Breach are cast as sorceries)
      const a = line.next(s, me); if (a == null) continue;
      const r = runLine(determinize(s, s.log.length + 17), me, x => line.next(x, me), 3000);
      if (r && line.wins(r, me)) { MF.ai.stats.lines = (MF.ai.stats.lines || 0) + 1; return a; }
    }
    return null;
  }
  MF.aiPlanLine = planLine; MF.aiLines = LINES; MF.aiRunLine = runLine;
  MF.ai = {
    stats: { decisions: 0, rollouts: 0, applies: 0 },
    choose: function (s) {
      const me = MF.whoActs(s);
      MF.ai.stats.decisions++;
      { const line = planLine(s, me); if (line) return line; }                                  // PLAN D24: a win line that works when played out
      if (s.pending) {
        const q = s.pending.q;
        if (q.kind === 'block' && !q.opts.some(o => o.id === 'done')) return { type: 'answer', id: blockPolicy(s, q) };   // an illegal declaration: repair it by policy (a search here can add and undo forever)
        if (!SEARCH_KINDS[q.kind] || q.opts.length === 1) { const a = policyAnswer(s, q); if (a !== undefined) return { type: 'answer', id: a }; if (q.opts.length === 1) return { type: 'answer', id: q.opts[0].id }; }
      }
      let legal = candidates(s, MF.legalActions(s));
      if (s.pending && s.pending.q.kind === 'block') {                                           // a first blocker on a menace attacker only if a second one could join (else the search adds and undoes forever)
        const q = s.pending.q, v = MF.view(s);
        legal = legal.filter(a => { const o = q.opts.find(o2 => o2.id === a.id); if (!o || o.iid == null || !MF.chars(v, o.att).kw.menace || Object.values(q.assign).includes(o.att)) return true; return q.opts.some(o2 => o2.att === o.att && o2.iid !== o.iid); });
      }
      // The opponent's turn with nothing on the stack: a roll-out scores pass as never acting again this
      // turn, so the first window always looks best — a pump spent in their upkeep, a Role on a creature
      // that won't attack until my turn. Act where timing matters: their beginning of combat, combat, end step.
      if (W.waitWindows && !s.pending && s.ap !== me && !s.stack.length && !OPP_WINDOWS[s.step]) { const p = legal.find(a => a.type === 'pass'); if (p) return p; }
      // A question with very many answers (blocks on a board of tokens: 155 pairs once took 37 s) rolls out
      // the policy's own answer, "done", and the first others up to MAX_CANDIDATES — a count, so the AI stays
      // deterministic. Only big boards reach it.
      if (s.pending && legal.length > MAX_CANDIDATES) {
        const pa = policyAnswer(s, s.pending.q), must = legal.filter(a => a.id === 'done' || a.id === 'no' || a.id === pa);
        legal = must.concat(legal.filter(a => !must.includes(a)).slice(0, Math.max(0, MAX_CANDIDATES - must.length)));
      }
      if (legal.length === 1) return legal[0];
      // Every candidate and pass, rolled to the same horizon from the same determinized copy.
      const root = determinize(s, s.log.length);
      const st = { n: 0 };
      // PLAN D24: an opponent's spell or ability on the stack, and what stopping it is worth.
      const threats = s.pending ? [] : s.stack.filter(L => L.ctrl !== me).map(L => ({ L: L, v: threatOf(s, L, me) })).filter(t => t.v > 0);
      let best = legal[0], bs = -Infinity;
      for (const a of legal) {
        let v;
        try { const r = rolloutState(MF.apply(root, a), me, s.turn, st); v = evalFor(r, me); for (const t of threats) if (!resolvedAfter(r, t.L, s.log.length)) v += t.v; }
        catch (e) { throw e; }
        MF.ai.stats.rollouts++;
        if (a.type === 'pass' || a.id === 'done' || a.id === 'no' || a.id === 'keep') v += 0.05;   // ties go to doing nothing
        if (v > bs + 1e-9) { bs = v; best = a; }
      }
      MF.ai.stats.applies += st.n;
      return best;
    },
  };
})();
