// The rules engine. Surface: MF.newGame / legalActions / apply (immutable) / isTerminal / whoActs.
// Section numbers cite the Magic: The Gathering Comprehensive Rules effective September 25, 2026;
// docs/rules.md is the index.
(function () {
  'use strict';
  const MF = window.MF;

  // -------------------------------------------------------------------------------------------
  // Basics
  // -------------------------------------------------------------------------------------------
  const clone = MF.clone = function (s) {
    const log = s.log; s.log = null;
    const c = JSON.parse(JSON.stringify(s));
    s.log = log; c.log = log.slice();
    if (s.pending && s.pending.view) Object.defineProperty(c.pending, 'view', { value: s.pending.view, enumerable: false });
    return c;
  };
  // What the player sees while a question is pending: the partial run that asked it (a card just
  // drawn by "draw a card, then discard a card" exists only there). Read-only; the answer re-runs
  // the effect from the pre-effect state.
  MF.view = s => (s.pending && s.pending.view) || s;
  const I = MF.inst = (s, iid) => s.cards[iid];
  const P = (s, seat) => s.players[seat];
  const def = MF.def = (s, iid) => MF.cards[s.cards[iid].id];
  // The log door. An entry's own fields may not reuse the names `t` (its type) or `turn`: a pump's
  // toughness once overwrote `t`, and the interface could no longer read the entry.
  const log = MF.log = function (s, t, d) {
    if (d && ('t' in d || 'turn' in d)) throw new Error('log entry ' + t + ' reuses a reserved field (t or turn)');
    s.log.push(Object.assign({ t: t, turn: s.turn }, d));
  };
  const ctl = MF.ctl = (s, iid) => s.cards[iid].ctrl;
  const freshHist = () => ({ cast: 0, castInstant: 0, castSorcery: 0, castOtter: 0, entered: 0, gained: 0, died: 0, attackedWith: 0 });

  const EXEC = MF.EXEC = {};
  function EXEC_DEF(name, f) { EXEC[name] = f; }
  function Ask(q) { this.ask = q; }
  function Illegal(why) { this.illegal = why; }
  MF.Illegal = Illegal;
  // The one choice door. There is no auto-take path: one option or fifty, the player is asked.
  const ask = MF.ask = function (x, q) {
    if (x.ai < x.inv.answers.length) return x.inv.answers[x.ai++];
    if (!q.opts.length) throw new Error('a question with no options: ' + q.kind);
    throw new Ask(q);
  };

  // -------------------------------------------------------------------------------------------
  // Setup (CR 103)
  // -------------------------------------------------------------------------------------------
  MF.newGame = function (setup) {
    const s = {
      seed: setup.seed | 0, rng: setup.seed | 0, turn: 0, ap: 0, step: 'pregame', sub: 0, firstTurn: true,
      priority: null, passes: 0, players: [], cards: {}, nid: 1, lid: 1, ts: 1,
      bf: [], stack: [], todo: [], pending: null, trigs: [], effects: [], combat: null,
      log: [], winner: null,
    };
    for (let seat = 0; seat < 2; seat++) {
      const deck = MF.decks[setup.decks[seat]];
      if (!deck || !deck.registered) throw new Error('deck is not registered: ' + setup.decks[seat]);
      const p = { seat: seat, deckId: deck.id, life: 20, hand: [], lib: [], grave: [], exile: [], pool: emptyPool(), landsPlayed: 0, mulls: 0, kept: false, drewEmpty: false, lost: false, h: freshHist() };
      s.players.push(p);
      for (const e of deck.main) for (let i = 0; i < e.n; i++) {
        const d = MF.cards[e.id];
        if (!d) throw new Error('unknown card: ' + e.id);
        if (d.un) throw new Error('unimplemented card in a registered deck: ' + e.id + ' (' + d.un + ')');
        if (MF.defects[e.id]) throw new Error('card listed in data/defects.js reached a deck: ' + e.id);
        const iid = s.nid++;
        s.cards[iid] = newObj(s, iid, e.id, seat, 'lib');
        p.lib.push(iid);
      }
      MF.shuffle(s, p.lib);                                                                  // CR 103.3
    }
    // CR 103.1: a randomly selected player chooses who takes the first turn.
    s.todo.push({ t: 'chooseFirst', who: MF.randInt(s, 2), answers: [] });
    return run(s);
  };
  function newObj(s, iid, id, owner, zone) {
    return { iid: iid, id: id, owner: owner, ctrl: owner, zone: zone, ts: s.ts++, tapped: false, dmg: 0, dt: false, ctr: {}, att: null, ctlTurn: s.turn };
  }
  const emptyPool = () => ({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });

  // -------------------------------------------------------------------------------------------
  // Zones. An object that moves from one zone to another becomes a new object with no memory of
  // its previous existence (CR 400.7): it gets a new iid, so a stale target fails on its own. The
  // old record stays as last known information (CR 608.2h), marked moved.
  // -------------------------------------------------------------------------------------------
  function zoneArr(s, c) {
    switch (c.zone) {
      case 'hand': return P(s, c.owner).hand; case 'lib': return P(s, c.owner).lib;
      case 'grave': return P(s, c.owner).grave; case 'exile': return P(s, c.owner).exile;
      case 'bf': return s.bf;
      default: return null;
    }
  }
  MF.zoneArr = zoneArr;
  // The zone-move door. o: { top, bottom, ctrl, tapped, x (the invocation, so a replacement that
  // asks can ask), why }. Returns the new object's iid.
  const move = MF.move = function (s, iid, zone, o) {
    o = o || {};
    const c = I(s, iid), from = c.zone;
    if (from === 'moved') throw new Error('moving an object that no longer exists: ' + iid);
    const lki = from === 'bf' ? snapshot(s, iid) : null;
    const arr = zoneArr(s, c);
    if (arr) { const i = arr.indexOf(iid); if (i >= 0) arr.splice(i, 1); }
    if (from === 'stack') { const i = s.stack.findIndex(L => L.iid === iid); if (i >= 0 && o.keepLayer !== true) { /* the layer is removed by its resolver */ } }
    const n = s.nid++;
    const nc = newObj(s, n, c.id, c.owner, zone);
    if (c.tok || (c.copySpell && zone === 'bf')) nc.tok = true;                           // CR 111.1; CR 608.3f: a copy of a permanent spell becomes a token
    if (c.copySpell) nc.copySpell = true;
    if (zone === 'bf' || zone === 'stack') nc.ctrl = o.ctrl != null ? o.ctrl : (zone === 'stack' ? (o.ctrl != null ? o.ctrl : c.owner) : c.owner);
    s.cards[n] = nc;
    c.zone = 'moved'; c.to = n; c.from = from; if (lki) c.lki = lki;
    if (zone === 'bf') {
      nc.ctlTurn = s.turn;                                                                   // CR 302.6
      if (o.tapped) nc.tapped = true;
      if (o.copy) nc.copy = o.copy;
      if (o.offspringPaid) nc.offspringPaid = true;
      if (o.spent != null) nc.spent = o.spent;
      if (o.castFromHand) nc.castFromHand = true;
      if (o.att != null) nc.att = o.att;
      enterReplacements(s, n, o);
    }
    const to = zoneArr(s, nc);
    if (to) { if (o.top) to.unshift(n); else to.push(n); }
    if (from === 'bf') {
      for (const k of s.bf) { const a = I(s, k); if (a.att === iid) a.att = -1; }            // what was attached to it is now attached to nothing (SBA 704.5m/n)
      if (s.combat) removeFromCombat(s, iid);                                                // CR 506.4
      emit(s, { t: 'leaves', iid: iid, to: zone, lki: lki });
      if (zone === 'grave' && lki.types.includes('Creature')) { emit(s, { t: 'dies', iid: iid, lki: lki, to: n }); P(s, lki.ctrl).h.died++; s.diedThisTurn = (s.diedThisTurn || 0) + 1; }
    }
    if (zone === 'bf') {
      const ch = chars(s, n);
      if (ch.types.includes('Creature')) { const h = P(s, nc.ctrl).h; h.entered++; (h.enteredIids = h.enteredIids || []).push(n); }   // turn history (handoff 11.7)
      emit(s, { t: 'enters', iid: n, ctrl: nc.ctrl });
    }
    return n;
  };
  // "Enters tapped" and other self-replacement effects (CR 614.1c, 614.12). A replacement that
  // offers a choice (Mockingbird) is asked by its resolver before the move, not here.
  // CR 614.1c, 614.12: "enters tapped", "enters tapped unless ...", and "As this land enters, you may
  // pay 2 life. If you don't, it enters tapped." — a choice made before it enters (614.12a), so the
  // move needs the invocation (o.x) to ask; every caller that puts a land onto the battlefield passes it.
  function enterReplacements(s, n, o) {
    const c = I(s, n);
    for (const a of baseChars(s, n).ab) {
      if (a.k === 'etbTapped' && !(a.unless && MF.cond({ s: s, ctrl: c.ctrl, src: n, flags: {} }, a.unless))) c.tapped = true;
      if (a.k === 'etbPayOrTap' && !o.tapped) {                                                // put onto the battlefield tapped anyway: paying could change nothing, so nothing is asked
        if (!o.x) throw new Error('a land with an entering choice was moved without the invocation to ask: ' + c.id);
        const p = P(s, c.ctrl);
        const can = p.life >= a.life;                                                          // CR 119.4: a player can pay life only if they have that much
        const ans = can ? ask(o.x, { who: c.ctrl, kind: 'payLifeOrTap', c: c.id, life: a.life, opts: [{ id: 'pay' }, { id: 'tapped' }] }) : 'tapped';
        if (ans === 'pay') MF.loseLife(s, c.ctrl, a.life, 'pay', c.id); else c.tapped = true;
      }
    }
  }
  // Losing life (paying it, or "loses N life") is not damage (CR 119.3, 119.4).
  MF.loseLife = function (s, who, n, why, cid) {
    const p = P(s, who); p.life -= n; p.h.lostLife = (p.h.lostLife || 0) + n;
    log(s, 'lifeLoss', { who: who, n: n, why: why || null, c: cid || null, life: p.life });
  };
  function snapshot(s, iid) {
    const c = I(s, iid), ch = chars(s, iid);
    return { iid: iid, id: c.id, owner: c.owner, ctrl: c.ctrl, name: ch.name, types: ch.types.slice(), subtypes: ch.subtypes.slice(), colors: ch.colors.slice(), p: ch.p, t: ch.t, kw: Object.assign({}, ch.kw), ab: ch.ab, ctr: Object.assign({}, c.ctr), tok: !!c.tok };
  }
  MF.snapshot = snapshot;
  // The object an iid now is: follows the moved chain (for the log and the interface only; the
  // rules never follow it, CR 400.7).
  MF.current = function (s, iid) { let c = s.cards[iid]; while (c && c.zone === 'moved') c = s.cards[c.to]; return c; };

  function draw(s, who, n) {
    const p = P(s, who); let k = 0;
    for (let i = 0; i < n; i++) {
      if (!p.lib.length) { p.drewEmpty = true; continue; }                                    // CR 104.3c, 121.3
      move(s, p.lib[0], 'hand'); k++;
      p.h.drawn = (p.h.drawn || 0) + 1;
    }
    if (k) log(s, 'draw', { who: who, n: k });
    return k;
  }
  MF.draw = draw;

  // -------------------------------------------------------------------------------------------
  // The characteristics door (CR 613). Every reader — legal actions, combat, state-based
  // actions, the interface, the AI — asks here. Layers are applied to every permanent together,
  // one layer at a time, so a condition read in a later layer sees the earlier layers' results
  // and nothing recurses.
  // -------------------------------------------------------------------------------------------
  const KWS = MF.KEYWORDS = ['flying', 'reach', 'firstStrike', 'doubleStrike', 'deathtouch', 'lifelink', 'trample', 'vigilance', 'haste', 'menace', 'defender', 'flash', 'hexproof', 'indestructible', 'prowess', 'shroud'];
  // An Adventure or Omen card on the stack as that spell has only its alternative characteristics
  // (CR 715.3b, 720.3b); asked about while casting, its alternative face is evaluated (715.3a, 720.3a).
  const faceChars = MF.faceChars = function (s, iid, alt) {
    if (!alt) return chars(s, iid);
    const f = def(s, iid).alt, c = I(s, iid);
    if (!f) throw new Error('no alternative face: ' + c.id);
    return { iid: iid, name: f.name, types: f.types.slice(), subtypes: f.subtypes.slice(), supers: f.supers.slice(), colors: f.colors.slice(), p: null, t: null, ab: f.ab, kw: Object.assign({}, f.kw), mana: f.mana, mv: MF.manaValue(MF.parseMana(f.mana)), ctrl: c.ctrl, owner: c.owner, tok: !!c.tok, alt: f.kind };
  };
  const faceDef = MF.faceDef = (s, iid, alt) => alt ? def(s, iid).alt : def(s, iid);
  function baseChars(s, iid) {
    const c = I(s, iid);
    if (c.asAlt && c.zone === 'stack') return faceChars(s, iid, true);
    let d = def(s, iid);
    let name = d.name, types = d.types.slice(), subtypes = d.subtypes.slice(), supers = d.supers.slice(), colors = d.colors.slice(), p = d.power, t = d.toughness, ab = d.ab, kw = Object.assign({}, d.kw), mana = d.mana;
    if (c.copy) {                                                                             // CR 613.2a layer 1a: copiable values
      const src = MF.cards[c.copy.id];
      name = src.name; types = src.types.slice(); subtypes = src.subtypes.slice(); supers = src.supers.slice(); colors = src.colors.slice();
      p = src.power; t = src.toughness; ab = src.ab; kw = Object.assign({}, src.kw); mana = src.mana;
      const ex = c.copy.except || {};                                                         // CR 707.9a-b: exceptions are part of the copiable values
      if (ex.addSubtypes) for (const st of ex.addSubtypes) if (!subtypes.includes(st)) subtypes.push(st);
      if (ex.kw) for (const k of ex.kw) kw[k] = (kw[k] || 0) + 1;
      if (ex.pt) { p = ex.pt[0]; t = ex.pt[1]; }
    }
    return { iid: iid, name: name, types: types, subtypes: subtypes, supers: supers, colors: colors, p: p, t: t, ab: ab, kw: kw, mana: mana, mv: MF.manaValue(MF.parseMana(mana)), ctrl: c.ctrl, owner: c.owner, tok: !!c.tok };
  }
  function computeBF(s) {
    const out = {};
    for (const iid of s.bf) out[iid] = baseChars(s, iid);                                    // layer 1
    // Layer 2: control-changing effects. Layer 3: text-changing effects. Layer 5: colour.
    // (No card in a registered deck makes these; written here so the order is right when one does.)
    for (const e of s.effects) if (e.k === 'control' && out[e.iid]) out[e.iid].ctrl = e.who;   // layer 2
    for (const e of s.effects) if (e.k === 'types' && out[e.iid]) { const o = out[e.iid]; o.types = e.types.slice(); o.subtypes = e.subtypes.slice(); }   // layer 4
    for (const e of s.effects) if (e.k === 'animate' && out[e.iid]) { const o = out[e.iid]; if (!o.types.includes('Creature')) o.types.push('Creature'); if (e.allTypes) o.allCreatureTypes = true; }   // layer 4: "becomes a creature ... It's still a land"
    for (const e of s.effects) if (e.k === 'color' && out[e.iid]) out[e.iid].colors = e.colors.slice();                                                 // layer 5
    // Statics that apply, in timestamp order (CR 613.7). Their conditions and affected sets are
    // read with layers 1-4 applied.
    const statics = [];
    for (const iid of s.bf) for (const a of out[iid].ab) if (a.k === 'static' || a.k === 'cda' || a.k === 'noUntap') statics.push({ src: iid, a: a, ts: I(s, iid).ts });
    statics.sort((x, y) => x.ts - y.ts);
    const affected = (st) => {
      const a = st.a, src = I(s, st.src), sc = out[st.src];
      if (a.cond && !MF.condStatic(s, st.src, a.cond, out)) return [];
      if (a.affects === 'self') return [st.src];
      if (a.affects === 'enchanted' || a.affects === 'equipped') return src.att != null && out[src.att] ? [src.att] : [];
      return s.bf.filter(i => MF.matchChars(s, i, out[i], a.affects, sc.ctrl, st.src));
    };
    // Layer 6: ability-adding and -removing effects.
    for (const st of statics) if (st.a.k === 'static' && st.a.grant) for (const i of affected(st)) for (const k of st.a.grant) out[i].kw[k] = (out[i].kw[k] || 0) + 1;
    for (const e of s.effects) if ((e.k === 'grant' || e.k === 'animate') && out[e.iid]) for (const k of e.kws) out[e.iid].kw[k] = (out[e.iid].kw[k] || 0) + 1;
    // Layer 7a: characteristic-defining abilities.
    for (const st of statics) if (st.a.k === 'cda') { const o = out[st.src]; const v = MF.valueStatic(s, st.src, st.a.v, out); if (st.a.p) o.p = v; if (st.a.t) o.t = v; }
    for (const iid of s.bf) { const o = out[iid]; if (o.p === '*') o.p = 0; if (o.t === '*') o.t = 0; }
    // Layer 7b: effects that set power and toughness.
    for (const e of s.effects) if ((e.k === 'setPT' || e.k === 'animate') && out[e.iid]) { out[e.iid].p = e.p; out[e.iid].t = e.t; }
    // Layer 7c: modifications, and counters.
    for (const st of statics) if (st.a.k === 'static' && (st.a.p || st.a.t)) for (const i of affected(st)) { out[i].p += st.a.p || 0; out[i].t += st.a.t || 0; }
    for (const e of s.effects) if (e.k === 'pt' && out[e.iid]) { out[e.iid].p += e.p; out[e.iid].t += e.t; }
    for (const iid of s.bf) { const c = I(s, iid), o = out[iid]; const n = (c.ctr['+1/+1'] || 0) - (c.ctr['-1/-1'] || 0); if (o.p != null) { o.p += n; o.t += n; } }
    // Layer 7d: switching. (None yet.)
    for (const e of s.effects) if (e.k === 'switchPT' && out[e.iid]) { const o = out[e.iid]; const p = o.p; o.p = o.t; o.t = p; }
    // Rules that are not layers but are read from the same place: "doesn't untap", "can't be blocked".
    for (const st of statics) if (st.a.k === 'noUntap') for (const i of affected(st)) out[i].noUntap = true;
    for (const e of s.effects) if (e.k === 'unblockable' && out[e.iid]) out[e.iid].unblockable = true;
    return out;
  }
  // Cached only on a state that has been handed back by apply/newGame: such a state is never
  // mutated again. Inside an invocation the copy is being changed, so nothing is cached.
  const chars = MF.chars = function (s, iid) {
    const c = I(s, iid);
    if (c.zone !== 'bf') return baseChars(s, iid);
    if (s._frozen) { if (!s._ch) Object.defineProperty(s, '_ch', { value: computeBF(s), enumerable: false, writable: true }); const r = s._ch[iid]; if (r) return r; }
    return computeBF(s)[iid];
  };
  MF.charsAll = function (s) { if (s._frozen) { if (!s._ch) Object.defineProperty(s, '_ch', { value: computeBF(s), enumerable: false, writable: true }); return s._ch; } return computeBF(s); };
  function abilitiesOf(s, iid) { return chars(s, iid).ab; }
  MF.abilitiesOf = abilitiesOf;
  const hasKw = MF.hasKw = (s, iid, k) => !!chars(s, iid).kw[k];
  const isType = MF.isType = (s, iid, t) => chars(s, iid).types.includes(t);

  // -------------------------------------------------------------------------------------------
  // The damage door (CR 120). Lifelink, deathtouch, damage marked, life lost, and the event.
  // -------------------------------------------------------------------------------------------
  // o: { src (iid or lki), to: {p: seat} | {c: iid}, n, combat }
  const dealDamage = MF.dealDamage = function (s, o) {
    let n = o.n;
    if (n <= 0) return 0;
    const sc = o.srcChars;                                                                   // the source's characteristics as it deals the damage (last known if it is gone, CR 608.2h)
    for (const f of MF.replacers.damage) n = f(s, o, n);                                     // CR 615, 616: prevention and replacement (none in a registered deck yet)
    if (n <= 0) return 0;
    if (o.to.p != null) {
      const p = P(s, o.to.p);
      p.life -= n;                                                                           // CR 120.3a
      p.h.lostLife = (p.h.lostLife || 0) + n;                                                // turn history: "if an opponent lost life this turn"
      log(s, 'damage', { who: o.to.p, n: n, src: sc.name, srcId: sc.id, life: p.life, combat: !!o.combat });
    } else {
      const c = I(s, o.to.c);
      c.dmg += n;                                                                            // CR 120.3e
      emit(s, { t: 'dealtDamage', iid: o.to.c, n: n, src: sc.iid });                          // "whenever this creature is dealt damage"
      if (sc.kw.deathtouch) c.dt = true;                                                     // CR 702.2b
      log(s, 'damageCreature', { who: c.ctrl, n: n, src: sc.name, srcId: sc.id, c: c.id, combat: !!o.combat });
    }
    if (sc.kw.lifelink) gainLife(s, sc.ctrl, n, sc);                                         // CR 702.15b
    emit(s, { t: 'dealsDamage', src: sc.iid, srcCtrl: sc.ctrl, to: o.to, n: n, combat: !!o.combat });
    return n;
  };
  MF.replacers = { damage: [] };
  const gainLife = MF.gainLife = function (s, who, n, src) {
    if (n <= 0) return 0;
    const p = P(s, who);
    if (p.noGain) { log(s, 'noGain', { who: who, n: n }); return 0; }                        // Screaming Nemesis: "can't gain life for the rest of the game"
    p.life += n; p.h.gained += n;
    log(s, 'life', { who: who, n: n, life: p.life, src: src ? src.name : null });
    emit(s, { t: 'gainLife', who: who, n: n });
    return n;
  };

  // -------------------------------------------------------------------------------------------
  // Triggers (CR 603). Nothing resolves inline: a triggered ability waits in s.trigs until a
  // player would receive priority, then goes on the stack in APNAP order (CR 603.3b).
  // -------------------------------------------------------------------------------------------
  const emit = MF.emit = function (s, ev) {
    const seen = new Set();
    const scan = (iid, lki) => {
      const key = iid + (lki ? 'L' : '');
      if (seen.has(key)) return; seen.add(key);
      const src = lki || chars(s, iid);
      const ab = lki ? abFromLki(s, lki) : src.ab;
      for (let i = 0; i < ab.length; i++) {
        const a = ab[i];
        if (a.k !== 'trig' || a.on !== ev.t) continue;
        if (!!a.lookBack !== !!lki) continue;                                                 // CR 603.10a: leaves-the-battlefield triggers look back in time
        if (!MF.trigMatch(s, iid, src, a, ev)) continue;
        s.trigs.push({ src: iid, ab: i, ctrl: src.ctrl, ev: ev, lki: lki || null });
      }
      if (ev.t === 'cast' && !lki && src.kw && src.kw.prowess && ev.ctrl === src.ctrl && !ev.types.includes('Creature') && src.types.includes('Creature')) {
        for (let k = 0; k < src.kw.prowess; k++) s.trigs.push({ src: iid, ab: -1, inl: 'prowess', ctrl: src.ctrl, ev: ev });   // CR 702.108a-b: each instance triggers separately
      }
    };
    for (const iid of s.bf.slice()) scan(iid, null);
    if (ev.lki) scan(ev.iid, ev.lki);
  };
  function abFromLki(s, lki) { return lki.ab || MF.cards[lki.id].ab; }                     // the abilities it had, a copy's included (CR 608.2h)

  // -------------------------------------------------------------------------------------------
  // Mana and the cost door (CR 601.2f-h, 605)
  // -------------------------------------------------------------------------------------------
  // Mana abilities a player could activate now: [{ iid, ab index, cols }]. CR 302.6: a creature's
  // {T} ability needs it to have been controlled since the turn began, unless it has haste.
  // ctx: { creature } — what the mana is for. Mana that may be spent only on creature spells
  // (Rockface Village, CR 106.6) is offered only when paying for one.
  const manaSources = MF.manaSources = function (s, who, ctx) {
    const out = [];
    for (const iid of s.bf) {
      const c = I(s, iid); if (c.ctrl !== who || c.tapped) continue;
      const ch = chars(s, iid);
      ch.ab.forEach((a, i) => {
        if (a.k !== 'mana') return;
        if (a.only === 'creature' && !(ctx && ctx.creature)) return;
        if (a.cond && !MF.cond({ s: s, ctrl: who, src: iid, flags: {} }, a.cond)) return;        // the Verges: "Activate only if you control ..."
        if (a.cost.life && P(s, who).life < a.cost.life) return;                                 // CR 119.4
        if (ch.types.includes('Creature') && !ch.kw.haste && !(c.ctlTurn < s.turn)) return;
        out.push({ iid: iid, ab: i, cols: a.cols, name: ch.name, id: c.id });
      });
    }
    return out;
  };
  // The solver. It proposes a complete payment and never decides: the player confirms it or taps
  // sources one by one (PLAN D8). Returns { taps: [{iid, ab, col}] } or null. Backtracking, so a
  // payment that exists is found even with two-colour lands (no greedy canPay).
  const solve = MF.solveMana = function (pool, srcs, need) {
    const rem = Object.assign({}, need);
    const left = Object.assign({}, pool);
    for (const k of ['W', 'U', 'B', 'R', 'G', 'C']) { const u = Math.min(left[k], rem[k]); left[k] -= u; rem[k] -= u; }
    let poolLeft = left.W + left.U + left.B + left.R + left.G + left.C;
    const g0 = Math.max(0, rem.g - poolLeft);
    const pips = []; for (const k of ['W', 'U', 'B', 'R', 'G', 'C']) for (let i = 0; i < rem[k]; i++) pips.push(k);
    // Fewest-colour sources first: they are the least useful to keep.
    const order = srcs.slice().sort((a, b) => a.cols.length - b.cols.length);
    const used = new Array(order.length).fill(false), taps = [];
    function fill(pi) {
      if (pi === pips.length) {
        const free = order.map((o, i) => i).filter(i => !used[i]);
        if (free.length < g0) return false;
        for (let k = 0; k < g0; k++) taps.push({ iid: order[free[k]].iid, ab: order[free[k]].ab, col: order[free[k]].cols[0] });
        return true;
      }
      const col = pips[pi];
      for (let i = 0; i < order.length; i++) {
        if (used[i] || !order[i].cols.includes(col)) continue;
        used[i] = true; taps.push({ iid: order[i].iid, ab: order[i].ab, col: col });
        if (fill(pi + 1)) return true;
        used[i] = false; taps.pop();
      }
      return false;
    }
    return fill(0) ? { taps: taps } : null;
  };
  const poolTotal = p => p.W + p.U + p.B + p.R + p.G + p.C;
  // The pool that may pay this cost: creature-only mana (p.poolCre, a part of p.pool) only for a creature spell.
  const usablePool = (p, ctx) => { if (ctx && ctx.creature) return Object.assign({}, p.pool); const u = {}; for (const k of ['W', 'U', 'B', 'R', 'G', 'C']) u[k] = p.pool[k] - ((p.poolCre && p.poolCre[k]) || 0); return u; };
  const canPayMana = MF.canPayMana = (s, who, need, ctx) => !!solve(usablePool(P(s, who), ctx), manaSources(s, who, ctx), need);
  // How much mana a player could make right now: pool plus untapped sources (for the X question).
  MF.manaAvailable = (s, who, ctx) => poolTotal(usablePool(P(s, who), ctx)) + manaSources(s, who, ctx).length;

  function activateMana(s, who, iid, abIdx, col) {
    const c = I(s, iid), a = chars(s, iid).ab[abIdx];
    if (a.k !== 'mana' || !a.cols.includes(col)) throw new Error('not a mana ability for ' + col);
    if (c.tapped) throw new Illegal('already tapped');
    c.tapped = true;                                                                          // CR 605.3b: it resolves immediately
    const p = P(s, who);
    p.pool[col]++;
    if (a.only === 'creature') { p.poolCre = p.poolCre || emptyPool(); p.poolCre[col]++; }   // CR 106.6: mana with a spending restriction
    if (a.cost.life) MF.loseLife(s, who, a.cost.life, 'pay', c.id);                         // CR 119.4: paying life is part of the cost
    log(s, 'mana', { who: who, c: c.id, col: col, only: a.only || null });
    if (a.selfDamage && col !== 'C') dealDamage(s, { srcChars: Object.assign({ id: c.id }, chars(s, iid)), to: { p: who }, n: a.selfDamage });   // pain lands: "deals 1 damage to you" (the {C} ability is the other one)
  }
  // Ways to spend the pool on a cost that it covers: the coloured pips are forced; the generic
  // part is a choice when the pool holds more than one kind of mana beyond the pips.
  function spendPlans(pool, need) {
    const left = Object.assign({}, pool);
    for (const k of ['W', 'U', 'B', 'R', 'G', 'C']) left[k] -= need[k];
    const kinds = ['W', 'U', 'B', 'R', 'G', 'C'].filter(k => left[k] > 0);
    const plans = [];
    const rec = (i, g, cur) => {
      if (g === 0) { plans.push(Object.assign({}, cur)); return; }
      if (i === kinds.length) return;
      const k = kinds[i];
      for (let n = Math.min(left[k], g); n >= 0; n--) { cur[k] = n; rec(i + 1, g - n, cur); }
      cur[k] = 0;
    };
    rec(0, need.g, {});
    return plans;
  }
  // The mana half of the cost door. Mana abilities are activated inside the payment (CR 601.2g,
  // 605.3a); the player always chooses which source, unless the sources are indistinguishable.
  const payMana = MF.payMana = function (x, who, need, srcIid, cancel, ctx) {
    const s = x.s, p = P(s, who);
    if (MF.manaValue(need) === 0) return;
    for (let guard = 0; guard < 60; guard++) {
      const pool = usablePool(p, ctx);
      const covered = ['W', 'U', 'B', 'R', 'G', 'C'].every(k => pool[k] >= need[k]) && poolTotal(pool) >= MF.manaValue(need);
      if (covered) {
        const plans = spendPlans(pool, need);
        const plan = plans.length > 1 ? plans[ask(x, { who: who, kind: 'spend', src: srcIid, need: need, opts: plans.map((pl, i) => ({ id: i, plan: pl })), cancel: cancel })] : plans[0];
        for (const k of ['W', 'U', 'B', 'R', 'G', 'C']) {
          const spent = need[k] + (plan[k] || 0);
          p.pool[k] -= spent;
          if (ctx && ctx.creature && p.poolCre) p.poolCre[k] -= Math.min(p.poolCre[k], spent);   // creature-only mana is spent first on a creature spell
        }
        log(s, 'pay', { who: who, mana: MF.manaStr(need) });
        return;
      }
      const srcs = manaSources(s, who, ctx);
      const plan = solve(pool, srcs, need);
      if (!plan) throw new Illegal('cannot pay ' + MF.manaStr(need));
      // One option per distinguishable source and colour: identical basic lands are one option.
      const opts = [{ id: 'auto', taps: plan.taps }], seenKey = new Set();
      for (const src of srcs) for (const col of src.cols) {
        const key = src.id + ':' + col + ':' + JSON.stringify(chars(s, src.iid).ab.filter(a => a.k !== 'mana').length);
        if (seenKey.has(key)) continue; seenKey.add(key);
        opts.push({ id: 'tap:' + src.iid + ':' + src.ab + ':' + col, iid: src.iid, col: col });
      }
      const a = ask(x, { who: who, kind: 'pay', src: srcIid, need: need, pool: Object.assign({}, p.pool), opts: opts, cancel: cancel });
      if (a === 'auto') { for (const t of plan.taps) activateMana(s, who, t.iid, t.ab, t.col); }
      else { const [, iid, ab, col] = a.split(':'); activateMana(s, who, +iid, +ab, col); }
    }
    throw new Error('payMana did not settle');
  };

  // The whole cost (CR 601.2f): mana cost or X, plus additional costs, plus increases, minus
  // reductions (generic only, never below zero).
  MF.costMods = [];          // (s, who, iid, d, cost) => void: js/ops.js registers "costs {1} less"
  const spellCost = MF.spellCost = function (s, who, iid, o) {
    const ch = faceChars(s, iid, o && o.alt);
    const c = MF.parseMana(ch.mana);
    c.g += (o && o.x ? o.x * c.x : 0); const xs = c.x; c.x = 0;
    if (o && o.extra) { const e = o.extra; for (const k in e) c[k] += e[k]; }
    for (const f of MF.costMods) f(s, who, iid, ch, c);
    c.g = Math.max(0, c.g);
    c.xs = xs;
    return c;
  };
  MF.costOf = function (s, who, iid) { const c = spellCost(s, who, iid, { x: 0 }); delete c.xs; return c; };

  // -------------------------------------------------------------------------------------------
  // Targets (CR 115, 601.2c, 608.2b)
  // -------------------------------------------------------------------------------------------
  // A target reference is { p: seat } or { c: iid }.
  const targetable = MF.targetable = function (s, ref, slot, who, srcIid) {
    if (ref.p != null) return MF.matchPlayer(s, ref.p, slot.f, who);
    const c = s.cards[ref.c];
    if (slot.f && slot.f.card) return !!c && c.zone === slot.f.card;                        // a card in a graveyard: no characteristics beyond the card's own are checked
    if (!c || c.zone !== 'bf') return false;
    const ch = chars(s, ref.c);
    if (ch.kw.shroud) return false;                                                          // CR 702.18a
    if (ch.kw.hexproof && ch.ctrl !== who) return false;                                     // CR 702.11b
    return MF.matchChars(s, ref.c, ch, slot.f, who, srcIid);
  };
  MF.targetOptions = function (s, slot, who, srcIid, chosen) {
    const out = [];
    if (MF.slotTakesPlayers(slot.f)) for (const seat of [who, 1 - who]) if (targetable(s, { p: seat }, slot, who, srcIid)) out.push({ p: seat });
    if (slot.f && slot.f.card) { for (const p of s.players) for (const iid of p[slot.f.card]) out.push({ c: iid }); }
    else if (MF.slotTakesObjects(slot.f)) for (const iid of s.bf) if (targetable(s, { c: iid }, slot, who, srcIid)) out.push({ c: iid });
    return out.filter(r => !(chosen || []).some(q => q.p === r.p && q.c === r.c));
  };
  const refId = r => r.p != null ? 'p' + r.p : 'c' + r.c;
  MF.refId = refId;
  // Choose targets for each slot. A slot with "up to N" may take fewer. Different instances of
  // the word "target" on one object may not take the same object (CR 115.3) only when the text
  // says "other"; the same object may be chosen once per instance otherwise.
  function chooseTargets(x, who, srcIid, slots, kindSrc, cancel) {
    const s = x.s, out = [];
    slots.forEach((slot, si) => {
      const picked = [];
      const n = slot.n || 1;
      for (let k = 0; k < n; k++) {
        const opts = MF.targetOptions(s, slot, who, srcIid, picked).map(r => Object.assign({ id: refId(r) }, r.c != null ? { iid: r.c } : { seat: r.p }));
        if (slot.diff != null) for (const r of out[slot.diff] || []) { const i = opts.findIndex(o => o.id === refId(r)); if (i >= 0) opts.splice(i, 1); }
        if (slot.upTo || k > 0) opts.push({ id: 'done' });
        if (!opts.length || (opts.length === 1 && opts[0].id === 'done')) { if (slot.upTo || k > 0) break; throw new Illegal('no legal target'); }
        const a = ask(x, { who: who, kind: 'target', src: srcIid, srcKind: kindSrc, slot: si, n: n, upTo: !!slot.upTo, picked: picked.map(refId), opts: opts, cancel: cancel });
        if (a === 'done') break;
        picked.push(a[0] === 'p' ? { p: +a.slice(1) } : { c: +a.slice(1) });
      }
      out.push(picked);
    });
    return out;
  }
  MF.chooseTargets = chooseTargets;
  const slotsLegalNow = MF.slotsLegalNow = function (s, who, srcIid, slots) {
    return slots.every(slot => slot.upTo || MF.targetOptions(s, slot, who, srcIid, []).length >= 1);
  };

  // -------------------------------------------------------------------------------------------
  // Priority (CR 117) and the turn (CR 500-514)
  // -------------------------------------------------------------------------------------------
  const STEPS = MF.STEPS = ['untap', 'upkeep', 'draw', 'main1', 'boc', 'attackers', 'blockers', 'fsdamage', 'damage', 'eoc', 'main2', 'end', 'cleanup'];
  function setPriority(s, who) { s.priority = who; s.passes = 0; }
  MF.setPriority = setPriority;
  function bothPassed(s) {                                                                    // CR 117.4
    s.priority = null; s.passes = 0;
    if (s.stack.length) { s.todo.push({ t: 'resolve', answers: [] }); return; }
    endStep(s);
  }
  // CR 500.5: as a step ends, "until end of step" effects end, then mana empties.
  function endStep(s) {
    for (const p of s.players) { if (poolTotal(p.pool)) log(s, 'manaEmpties', { who: p.seat, n: poolTotal(p.pool) }); p.pool = emptyPool(); p.poolCre = emptyPool(); }
    let extra = false;
    if (s.step === 'eoc') {                                                                   // CR 511.3
      s.effects = s.effects.filter(e => e.until !== 'eoc');
      s.combat = null;
      if (s.extraCombat > 0) { s.extraCombat--; extra = true; log(s, 'extraCombat', { who: s.ap }); }   // CR 500.8: "After this phase, there is an additional combat phase"
    }
    let i = extra ? STEPS.indexOf('boc') : STEPS.indexOf(s.step) + 1;
    if (s.step === 'attackers' && s.combat && !s.combat.attackers.length) i = STEPS.indexOf('eoc');   // CR 508.8
    if (STEPS[i] === 'fsdamage') { const cb = s.combat; cb.fs = cb.attackers.concat(Object.keys(cb.blocks).map(Number)).some(i2 => I(s, i2).zone === 'bf' && (hasKw(s, i2, 'firstStrike') || hasKw(s, i2, 'doubleStrike'))); if (!cb.fs) i++; }                                        // CR 510.4: the first-strike step exists only if a first or double striker is in combat
    if (s.step === 'cleanup' && s.cleanupAgain) { s.cleanupAgain = false; s.sub = 0; return; }   // CR 514.3a: another cleanup step
    if (i >= STEPS.length) { nextTurn(s); return; }
    s.step = STEPS[i]; s.sub = 0;
  }
  function nextTurn(s) {
    s.ap = 1 - s.ap; s.turn++; s.step = 'untap'; s.sub = 0; s.firstTurn = false; s.extraCombat = 0;
    for (const p of s.players) { p.landsPlayed = 0; p.h = freshHist(); }
    s.diedThisTurn = 0;
  }
  function stepFlow(s) {
    const ap = s.ap;
    if (s.sub === 1) throw new Error('stepFlow: a priority step with nobody holding priority');
    s.sub = 1;
    switch (s.step) {
      case 'untap':                                                                           // CR 502.3
        log(s, 'turn', { who: ap, n: s.turn });
        for (const iid of s.bf) { const c = I(s, iid); if (c.ctrl === ap && c.tapped && !chars(s, iid).noUntap) c.tapped = false; }
        s.step = 'upkeep'; s.sub = 0;                                                          // CR 502.4: no priority in the untap step
        return;
      case 'upkeep': emit(s, { t: 'beginStep', step: 'upkeep', ap: ap }); setPriority(s, ap); return;   // CR 503.1
      case 'draw':
        if (!(s.firstTurn)) draw(s, ap, 1);                                                   // CR 504.1, 103.8a
        setPriority(s, ap); return;
      case 'main1': case 'main2': setPriority(s, ap); return;                                // CR 505.6
      case 'boc':                                                                             // CR 507
        s.combat = { attackers: [], blocks: {}, blockedBy: {}, blocked: {}, fs: false, dealtFirst: [] };
        emit(s, { t: 'beginStep', step: 'boc', ap: ap });
        setPriority(s, ap); return;
      case 'attackers': s.todo.push({ t: 'declareAttackers', who: ap, answers: [] }); return;   // CR 508.1
      case 'blockers': s.todo.push({ t: 'declareBlockers', who: 1 - ap, answers: [] }); return; // CR 509.1
      case 'fsdamage': s.todo.push({ t: 'combatDamage', first: true, answers: [] }); return;    // CR 510, 702.7b
      case 'damage': s.todo.push({ t: 'combatDamage', first: false, answers: [] }); return;
      case 'eoc': emit(s, { t: 'beginStep', step: 'eoc', ap: ap }); setPriority(s, ap); return;  // CR 511.1
      case 'end': emit(s, { t: 'beginStep', step: 'end', ap: ap }); setPriority(s, ap); return;  // CR 513.1
      case 'cleanup': s.todo.push({ t: 'cleanup', who: ap, answers: [] }); return;            // CR 514
      default: throw new Error('stepFlow: unknown step ' + s.step);
    }
  }
  MF.stepName = s => ({ pregame: 'Before the game', untap: 'Untap step', upkeep: 'Upkeep', draw: 'Draw step', main1: 'First main phase', boc: 'Beginning of combat', attackers: 'Declare attackers', blockers: 'Declare blockers', fsdamage: 'First-strike damage', damage: 'Combat damage', eoc: 'End of combat', main2: 'Second main phase', end: 'End step', cleanup: 'Cleanup' })[s.step];

  // -------------------------------------------------------------------------------------------
  // Combat (CR 506-511)
  // -------------------------------------------------------------------------------------------
  function removeFromCombat(s, iid) {
    const cb = s.combat;
    cb.attackers = cb.attackers.filter(a => a !== iid);
    if (cb.blocks[iid]) { for (const a of cb.blocks[iid]) cb.blockedBy[a] = (cb.blockedBy[a] || []).filter(b => b !== iid); delete cb.blocks[iid]; }
    if (cb.blockedBy[iid]) { for (const b of cb.blockedBy[iid]) if (cb.blocks[b]) cb.blocks[b] = cb.blocks[b].filter(a => a !== iid); delete cb.blockedBy[iid]; }
  }
  const restricted = MF.restricted = (s, iid, what) => chars(s, iid).ab.some(a => a.k === 'restrict' && a[what] && !(a.unless && MF.cond({ s: s, ctrl: I(s, iid).ctrl, src: iid, flags: {} }, a.unless)));
  const canAttack = MF.canAttack = function (s, iid) {                                       // CR 508.1a
    const c = I(s, iid), ch = chars(s, iid);
    if (c.ctrl !== s.ap || !ch.types.includes('Creature') || c.tapped) return false;
    if (ch.kw.defender) return false;                                                        // CR 702.3b
    if (restricted(s, iid, 'attack')) return false;
    if (!ch.kw.haste && !(c.ctlTurn < s.turn)) return false;                                 // CR 302.6
    if (s.effects.some(e => e.k === 'cantAttack' && e.iid === iid)) return false;
    return true;
  };
  // Can this creature block that attacker, given what else has been declared?
  const canBlock = MF.canBlock = function (s, b, a) {
    const bc = I(s, b), bch = chars(s, b), ach = chars(s, a);
    if (bc.ctrl === s.ap || bc.tapped || !bch.types.includes('Creature')) return false;       // CR 509.1a
    if (s.effects.some(e => e.k === 'cantBlock' && e.iid === b)) return false;
    if (ach.unblockable) return false;
    if (restricted(s, b, 'block')) return false;
    if (ach.kw.flying && !bch.kw.flying && !bch.kw.reach) return false;                      // CR 702.9b
    return true;
  };
  EXEC_DEF('declareAttackers', function (x) {                                                // CR 508.1
    const s = x.s, who = x.inv.who, chosen = [];
    for (;;) {
      const opts = s.bf.filter(i => !chosen.includes(i) && canAttack(s, i)).map(i => ({ id: i, iid: i }));
      if (!opts.length && !chosen.length) break;                                             // nothing could attack: not a choice
      opts.push({ id: 'done' });
      if (chosen.length) opts.push({ id: 'undo' });
      const a = ask(x, { who: who, kind: 'attack', chosen: chosen.slice(), opts: opts });
      if (a === 'done') break;
      if (a === 'undo') { chosen.pop(); continue; }
      chosen.push(a);
    }
    const cb = s.combat;
    for (const iid of chosen) {
      const c = I(s, iid);
      if (!chars(s, iid).kw.vigilance) c.tapped = true;                                        // CR 508.1f, 702.20b
      cb.attackers.push(iid);
    }
    log(s, 'attackers', { who: who, cs: chosen.map(i => I(s, i).id) });
    if (chosen.length) P(s, who).h.attackedWith += chosen.length;
    for (const iid of chosen) { const c = I(s, iid), first = c.attackedTurn !== s.turn; c.attackedTurn = s.turn; emit(s, { t: 'attacks', iid: iid, ctrl: who, first: first }); }   // CR 508.1m
    if (chosen.length) {                                                                      // CR 508.3c: "Whenever you attack with one or more Lizards" — once for the declaration
      const subs = new Set(); let anyType = false;
      for (const iid of chosen) { const ch = chars(s, iid); ch.subtypes.forEach(st => subs.add(st)); if (ch.allCreatureTypes) anyType = true; }
      emit(s, { t: 'attackWith', ctrl: who, subtypes: [...subs], anyType: anyType });
    }
    setPriority(s, s.ap);                                                                     // CR 508.2
  });
  function blockLegal(s, assign) {                                                           // CR 509.1b: menace (702.111b) is checked on the whole declaration
    const count = {};
    for (const b in assign) count[assign[b]] = (count[assign[b]] || 0) + 1;
    for (const a in count) if (chars(s, +a).kw.menace && count[a] < 2) return false;
    return true;
  }
  EXEC_DEF('declareBlockers', function (x) {                                                 // CR 509.1
    const s = x.s, who = x.inv.who, cb = s.combat, assign = {};
    for (;;) {
      const opts = [];
      for (const b of s.bf) if (assign[b] == null) for (const a of cb.attackers) if (canBlock(s, b, a)) opts.push({ id: b + '>' + a, iid: b, att: a });
      if (!opts.length && !Object.keys(assign).length) break;
      if (blockLegal(s, assign)) opts.push({ id: 'done' });
      if (Object.keys(assign).length) opts.push({ id: 'undo' });
      const ans = ask(x, { who: who, kind: 'block', assign: Object.assign({}, assign), opts: opts });
      if (ans === 'done') break;
      if (ans === 'undo') { const ks = Object.keys(assign); delete assign[ks[ks.length - 1]]; continue; }
      const [b, a] = ans.split('>').map(Number);
      assign[b] = a;
    }
    for (const b in assign) {
      const a = assign[b];
      cb.blocks[b] = [a];
      (cb.blockedBy[a] = cb.blockedBy[a] || []).push(+b);
    }
    for (const a of cb.attackers) cb.blocked[a] = !!(cb.blockedBy[a] && cb.blockedBy[a].length);   // CR 509.1h
    log(s, 'blockers', { who: who, pairs: Object.keys(assign).map(b => [I(s, +b).id, I(s, assign[b]).id]) });
    for (const b in assign) emit(s, { t: 'blocks', iid: +b, att: assign[b] });
    for (const a of cb.attackers) if (cb.blocked[a]) emit(s, { t: 'becomesBlocked', iid: a });
    // CR 510.4: decided as the combat damage step begins; the first-strike step is skipped if nobody has it.
    setPriority(s, s.ap);
  });
  // CR 510.1, 702.19b: the attacking player assigns, then the defending player; then all of it is dealt at once.
  EXEC_DEF('combatDamage', function (x) {
    const s = x.s, cb = s.combat, first = x.inv.first;
    if (first == null) throw new Error('combatDamage needs first');
    if (!first && s.step === 'damage' && !cb.checkedFs) { /* fall through */ }
    const strikes = iid => { const k = chars(s, iid).kw; return first ? !!(k.firstStrike || k.doubleStrike) : (!cb.dealtFirst.includes(iid) || !!k.doubleStrike); };
    const assigns = [];                                                                       // { src, to, n }
    // Attackers, by the active player.
    for (const a of cb.attackers) {
      if (!strikes(a)) continue;
      const ch = chars(s, a), pow = ch.p;
      if (pow <= 0) continue;                                                                 // CR 510.1a
      const blockers = (cb.blockedBy[a] || []).filter(b => I(s, b).zone === 'bf');
      if (!cb.blocked[a]) { assigns.push({ src: a, to: { p: 1 - s.ap }, n: pow }); continue; }   // CR 510.1b
      if (!blockers.length) {                                                                 // CR 510.1c, 702.19d
        if (ch.kw.trample) assigns.push({ src: a, to: { p: 1 - s.ap }, n: pow });
        continue;
      }
      divide(x, s.ap, a, pow, blockers, ch.kw.trample ? { p: 1 - s.ap } : null, ch.kw.deathtouch, assigns);
    }
    // Blockers, by the defending player.
    for (const b in cb.blocks) {
      const bi = +b;
      if (I(s, bi).zone !== 'bf' || !strikes(bi)) continue;
      const pow = chars(s, bi).p; if (pow <= 0) continue;
      const atts = cb.blocks[b].filter(a => I(s, a).zone === 'bf');
      if (!atts.length) continue;
      divide(x, 1 - s.ap, bi, pow, atts, null, chars(s, bi).kw.deathtouch, assigns);
    }
    if (first) { cb.fsDone = true; for (const a of cb.attackers.concat(Object.keys(cb.blocks).map(Number))) if (strikes(a)) cb.dealtFirst.push(a); }
    // CR 510.2: dealt simultaneously. Each source's characteristics are read now, before any of it is dealt.
    const srcChars = {}; for (const as of assigns) srcChars[as.src] = Object.assign({ id: I(s, as.src).id }, chars(s, as.src));
    for (const as of assigns) dealDamage(s, { srcChars: srcChars[as.src], to: as.to, n: as.n, combat: true });
    setPriority(s, s.ap);                                                                     // CR 510.3
  });
  // Lethal damage for assignment (CR 702.19b, 702.2c): toughness minus damage already marked
  // and already assigned this step; one is lethal from a deathtouch source.
  function lethalFor(s, b, assigned, dt) { const ch = chars(s, b); const left = Math.max(0, ch.t - I(s, b).dmg - (assigned[b] || 0)); return dt ? Math.min(1, left) : left; }
  // Divide a creature's combat damage among several recipients (CR 510.1c-d). One recipient: no
  // choice. Several, or trample's excess: the controller chooses, one recipient at a time.
  function divide(x, who, src, pow, recips, trampleTo, dt, assigns) {
    const s = x.s;
    if (recips.length === 1 && !trampleTo) { assigns.push({ src: src, to: { c: recips[0] }, n: pow }); return; }
    const assigned = {}; for (const as of assigns) if (as.to.c != null) assigned[as.to.c] = (assigned[as.to.c] || 0) + as.n;
    let left = pow;
    const mine = {};
    for (let i = 0; i < recips.length && left > 0; i++) {
      const b = recips[i];
      const lethal = lethalFor(s, b, assigned, dt);
      // With trample, every blocker must be assigned lethal before any goes to the player (CR 702.19b).
      const restLethal = trampleTo ? recips.slice(i + 1).reduce((a, r) => a + lethalFor(s, r, assigned, dt), 0) : 0;
      const isLast = i === recips.length - 1;
      let min = trampleTo ? Math.min(left, lethal) : 0;
      let max = left;
      if (!trampleTo && isLast) min = left;                                                  // without trample, it all goes to the blockers
      if (trampleTo) max = left;
      if (min === max) { mine[b] = min; left -= min; continue; }
      const opts = []; for (let n = max; n >= min; n--) opts.push({ id: n, n: n });
      const n = ask(x, { who: who, kind: 'assign', src: src, to: b, left: left, lethal: lethal, trample: !!trampleTo, restLethal: restLethal, opts: opts });
      mine[b] = n; left -= n;
    }
    for (const b in mine) if (mine[b] > 0) assigns.push({ src: src, to: { c: +b }, n: mine[b] });
    if (left > 0) { if (!trampleTo) throw new Error('undivided combat damage'); assigns.push({ src: src, to: trampleTo, n: left }); }
  }

  // -------------------------------------------------------------------------------------------
  // State-based actions (CR 704). Checked every time a player would receive priority; all that
  // apply are performed at once, then checked again, then triggers go on the stack.
  // -------------------------------------------------------------------------------------------
  function sbaList(s) {
    const out = [];
    for (const p of s.players) {
      if (p.life <= 0) out.push({ k: 'lose', who: p.seat, why: 'life' });                   // CR 704.5a
      if (p.drewEmpty) out.push({ k: 'lose', who: p.seat, why: 'draw' });                    // CR 704.5b
    }
    for (const p of s.players) for (const z of ['hand', 'lib', 'grave', 'exile']) for (const iid of p[z]) if (I(s, iid).tok) out.push({ k: 'tokenGone', iid: iid });   // CR 704.5d
    const legends = {};
    for (const iid of s.bf) {
      const c = I(s, iid), ch = chars(s, iid);
      if (ch.types.includes('Creature')) {
        if (ch.t <= 0) out.push({ k: 'grave', iid: iid, why: 'toughness' });                  // CR 704.5f
        else if (c.dmg >= ch.t && !ch.kw.indestructible) out.push({ k: 'destroy', iid: iid, why: 'lethal' });   // CR 704.5g
        else if (c.dt && c.dmg > 0 && !ch.kw.indestructible) out.push({ k: 'destroy', iid: iid, why: 'deathtouch' });   // CR 704.5h
      }
      if (ch.supers.includes('Legendary')) { const key = c.ctrl + '|' + ch.name; (legends[key] = legends[key] || []).push(iid); }
      if (ch.subtypes.includes('Aura')) {                                                     // CR 704.5m, 303.4c
        const ok = c.att != null && c.att >= 0 && I(s, c.att) && I(s, c.att).zone === 'bf' && MF.auraCanEnchant(s, iid, c.att);
        if (!ok) out.push({ k: 'grave', iid: iid, why: 'aura' });
      }
      if (ch.subtypes.includes('Equipment') && c.att != null) {                               // CR 704.5n
        const ok = c.att >= 0 && I(s, c.att) && I(s, c.att).zone === 'bf' && isType(s, c.att, 'Creature');
        if (!ok) out.push({ k: 'unattach', iid: iid });
      }
      if (c.ctr['+1/+1'] && c.ctr['-1/-1']) out.push({ k: 'counters', iid: iid });             // CR 704.5q
      if (ch.subtypes.includes('Role') && c.att != null && c.att >= 0) {                      // CR 704.5z, 303.7a: one Role per controller on a permanent; the newest stays
        const mine = s.bf.filter(i => I(s, i).att === c.att && I(s, i).ctrl === c.ctrl && chars(s, i).subtypes.includes('Role'));
        if (mine.length > 1 && mine.some(i => I(s, i).ts > c.ts)) out.push({ k: 'grave', iid: iid, why: 'role' });
      }
    }
    for (const k in legends) if (legends[k].length > 1) out.push({ k: 'legend', iids: legends[k], who: +k.split('|')[0] });   // CR 704.5j
    return out;
  }
  MF.sbaList = sbaList;
  EXEC_DEF('sba', function (x) {
    const s = x.s, list = sbaList(s);
    // The legend rule asks first (the choice is part of the check); then everything happens at once.
    const keep = {};
    for (const a of list) if (a.k === 'legend') keep[a.iids.join(',')] = ask(x, { who: a.who, kind: 'legend', opts: a.iids.map(i => ({ id: i, iid: i })) });
    const lost = [];
    for (const a of list) {
      switch (a.k) {
        case 'lose': if (!lost.includes(a.who)) { lost.push(a.who); P(s, a.who).lost = true; log(s, 'lose', { who: a.who, why: a.why }); } break;
        case 'tokenGone': { const c = I(s, a.iid); if (c.zone === 'moved') break; zoneArr(s, c).splice(zoneArr(s, c).indexOf(a.iid), 1); c.zone = 'moved'; c.to = null; log(s, 'tokenGone', { c: c.id }); break; }
        case 'grave': if (I(s, a.iid).zone === 'bf') { log(s, 'sbaGrave', { c: I(s, a.iid).id, why: a.why, who: I(s, a.iid).ctrl }); move(s, a.iid, 'grave'); } break;
        case 'destroy': if (I(s, a.iid).zone === 'bf') MF.destroy(s, a.iid, a.why); break;
        case 'unattach': I(s, a.iid).att = null; log(s, 'unattach', { c: I(s, a.iid).id }); break;
        case 'counters': { const c = I(s, a.iid); const n = Math.min(c.ctr['+1/+1'], c.ctr['-1/-1']); c.ctr['+1/+1'] -= n; c.ctr['-1/-1'] -= n; break; }
        case 'legend': { const k = keep[a.iids.join(',')]; for (const i of a.iids) if (i !== k && I(s, i).zone === 'bf') { log(s, 'legendRule', { who: a.who, c: I(s, i).id }); move(s, i, 'grave'); } break; }
        default: throw new Error('unknown SBA ' + a.k);
      }
    }
    if (lost.length) { s.winner = lost.length === 2 ? 'draw' : 1 - lost[0]; log(s, 'win', { who: s.winner }); }   // CR 104.4a: both lose at once is a draw
  });
  MF.destroy = function (s, iid, why) {
    const c = I(s, iid);
    if (chars(s, iid).kw.indestructible) { log(s, 'indestructible', { c: c.id }); return null; }   // CR 702.12b
    log(s, 'destroy', { who: c.ctrl, c: c.id, why: why || null });
    return move(s, iid, 'grave');
  };

  // CR 603.3b: each player, active player first, puts the triggered abilities they control on
  // the stack in the order they choose; targets are chosen as each goes on (CR 603.3d).
  EXEC_DEF('putTrigs', function (x) {
    const s = x.s, all = s.trigs; s.trigs = [];
    for (const seat of [s.ap, 1 - s.ap]) {
      const mine = all.filter(t => t.ctrl === seat);
      const order = [];
      while (mine.length) {
        const keys = new Set(mine.map(t => trigKey(s, t)));
        if (keys.size <= 1) { order.push.apply(order, mine.splice(0)); break; }              // indistinguishable: no choice to make
        const opts = mine.map((t, i) => ({ id: i, iid: t.src, trig: trigLabelData(s, t) }));
        const a = ask(x, { who: seat, kind: 'trigOrder', placed: order.length, total: order.length + mine.length, opts: opts });
        order.push(mine.splice(a, 1)[0]);
      }
      for (const t of order) {
        const ab = trigAbility(s, t);
        const L = { lid: s.lid++, kind: 'trig', ctrl: t.ctrl, src: t.src, ab: t.ab, inl: t.inl || null, ev: t.ev, lki: t.lki, srcId: t.lki ? t.lki.id : I(s, t.src).id, t: [] };
        if (ab.cond && !MF.cond(ctxFor(s, L), ab.cond)) { continue; }                          // CR 603.4: an intervening "if" checked as it triggers
        if (ab.tg && ab.tg.length) {
          try { L.t = chooseTargets(x, t.ctrl, t.src, ab.tg, 'trig', false); }
          catch (e) { if (e instanceof Illegal) { log(s, 'trigNoTarget', { who: t.ctrl, c: L.srcId }); continue; } throw e; }   // CR 603.3d
        }
        s.stack.push(L);
        log(s, 'trigger', { who: t.ctrl, c: L.srcId, ab: t.ab, inl: t.inl || null, tg: L.t.map(sl => sl.map(r => refLabel(s, r))) });
        emitTargeted(s, L.t, t.ctrl);
      }
    }
  });
  function trigAbility(s, t) {
    if (t.inl === 'prowess') return MF.PROWESS;
    if (t.inl) return t.inl;
    const src = t.lki ? abFromLki(s, t.lki) : chars(s, t.src).ab;
    return src[t.ab];
  }
  MF.trigAbility = trigAbility;
  function trigKey(s, t) { return (t.lki ? t.lki.id : I(s, t.src).id) + '#' + t.ab + '#' + (t.inl ? (typeof t.inl === 'string' ? t.inl : JSON.stringify(t.inl)) : '') + '#' + JSON.stringify(t.ev.iid != null && t.ev.iid !== t.src ? t.ev.iid : null); }
  function trigLabelData(s, t) { return { src: t.lki ? t.lki.id : I(s, t.src).id, ab: t.ab, inl: typeof t.inl === 'string' ? t.inl : null, ev: t.ev.t }; }
  const refLabel = MF.refLabel = (s, r) => r.p != null ? { p: r.p } : { c: I(s, r.c).id, iid: r.c };

  // -------------------------------------------------------------------------------------------
  // What may be done (CR 117.1, 116, 601, 602)
  // -------------------------------------------------------------------------------------------
  const sorceryTiming = (s, who) => s.ap === who && (s.step === 'main1' || s.step === 'main2') && !s.stack.length;   // CR 307.1
  MF.sorceryTiming = sorceryTiming;
  // Cards a player may cast or play from somewhere other than hand: an effect names them (Alania's Pathmaker).
  function playableZones(s, who) {
    const out = P(s, who).hand.slice();
    for (const e of s.effects) if (e.k === 'mayPlay' && e.who === who && I(s, e.iid) && I(s, e.iid).zone === 'exile') out.push(e.iid);
    return out;
  }
  const canPlayLand = MF.canPlayLand = function (s, who, iid) {                              // CR 305.1-2, 116.2a
    const d = def(s, iid);
    return d.types.includes('Land') && sorceryTiming(s, who) && P(s, who).landsPlayed < 1 && s.priority === who;
  };
  // `alt`: cast as its Adventure or Omen (CR 715.3a, 720.3a: only the alternative face is evaluated).
  const canCast = MF.canCast = function (s, who, iid, alt) {                                 // CR 601.2e
    const ch = faceChars(s, iid, alt), d = faceDef(s, iid, alt);
    if (ch.types.includes('Land')) return false;
    if (s.priority !== who) return false;
    const instant = ch.types.includes('Instant') || ch.kw.flash;                             // CR 117.1a, 702.8a
    if (!instant && !sorceryTiming(s, who)) return false;
    const sp = d.ab.find(a => a.k === 'spell');
    const aura = d.ab.find(a => a.k === 'enchant');
    if (sp && sp.modes && !sp.modes.some(m => !m.tg || slotsLegalNow(s, who, iid, m.tg))) return false;   // CR 700.2a: a mode whose targets cannot be chosen cannot be chosen
    if (sp && sp.tg && !slotsLegalNow(s, who, iid, sp.tg)) return false;
    if (aura && !slotsLegalNow(s, who, iid, [{ f: aura.f }])) return false;
    return canPayMana(s, who, spellCost(s, who, iid, { x: 0, alt: alt }), { creature: ch.types.includes('Creature') });
  };
  const canActivate = MF.canActivate = function (s, who, iid, i) {                            // CR 602.5
    const c = I(s, iid), ch = chars(s, iid), a = ch.ab[i];
    if (c.ctrl !== who || a.k !== 'act' || s.priority !== who) return false;
    if (a.sorcery && !sorceryTiming(s, who)) return false;
    if (a.cost.tap && (c.tapped || (ch.types.includes('Creature') && !ch.kw.haste && !(c.ctlTurn < s.turn)))) return false;   // CR 302.6
    if (a.tg && !slotsLegalNow(s, who, iid, a.tg)) return false;
    if (a.cond && !MF.cond({ s: s, ctrl: who, src: iid }, a.cond)) return false;
    if (a.once && c.usedOnce) return false;
    if (a.oncePerTurn && c.actTurn && c.actTurn[i] === s.turn) return false;                  // CR 602.5b: "Activate only once each turn"
    const need = MF.parseMana(a.cost.mana || '');
    if (a.cost.tap && MF.manaValue(need)) {                                                   // the source taps for its own cost: it cannot also pay mana
      const pool = usablePool(P(s, who), null), srcs = manaSources(s, who).filter(m => m.iid !== iid);
      return !!solve(pool, srcs, need);
    }
    return canPayMana(s, who, need);
  };

  MF.legalActions = function (s) {
    if (s.winner != null) return [];
    if (s.pending) {
      const q = s.pending.q;
      const out = q.opts.map(o => ({ type: 'answer', id: o.id }));
      if (q.cancel) out.push({ type: 'cancel' });
      if (!out.length) throw new Error('a pending head that offers nothing');
      return out;
    }
    if (s.priority == null) throw new Error('nobody holds priority and nothing is pending');
    const who = s.priority, out = [];
    for (const iid of playableZones(s, who)) {
      if (canPlayLand(s, who, iid)) out.push({ type: 'land', iid: iid });
      else if (canCast(s, who, iid)) out.push({ type: 'cast', iid: iid });
      // CR 715.3, 720.3: an Adventure or Omen card may be cast as that spell — not again from exile after its Adventure (715.3d)
      if (def(s, iid).alt && !s.effects.some(e => e.k === 'mayPlay' && e.iid === iid && e.noAlt) && canCast(s, who, iid, true)) out.push({ type: 'cast', iid: iid, alt: true });
    }
    for (const iid of s.bf) {
      if (I(s, iid).ctrl !== who) continue;
      const ab = chars(s, iid).ab;
      for (let i = 0; i < ab.length; i++) if (ab[i].k === 'act' && canActivate(s, who, iid, i)) out.push({ type: 'act', iid: iid, ab: i });
    }
    out.push({ type: 'pass' });
    return out;
  };
  // Why a card in hand cannot be played right now, in words, or null if it can.
  MF.whyNot = function (s, who, iid) {
    const ch = chars(s, iid), p = P(s, who);
    if (ch.types.includes('Land')) {
      if (canPlayLand(s, who, iid)) return null;
      if (s.priority !== who) return 'You do not have priority.';
      if (s.ap !== who) return 'Lands can only be played on your own turn.';
      if (s.step !== 'main1' && s.step !== 'main2') return 'Lands can only be played in a main phase.';
      if (s.stack.length) return 'Lands can only be played while the stack is empty.';
      if (p.landsPlayed >= 1) return 'You have already played a land this turn.';
      return 'You cannot play a land now.';
    }
    if (canCast(s, who, iid)) return null;
    if (s.priority !== who) return 'You do not have priority.';
    const instant = ch.types.includes('Instant') || ch.kw.flash;
    if (!instant) {
      if (s.ap !== who) return 'Only instants and cards with flash can be cast on the opponent’s turn.';
      if (s.step !== 'main1' && s.step !== 'main2') return 'This can be cast only in your main phase.';
      if (s.stack.length) return 'This can be cast only while the stack is empty.';
    }
    const d = def(s, iid), sp = d.ab.find(a => a.k === 'spell'), aura = d.ab.find(a => a.k === 'enchant');
    if ((sp && sp.tg && !slotsLegalNow(s, who, iid, sp.tg)) || (aura && !slotsLegalNow(s, who, iid, [{ f: aura.f }]))) return 'There is no legal target for it.';
    return 'You cannot pay ' + MF.manaStr(spellCost(s, who, iid, { x: 0 })) + ' with your untapped mana sources.';
  };
  MF.whoActs = s => s.winner != null ? null : (s.pending ? s.pending.q.who : s.priority);
  MF.isTerminal = s => s.winner != null;

  // -------------------------------------------------------------------------------------------
  // Invocations. Each runs on a copy; a question discards the partial run and parks itself, and
  // the answer re-runs from the pre-effect state. Effects are atomic and the RNG advances only
  // on the run that survives.
  // -------------------------------------------------------------------------------------------

  EXEC_DEF('chooseFirst', function (x) {                                                     // CR 103.1
    const s = x.s, who = x.inv.who;
    const a = ask(x, { who: who, kind: 'first', opts: [{ id: 'me' }, { id: 'opp' }] });
    s.ap = a === 'me' ? who : 1 - who;
    log(s, 'first', { who: who, first: s.ap });
    for (const seat of [s.ap, 1 - s.ap]) draw(s, seat, 7);                                   // CR 103.5
    s.todo.push({ t: 'mulligan', answers: [] });
  });
  // CR 103.5 (the London mulligan): declarations in turn order, then the mulligans at once, then
  // each player who mulliganed puts that many cards on the bottom in an order they choose.
  EXEC_DEF('mulligan', function (x) {
    const s = x.s, decl = {};
    for (const seat of [s.ap, 1 - s.ap]) {
      const p = P(s, seat);
      if (p.kept) continue;
      if (p.mulls >= 7) { p.kept = true; continue; }
      decl[seat] = ask(x, { who: seat, kind: 'mulligan', mulls: p.mulls, opts: [{ id: 'keep' }, { id: 'mull' }] });
    }
    let again = false;
    for (const seat of [s.ap, 1 - s.ap]) {
      const p = P(s, seat);
      if (decl[seat] == null) continue;
      if (decl[seat] === 'keep') {
        p.kept = true; log(s, 'keep', { who: seat, n: p.hand.length - p.mulls });
        for (let k = 0; k < p.mulls; k++) {
          const iid = ask(x, { who: seat, kind: 'bottom', left: p.mulls - k, total: p.mulls, opts: p.hand.map(i => ({ id: i, iid: i })) });
          move(s, iid, 'lib');
        }
        if (p.mulls) log(s, 'bottomed', { who: seat, n: p.mulls });
      } else {
        p.mulls++; again = true;
        for (const i of p.hand.slice()) move(s, i, 'lib');
        MF.shuffle(s, p.lib);
        draw(s, seat, 7);
        log(s, 'mulligan', { who: seat, n: p.mulls });
      }
    }
    if (again) s.todo.push({ t: 'mulligan', answers: [] });
    else { s.turn = 1; s.step = 'untap'; s.sub = 0; s.firstTurn = true; for (const k in s.cards) s.cards[k].ctlTurn = 0; }   // CR 103.8
  });

  // CR 514.1-2: discard to hand size, then damage is removed and "until end of turn" effects end.
  EXEC_DEF('cleanup', function (x) {
    const s = x.s, who = s.ap, p = P(s, who);
    let n = p.hand.length - 7;
    while (n-- > 0) {
      const iid = ask(x, { who: who, kind: 'discardHand', left: n + 1, opts: p.hand.map(i => ({ id: i, iid: i })) });
      MF.discard(s, iid);
    }
    for (const iid of s.bf) { const c = I(s, iid); c.dmg = 0; c.dt = false; }
    s.effects = s.effects.filter(e => e.until !== 'eot' && !(e.until === 'endOfTurn' && e.turn <= s.turn));
    // CR 514.3a: if anything triggered or a state-based action applies, players get priority and another cleanup follows.
    if (s.trigs.length || sbaList(s).length) { s.cleanupAgain = true; setPriority(s, s.ap); return; }
    endStep(s);
  });
  MF.discard = function (s, iid) {
    const c = I(s, iid);
    log(s, 'discard', { who: c.owner, c: c.id });
    const n = move(s, iid, 'grave');
    emit(s, { t: 'discarded', who: c.owner, iid: n });
    return n;
  };

  // -------------------------------------------------------------------------------------------
  // Casting (CR 601.2) and activating (CR 602.2)
  // -------------------------------------------------------------------------------------------
  EXEC_DEF('land', function (x) {                                                            // CR 305.1: a special action, no stack
    const s = x.s, who = x.inv.who, iid = x.inv.iid, c = I(s, iid);
    const from = c.zone;
    log(s, 'land', { who: who, c: c.id, from: from });
    P(s, who).landsPlayed++;
    move(s, iid, 'bf', { ctrl: who, x: x });
    setPriority(s, who);                                                                      // CR 117.3c
  });
  EXEC_DEF('cast', function (x) {
    const s = x.s, who = x.inv.who, iid0 = x.inv.iid, c0 = I(s, iid0), from = c0.zone, alt = !!x.inv.alt;
    const card = def(s, iid0), d = alt ? card.alt : card;                                      // CR 715.3b, 720.3b: as an Adventure or Omen it has only that face
    const iid = move(s, iid0, 'stack', { ctrl: who });                                        // CR 601.2a
    const L = { lid: s.lid++, kind: 'spell', ctrl: who, iid: iid, id: card.id, t: [], x: 0, from: from, alt: alt ? d.kind : null };
    s.stack.push(L);
    const c = I(s, iid);
    if (alt) c.asAlt = true;
    const ctx = { creature: d.types.includes('Creature') };                                   // what the mana is spent on (CR 106.6)
    const costRaw = MF.parseMana(d.mana);
    if (costRaw.x) {                                                                           // CR 601.2b, 107.3a: X is announced
      const max = Math.max(0, MF.manaAvailable(s, who, ctx) - MF.manaValue(spellCost(s, who, iid, { x: 0 })));
      const opts = []; for (let n = 0; n <= max; n++) opts.push({ id: n });
      L.x = ask(x, { who: who, kind: 'x', src: iid, opts: opts, cancel: true });
    }
    const extra = {};
    // Optional additional costs are announced now (CR 601.2b): offspring (702.175a), kicker (702.33a).
    for (const a of d.ab) if (a.k === 'offspring' || a.k === 'kicker') {
      const add = MF.parseMana(a.cost), tot = spellCost(s, who, iid, { x: L.x, extra: extra });
      for (const k of ['W', 'U', 'B', 'R', 'G', 'C', 'g']) tot[k] += add[k];
      if (!canPayMana(s, who, tot, ctx)) continue;                                           // it cannot be paid: not a choice
      const yn = [{ id: 'yes' }, { id: 'no' }];
      const q = a.k === 'kicker' ? { who: who, kind: 'kicker', src: iid, cost: a.cost, opts: yn, cancel: true } : { who: who, kind: 'offspring', src: iid, cost: a.cost, opts: yn, cancel: true };
      if (ask(x, q) === 'yes') {
        if (a.k === 'offspring') L.offspring = true; else L.kicked = true;
        for (const k of ['W', 'U', 'B', 'R', 'G', 'C', 'g']) extra[k] = (extra[k] || 0) + add[k];
      }
    }
    const sp = d.ab.find(a => a.k === 'spell'), aura = d.ab.find(a => a.k === 'enchant');
    if (sp && sp.modes) {                                                                     // CR 700.2a, 601.2b: the mode is chosen as it is cast
      const opts = sp.modes.map((m, i) => ({ id: i, text: m.text })).filter(o => !sp.modes[o.id].tg || slotsLegalNow(s, who, iid, sp.modes[o.id].tg));
      L.mode = ask(x, { who: who, kind: 'mode', src: iid, opts: opts, cancel: true });
      if (sp.modes[L.mode].tg) L.t = chooseTargets(x, who, iid, sp.modes[L.mode].tg, 'spell', true);
    }
    if (sp && sp.tg) L.t = chooseTargets(x, who, iid, sp.tg, 'spell', true);                 // CR 601.2c
    if (aura) L.t = chooseTargets(x, who, iid, [{ f: aura.f }], 'aura', true);                 // CR 303.4a
    const cost = spellCost(s, who, iid, { x: L.x, extra: extra });                            // CR 601.2f
    payMana(x, who, cost, iid, true, ctx);                                                    // CR 601.2g-h
    L.spent = MF.manaValue(cost);                                                             // "the amount of mana spent to cast" (CR 601.2h)
    const ch = chars(s, iid);
    const p = P(s, who);
    p.h.cast++;
    if (ch.types.includes('Instant')) p.h.castInstant++;
    if (ch.types.includes('Sorcery')) p.h.castSorcery++;
    if (ch.subtypes.includes('Otter')) p.h.castOtter++;
    (p.h.castList = p.h.castList || []).push({ lid: L.lid, name: ch.name, types: ch.types.slice(), subtypes: ch.subtypes.slice() });   // turn history: "the first instant spell ... you've cast this turn"
    L.nth = { cast: p.h.cast, instant: ch.types.includes('Instant') ? p.h.castInstant : 0, sorcery: ch.types.includes('Sorcery') ? p.h.castSorcery : 0, otter: ch.subtypes.includes('Otter') ? p.h.castOtter : 0 };
    log(s, 'cast', { who: who, c: card.id, face: alt ? d.name : null, alt: alt ? d.kind : null, x: costRaw.x ? L.x : null, from: from, tg: L.t.map(sl => sl.map(r => refLabel(s, r))), offspring: !!L.offspring, kicked: !!L.kicked });
    emit(s, { t: 'cast', iid: iid, ctrl: who, types: ch.types.slice(), subtypes: ch.subtypes.slice(), colors: ch.colors.slice(), lid: L.lid });   // CR 601.2i
    emitTargeted(s, L.t, who);
    setPriority(s, who);                                                                      // CR 117.3c
  });
  // "Becomes the target of a spell or ability you control for the first time each turn" (valiant):
  // each object records, per controller, the turn it was last targeted (CR 603.2e: "becomes").
  function emitTargeted(s, t, by) {
    const seen = new Set();
    for (const sl of t || []) for (const r of sl) {
      if (!r || r.c == null || seen.has(r.c)) continue; seen.add(r.c);
      const c = I(s, r.c), key = 'tgtBy' + by, first = c[key] !== s.turn;
      c[key] = s.turn;
      emit(s, { t: 'targeted', iid: r.c, by: by, firstThisTurn: first });
    }
  }
  MF.emitTargeted = emitTargeted;
  EXEC_DEF('act', function (x) {                                                             // CR 602.2
    const s = x.s, who = x.inv.who, iid = x.inv.iid, c = I(s, iid), ch = chars(s, iid), a = ch.ab[x.inv.ab];
    const L = { lid: s.lid++, kind: 'ab', ctrl: who, src: iid, ab: x.inv.ab, srcId: c.id, t: [], lki: null };
    if (a.tg) L.t = chooseTargets(x, who, iid, a.tg, 'ab', true);
    if (a.cost.tap) { if (c.tapped) throw new Illegal('already tapped'); c.tapped = true; }    // CR 602.2b, 601.2h
    payMana(x, who, MF.parseMana(a.cost.mana || ''), iid, true);
    if (a.once) c.usedOnce = true;
    if (a.oncePerTurn) { c.actTurn = c.actTurn || {}; c.actTurn[x.inv.ab] = s.turn; }
    L.lki = snapshot(s, iid);
    log(s, 'activate', { who: who, c: c.id, ab: x.inv.ab, tg: L.t.map(sl => sl.map(r => refLabel(s, r))) });
    if (a.cost.sacSelf) MF.sacrifice(s, iid);
    s.stack.push(L);
    emitTargeted(s, L.t, who);
    setPriority(s, who);
  });
  MF.sacrifice = function (s, iid) {                                                         // CR 701.21
    const c = I(s, iid), lki = snapshot(s, iid);
    log(s, 'sacrifice', { who: c.ctrl, c: c.id });
    const n = move(s, iid, 'grave');
    emit(s, { t: 'sacrificed', iid: iid, ctrl: lki.ctrl, lki: lki });
    return n;
  };
  EXEC_DEF('manaAb', function (x) {                                                          // CR 605.3a: at priority, resolves at once
    activateMana(x.s, x.inv.who, x.inv.iid, x.inv.ab, x.inv.col);
  });

  // The context an effect runs in: who controls it, its source, its targets, the event.
  function ctxFor(s, L, x) {
    // Last known information (CR 608.2h): the ability's own snapshot, else the one its source left behind when it moved (MF.move keeps it).
    const src = L.kind === 'spell' ? L.iid : L.src, old = s.cards[src];
    return { s: s, x: x || null, ctrl: L.ctrl, src: src, L: L, ev: L.ev || null, t: L.t || [], flags: {}, lki: L.lki || (old && old.lki) || null };
  }
  MF.ctxFor = ctxFor;
  // CR 608.2b: a target is legal on resolution only if it still exists in its zone and still fits.
  function liveTargets(s, L, slots) {
    if (!slots || !slots.length) return { any: true, t: [] };
    let anyLegal = false;
    const src = L.kind === 'spell' ? L.iid : L.src;
    const t = L.t.map((sl, i) => sl.map(r => { const ok = targetable(s, r, slots[i], L.ctrl, src); if (ok) anyLegal = true; return ok ? r : null; }));
    const hadAny = L.t.some(sl => sl.length);
    return { any: anyLegal || !hadAny, t: t };
  }
  EXEC_DEF('resolve', function (x) {                                                          // CR 608
    const s = x.s, L = s.stack[s.stack.length - 1];
    const X = ctxFor(s, L, x);
    if (L.kind === 'spell') {
      const c = I(s, L.iid), d = L.alt ? def(s, L.iid).alt : def(s, L.iid), ch = chars(s, L.iid);
      const sp0 = d.ab.find(a => a.k === 'spell'), aura = d.ab.find(a => a.k === 'enchant');
      const sp = sp0 && sp0.modes ? sp0.modes[L.mode] : sp0;                                // CR 700.2: only the chosen mode
      const slots = sp && sp.tg ? sp.tg : aura ? [{ f: aura.f }] : null;
      const lt = liveTargets(s, L, slots);
      s.stack.pop();
      if (!lt.any) {                                                                          // CR 608.2b, 608.3b
        log(s, 'fizzle', { who: L.ctrl, c: L.id });
        if (L.copy) { c.zone = 'moved'; c.to = null; } else move(s, L.iid, 'grave');
        afterResolve(s); return;
      }
      X.t = lt.t;
      log(s, 'resolve', { who: L.ctrl, c: L.id, face: L.alt ? d.name : null });
      if (ch.types.includes('Instant') || ch.types.includes('Sorcery')) {
        MF.runOps(X, sp ? sp.ops : []);
        if (I(s, L.iid).zone === 'stack') {
          if (L.copy) { I(s, L.iid).zone = 'moved'; I(s, L.iid).to = null; }                 // a copy ceases to exist (CR 704.5e)
          else if (L.alt === 'omen') {                                                        // CR 720.3d: shuffled into its owner's library
            const owner = I(s, L.iid).owner, n = move(s, L.iid, 'lib'); MF.shuffle(s, P(s, owner).lib);
            log(s, 'omenShuffle', { who: owner, c: I(s, n).id });
          } else if (L.alt === 'adventure') {                                                 // CR 715.3d: exiled; its owner may cast the creature from exile
            const owner = I(s, L.iid).owner, n = move(s, L.iid, 'exile');
            s.effects.push({ k: 'mayPlay', iid: n, who: owner, noAlt: true, until: 'exiled' });
            log(s, 'adventureExile', { who: owner, c: I(s, n).id });
          } else move(s, L.iid, 'grave');                                                     // CR 608.2n
        }
      } else {                                                                                // CR 608.3: a permanent spell
        const o = { ctrl: L.ctrl, x: x, spent: L.spent, offspringPaid: !!L.offspring, castFromHand: L.from === 'hand' };
        if (aura) o.att = lt.t[0][0].c;                                                        // CR 608.3c
        for (const a of d.ab) if (a.k === 'enterAsCopy') { const cp = MF.askEnterAsCopy(X, a, L); if (cp) o.copy = cp; }   // CR 614.1c, 707: a replacement with a choice, asked as it would enter
        move(s, L.iid, 'bf', o);
      }
    } else {
      s.stack.pop();
      const ab = L.kind === 'trig' ? trigAbility(s, L) : (L.lki ? abFromLki(s, L.lki)[L.ab] : chars(s, L.src).ab[L.ab]);
      if (L.kind === 'trig' && ab.cond && !MF.cond(X, ab.cond)) { log(s, 'trigIf', { who: L.ctrl, c: L.srcId }); afterResolve(s); return; }   // CR 608.2a
      const lt = liveTargets(s, L, ab.tg);
      if (!lt.any) { log(s, 'fizzle', { who: L.ctrl, c: L.srcId, ab: true }); afterResolve(s); return; }
      X.t = lt.t;
      log(s, 'resolveAb', { who: L.ctrl, c: L.srcId, trig: L.kind === 'trig' });
      MF.runOps(X, ab.ops);
    }
    afterResolve(s);
  });
  function afterResolve(s) { if (s.winner == null) setPriority(s, s.ap); }                    // CR 117.3b

  // -------------------------------------------------------------------------------------------
  // The loop. CR 117.5 / 704.3: each time a player would receive priority, state-based actions
  // are performed until none apply, then triggered abilities go on the stack, then priority.
  // -------------------------------------------------------------------------------------------
  function run(s) {
    for (let guard = 0; guard < 2000; guard++) {
      if (s.winner != null) { s.pending = null; s.priority = null; s.todo = []; return freeze(s); }
      if (s.pending) return freeze(s);
      if (s.todo.length) {
        const inv = s.todo[0];
        const c = clone(s); c.todo.shift();
        const x = { s: c, inv: inv, ai: 0 };
        try { EXEC[inv.t](x); s = c; }
        catch (e) {
          if (e instanceof Ask) { s.pending = { q: e.ask }; c.log = c.log.slice(); Object.defineProperty(s.pending, 'view', { value: freeze(c), enumerable: false }); return freeze(s); }
          if (e instanceof Illegal) { s.todo.shift(); log(s, 'undone', { who: inv.who, why: e.illegal }); continue; }   // CR 733.1: the action is reversed
          throw e;
        }
        continue;
      }
      const wouldGetPriority = s.priority != null || (s.step === 'cleanup' && s.sub === 1);
      if (wouldGetPriority && sbaList(s).length) { s.todo.push({ t: 'sba', answers: [] }); continue; }
      if (wouldGetPriority && s.trigs.length) { s.todo.push({ t: 'putTrigs', answers: [] }); s.passes = 0; continue; }
      if (s.priority != null) return freeze(s);
      if (s.step === 'pregame') throw new Error('run: pregame with nothing to do');
      stepFlow(s);
    }
    throw new Error('run: the game did not settle');
  }
  function freeze(s) { Object.defineProperty(s, '_frozen', { value: true, enumerable: false, writable: true }); return s; }

  const same = (a, b) => a.type === b.type && a.id === b.id && a.iid === b.iid && a.ab === b.ab && a.col === b.col && !!a.alt === !!b.alt;
  MF.apply = function (s0, a) {
    const legal = MF.legalActions(s0);
    if (!legal.some(l => same(l, a))) throw new Error('ILLEGAL action: ' + JSON.stringify(a));
    const s = clone(s0);
    switch (a.type) {
      case 'answer': s.todo[0].answers.push(a.id); s.pending = null; break;
      case 'cancel': s.todo.shift(); s.pending = null; break;                                 // CR 733.1: reversed
      case 'pass':                                                                            // CR 117.3d
        s.passes++;
        if (s.passes >= 2) bothPassed(s); else s.priority = 1 - s.priority;
        break;
      case 'land': s.todo.unshift({ t: 'land', iid: a.iid, who: s.priority, answers: [] }); break;
      case 'cast': s.todo.unshift({ t: 'cast', iid: a.iid, alt: !!a.alt, who: s.priority, answers: [] }); break;
      case 'act': s.todo.unshift({ t: 'act', iid: a.iid, ab: a.ab, who: s.priority, answers: [] }); break;
      default: throw new Error('unknown action type ' + a.type);
    }
    return run(s);
  };
  MF.run = run;
})();
