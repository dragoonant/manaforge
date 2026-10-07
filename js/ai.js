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
  const W = { landInHand: 0.7, life: 1.0, lowLife: 6, lowLifeExtra: 1.2, card: 2.2, land: 1.6, landCap: 7, pow: 1.4, tou: 0.6, evasion: 0.6, creature: 1.0, perm: 0.8, untappedBlocker: 0.25, counter: 0.0, openInstant: 1.2, rollAttack: 1, waitWindows: 1 };
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
      if (p.lib.length < 3) x -= (3 - p.lib.length) * 4;
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
      case 'exileFromGrave': return q.opts.slice().sort((a, b) => keepValue(s, a.iid) - keepValue(s, b.iid))[0].id;
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
  function rollout(s, me, turn0, st) {
    let guard = 0;
    while (s.winner == null && s.turn === turn0 && guard++ < 600) { s = MF.apply(s, defaultAct(s)); st.n++; }
    return evalFor(s, me);
  }
  // Kinds where every answer is worth a roll-out when the AI itself is asked.
  const SEARCH_KINDS = { addCostYes: 1, attackWhom: 1, wardPay: 1, bargain: 1, payOrCounter: 1, gift: 1, handPick: 1, mode: 1, target: 1, attack: 1, block: 1, may: 1, enterAsCopy: 1, offspring: 1, kicker: 1, chooseKw: 1, x: 1, lookTop: 1 };

  const OPP_WINDOWS = { boc: 1, attackers: 1, blockers: 1, end: 1 };
  function candidates(s, legal) {
    const seen = new Set(), out = [];
    for (const a of legal) {
      if (a.type === 'cancel' || a.id === 'undo' || a.type === 'mana') continue;   // mana is made inside a payment; nothing it plays cares about a pool before one
      const key = a.type + ':' + (a.iid != null ? I(s, a.iid).id + '@' + I(s, a.iid).zone : '') + ':' + (a.ab != null ? a.ab : '') + ':' + (a.id != null ? a.id : '') + ':' + (a.door != null ? 'door' + a.door : '') + (a.alt ? 'alt' : '');
      if (seen.has(key)) continue; seen.add(key); out.push(a);
    }
    return out;
  }

  MF.ai = {
    stats: { decisions: 0, rollouts: 0, applies: 0 },
    choose: function (s) {
      const me = MF.whoActs(s);
      MF.ai.stats.decisions++;
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
      if (legal.length === 1) return legal[0];
      // Every candidate and pass, rolled to the same horizon from the same determinized copy.
      const root = determinize(s, s.log.length);
      const st = { n: 0 };
      let best = legal[0], bs = -Infinity;
      for (const a of legal) {
        let v;
        try { v = rollout(MF.apply(root, a), me, s.turn, st); }
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
