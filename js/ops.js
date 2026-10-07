// The effect vocabulary. tools/build-cards.mjs compiles Oracle text into these filters,
// conditions, values and ops; an op with no handler or no describer is rejected at load
// (MF.validate), so neither half can be forgotten.
(function () {
  'use strict';
  const MF = window.MF;
  const I = (s, iid) => s.cards[iid];
  const P = (s, seat) => s.players[seat];
  const log = MF.log;

  // -------------------------------------------------------------------------------------------
  // Filters. One grammar for "creature you control with power 2 or less", "nonland permanent an
  // opponent controls", "any target". `ch` is the object's characteristics (from MF.chars, or a
  // layer-in-progress table inside the characteristics door).
  // -------------------------------------------------------------------------------------------
  MF.matchChars = function (s, iid, ch, f, who, srcIid) {
    if (!f) return true;
    if (f.any) return (!f.other || iid !== srcIid) && ch.types.some(t => t === 'Creature' || t === 'Planeswalker' || t === 'Battle');   // CR 115.4: "any target"; "any other target"
    if (f.player) return false;
    if (f.types && !f.types.some(t => ch.types.includes(t))) return false;
    if (f.notTypes && f.notTypes.some(t => ch.types.includes(t))) return false;
    if (f.notSupers && f.notSupers.some(t => ch.supers.includes(t))) return false;   // "nonbasic"
    if (f.notSubtypes && f.notSubtypes.some(t => ch.subtypes.includes(t)) || (f.notSubtypes && ch.allCreatureTypes)) return false;   // "non-outlaw"
    if (f.supers && !f.supers.every(t => ch.supers.includes(t))) return false;                  // "basic land" (CR 205.4a)
    if (f.subtypes && !(ch.allCreatureTypes && ch.types.includes('Creature')) && !f.subtypes.some(t => ch.subtypes.includes(t))) return false;   // CR 205.3m: "all creature types"
    if (f.ctrl === 'you' && ch.ctrl !== who) return false;
    if (f.ctrl === 'opp' && ch.ctrl === who) return false;
    if (f.other && iid === srcIid) return false;
    if (f.notIid != null && iid === f.notIid) return false;                                       // "other than that creature"
    if (f.mvLEv && !(ch.mv <= MF.num({ s: s, ctrl: who, src: srcIid }, f.mvLEv))) return false;     // Lay Down Arms: "less than or equal to the number of Plains you control"
    if (f.kw && !ch.kw[f.kw]) return false;
    if (f.notKw && ch.kw[f.notKw]) return false;
    if (f.powLE != null && !(ch.p <= f.powLE)) return false;
    if (f.powGE != null && !(ch.p >= f.powGE)) return false;
    if (f.ptGE != null && !(ch.p >= f.ptGE || ch.t >= f.ptGE)) return false;
    if (f.touGtPow && !(ch.t > ch.p)) return false;
    if (f.counter && !((I(s, iid).ctr[f.counter] || 0) > 0)) return false;
    if (f.tok && !I(s, iid).tok) return false;
    if (f.tokOrSub && !(I(s, iid).tok || ch.subtypes.includes(f.tokOrSub))) return false;
    if (f.mvLE != null && !(ch.mv <= f.mvLE)) return false;
    if (f.attacking && !(s.combat && s.combat.attackers.includes(iid))) return false;
    if (f.ptSumLE != null && !(ch.p + ch.t <= f.ptSumLE)) return false;                         // Cut Down: "total power and toughness 5 or less"
    return true;
  };
  MF.matchPlayer = function (s, seat, f, who) {
    if (f.any) return true;
    if (!f.player) return false;
    if (f.player === 'opp') return seat !== who;
    if (f.player === 'you') return seat === who;
    return true;
  };
  MF.slotTakesPlayers = f => !!(f.any || f.player);
  MF.slotTakesObjects = f => !!(f.any || !f.player);
  const countMine = (s, who, f, src, table) => s.bf.filter(i => { const ch = table ? table[i] : MF.chars(s, i); return MF.matchChars(s, i, ch, Object.assign({ ctrl: 'you' }, f), who, src); }).length;

  // -------------------------------------------------------------------------------------------
  // Conditions. x = { s, ctrl, src, L, ev, t, flags }. A static's condition is read inside the
  // characteristics door with the table so far (MF.condStatic), never by calling back into it.
  // -------------------------------------------------------------------------------------------
  const CONDS = {
    control: (x, c, table) => countMine(x.s, x.ctrl, c.f, x.src, table) >= (c.n || 1),
    totalPower: x => x.s.bf.filter(i => I(x.s, i).ctrl === x.ctrl && MF.isType(x.s, i, 'Creature')).reduce((a, i) => a + MF.chars(x.s, i).p, 0) >= x.c.n,   // CR 107.1b: negative power counts as negative
    did: x => !!x.flags.did,
    enteredOther: x => (P(x.s, x.ctrl).h.enteredIids || []).some(i => i !== x.src),
    offspringPaid: x => { const c = I(x.s, x.src); return !!(c && c.offspringPaid); },
    // Alania: "if it's the first instant spell, the first sorcery spell, or the first Otter spell
    // other than Alania you've cast this turn" — counted from this turn's cast record up to that spell.
    firstOfKind: x => {
      const ev = x.ev, list = P(x.s, x.ctrl).h.castList || [];
      const k = list.findIndex(e => e.lid === ev.lid); if (k < 0) return false;
      const me = list[k], before = list.slice(0, k), srcName = x.lki ? x.lki.name : MF.chars(x.s, x.src).name;
      if (me.types.includes('Instant') && !before.some(e => e.types.includes('Instant'))) return true;
      if (me.types.includes('Sorcery') && !before.some(e => e.types.includes('Sorcery'))) return true;
      const otter = e => e.subtypes.includes('Otter') && e.name !== srcName;
      if (otter(me) && !before.some(otter)) return true;
      return false;
    },
    kicked: x => !!(x.L && x.L.kicked),                                                         // CR 702.33d
    controlAtMost: (x, c, table) => countMine(x.s, x.ctrl, c.f, x.src, table) <= c.n,           // "unless you control two or fewer other lands"
    earlyTurn: (x, c) => { const n = x.s.log.filter(e => e.t === 'turn' && e.who === x.ctrl).length; return n <= c.n; },   // "your first, second, or third turn of the game"
    enteredThisTurn: x => { const o = I(x.s, x.src); return !!o && o.ctlTurn === x.s.turn; },
    any: (x, c) => c.of.some(k => MF.cond(x, k)),
    graveTypes: (x, c) => cardTypes(x.s, P(x.s, x.ctrl).grave) >= c.n,                          // delirium: card types among cards in your graveyard (CR 205.2a)
    exiledWithTypes: (x, c) => { const o = I(x.s, x.src); return cardTypes(x.s, ((o && o.exiled) || []).filter(i => I(x.s, i) && I(x.s, i).zone === 'exile')) >= c.n; },   // CR 607.2a
    graveCount: (x, c) => P(x.s, x.ctrl).grave.length >= c.n,
    oppLostLife: x => (P(x.s, 1 - x.ctrl).h.lostLife || 0) > 0,
    addCostPaid: x => !!(x.L && x.L.addCostPaid),                                            // "if this spell's additional cost was paid", teamwork
    oppMore: (x, c) => { const me = P(x.s, x.ctrl), op = P(x.s, 1 - x.ctrl), n = (p, w) => w === 'life' ? p.life : w === 'hand' ? p.hand.length : x.s.bf.filter(i => I(x.s, i).ctrl === p.seat && MF.chars(x.s, i).types.includes(w === 'lands' ? 'Land' : 'Creature')).length; return n(op, c.what) > n(me, c.what); },   // Beza
    impendingTime: x => { const c = I(x.s, x.src); return !!c && !!c.impended && (c.ctr.time || 0) > 0; },   // CR 702.176a's intervening "if"
    castFromGrave: x => !!(x.L && x.L.from === 'grave'),                                           // "if this spell was cast from a graveyard"
    counterAtLeast: (x, c) => { const o = I(x.s, x.src); return !!o && (o.ctr[c.kind] || 0) >= c.n; },
    descended: x => !!P(x.s, x.ctrl).h.descended,                                                // CR 700.11
    oppLifeLE: (x, c) => P(x.s, 1 - x.ctrl).life <= c.n,                                          // "as long as an opponent has 10 or less life"
    sneakPaid: x => !!(x.L && x.L.sneak),                                                      // CR 702.190b
    gainedAtLeast: (x, c) => (P(x.s, x.ctrl).h.gained || 0) >= c.n,                            // "if you gained life this turn", "3 or more life"
    lostLifeThisTurn: x => (P(x.s, x.ctrl).h.lostLife || 0) > 0,
    all: (x, c) => c.of.every(k => MF.cond(x, k)),
    evIs: (x, c) => { const i = x.ev && x.ev.iid; return i != null && x.s.cards[i] && x.s.cards[i].zone === 'bf' && MF.matchChars(x.s, i, MF.chars(x.s, i), c.f, x.ctrl, x.src); },   // "If it's a Spider"
    lkiType: (x, c) => !!(x.lki && x.lki.types.includes(c.type)),                             // "if it was a creature"
    selfPowerIs: (x, c) => { const o = I(x.s, x.src); const p = o && o.zone === 'bf' ? MF.chars(x.s, x.src).p : x.lki ? x.lki.p : null; return p === c.n; },   // Amalia: checked once, last known if gone
    hasCounter: (x, c, table) => { const o = I(x.s, x.src); return !!o && (o.ctr[c.kind] || 0) > 0; },
    lifeAtMostHalfStart: x => P(x.s, x.ctrl).life <= P(x.s, x.ctrl).startLife / 2,           // Cecil: "half your starting life total" (CR 107.1a: no rounding needed for a comparison)
    notSolved: x => { const o = I(x.s, x.src); return !!o && !o.solved; },
    lifeOverStart: (x, c) => P(x.s, x.ctrl).life - P(x.s, x.ctrl).startLife >= c.n,            // "greater than your starting life total" (n 1), "at least 10 greater" (n 10) — CR 119.1
    giftPromised: x => !!(x.L && x.L.gift != null),                                            // CR 702.174k
    bargained: x => !!(x.L && x.L.bargained),                                                  // CR 702.166b
    yourTurn: x => x.s.ap === x.ctrl,
    noCounters: x => { const l = x.lki; return !!l && !Object.values(l.ctr || {}).some(n => n > 0); },   // "if it had no counters on it" — as it last existed (CR 603.10a)
  };
  MF.conds = CONDS;
  function cardTypes(s, iids) { const ts = new Set(); for (const i of iids) for (const ty of MF.def(s, i).types) ts.add(ty); return ts.size; }
  MF.cardTypes = cardTypes;
  MF.cond = function (x, c) {
    if (!c) return true;
    const f = CONDS[c.c];
    if (!f) throw new Error('no condition handler: ' + c.c);
    return f(Object.assign({}, x, { c: c }), c, null);
  };
  MF.condStatic = function (s, src, c, table) {
    const f = CONDS[c.c];
    if (!f) throw new Error('no condition handler: ' + c.c);
    return f({ s: s, ctrl: table[src].ctrl, src: src, c: c, flags: {} }, c, table);
  };

  // Values: a literal, or { v: name } read when the effect is applied (CR 608.2h).
  const VALS = {
    creatures: (x, v, table) => countMine(x.s, x.ctrl, { types: ['Creature'] }, x.src, table),
    x: x => (x.L && x.L.kind === 'spell' ? x.L.x : (I(x.s, x.src) || {}).xPaid) || 0,          // a permanent's X is the one paid for its spell (CR 107.3m)
    halfX: (x) => Math.floor(num(x, { v: 'x' }) / 2),
    // "its power": the object's current power, or its last known power if it has left (CR 608.2h).
    power: (x, v) => { const r = MF.resolveRefs(x, v.of)[0]; if (r != null) return MF.chars(x.s, r).p; if (v.of === 'self' && x.lki) return x.lki.p; return 0; },
    castNoncreature: (x, v) => { const who = x.ev.ctrl; return (P(x.s, who).h.castList || []).filter(e => !e.types.includes('Creature')).length; },   // "the number of noncreature spells they've cast this turn"
    evAmount: x => x.ev.n,                                                                      // "that much damage"
    kicked: (x, v) => x.L && x.L.kicked ? v.yes : v.no,
    countYou: (x, v, table) => x.s.bf.filter(i => I(x.s, i).ctrl === x.ctrl && MF.matchChars(x.s, i, table ? table[i] : MF.chars(x.s, i), v.f, x.ctrl, x.src)).length,   // "the number of Plains you control"
    creLeftYou: x => P(x.s, x.ctrl).h.creLeft || 0,                                              // "each creature that left the battlefield under your control this turn"
    graveCount: x => P(x.s, x.ctrl).grave.filter(i => MF.def(x.s, i).types.some(ty => ['Artifact', 'Battle', 'Creature', 'Enchantment', 'Land', 'Planeswalker'].includes(ty))).length,   // "permanent cards in your graveyard": card types from the card itself (a CDA reading chars here would read its own count)
    lands: (x, v, table) => countMine(x.s, x.ctrl, { types: ['Land'] }, x.src, table),        // "the number of lands you control"
    gainedThisTurn: x => P(x.s, x.ctrl).h.gained || 0,
    oppsLostLife: x => ((P(x.s, 1 - x.ctrl).h.lostLife || 0) > 0 ? 1 : 0),                    // "for each opponent who lost life this turn"
    oppExiledCreatures: x => ((x.s.exiledCre || {})[1 - x.ctrl] || 0),
    countOthers: (x, v, table) => x.s.bf.filter(i => i !== x.src && MF.matchChars(x.s, i, table ? table[i] : MF.chars(x.s, i), v.f, x.ctrl, x.src)).length,                                        // CR 702.33e
  };
  MF.vals = VALS;
  const num = MF.num = function (x, v) { if (typeof v === 'number') return v; const f = VALS[v.v]; if (!f) throw new Error('no value: ' + v.v); return f(x, v, null); };
  MF.valueStatic = function (s, src, v, table) { const f = VALS[v.v]; if (!f) throw new Error('no value: ' + v.v); return f({ s: s, ctrl: table[src].ctrl, src: src }, v, table); };

  // -------------------------------------------------------------------------------------------
  // Trigger matching (CR 603.2). `src` is the source's characteristics or its last known
  // information; `a` is the compiled ability.
  // -------------------------------------------------------------------------------------------
  const subject = (s, iid, src, who, evIid) => {
    if (who === 'self') return evIid === iid;
    if (who.or) return who.or.some(w => subject(s, iid, src, w, evIid));
    if (who.self) return evIid === iid && MF.matchChars(s, evIid, MF.chars(s, evIid), who.self, src.ctrl, iid);   // "this creature ... with toughness greater than its power"
    const c = s.cards[evIid]; if (!c || c.zone !== 'bf') return false;
    return MF.matchChars(s, evIid, MF.chars(s, evIid), who, src.ctrl, iid);
  };
  MF.trigMatch = function (s, iid, src, a, ev) {
    switch (ev.t) {
      case 'attacks': {
        if (!subject(s, iid, src, a.who, ev.iid) || (a.firstEachTurn && !ev.first)) return false;
        // Preacher of the Schism: checked as it triggers only (its rulings). In a two-player game the attacked player is the opponent.
        const me = P(s, src.ctrl).life, them = P(s, 1 - src.ctrl).life;
        if (a.defMostLife && !(ev.target && ev.target.p != null)) return false;                 // its ruling: only when it attacks a player
        if (a.defMostLife && !(them >= me)) return false;
        if (a.youMostLife && !(me >= them)) return false;
        return true;
      }
      case 'enters': case 'blocks': case 'becomesBlocked': return subject(s, iid, src, a.who, ev.iid) && (!a.firstEachTurn || ev.first);
      case 'unlock': return ev.iid === iid && ev.door === a.door;                                // "When you unlock this door" (CR 709.5h)
      case 'levelUp': return ev.iid === iid && ev.level === a.level;
      case 'lore': return ev.iid === iid && ev.before < a.chapter && ev.after >= a.chapter;      // CR 714.2b
      case 'leaves': return a.iid != null ? ev.iid === a.iid && (ev.to === 'grave' || ev.to === 'exile') : ev.iid === iid;   // earthbend's return; LTB triggers
      case 'discardBatch': case 'leftGraveBatch': case 'toGraveBatch': case 'discarded': return !a.you || ev.who === src.ctrl;
      case 'crime': return ev.who === src.ctrl;                                                 // "Whenever you commit a crime"
      case 'search': return a.opp ? ev.who !== src.ctrl : ev.who === src.ctrl;
      case 'drawCard': return (!a.you || ev.who === src.ctrl) && (!a.opp || ev.who !== src.ctrl) && (!a.nth || ev.nth === a.nth);
      case 'counterPut': return ev.iid === iid && (!a.ctrKind || ev.kind === a.ctrKind) && (!a.nth || (ev.before < a.nth && ev.after >= a.nth));   // "When the fourth plan counter is put on this"                               // "When this Class becomes level N" (CR 716.2a)
      case 'cast': return (a.anyPlayer || ev.ctrl === src.ctrl) && (!a.oppOnly || ev.ctrl !== src.ctrl) && (!a.chosenParity || (s.cards[iid].chosen && ((ev.mv % 2 === 0) === (s.cards[iid].chosen === 'even')))) && (!a.nth || ev.nth === a.nth) && (!a.spell || ((!a.spell.notTypes || !a.spell.notTypes.some(t => ev.types.includes(t))) && (!a.spell.types || a.spell.types.some(t => ev.types.includes(t))) && (a.spell.mvGE == null || ev.mv >= a.spell.mvGE)));
      case 'dealsDamage': return (a.who && a.who !== 'self' ? (ev.srcCtrl === src.ctrl && (!a.who.types || a.who.types.some(ty => (ev.srcTypes || []).includes(ty)))) : ev.src === iid) && (!a.toOpp || (ev.to.p != null && ev.to.p !== src.ctrl)) && (!a.toPlayer || ev.to.p != null) && (!a.combat || ev.combat);
      case 'sacrificed': case 'dies': return ev.iid === iid;
      case 'beginStep': return ev.step === a.step && (!a.yours || ev.ap === src.ctrl);
      case 'gainLife': return ev.who === src.ctrl;
      // Valiant: "becomes the target of a spell or ability you control for the first time each turn".
      case 'targeted': if (a.ownCreature) { const tc = s.cards[ev.iid]; return !!tc && (tc.zone === 'bf' || (tc.zone === 'stack' && !a.permOnly)) && tc.ctrl === src.ctrl && MF.chars(s, ev.iid).types.includes('Creature') && ev.by !== src.ctrl; }   // Surrak
        return ev.iid === iid && (!a.byYou || ev.by === src.ctrl) && (!a.byOpp || ev.by !== src.ctrl) && (!a.firstEachTurn || ev.firstThisTurn);
      case 'reflexive': return false;
      case 'attackWith': return ev.ctrl === src.ctrl && (!a.sub || ev.subtypes.includes(a.sub) || ev.anyType);   // CR 508.3c: once for the declaration; "all creature types" counts (CR 205.3m)
      case 'dealtDamage': if (a.who && a.who !== 'self') { const dc = s.cards[ev.iid]; return !!dc && dc.zone === 'bf' && MF.matchChars(s, ev.iid, MF.chars(s, ev.iid), a.who, src.ctrl, iid); }
        return ev.iid === iid;
      default: return false;
    }
  };
  MF.PROWESS = { k: 'trig', on: 'cast', ops: [{ o: 'pump', on: 'self', p: 1, t: 1 }] };   // CR 702.108a

  // -------------------------------------------------------------------------------------------
  // References: which objects an op acts on.
  //   { t: n }   the objects chosen for target slot n (legal ones only, CR 608.2b)
  //   'self'     the source, if it is still the object it was
  //   'enchanted' / 'equipped'  what the source is attached to
  //   'ev'       the object the trigger event names ("that creature")
  //   { each: f } every permanent matching f, as the effect begins (CR 611.2c)
  //   'it'       the card the previous op moved ("that card")
  // -------------------------------------------------------------------------------------------
  MF.resolveRefs = function (x, r) {
    const s = x.s;
    const onBf = i => i != null && s.cards[i] && s.cards[i].zone === 'bf';
    if (r == null) return [];
    if (r === 'self') return onBf(x.src) ? [x.src] : [];
    if (r === 'enchanted' || r === 'equipped') { const c = s.cards[x.src]; return c && c.zone === 'bf' && onBf(c.att) ? [c.att] : []; }
    if (r === 'ev') return onBf(x.ev && x.ev.iid) ? [x.ev.iid] : [];
    if (r === 'it') return x.it != null ? [x.it] : [];
    if (r.t != null) return (x.t[r.t] || []).filter(q => q && q.c != null).map(q => q.c);
    if (r.each && r.each.ctrlOfT != null) { const ps = (x.t[r.each.ctrlOfT] || []).filter(q => q && q.p != null).map(q => q.p); return s.bf.filter(i => ps.includes(MF.chars(s, i).ctrl) && MF.matchChars(s, i, MF.chars(s, i), Object.assign({}, r.each, { ctrlOfT: undefined }), x.ctrl, x.src)); }   // "each creature target player controls"
    if (r.each) return s.bf.filter(i => MF.matchChars(s, i, MF.chars(s, i), r.each, x.ctrl, x.src));
    throw new Error('unknown reference ' + JSON.stringify(r));
  };
  const PLAYER_REFS = ['eachOpp', 'you', 'evPlayer'];
  const players = (x, r) => {
    if (r === 'you') return [x.ctrl];
    if (r === 'eachOpp') return [1 - x.ctrl];
    if (r === 'eachPlayer') return [x.s.ap, 1 - x.s.ap];
    if (r === 'evPlayer') return [x.ev.t === 'dealsDamage' ? x.ev.to.p : x.ev.t === 'drawCard' ? x.ev.who : x.ev.ctrl];          // "that player" / "they": the one the event names
    if (r && r.t != null) return (x.t[r.t] || []).filter(q => q && q.p != null).map(q => q.p);
    return [];
  };
  // The damage source's characteristics: the object if it is still where it was, else its last
  // known information (CR 608.2h). A spell deals damage from the stack.
  function srcChars(x, from) {
    const s = x.s;
    if (from === 'self') {
      const c = s.cards[x.src];
      if (c && (c.zone === 'bf' || c.zone === 'stack')) return Object.assign({ id: c.id }, MF.chars(s, x.src));
      if (x.lki) return Object.assign({ iid: x.src }, x.lki, { kw: x.lki.kw, ctrl: x.lki.ctrl });
      return null;
    }
    const r = MF.resolveRefs(x, from)[0];
    return r != null ? Object.assign({ id: s.cards[r].id }, MF.chars(s, r)) : null;
  }

  // -------------------------------------------------------------------------------------------
  // Ops
  // -------------------------------------------------------------------------------------------
  // "Its controller": the target's controller as it last existed on the battlefield (CR 608.2h).
  function ctrlOfTarget(x, ref) {
    const r = (x.t[ref.t] || [])[0]; if (!r || r.c == null) return null;
    const c = I(x.s, r.c); if (!c) return null;
    return c.zone === 'bf' ? c.ctrl : c.lki ? c.lki.ctrl : c.ctrl;
  }
  const OPS = {
    counter(x, op) {                                                                           // CR 122.1
      const n = num(x, op.n);                                                                 // fixed once as it resolves (Ouroboroid's X, its ruling)
      for (const i of MF.resolveRefs(x, op.on)) {
        const c = I(x.s, i);
        const before = c.ctr[op.kind] || 0;
        c.ctr[op.kind] = before + n;
        log(x.s, 'counter', { who: c.ctrl, c: c.id, n: n, kind: op.kind, src: x.L ? x.L.srcId || I(x.s, x.src).id : null });
        MF.emit(x.s, { t: 'counterPut', iid: i, n: n, kind: op.kind, before: before, after: c.ctr[op.kind] });
      }
    },
    doubleCounters(x, op) {                                                                    // "double the number of +1/+1 counters on it" (CR 701.10e: put that many more)
      for (const i of MF.resolveRefs(x, op.on)) {
        const c = I(x.s, i), n = c.ctr[op.kind] || 0;
        if (!n) continue;
        c.ctr[op.kind] = 2 * n;
        const before = n;                                                                    // its ruling: that many more are put on it
        log(x.s, 'counter', { who: c.ctrl, c: c.id, n: n, kind: op.kind, src: x.L.srcId });
        MF.emit(x.s, { t: 'counterPut', iid: i, n: n, kind: op.kind, before: before, after: 2 * n });
      }
    },
    tap(x, op) { for (const i of MF.resolveRefs(x, op.on)) { const c = I(x.s, i); if (!c.tapped) { c.tapped = true; log(x.s, 'tapped', { who: c.ctrl, c: c.id }); } } },
    pump(x, op) {                                                                              // "gets +N/+N until end of turn", "gains <keyword>"
      const iids = MF.resolveRefs(x, op.on);
      const p = op.p == null ? 0 : num(x, op.p), t = op.t == null ? 0 : num(x, op.t);
      for (const i of iids) {
        if (p || t) x.s.effects.push({ k: 'pt', iid: i, p: p, t: t, until: 'eot', ts: x.s.ts++ });
        if (op.grant) x.s.effects.push({ k: 'grant', iid: i, kws: op.grant.slice(), until: 'eot', ts: x.s.ts++ });
      }
      if (iids.length) log(x.s, 'pump', { who: x.ctrl, cs: iids.map(i => I(x.s, i).id), p: p, tou: t, grant: op.grant || null, src: x.L ? x.L.srcId || x.L.id : null, all: !!(op.on && op.on.each) });
    },
    unblockable(x, op) { for (const i of MF.resolveRefs(x, op.on)) { x.s.effects.push({ k: 'unblockable', iid: i, until: 'eot' }); log(x.s, 'unblockable', { c: I(x.s, i).id }); } },
    scry(x, op) {                                                                              // CR 701.22a
      const s = x.s, p = P(s, x.ctrl), n = Math.min(num(x, op.n), p.lib.length);
      if (n <= 0) return;
      const look = p.lib.slice(0, n), bottom = [], top = [];
      for (const iid of look) {
        const a = MF.ask(x.x, { who: x.ctrl, kind: 'scry', n: n, k: look.indexOf(iid) + 1, src: x.src, opts: [{ id: 'top', iid: iid }, { id: 'bottom', iid: iid }] });
        (a === 'top' ? top : bottom).push(iid);
      }
      const order = (arr, where) => {                                                          // "in any order": asked when there are two or more distinguishable cards
        const out = [], left = arr.slice();
        while (left.length > 1 && new Set(left.map(i => I(s, i).id)).size > 1) {
          const a = MF.ask(x.x, { who: x.ctrl, kind: 'scryOrder', where: where, opts: left.map(i => ({ id: i, iid: i })) });
          out.push(a); left.splice(left.indexOf(a), 1);
        }
        return out.concat(left);
      };
      const topOrder = order(top, 'top'), botOrder = order(bottom, 'bottom');
      p.lib.splice(0, n);
      p.lib.unshift.apply(p.lib, topOrder);
      p.lib.push.apply(p.lib, botOrder);
      log(s, 'scry', { who: x.ctrl, n: n, top: top.length, bottom: bottom.length });
    },
    token(x, op) {                                                                             // CR 111.1
      if (op.forCtrlOf) { const w = ctrlOfTarget(x, op.forCtrlOf); if (w == null) return; return OPS.token(Object.assign({}, x, { ctrl: w }), Object.assign({}, op, { forCtrlOf: null })); }   // "Its controller creates ..."
      const s = x.s, n = num(x, op.n);
      for (let k = 0; k < n; k++) {
        const iid = s.nid++;
        s.cards[iid] = { iid: iid, id: op.id, owner: x.ctrl, ctrl: x.ctrl, zone: 'bf', ts: s.ts++, tapped: false, dmg: 0, dt: false, ctr: {}, att: null, ctlTurn: s.turn, tok: true };
        s.bf.push(iid);
        noteEntered(s, iid);
        x.it = iid;                                                                              // "You may attach this Equipment to it"
        // "tapped and attacking" (CR 508.4); The Last Ronin's Technique: only if the sneak cost was paid.
        const atk = (op.attacking || op.attackingIf) && (!op.attackingIf || MF.cond(x, op.attackingIf));
        if (op.tapped || atk) s.cards[iid].tapped = true;
        const attacking = atk ? MF.enterAttacking(s, iid) : false;
        (x.made = x.made || []).push(iid);
        log(s, 'token', { who: x.ctrl, c: op.id, tapped: !!s.cards[iid].tapped, attacking: attacking });
        MF.emit(s, { t: 'enters', iid: iid, ctrl: x.ctrl });
      }
      // "Sacrifice them at the beginning of the next end step": a delayed trigger (CR 603.7), made after the tokens.
      if (op.sacEnd && x.made && n > 0) (s.delayed = s.delayed || []).push({ src: x.src, ctrl: x.ctrl, once: true, ab: { k: 'trig', on: 'beginStep', step: 'end', ops: [{ o: 'sacThese', iids: x.made.slice(-n) }] } });
    },
    // Offspring (CR 702.175a): "create a token that's a copy of it, except it's 1/1".
    tokenCopy(x, op) {
      const s = x.s, src = MF.resolveRefs(x, op.of)[0];
      if (op.targeted && src == null) return;                                                  // an illegal target: nothing is copied (CR 608.2b)
      // If the creature has left the battlefield, its copiable values are its last known ones (CR 608.2h, 707.2): the record it left behind.
      const base = src != null ? I(s, src) : I(s, x.src);
      if (!base) { log(s, 'noSource', { src: x.L.srcId }); return; }
      const id = base.id, copy = base.copy ? base.copy : null;
      const iid = s.nid++;
      const except = Object.assign({}, copy ? copy.except : {}, op.except);
      s.cards[iid] = { iid: iid, id: id, owner: x.ctrl, ctrl: x.ctrl, zone: 'bf', ts: s.ts++, tapped: false, dmg: 0, dt: false, ctr: {}, att: null, ctlTurn: s.turn, tok: true, copy: { id: copy ? copy.id : id, except: except } };
      s.bf.push(iid);
      noteEntered(s, iid);
      log(s, 'tokenCopy', { who: x.ctrl, c: id });
      MF.emit(s, { t: 'enters', iid: iid, ctrl: x.ctrl });
    },
    destroy(x, op) { for (const i of MF.resolveRefs(x, op.on)) MF.destroy(x.s, i, 'effect'); },
    damage(x, op) {                                                                            // CR 120
      const sc = srcChars(x, op.from);
      if (!sc) { log(x.s, 'noSource', { src: x.L.srcId || x.L.id }); return; }               // the source is gone and has no last known information: nothing deals the damage
      const n = num(x, op.n);
      for (const seat of players(x, op.to)) if (MF.dealDamage(x.s, { srcChars: sc, to: { p: seat }, n: n }) > 0) (x.flags.dealtTo = x.flags.dealtTo || []).push(seat);
      if (!PLAYER_REFS.includes(op.to)) for (const i of MF.resolveRefs(x, op.to)) MF.dealDamage(x.s, { srcChars: sc, to: { c: i }, n: n });
    },
    // CR 701.25a: look at the top N; any number go to the graveyard, the rest back on top in any order.
    surveil(x, op) {
      const s = x.s, p = P(s, x.ctrl), n = Math.min(num(x, op.n), p.lib.length);
      if (n <= 0) return;
      const look = p.lib.slice(0, n), keep = [], yard = [];
      for (const iid of look) {
        const a = MF.ask(x.x, { who: x.ctrl, kind: 'surveil', n: n, k: look.indexOf(iid) + 1, src: x.src, opts: [{ id: 'top', iid: iid }, { id: 'grave', iid: iid }] });
        (a === 'top' ? keep : yard).push(iid);
      }
      const order = [], left = keep.slice();
      while (left.length > 1 && new Set(left.map(i => I(s, i).id)).size > 1) {
        const a = MF.ask(x.x, { who: x.ctrl, kind: 'scryOrder', where: 'top', opts: left.map(i => ({ id: i, iid: i })) });
        order.push(a); left.splice(left.indexOf(a), 1);
      }
      p.lib.splice(0, n);
      p.lib.unshift.apply(p.lib, order.concat(left));
      for (const iid of yard) { p.lib.unshift(iid); MF.move(s, iid, 'grave'); }               // milled cards are public: named in the log (CLAUDE.md rule 12)
      log(s, 'surveil', { who: x.ctrl, n: n, top: keep.length, grave: yard.map(i => I(s, i).id) });
    },
    // CR 701.23: search the library for a basic land card (the player chooses; finding nothing is allowed, 701.23b), put it onto the battlefield, shuffle.
    searchBasic(x, op) {
      if (op.whoT != null) {                                                                     // Erode: "Its controller may search ..." — the destroyed permanent's controller
        const q = (x.t[op.whoT] || [])[0]; if (!q || q.c == null) return;
        const who = I(x.s, q.c).ctrl;
        if (op.may && MF.ask(x.x, { who: who, kind: 'may', src: x.src, what: 'search', opts: [{ id: 'yes' }, { id: 'no' }] }) !== 'yes') return;
        return OPS.searchBasic(Object.assign({}, x, { ctrl: who }), { tapped: op.tapped, toHand: op.toHand });
      }
      const s = x.s, p = P(s, x.ctrl);
      const opts = p.lib.filter(i => { const d = MF.def(s, i); return d.types.includes('Land') && d.supers.includes('Basic'); }).map(i => ({ id: i, iid: i }));
      const seen = new Set(), uniq = opts.filter(o => { const id = I(s, o.iid).id; if (seen.has(id)) return false; seen.add(id); return true; });   // identical basics are one choice
      uniq.push({ id: 'none' });
      MF.emit(s, { t: 'search', who: x.ctrl });                                                 // "Whenever an opponent searches their library"
      const a = MF.ask(x.x, { who: x.ctrl, kind: 'search', src: x.src, what: 'basic land', opts: uniq });
      if (a !== 'none' && op.toHand) { const id = I(s, a).id; MF.move(s, a, 'hand'); log(s, 'toHand', { who: x.ctrl, c: id, revealed: true, from: 'library' }); }
      else if (a !== 'none') { const n = MF.move(s, a, 'bf', { ctrl: x.ctrl, tapped: !!op.tapped, x: x.x }); x.it = n; log(s, 'putOnto', { who: x.ctrl, c: I(s, n).id, tapped: !!op.tapped, from: 'library' }); }
      else log(s, 'searchNothing', { who: x.ctrl });
      MF.shuffle(s, p.lib);
    },
    mill(x, op) {                                                                              // CR 701.17a
      if (op.who) { for (const w of players(x, op.who)) OPS.mill(Object.assign({}, x, { ctrl: w }), { n: op.n }); return; }   // "target player mills four cards"
      const s = x.s, p = P(s, x.ctrl), n = Math.min(num(x, op.n), p.lib.length);
      const ids = [], milled = [];
      for (let k = 0; k < n; k++) { const id = I(s, p.lib[0]).id; milled.push(MF.move(s, p.lib[0], 'grave')); ids.push(id); }
      x.milled = milled;
      if (n) log(s, 'mill', { who: x.ctrl, cs: ids });
    },
    // "You may put a permanent card from among the milled cards into your hand" (CR 701.17c: found in the graveyard).
    pickMilled(x, op) {
      const s = x.s, PERM = ['Artifact', 'Battle', 'Creature', 'Enchantment', 'Land', 'Planeswalker'];
      const ok = t => op.type === 'permanent' ? PERM.some(ty => t.includes(ty)) : t.includes(op.type[0].toUpperCase() + op.type.slice(1));
      const opts = (x.milled || []).filter(i => I(s, i).zone === 'grave' && ok(MF.def(s, i).types)).map(i => ({ id: i, iid: i }));
      if (!opts.length && op.ifSub) return;
      if (!opts.length) return;
      opts.push({ id: 'none' });
      const a = MF.ask(x.x, { who: x.ctrl, kind: 'pickMilled', src: x.src, type: op.type, opts: opts });
      if (a !== 'none') {
        const id = I(s, a).id; MF.move(s, a, 'hand'); log(s, 'toHand', { who: x.ctrl, c: id, revealed: true, from: 'graveyard' });
        if (op.ifSub && MF.def(s, a).subtypes.includes(op.ifSub.sub)) MF.gainLife(s, x.ctrl, op.ifSub.gain, x.L ? x.L.srcId : null);   // Town Greeter: "If you put a Town card into your hand this way"
      }
    },
    untap(x, op) { for (const i of MF.resolveRefs(x, op.on)) MF.untap(x.s, i); },
    extraCombat(x) { x.s.extraCombat = (x.s.extraCombat || 0) + 1; log(x.s, 'extraCombatAdded', { who: x.ctrl }); },
    // CR 701.14: each deals damage equal to its power to the other; if either is gone or not a creature, neither fights.
    fight(x, op) {
      const s = x.s, a = MF.resolveRefs(x, op.a)[0], b = MF.resolveRefs(x, op.b)[0];
      if (a == null || b == null || !MF.isType(s, a, 'Creature') || !MF.isType(s, b, 'Creature')) { log(s, 'noFight', {}); return; }
      const ca = Object.assign({ id: I(s, a).id }, MF.chars(s, a)), cb = Object.assign({ id: I(s, b).id }, MF.chars(s, b));
      log(s, 'fight', { a: ca.id, b: cb.id });
      MF.dealDamage(s, { srcChars: ca, to: { c: b }, n: Math.max(0, ca.p) });
      MF.dealDamage(s, { srcChars: cb, to: { c: a }, n: Math.max(0, cb.p) });
    },
    // "Exile target card from a graveyard." Linked to "cards exiled with this creature" (CR 607.2a).
    exile(x, op) {
      const s = x.s;
      const ids = op.on && op.on.t != null ? (x.t[op.on.t] || []).filter(q => q && q.c != null).map(q => q.c) : MF.resolveRefs(x, op.on);
      for (const i of ids) {
        const c = I(s, i); if (!c || c.zone === 'moved' || c.zone === 'exile') continue;
        const id = c.id, from0 = c.zone, n = MF.move(s, i, 'exile');
        log(s, 'exiled', { who: c.owner, c: id, by: x.L ? (x.L.srcId || x.L.id) : null, from: from0 });
        if (op.link) { const src = I(s, x.src); if (src && src.zone === 'bf') (src.exiled = src.exiled || []).push(n); }
      }
    },
    // Break Out: look at the top N, may reveal a card of a type; low enough mana value may go onto the battlefield, else to hand; the rest to the bottom at random.
    dig(x, op) {
      const s = x.s, p = P(s, x.ctrl), look = p.lib.slice(0, op.n);
      if (!look.length) return;
      const opts = look.filter(i => MF.def(s, i).types.includes(op.type)).map(i => ({ id: i, iid: i }));
      opts.push({ id: 'none' });
      // Nothing of the type among them: looking is not a choice (CLAUDE.md rule 11); the look is logged, shown only to its player.
      const pick = opts.length > 1 ? MF.ask(x.x, { who: x.ctrl, kind: 'dig', src: x.src, n: look.length, type: op.type, look: look, opts: opts }) : (log(s, 'lookedAt', { who: x.ctrl, cs: look.map(i => I(s, i).id), type: op.type }), 'none');
      const rest = look.filter(i => i !== pick);
      if (pick !== 'none') {
        const d = MF.def(s, pick);
        log(s, 'reveal', { who: x.ctrl, cs: [d.id] });
        let onto = false;
        if (MF.manaValue(MF.parseMana(d.mana)) <= op.bfMvMax) onto = MF.ask(x.x, { who: x.ctrl, kind: 'may', src: x.src, what: 'digOnto', c: d.id, opts: [{ id: 'yes' }, { id: 'no' }] }) === 'yes';
        if (onto) { const n = MF.move(s, pick, 'bf', { ctrl: x.ctrl, x: x.x }); if (op.grant) s.effects.push({ k: 'grant', iid: n, kws: op.grant.slice(), until: 'eot', ts: s.ts++ }); log(s, 'putOnto', { who: x.ctrl, c: d.id, tapped: false, from: 'library' }); }
        else { MF.move(s, pick, 'hand'); log(s, 'toHand', { who: x.ctrl, c: d.id, revealed: true, from: 'library' }); }
      }
      for (const i of rest) p.lib.splice(p.lib.indexOf(i), 1);
      MF.shuffle(s, rest); p.lib.push.apply(p.lib, rest);
      if (rest.length) log(s, 'toBottom', { who: x.ctrl, n: rest.length, random: true });
    },
    untapIt(x) { const c = x.it != null ? I(x.s, x.it) : null; if (c && c.zone === 'bf') MF.untap(x.s, x.it); },
    // Manifold Mouse: "gains your choice of double strike or trample until end of turn" — chosen on resolution (CR 608.2d).
    pumpChoice(x, op) {
      const iids = MF.resolveRefs(x, op.on); if (!iids.length) return;
      const k = MF.ask(x.x, { who: x.ctrl, kind: 'chooseKw', src: x.src, on: iids[0], opts: op.kws.map(k => ({ id: k })) });
      OPS.pump(x, { on: op.on, grant: [k] });
    },
    // Soulstone Sanctuary: "becomes a 3/3 creature with vigilance and all creature types. It's still a land." No duration: it lasts while the object does (CR 611.2a).
    animate(x, op) {
      for (const i of MF.resolveRefs(x, op.on)) {
        x.s.effects.push(Object.assign({ k: 'animate', iid: i, p: op.p, t: op.t, kws: op.kws.slice(), allTypes: !!op.allTypes, ts: x.s.ts++ }, op.until ? { until: op.until } : {}, op.colors ? { colors: op.colors } : {}, op.subtypes ? { subtypes: op.subtypes } : {}));
        log(x.s, 'animate', { who: x.ctrl, c: I(x.s, i).id, p: op.p, tou: op.t, kws: op.kws });
      }
    },
    // A Role token is an Aura token created attached to a creature (CR 111.10j-r, 303.7).
    role(x, op) {
      const s = x.s, to = MF.resolveRefs(x, op.on)[0];
      if (to == null) return;
      const id = 'token-role-' + op.role.toLowerCase().replace(/ /g, '-');
      if (!MF.cards[id]) throw new Error('Role token not in the pack: ' + op.role);
      const iid = s.nid++;
      s.cards[iid] = { iid: iid, id: id, owner: x.ctrl, ctrl: x.ctrl, zone: 'bf', ts: s.ts++, tapped: false, dmg: 0, dt: false, ctr: {}, att: to, ctlTurn: s.turn, tok: true };
      s.bf.push(iid);
      log(s, 'role', { who: x.ctrl, c: id, to: I(s, to).id });
      MF.emit(s, { t: 'enters', iid: iid, ctrl: x.ctrl });
    },
    // Tersa Lightshatter: "discard up to two cards, then draw that many cards".
    discardUpTo(x, op) {
      const s = x.s, p = P(s, x.ctrl); let n = 0;
      while (n < op.n && p.hand.length) {
        const opts = p.hand.map(i => ({ id: i, iid: i })); opts.push({ id: 'done' });
        const a = MF.ask(x.x, { who: x.ctrl, kind: 'discardUpTo', src: x.src, n: op.n, done: n, opts: opts });
        if (a === 'done') break;
        MF.discard(s, a); n++;
      }
      if (op.thenDraw && n) MF.draw(s, x.ctrl, n);
    },
    // Tersa Lightshatter: "exile a card at random from your graveyard. You may play that card this turn."
    graveImpulse(x, op) {
      const s = x.s, p = P(s, x.ctrl);
      if (!p.grave.length) return;
      const pick = p.grave[MF.randInt(s, p.grave.length)], id = I(s, pick).id;
      const n = MF.move(s, pick, 'exile');
      s.effects.push({ k: 'mayPlay', iid: n, who: x.ctrl, until: 'endOfTurn', turn: s.turn });
      log(s, 'impulse', { who: x.ctrl, c: id, until: s.turn, from: 'graveyard' });
    },
    // Screaming Nemesis: "If a player is dealt damage this way, they can't gain life for the rest of the game."
    noLifeGain(x, op) {
      for (const seat of players(x, op.on)) if ((x.flags.dealtTo || []).includes(seat)) { P(x.s, seat).noGain = true; log(x.s, 'noLifeGain', { who: seat }); }
    },
    draw(x, op) { for (const who of op.who ? players(x, op.who) : [x.ctrl]) MF.draw(x.s, who, num(x, op.n)); },
    discard(x, op) {                                                                           // "then discard a card": the player chooses
      const s = x.s, p = P(s, x.ctrl);
      for (let k = 0; k < op.n && p.hand.length; k++) {
        const iid = MF.ask(x.x, { who: x.ctrl, kind: 'discard', src: x.src, left: op.n - k, opts: p.hand.map(i => ({ id: i, iid: i })) });
        MF.discard(s, iid);
      }
    },
    gain(x, op) {
      if (op.forCtrlOf) { const w = ctrlOfTarget(x, op.forCtrlOf); if (w == null) return; return OPS.gain(Object.assign({}, x, { ctrl: w }), Object.assign({}, op, { forCtrlOf: null })); }   // "Its controller gains 3 life"
      MF.gainLife(x.s, x.ctrl, num(x, op.n), { name: x.L ? MF.cards[x.L.srcId || x.L.id].name : null }); },
    // Fecund Greenshell: "look at the top card of your library. If it's a land card, you may put it
    // onto the battlefield tapped. Otherwise, put it into your hand."
    lookTop(x, op) {
      const s = x.s, p = P(s, x.ctrl);
      if (!p.lib.length) return;
      const top = p.lib[0], d = MF.def(s, top);
      if (d.types.includes(op.type)) {
        const a = MF.ask(x.x, { who: x.ctrl, kind: 'lookTop', src: x.src, opts: [{ id: 'yes', iid: top }, { id: 'no', iid: top }] });
        if (a === 'yes') { log(s, 'putOnto', { who: x.ctrl, c: d.id, tapped: true, from: 'library' }); MF.move(s, top, 'bf', { ctrl: x.ctrl, tapped: true, x: x.x }); }
        else { log(s, 'toHand', { who: x.ctrl, c: d.id, revealed: false, from: 'library' }); MF.move(s, top, 'hand'); }   // "Otherwise, put it into your hand" covers a land not put onto the battlefield (its ruling)
      } else { log(s, 'toHand', { who: x.ctrl, c: d.id, revealed: false, from: 'library' }); MF.move(s, top, 'hand'); }
    },
    // Clifftop Lookout: "reveal cards from the top of your library until you reveal a land card.
    // Put that card onto the battlefield tapped and the rest on the bottom of your library in a random order."
    revealUntil(x, op) {
      const s = x.s, p = P(s, x.ctrl), shown = [];
      let hit = null;
      for (const iid of p.lib) { shown.push(iid); if (MF.def(s, iid).types.includes(op.type)) { hit = iid; break; } }
      log(s, 'reveal', { who: x.ctrl, cs: shown.map(i => I(s, i).id) });
      const rest = shown.filter(i => i !== hit);
      if (hit != null) { const n = MF.move(s, hit, 'bf', { ctrl: x.ctrl, tapped: true, x: x.x }); log(s, 'putOnto', { who: x.ctrl, c: I(s, n).id, tapped: true, from: 'library' }); }
      for (const i of rest) p.lib.splice(p.lib.indexOf(i), 1);
      MF.shuffle(s, rest);
      p.lib.push.apply(p.lib, rest);
      if (rest.length) log(s, 'toBottom', { who: x.ctrl, n: rest.length, random: true });
    },
    // Alania's Pathmaker: "exile the top card of your library. Until the end of your next turn, you may play that card."
    impulse(x, op) {
      const s = x.s, p = P(s, x.ctrl);
      if (!p.lib.length) return;
      const id = I(s, p.lib[0]).id;
      const n = MF.move(s, p.lib[0], 'exile');
      const turn = op.until === 'eot' ? s.turn : s.ap === x.ctrl ? s.turn + 2 : s.turn + 1;    // "until end of turn" / "until the end of your next turn"
      if (op.until === 'nextEndStep') s.effects.push({ k: 'mayPlay', iid: n, who: x.ctrl, until: 'nextEndStep' });   // Inti: until your next end step begins
      else s.effects.push({ k: 'mayPlay', iid: n, who: x.ctrl, until: 'endOfTurn', turn: turn });
      log(s, 'impulse', { who: x.ctrl, c: id, until: turn });
      x.it = n;
    },
    attach(x, op) {                                                                            // CR 701.3, 702.6a
      const src = I(x.s, x.src), to = MF.resolveRefs(x, op.on)[0];
      if (!src || src.zone !== 'bf' || to == null) return;
      if (src.att === to) return;                                                                // CR 701.3b: attaching to what it is already attached to does nothing
      src.att = to; src.ts = x.s.ts++;                                                          // CR 613.7e
      log(x.s, 'attach', { who: x.ctrl, c: src.id, to: I(x.s, to).id });
    },
    may(x, op) {                                                                               // "you may": asked on resolution (CR 608.2d)
      const a = MF.ask(x.x, { who: x.ctrl, kind: 'may', src: x.src, what: op.what, opts: [{ id: 'yes' }, { id: 'no' }] });
      x.flags.did = a === 'yes';
      if (x.flags.did) MF.runOps(x, op.ops);
    },
    if(x, op) { if (MF.cond(x, op.cond)) MF.runOps(x, op.ops); else if (op.else) MF.runOps(x, op.else); },   // "Otherwise, ..."
    // "each opponent loses 2 life", "you lose 1 life", "they lose half their life, rounded up" (CR 119.3, 107.1a)
    loseLife(x, op) {
      for (const who of players(x, op.who)) {
        const n = op.half ? Math.ceil(Math.max(0, P(x.s, who).life) / 2) : num(x, op.n);
        MF.loseLife(x.s, who, n, 'effect', x.L ? (x.L.srcId || x.L.id) : null);
      }
    },
    // Duress, Cruelclaw's Heist: "Target opponent reveals their hand. You choose a <kind> card from it.
    // That player discards that card." / "Exile that card." The revealed hand is public: named in the log.
    handPick(x, op) {
      const s = x.s;
      for (const who of players(x, op.who)) {
        const p = P(s, who);
        log(s, op.look ? 'lookHand' : 'revealHand', { who: who, by: x.ctrl, cs: p.hand.map(i => I(s, i).id) });   // "look at": only the looker sees it
        const fit = i => { const d = MF.def(s, i); return !(op.f.notTypes || []).some(ty => d.types.includes(ty)); };
        const opts = p.hand.filter(fit).map(i => ({ id: i, iid: i }));
        if (!opts.length) { log(s, 'handPickNone', { who: x.ctrl }); continue; }
        if (op.then === 'exileUntil') { const sc = I(s, x.src); if (!sc || sc.zone !== 'bf') continue; }   // Deep-Cavern Bat's ruling: gone already, nothing is exiled
        if (op.may) opts.push({ id: 'none' });
        const a = MF.ask(x.x, { who: x.ctrl, kind: 'handPick', src: x.src, from: who, then: op.then, opts: opts });
        if (a === 'none') continue;
        if (op.then === 'discard') MF.discard(s, a);
        else if (op.then === 'exileUntil') {
          const id = I(s, a).id, n = MF.move(s, a, 'exile');
          s.effects.push({ k: 'exileUntil', src: x.src, iid: n });
          log(s, 'exiledFromHand', { who: who, c: id, by: x.L ? (x.L.srcId || x.L.id) : null, until: true });
        }
        else {
          const id = I(s, a).id, n = MF.move(s, a, 'exile');
          log(s, 'exiledFromHand', { who: who, c: id, by: x.L ? (x.L.srcId || x.L.id) : null });
          if (op.castIfGift && x.L && x.L.gift != null) { s.effects.push({ k: 'mayPlay', iid: n, who: x.ctrl, until: 'exiled', anyMana: true, castOnly: true }); log(s, 'mayCastExiled', { who: x.ctrl, c: id }); }
        }
      }
    },
    // Floodpits Drowner: "Shuffle this creature and target creature with a stun counter on it into their owners' libraries."
    shuffleIntoLib(x, op) {
      const s = x.s, iids = op.on.flatMap(r => MF.resolveRefs(x, r)), owners = new Set();
      for (const i of iids) { const c = I(s, i); if (!c || c.zone !== 'bf') continue; owners.add(c.owner); log(s, 'shuffledIn', { who: c.owner, c: c.id }); MF.move(s, i, 'lib'); }
      for (const o of owners) MF.shuffle(s, P(s, o).lib);
    },
    // CR 701.27: transform — only a double-faced permanent, and only if it has not transformed since the ability was put on the stack (701.27f).
    transform(x) {
      const s = x.s, c = I(s, x.src); if (!c || c.zone !== 'bf' || !MF.def(s, x.src).back) return;
      if (c.transformedAt != null && x.L && c.transformedAt > x.L.lid) return;
      c.transformed = !c.transformed; c.transformedAt = s.lid;
      log(s, 'transformed', { who: c.ctrl, c: c.id, face: c.transformed ? MF.def(s, x.src).back.name : MF.def(s, x.src).name });
    },
    // CR 114: an emblem — a static ability in the command zone.
    emblem(x, op) { const s = x.s; (s.emblems = s.emblems || []).push({ ctrl: x.ctrl, ab: op.ab, text: op.text, src: x.L ? (x.L.srcId || x.L.id) : null, ts: s.ts++ }); log(s, 'emblem', { who: x.ctrl, text: op.text, c: x.L ? (x.L.srcId || x.L.id) : null }); },
    // Gix's Command: "up to one creature" — chosen on resolution, not targeted (its ruling).
    choose(x, op) {
      const s = x.s, opts = s.bf.filter(i => MF.matchChars(s, i, MF.chars(s, i), op.f, x.ctrl, x.src)).map(i => ({ id: i, iid: i }));
      x.it = null; if (!opts.length) return;
      if (op.upTo) opts.push({ id: 'none' });
      const a = MF.ask(x.x, { who: x.ctrl, kind: 'chooseObj', src: x.src, opts: opts });
      if (a !== 'none') x.it = a;
    },
    chooseFromGrave(x, op) {
      const s = x.s, p = P(s, x.ctrl), took = [];
      for (let k = 0; k < op.n; k++) {
        const fit = i => op.fs ? op.fs.some(f => MF.matchChars(s, i, MF.chars(s, i), f, x.ctrl, x.src)) : op.types.some(ty => MF.def(s, i).types.includes(ty));
        const opts = p.grave.filter(i => !took.includes(i) && fit(i)).map(i => ({ id: i, iid: i }));
        if (!opts.length) break; opts.push({ id: 'done' });
        const a = MF.ask(x.x, { who: x.ctrl, kind: 'chooseFromGrave', src: x.src, n: op.n, k: k + 1, opts: opts });
        if (a === 'done') break; took.push(a);
      }
      for (const i of took) { log(s, 'toHand', { who: x.ctrl, c: I(s, i).id, revealed: true, from: 'graveyard' }); MF.move(s, i, 'hand'); }
    },
    // "Each opponent sacrifices a creature with the greatest power among creatures they control." — they choose among ties.
    sacGreatestPower(x) {
      const s = x.s, opp = 1 - x.ctrl, mine = s.bf.filter(i => MF.chars(s, i).ctrl === opp && MF.isType(s, i, 'Creature'));
      if (!mine.length) return;
      const top = Math.max(...mine.map(i => MF.chars(s, i).p)), opts = mine.filter(i => MF.chars(s, i).p === top).map(i => ({ id: i, iid: i }));
      MF.sacrifice(s, MF.ask(x.x, { who: opp, kind: 'sacrificeOne', src: x.src, opts: opts }));
    },
    // Azure Beastbinder: loses all abilities; a creature also has base power and toughness 2/2 — until its controller's next turn.
    loseAbilities(x, op) {
      const s = x.s;
      if (op.whileSrc) {                                                                         // The Wondrous Wasp: "for as long as ~ remains on the battlefield"
        const me = I(s, x.src); if (!me || me.zone !== 'bf') return;
        for (const i of MF.resolveRefs(x, op.on)) { s.effects.push({ k: 'loseAll', iid: i, whileSrc: x.src, ts: s.ts++ }); log(s, 'loseAbilities', { who: I(s, i).ctrl, c: I(s, i).id, pt: null, whileSrc: me.id }); }
        return;
      }
      for (const i of MF.resolveRefs(x, op.on)) {
        const ts = s.ts++, wasCre = MF.isType(s, i, 'Creature');
        s.effects.push({ k: 'loseAll', iid: i, ts: ts, untilNextTurnOf: x.ctrl, turn: s.turn });
        if (wasCre) s.effects.push({ k: 'setPT', iid: i, p: op.basePT[0], t: op.basePT[1], ts: ts, untilNextTurnOf: x.ctrl, turn: s.turn });
        log(s, 'loseAbilities', { who: I(s, i).ctrl, c: I(s, i).id, pt: wasCre ? op.basePT : null });
      }
    },
    // Ninjutsu: "Put this card onto the battlefield from your hand tapped and attacking" (CR 702.49a, c).
    ninjutsuEnter(x) {
      const s = x.s, c = I(s, x.src);
      if (!c || c.zone !== 'hand') { log(s, 'ninjutsuGone', { who: x.ctrl, c: x.L.srcId }); return; }   // its ruling: it left your hand, it doesn't enter
      const n = MF.move(s, x.src, 'bf', { ctrl: x.ctrl, tapped: true, x: x.x, attacking: x.L.ninjaTarget || { p: 1 - x.ctrl } });
      log(s, 'putOnto', { who: x.ctrl, c: I(s, n).id, tapped: true, from: 'hand', attacking: true });
    },
    // CR 701.66a: earthbend N — a 0/0 land creature with haste, N +1/+1 counters; when it dies or is exiled, it returns tapped.
    earthbend(x, op) {
      const s = x.s;
      for (const i of MF.resolveRefs(x, op.on)) {
        s.effects.push({ k: 'animate', iid: i, p: 0, t: 0, kws: ['haste'], ts: s.ts++ });
        I(s, i).ctr['+1/+1'] = (I(s, i).ctr['+1/+1'] || 0) + op.n;
        log(s, 'earthbend', { who: x.ctrl, c: I(s, i).id, n: op.n });
        (s.delayed = s.delayed || []).push({ src: x.src, ctrl: x.ctrl, once: true, ab: { k: 'trig', on: 'leaves', iid: i, ops: [{ o: 'returnLand', from: i }] } });
      }
    },
    returnLand(x, op) {
      const s = x.s, n0 = I(s, op.from).to, c = n0 != null ? I(s, n0) : null;
      if (!c || (c.zone !== 'grave' && c.zone !== 'exile')) return;                             // its ruling: only from the graveyard or exile
      const n = MF.move(s, n0, 'bf', { ctrl: x.ctrl, tapped: true, x: x.x }); log(s, 'putOnto', { who: x.ctrl, c: I(s, n).id, tapped: true, from: c.zone === 'grave' ? 'graveyard' : 'exile' });
    },
    // Esper Origins: exile it, then put it onto the battlefield transformed with a finality counter (CR 712).
    exileTransformOnto(x, op) {
      const s = x.s, c = I(s, x.L.iid); if (!c || c.zone !== 'stack') return;
      s.stack.splice(s.stack.indexOf(x.L), 1);
      const e = MF.move(s, x.L.iid, 'exile'); log(s, 'exiled', { who: c.owner, c: c.id, by: c.id, fromStack: true });
      const n = MF.move(s, e, 'bf', { ctrl: I(s, e).owner, transformed: true, ctr: op.ctr, x: x.x });
      log(s, 'putOnto', { who: I(s, n).owner, c: I(s, n).id, tapped: false, from: 'exile', ctr: op.ctr, transformed: true });
    },
    revealTopToHand(x, op) {
      const s = x.s, p = P(s, x.ctrl); if (!p.lib.length) return;
      const top = p.lib[0], d = MF.def(s, top), perm = d.types.some(ty => ['Artifact', 'Battle', 'Creature', 'Enchantment', 'Land', 'Planeswalker'].includes(ty));
      log(s, 'reveal', { who: x.ctrl, cs: [d.id] });
      if (perm) { MF.move(s, top, 'hand'); log(s, 'toHand', { who: x.ctrl, c: d.id, revealed: true, from: 'library' }); }
    },
    addMana(x, op) { const p = P(x.s, x.ctrl); p.pool[op.col] += op.n; log(x.s, 'addMana', { who: x.ctrl, col: op.col, n: op.n, c: x.L ? x.L.srcId : null }); },
    becomeCreature(x) { const s = x.s, c = I(s, x.src); if (!c || c.zone !== 'bf') return; s.effects.push({ k: 'addTypes', iid: x.src, types: ['Creature'], until: 'eot', ts: s.ts++ }); log(s, 'crewed', { who: x.ctrl, c: c.id }); },
    // "Add one mana of any color" as a triggered ability's effect: the color is chosen as it resolves.
    addManaAny(x) { const col = MF.ask(x.x, { who: x.ctrl, kind: 'manaColor', src: x.src, opts: ['W', 'U', 'B', 'R', 'G'].map(k => ({ id: k })) }); P(x.s, x.ctrl).pool[col] += 1; log(x.s, 'addMana', { who: x.ctrl, col: col, n: 1, c: x.L ? x.L.srcId : null }); },
    // Brightglass Gearhulk: search for up to N cards matching, reveal them, put them into your hand, shuffle.
    tutorUpTo(x, op) {
      const s = x.s, p = P(s, x.ctrl), got = [];
      MF.emit(s, { t: 'search', who: x.ctrl });
      for (let k = 0; k < op.n; k++) {
        const fit = p.lib.filter(i => !got.includes(i) && MF.matchChars(s, i, MF.chars(s, i), op.f, x.ctrl, x.src));
        const seen = new Set(), opts = fit.filter(i => { const id = I(s, i).id; if (seen.has(id)) return false; seen.add(id); return true; }).map(i => ({ id: i, iid: i }));   // identical cards are one choice
        if (!opts.length) break;
        opts.push({ id: 'done' });
        const a = MF.ask(x.x, { who: x.ctrl, kind: 'tutorUpTo', src: x.src, n: op.n, k: k + 1, opts: opts });
        if (a === 'done') break;
        got.push(a);
      }
      if (got.length) log(s, 'reveal', { who: x.ctrl, cs: got.map(i => I(s, i).id) }); else log(s, 'searchNothing', { who: x.ctrl });
      for (const i of got) { const id = I(s, i).id; MF.move(s, i, 'hand'); log(s, 'toHand', { who: x.ctrl, c: id, revealed: true, from: 'library' }); }
      MF.shuffle(s, p.lib);
    },
    // Leatherhead: "you may remove a counter from her" — of any kind; "When you do, ..." (CR 603.12)
    mayRemoveAnyCounter(x, op) {
      const s = x.s, c = I(s, x.src); if (!c || c.zone !== 'bf') return;
      const kinds = Object.keys(c.ctr).filter(k => c.ctr[k] > 0); if (!kinds.length) return;
      const a = MF.ask(x.x, { who: x.ctrl, kind: 'removeCounterKind', src: x.src, opts: kinds.map(k => ({ id: k, n: c.ctr[k] })).concat([{ id: 'none' }]) });
      if (a === 'none') return;
      c.ctr[a] -= 1; log(s, 'removeCounters', { who: c.ctrl, c: c.id, n: 1, ctr: a });
      MF.runOps(x, [op.then]);
    },
    // "Do this only once each turn": the ability still triggers; the optional action is offered only if not yet taken this turn.
    mayOnce(x, op) {
      const s = x.s, c = I(s, x.src); if (c && c.onceTurn === s.turn) { log(s, 'onceDone', { who: x.ctrl, c: c.id }); return; }
      if (MF.ask(x.x, { who: x.ctrl, kind: 'may', src: x.src, what: 'onceEachTurn', n: x.ev ? x.ev.n : null, tgt: x.t && x.t[0] && x.t[0][0] ? x.t[0][0] : null, opts: [{ id: 'yes' }, { id: 'no' }] }) !== 'yes') return;
      if (c) c.onceTurn = s.turn;
      MF.runOps(x, op.ops);
    },
    // Seam Rip: CR 610.3, 610.3b — if ~ has already left, nothing is exiled; otherwise it returns to the battlefield when ~ leaves.
    exileUntilLeaves(x, op) {
      const s = x.s, sc = I(s, x.src); if (!sc || sc.zone !== 'bf') return;
      const ids = op.on.t != null ? (x.t[op.on.t] || []).filter(r => r && r.c != null).map(r => r.c) : MF.resolveRefs(x, op.on);   // a target, or "each nonland permanent ..."
      for (const i of ids) {
        const c = I(s, i); if (!c || c.zone !== 'bf') continue;
        const id = c.id, n = MF.move(s, i, 'exile');
        s.effects.push({ k: 'exileUntil', src: x.src, iid: n, back: 'bf' });
        log(s, 'exiled', { who: c.owner, c: id, by: x.L ? (x.L.srcId || x.L.id) : null, until: true, from: 'bf' });
      }
    },
    // Hollow Marauder: each targeted opponent discards a card of their choice; for each who didn't discard one with mana value 4 or greater, draw.
    discardOrFeed(x, op) {
      const s = x.s;
      for (const r of (x.t[op.on.t] || [])) {
        if (!r || r.p == null) continue; const who = r.p, hand = P(s, who).hand;
        let big = false;
        if (hand.length) { const a = MF.ask(x.x, { who: who, kind: 'discard', src: x.src, left: 1, opts: hand.map(i => ({ id: i, iid: i })) }); big = MF.chars(s, a).mv >= op.mvGE; MF.discard(s, a); }
        if (!big) OPS.draw(x, { n: 1 });
      }
    },
    exileGrave(x, op) {                                                                       // "Exile target player's graveyard"
      const s = x.s;
      for (const w of players(x, op.who)) { const g = P(s, w).grave.slice(); if (!g.length) continue; log(s, 'exiledGrave', { who: w, cs: g.map(i => I(s, i).id) }); for (const i of g) MF.move(s, i, 'exile'); }
    },
    // CR 724.1a-b: triggered abilities waiting to be put on the stack cease to exist; every object on the stack is exiled, this one too.
    endTurn(x) {
      const s = x.s;
      s.trigs = [];
      for (const L of s.stack.slice().reverse()) {
        if (L.kind !== 'spell') continue;
        const c = I(s, L.iid); if (!c || c.zone !== 'stack') continue;
        if (L.copy) { c.zone = 'moved'; c.to = null; continue; }
        log(s, 'exiled', { who: c.owner, c: c.id, by: x.L ? (x.L.srcId || x.L.id) : null, fromStack: true }); MF.move(s, L.iid, 'exile');
      }
      s.stack = [];
      const me = x.L && x.L.iid != null ? I(s, x.L.iid) : null;
      if (me && me.zone === 'stack') { log(s, 'exiled', { who: me.owner, c: me.id, by: me.id, fromStack: true }); MF.move(s, x.L.iid, 'exile'); }
      log(s, 'endTurn', { who: x.ctrl, c: x.L ? (x.L.srcId || x.L.id) : null });
      s.endTurnNow = true;
    },
    // Bloodghast: "you may return this card from your graveyard to the battlefield" — only if it is still there (CR 400.7).
    selfFromGrave(x) { const s = x.s, c = I(s, x.src); if (!c || c.zone !== 'grave') return; const n = MF.move(s, x.src, 'bf', { ctrl: c.owner, x: x.x }); log(s, 'putOnto', { who: c.owner, c: I(s, n).id, tapped: false, from: 'graveyard' }); },
    removeCounter(x, op) { const c = I(x.s, x.src); if (!c || c.zone !== 'bf' || !(c.ctr[op.kind] > 0)) return; c.ctr[op.kind] = Math.max(0, c.ctr[op.kind] - op.n); log(x.s, 'removeCounters', { who: c.ctrl, c: c.id, n: op.n, ctr: op.kind }); },
    // Cool but Rude: "search your library for a card, put it into your hand, shuffle, then discard a card at random."
    tutor(x) {
      const s = x.s, p = P(s, x.ctrl);
      MF.emit(s, { t: 'search', who: x.ctrl });
      const seen = new Set(), opts = p.lib.filter(i => { const id = I(s, i).id; if (seen.has(id)) return false; seen.add(id); return true; }).map(i => ({ id: i, iid: i }));
      opts.push({ id: 'none' });
      const a = MF.ask(x.x, { who: x.ctrl, kind: 'search', src: x.src, what: 'card', opts: opts });
      if (a !== 'none') { MF.move(s, a, 'hand'); log(s, 'toHand', { who: x.ctrl, c: I(s, a).id, revealed: false, from: 'library' }); } else log(s, 'searchNothing', { who: x.ctrl });
      MF.shuffle(s, p.lib);
    },
    discardRandom(x) { const s = x.s, p = P(s, x.ctrl); if (!p.hand.length) return; MF.discard(s, p.hand[MF.randInt(s, p.hand.length)]); },   // random: inside apply (CLAUDE.md rule 9)
    // "You may pay {B}. If you do, ..." / "you may pay 1 life. If you do, ..." — paid as it resolves; not offered if it can't be paid.
    mayPay(x, op) {
      const s = x.s, need = op.mana ? MF.parseMana(op.mana) : null;
      if (need ? !MF.canPayMana(s, x.ctrl, need) : P(s, x.ctrl).life < op.life) return;
      if (MF.ask(x.x, { who: x.ctrl, kind: 'mayPay', src: x.src, mana: op.mana, life: op.life, opts: [{ id: 'yes' }, { id: 'no' }] }) !== 'yes') return;
      if (need) MF.payMana(x.x, x.ctrl, need, x.src, false); else MF.loseLife(s, x.ctrl, op.life, 'pay', I(s, x.src).id);
      MF.runOps(x, op.ops);
    },
    // CR 603.12: a reflexive triggered ability — triggers at once; its targets are chosen as it goes on the stack.
    reflexive(x, op) {
      if (op.ab.cond && !MF.cond(x, op.ab.cond)) return;                                          // "When you do, if ..." — checked as it triggers (CR 603.4)
      x.s.trigs.push({ src: x.src, ab: -1, inl: op.ab, ctrl: x.ctrl, ev: x.ev || { t: 'reflexive' }, lki: x.lki || null }); },
    // CR 603.7: "Whenever you attack this turn, ..." — a delayed triggered ability with a duration.
    delayed(x, op) {
      (x.s.delayed = x.s.delayed || []).push({ src: x.src, ctrl: x.ctrl, until: op.duration === 'turn' ? 'eot' : null, once: op.duration !== 'turn', ab: { k: 'trig', on: op.on, ops: op.ops } });
      log(x.s, 'delayedMade', { who: x.ctrl, c: x.L ? (x.L.srcId || x.L.id) : null, on: op.on });
    },
    sacThese(x, op) { for (const i of op.iids) { const c = I(x.s, i); if (c && c.zone === 'bf' && c.ctrl === x.ctrl) MF.sacrifice(x.s, i); } },   // CR 603.7c: only if still there
    sacrificeSelf(x) { const c = I(x.s, x.src); if (c && c.zone === 'bf') MF.sacrifice(x.s, x.src); },
    // Belladonna Took: what happens depends on how many times this ability has resolved this turn.
    nthResolution(x, op) {
      const c = I(x.s, x.src), key = 'res' + (x.L ? x.L.ab : 0);
      const r = c[key] && c[key].turn === x.s.turn ? c[key] : (c[key] = { turn: x.s.turn, n: 0 });
      r.n++;
      log(x.s, 'nthResolution', { who: x.ctrl, c: c.id, n: r.n });
      if (op.branches[r.n - 1]) MF.runOps(x, op.branches[r.n - 1]);                            // beyond the third: nothing (its ruling)
    },
    // CR 701.44a: explore — reveal the top card; a land goes to hand; otherwise a +1/+1 counter, and the card may go to the graveyard.
    explore(x, op) {
      const who = op && op.on ? MF.resolveRefs(x, op.on)[0] : x.src;                         // "Target creature you control explores" (a Map)
      if (op && op.on && who == null) return;
      const s = x.s, p = P(s, x.ctrl), here = I(s, who) && I(s, who).zone === 'bf', id0 = here ? I(s, who).id : x.L ? (x.L.srcId || x.L.id) : null, ref = op && op.on ? op.on : 'self';
      if (!p.lib.length) { if (here) OPS.counter(x, { on: ref, n: 1, kind: '+1/+1' }); log(s, 'explore', { who: x.ctrl, c: id0, card: null }); return; }   // its ruling: nothing revealed, still a counter
      const top = p.lib[0], d = MF.def(s, top);
      log(s, 'explore', { who: x.ctrl, c: id0, card: d.id, land: d.types.includes('Land') });
      if (d.types.includes('Land')) { MF.move(s, top, 'hand'); return; }
      if (here) OPS.counter(x, { on: ref, n: 1, kind: '+1/+1' });
      if (MF.ask(x.x, { who: x.ctrl, kind: 'exploreGrave', src: x.src, card: top, opts: [{ id: 'grave', iid: top }, { id: 'top', iid: top }] }) === 'grave') { MF.move(s, top, 'grave'); log(s, 'mill', { who: x.ctrl, cs: [d.id] }); }
    },
    // Essence Channeler: "put its counters on target creature you control" — the same number of each kind it had (its rulings).
    moveCounters(x, op) {
      const ctr = (x.lki && x.lki.ctr) || {};
      for (const k in ctr) if (ctr[k] > 0) { const put = { on: op.to, n: ctr[k] }; put.kind = k; OPS.counter(x, put); }
    },
    // Moseo: "return up to one target creature card ... from your graveyard to the battlefield".
    graveToBattlefield(x, op) {
      for (const q of (x.t[op.on.t] || [])) { if (!q || q.c == null) continue; const c = I(x.s, q.c); if (c.zone !== 'grave') continue; const n = MF.move(x.s, q.c, 'bf', { ctrl: x.ctrl, x: x.x }); log(x.s, 'putOnto', { who: x.ctrl, c: I(x.s, n).id, tapped: false, from: 'graveyard' });
        if (op.grantAb) x.s.effects.push({ k: 'grantAb', iid: n, abs: op.grantAb, ts: x.s.ts++ }); }   // Carnage: "It gains ..." for as long as it stays
    },
    // Case of the Uneaten Feast: "Creature cards in your graveyard gain 'You may cast this card from your graveyard' until end of turn."
    graveCastable(x, op) {
      const s = x.s;
      for (const i of P(s, x.ctrl).grave) if (op.types.some(ty => MF.def(s, i).types.includes(ty))) s.effects.push({ k: 'mayPlay', iid: i, who: x.ctrl, castOnly: true, until: 'eot' });
      log(s, 'graveCastable', { who: x.ctrl, n: P(s, x.ctrl).grave.filter(i => op.types.some(ty => MF.def(s, i).types.includes(ty))).length });
    },
    solve(x) { const c = I(x.s, x.src); if (!c || c.zone !== 'bf') return; c.solved = true; log(x.s, 'solved', { who: x.ctrl, c: c.id }); },   // CR 719.3a
    // Warp (CR 702.185a): exiled at the next end step; its owner may cast it after this turn while it stays exiled.
    warpExile(x, op) {
      const s = x.s, c = I(s, op.iid); if (!c || c.zone !== 'bf') return;
      const owner = c.owner, n = MF.move(s, op.iid, 'exile');
      s.effects.push({ k: 'mayPlay', iid: n, who: owner, castOnly: true, afterTurn: s.turn, until: 'exiled' });
      log(s, 'warpExile', { who: owner, c: I(s, n).id });
    },
    // Ward (CR 702.21a): "counter that spell or ability unless that player pays [cost]".
    wardCounter(x, op) {
      const s = x.s, L = s.stack.find(l => l.lid === x.ev.lid); if (!L) return;
      const who = L.ctrl, need = op.mana ? MF.parseMana(op.mana) : null;
      const can = op.discard ? P(s, who).hand.length > 0 : op.life != null ? P(s, who).life >= op.life : MF.canPayMana(s, who, need);
      if (can && MF.ask(x.x, { who: who, kind: 'wardPay', src: x.src, life: op.life, mana: op.mana, discard: op.discard || null, target: L.kind === 'spell' ? L.iid : L.src, opts: [{ id: 'pay' }, { id: 'decline' }] }) === 'pay') {
        if (op.discard) MF.discard(s, MF.ask(x.x, { who: who, kind: 'discard', src: x.src, left: 1, opts: P(s, who).hand.map(i => ({ id: i, iid: i })) }));
        else if (op.life != null) MF.loseLife(s, who, op.life, 'pay', I(s, x.src).id); else MF.payMana(x.x, who, need, x.src, false);
        log(s, 'wardPaid', { who: who, c: I(s, x.src).id }); return;
      }
      if (L.kind === 'spell') MF.counterSpell(s, L, I(s, x.src).id);
      else { s.stack.splice(s.stack.indexOf(L), 1); log(s, 'countered', { who: L.ctrl, c: L.srcId, by: I(s, x.src).id, ab: true }); }   // an ability countered: removed from the stack (CR 701.6a)
    },
    // "Return target creature ... to its owner's hand" (CR 400.7: a new object there).
    bounce(x, op) {
      for (const i of MF.resolveRefs(x, op.on)) { const c = I(x.s, i); log(x.s, 'bounce', { who: c.owner, c: c.id }); MF.move(x.s, i, 'hand'); }
    },
    // "Return target instant or sorcery card from your graveyard to your hand."
    graveToHand(x, op) {
      for (const q of (x.t[op.on.t] || [])) { if (!q || q.c == null) continue; const c = I(x.s, q.c); if (c.zone !== 'grave') continue; log(x.s, 'toHand', { who: c.owner, c: c.id, revealed: true, from: 'graveyard' }); MF.move(x.s, q.c, 'hand'); }
    },
    // Spell Pierce: "Counter target noncreature spell unless its controller pays {2}" (CR 701.6, 118.12a).
    counterUnless(x, op) {
      const s = x.s, iid = MF.resolveTargetSpell(x, op.on); if (iid == null) return;
      const L = s.stack.find(l => l.kind === 'spell' && l.iid === iid), who = L.ctrl, pay = op.payIf && MF.cond(x, op.payIf) ? op.payIf.pay : op.pay, need = MF.parseMana(pay);
      if (MF.canPayMana(s, who, need)) {
        const a = MF.ask(x.x, { who: who, kind: 'payOrCounter', src: x.src, spell: iid, pay: pay, opts: [{ id: 'pay' }, { id: 'decline' }] });
        if (a === 'pay') { MF.payMana(x.x, who, need, iid, false); log(s, 'paidToSave', { who: who, c: L.id, mana: pay }); return; }
      }
      MF.counterSpell(s, L, x.L ? (x.L.srcId || x.L.id) : null, op.exile);
    },
    counterTarget(x, op) { const iid = MF.resolveTargetSpell(x, op.on); if (iid == null) return; MF.counterSpell(x.s, x.s.stack.find(l => l.kind === 'spell' && l.iid === iid), x.L ? (x.L.srcId || x.L.id) : null); },   // CR 701.6a
    // Tishana's Tidebinder: counter an ability; an artifact's, creature's or planeswalker's loses all abilities while this remains (CR 611.2b).
    counterAbility(x, op) {
      const s = x.s, q = (x.t[op.on.t] || [])[0]; if (!q || q.a == null) return;
      const L = s.stack.find(l => l.lid === q.a); if (!L) return;
      s.stack.splice(s.stack.indexOf(L), 1);
      log(s, 'countered', { who: L.ctrl, c: L.srcId, by: x.L ? (x.L.srcId || x.L.id) : null, ab: true });
      const src = I(s, L.src), me = I(s, x.src);
      if (op.loseWhile && src && src.zone === 'bf' && me && me.zone === 'bf' && MF.chars(s, L.src).types.some(ty => ['Artifact', 'Creature', 'Planeswalker'].includes(ty))) {
        s.effects.push({ k: 'loseAll', iid: L.src, whileSrc: x.src, ts: s.ts++ });
        log(s, 'loseAbilities', { who: src.ctrl, c: src.id, pt: null, whileSrc: me.id });
      }
    },
    // Stock Up, Sleight of Hand: look at the top N; put some into your hand, the rest on the bottom in any order.
    lookPick(x, op) {
      const s = x.s, p = P(s, x.ctrl), look = p.lib.slice(0, op.n), took = [];
      if (!look.length) return;
      for (let k = 0; k < op.take && took.length < look.length; k++) {
        const left = look.filter(i => !took.includes(i));
        if (left.length === op.take - k) { took.push.apply(took, left); break; }               // every remaining card goes to hand: not a choice
        took.push(MF.ask(x.x, { who: x.ctrl, kind: 'lookPick', src: x.src, n: look.length, take: op.take, k: k + 1, look: look, opts: left.map(i => ({ id: i, iid: i })) }));
      }
      const rest = look.filter(i => !took.includes(i)), order = [], left = rest.slice();
      while (left.length > 1 && new Set(left.map(i => I(s, i).id)).size > 1) {                 // "in any order": the player chooses, the first chosen goes deepest
        const a = MF.ask(x.x, { who: x.ctrl, kind: 'scryOrder', where: 'bottom', opts: left.map(i => ({ id: i, iid: i })) });
        order.push(a); left.splice(left.indexOf(a), 1);
      }
      p.lib.splice(0, look.length);
      for (const i of took) MF.move(s, i, 'hand');
      p.lib.push.apply(p.lib, order.concat(left));
      log(s, 'lookPick', { who: x.ctrl, n: look.length, took: took.length, bottom: rest.length });
    },
    // Torch the Tower: "If a permanent dealt damage by this spell would die this turn, exile it instead."
    dieExile(x) {
      const s = x.s;
      for (const i of s.bf) { const c = I(s, i); if ((c.dmgBy || []).includes(x.src)) s.effects.push({ k: 'dieExile', iid: i, until: 'eot' }); }
    },
    // A Class gains a level (CR 716.2a).
    levelUp(x, op) {
      const c = I(x.s, x.src); if (!c || c.zone !== 'bf') return;
      c.level = op.n; log(x.s, 'levelUp', { who: x.ctrl, c: c.id, n: op.n });
      MF.emit(x.s, { t: 'levelUp', iid: x.src, level: op.n });
    },
    // Unstoppable Slasher: "return it to the battlefield tapped under its owner's control with two stun counters on it."
    returnFromGrave(x, op) {
      const s = x.s, g = x.ev && x.ev.to != null ? I(s, x.ev.to) : null;
      if (!g || g.zone !== 'grave') { log(s, 'returnGone', { c: x.L.srcId }); return; }           // CR 400.7: it is a new object once it has left the graveyard
      const n = MF.move(s, x.ev.to, 'bf', { ctrl: g.owner, tapped: !!op.tapped, ctr: op.ctr || null, x: x.x });
      if (op.asEnchantment) s.effects.push({ k: 'types', iid: n, types: ['Enchantment'], subtypes: [], ts: s.ts++ });   // "It's an enchantment. (It's not a creature.)" — creature types go too (its ruling)
      log(s, 'putOnto', { who: g.owner, c: I(s, n).id, tapped: !!op.tapped, from: 'graveyard', ctr: op.ctr || null });
    },
    // Alania: "copy that spell. You may choose new targets for the copy." (CR 707.10, 707.10c)
    copySpell(x, op) {
      // The spell on the stack, or — if it has left — the spell as it last existed there (Alania's
      // rulings: the copy is made even if the original was countered before her ability resolved).
      const s = x.s, live = s.stack.find(L => L.lid === x.ev.lid);
      const L0 = live ? { id: live.id, t: live.t, x: live.x, mode: live.mode, alt: live.alt, door: live.door, kicked: live.kicked, offspring: live.offspring, gift: live.gift, bargained: live.bargained } : x.ev.spell;
      if (!L0) throw new Error('copySpell: the cast event carries no spell');
      const iid = s.nid++;
      s.cards[iid] = { iid: iid, id: L0.id, owner: x.ctrl, ctrl: x.ctrl, zone: 'stack', ts: s.ts++, tapped: false, dmg: 0, dt: false, ctr: {}, att: null, ctlTurn: s.turn, copySpell: true };
      if (L0.alt) s.cards[iid].asAlt = true;
      if (L0.door != null) s.cards[iid].asDoor = L0.door;
      // CR 707.10: the copy has the same mode, X and targets; effects of additional costs paid for the original are copied (its ruling): kicker, offspring, gift.
      const L = { lid: s.lid++, kind: 'spell', ctrl: x.ctrl, iid: iid, id: L0.id, t: JSON.parse(JSON.stringify(L0.t)), x: L0.x, mode: L0.mode, copy: true, spent: 0, from: 'copy', alt: L0.alt || null, kicked: !!L0.kicked, offspring: !!L0.offspring };
      if (L0.door != null) L.door = L0.door;
      if (L0.gift != null) L.gift = L0.gift;
      if (L0.bargained) L.bargained = true;                                                     // a copy of a bargained spell is bargained (its rulings)
      const d = MF.faceDef(s, iid, !!L0.alt, L0.door), sp = d.ab.find(a => a.k === 'spell'), aura = d.ab.find(a => a.k === 'enchant');
      const part = MF.spellPart(sp, L0), slots = part && part.tg ? part.tg : aura ? [{ f: aura.f }] : [];
      // CR 707.10c: new targets may be chosen for each target; one with no legal new choice stays unchanged (its ruling), even if illegal.
      slots.forEach((slot, si) => {
        const alone = Object.assign({}, slot); delete alone.diff;
        if (!MF.targetOptions(s, alone, x.ctrl, iid, []).length) return;
        const a = MF.ask(x.x, { who: x.ctrl, kind: 'newTargets', src: iid, slot: si, slots: slots.length, opts: [{ id: 'keep' }, { id: 'new' }] });
        if (a !== 'new') return;
        let pick;
        try { pick = MF.chooseTargets(x.x, x.ctrl, iid, [alone], 'copy', false)[0]; } catch (e) { if (e instanceof MF.Illegal) return; throw e; }
        if (slot.diff != null && pick.some(r => (L.t[slot.diff] || []).some(q => q.p === r.p && q.c === r.c))) return;   // "any other target": the change would not be legal; it stays
        L.t[si] = pick;
      });
      s.stack.push(L);
      log(s, 'copy', { who: x.ctrl, c: L0.id, gone: !live, tg: L.t.map(sl => sl.map(r => MF.refLabel(s, r))) });
    },
  };
  // CR 702.174e: "Gift a card" — the chosen player draws a card.
  MF.giveGift = function (x, a, to) {
    log(x.s, 'gift', { who: x.ctrl, to: to, what: a.what });
    if (a.what === 'card') MF.draw(x.s, to, 1);
    else if (a.what === 'tappedFish') {                                                         // CR 702.174f
      const s = x.s, iid = s.nid++;
      s.cards[iid] = { iid: iid, id: a.token, owner: to, ctrl: to, zone: 'bf', ts: s.ts++, tapped: true, dmg: 0, dt: false, ctr: {}, att: null, ctlTurn: s.turn, tok: true };
      s.bf.push(iid); noteEntered(s, iid);
      log(s, 'token', { who: to, c: a.token, tapped: true });
      MF.emit(s, { t: 'enters', iid: iid, ctrl: to });
    }
    else throw new Error('gift not implemented: ' + a.what);
  };
  function noteEntered(s, iid) {                                                               // turn history: "if another creature entered the battlefield under your control this turn"
    const c = I(s, iid); if (!MF.isType(s, iid, 'Creature')) return;
    const h = P(s, c.ctrl).h; (h.enteredIids = h.enteredIids || []).push(iid);
  }
  MF.noteEntered = noteEntered;
  MF.ops = OPS;
  MF.resolveTargetSpell = (x, r) => { const q = (x.t[r.t] || [])[0]; return q && q.c != null && I(x.s, q.c) && I(x.s, q.c).zone === 'stack' ? q.c : null; };
  // CR 701.6a: a countered spell leaves the stack without resolving; it goes to its owner's graveyard
  // (a copy ceases to exist; harmonize exiles it).
  MF.counterSpell = function (s, L, by, exile) {
    if (MF.chars(s, L.iid).ab.some(a => a.k === 'uncounterable')) { log(s, 'cantCounter', { who: L.ctrl, c: L.id }); return; }   // "This spell can't be countered" (CR 113.6g)
    s.stack.splice(s.stack.indexOf(L), 1);
    log(s, 'countered', { who: L.ctrl, c: L.id, by: by });
    if (L.copy) { const c = I(s, L.iid); c.zone = 'moved'; c.to = null; return; }
    if (exile) { const n = MF.move(s, L.iid, 'exile'); log(s, 'exiledInsteadOfGrave', { who: L.ctrl, c: I(s, n).id }); return; }   // No More Lies
    MF.spellAway(s, L);
  };
  MF.runOps = function (x, ops) {
    for (const op of ops) {
      const f = OPS[op.o];
      if (!f) throw new Error('no op handler: ' + op.o);
      f(x, op);
      MF.batchFlush(x.s);                                                                        // one instruction, one batch of simultaneous events
      if (x.s.winner != null) return;
    }
  };

  // Mockingbird: "You may have this creature enter as a copy of any creature on the battlefield
  // with mana value less than or equal to the amount of mana spent to cast this creature, except
  // it's a Bird in addition to its other types and it has flying." (CR 707.2, 707.9a-b)
  MF.askEnterAsCopy = function (x, a, L) {
    const s = x.s;
    const opts = s.bf.filter(i => MF.isType(s, i, 'Creature') && MF.chars(s, i).mv <= (L.spent || 0)).map(i => ({ id: i, iid: i }));
    if (!opts.length) return null;                                                             // nothing it could copy: not a choice
    opts.push({ id: 'no' });
    const ans = MF.ask(x.x, { who: L.ctrl, kind: 'enterAsCopy', src: L.iid, spent: L.spent || 0, opts: opts });
    if (ans === 'no') return null;
    const t = I(s, ans);
    const base = t.copy ? t.copy : { id: t.id, except: {} };                                  // CR 707.2: the copiable values, including an earlier copy effect
    const except = Object.assign({}, base.except);
    except.addSubtypes = (except.addSubtypes || []).concat(a.except.addSubtypes || []);
    except.kw = (except.kw || []).concat(a.except.kw || []);
    log(s, 'enterAsCopy', { who: L.ctrl, c: L.id, of: t.id });
    return { id: base.id, except: except };
  };
  // CR 303.4: an Aura can be attached only to what its enchant ability allows.
  MF.auraCanEnchant = function (s, aura, target) {
    const en = MF.chars(s, aura).ab.find(a => a.k === 'enchant');
    if (!en) return false;
    return MF.matchChars(s, target, MF.chars(s, target), en.f, MF.chars(s, aura).ctrl, aura);
  };

  // Cost changes printed on cards (CR 601.2f): "This spell costs {1} less to cast if ...",
  // "Instant and sorcery spells you cast cost {1} less to cast."
  // Diamond Weapon: "Prevent all combat damage that would be dealt to ~" (CR 615).
  MF.replacers.damage.push(function (s, o, n) {
    if (!o.combat || o.to.c == null || !I(s, o.to.c) || I(s, o.to.c).zone !== 'bf') return n;
    if (!MF.chars(s, o.to.c).ab.some(a => a.k === 'preventCombatToSelf')) return n;
    log(s, 'prevented', { who: I(s, o.to.c).ctrl, c: I(s, o.to.c).id, n: n, src: o.srcChars ? o.srcChars.id : null });
    return 0;
  });
  MF.costMods.push(function (s, who, iid, ch, cost) {
    for (const a of ch.ab) if (a.k === 'costLess' && MF.cond({ s: s, ctrl: who, src: iid, flags: {} }, a.cond)) cost.g -= a.n;
    for (const a of ch.ab) if (a.k === 'costLessPer') cost.g -= a.zones.reduce((n, z) => n + P(s, who)[z].filter(i => i !== iid && I(s, i).owner === who && a.f.types.some(ty => MF.def(s, i).types.includes(ty))).length, 0);   // "for each creature card in your graveyard" (CR 601.2f)
    for (const a of ch.ab) if (a.k === 'affinity') cost.g -= s.bf.filter(i => I(s, i).ctrl === who && MF.matchChars(s, i, MF.chars(s, i), a.f, who, iid)).length;   // CR 702.41a
    for (const p of s.bf) {
      const pc = I(s, p); if (pc.ctrl !== who) continue;
      for (const a of MF.chars(s, p).ab) if (a.k === 'costLessFor' && a.spell.types.some(t => ch.types.includes(t))) cost.g -= a.n;
    }
  });

  // -------------------------------------------------------------------------------------------
  // Load-time validation: refuse to run rather than play a card wrongly.
  // -------------------------------------------------------------------------------------------
  const ABKINDS = ['mana', 'act', 'trig', 'static', 'cda', 'noUntap', 'etbTapped', 'enchant', 'costLess', 'costLessFor', 'spell', 'offspring', 'enterAsCopy', 'kicker', 'etbPayOrTap', 'restrict', 'hexproofFrom', 'lifeLossDouble', 'gift', 'bargain', 'harmonize', 'sneak', 'oppNoCast', 'warp', 'evasion', 'oppDieExile', 'addCost', 'etbCounters', 'flashback', 'mayhem', 'mustAttack', 'enterChoice', 'extraLand', 'landsFromGrave', 'uncounterable', 'affinity', 'maxBlockers', 'chosenLandType', 'plot', 'costLessPer', 'preventCombatToSelf', 'impending'];
  MF.validate = function () {
    const bad = [];
    const walkOps = (id, ops) => { for (const op of ops || []) { if (!OPS[op.o]) bad.push(id + ': op with no handler: ' + op.o); if (!MF.describeOp || !MF.describeOp[op.o]) bad.push(id + ': op with no describer: ' + op.o); if (op.ops) walkOps(id, op.ops); if (op.else) walkOps(id, op.else); if (op.cond && !CONDS[op.cond.c]) bad.push(id + ': no condition ' + op.cond.c); } };
    for (const id in MF.cards) {
      const d = MF.cards[id];
      if (d.un) continue;
      for (const a of d.ab.concat(d.alt ? d.alt.ab : [])) {
        for (const m of a.modes || []) walkOps(id, m.ops);   // spells' and triggers' modes                                      // a modal spell's modes (CR 700.2)
        if (a.gift && a.gift.ops) walkOps(id, a.gift.ops);
        if (!ABKINDS.includes(a.k)) bad.push(id + ': ability kind with no rule: ' + a.k);
        walkOps(id, a.ops);
        if (a.cond && !CONDS[a.cond.c]) bad.push(id + ': no condition ' + a.cond.c);
      }
      for (const k in d.kw) if (!MF.KEYWORDS.includes(k)) bad.push(id + ': keyword with no rule: ' + k);
    }
    for (const id in MF.decks) {
      const deck = MF.decks[id];
      if (!deck.registered) continue;
      let n = 0;
      for (const e of deck.main) {
        n += e.n;
        const d = MF.cards[e.id];
        if (!d) bad.push(id + ': unknown card ' + e.id);
        else if (d.un) bad.push(id + ': unimplemented card ' + e.id + ' (' + d.un + ')');
        if (MF.defects[e.id]) bad.push(id + ': defective card ' + e.id);
        if (d && !d.supers.includes('Basic') && e.n > 4 && deck.format === 'constructed') bad.push(id + ': more than four ' + e.id);   // CR 100.2a
      }
      if (n < deck.min) bad.push(id + ': ' + n + ' cards, fewer than ' + deck.min);
      for (const t of deck.tokens || []) if (!MF.cards[t]) bad.push(id + ': token not in the pack ' + t);
    }
    if (bad.length) throw new Error('MF.validate refused:\n  ' + bad.join('\n  '));
    return true;
  };
})();
