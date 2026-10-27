// Menu, deck screen, how-to-play, and the black box.
(function () {
  'use strict';
  const MF = window.MF, T = MF.text, esc = T.esc;
  MF.validate();                                                                              // refuse to run rather than play a card wrongly
  const app = () => document.getElementById('app');
  const reg = () => Object.values(MF.decks).filter(d => d.registered && !d.main.some(e => MF.defects[e.id]));
  const pick = { me: null, opp: null };
  let overlay = null;
  const NOTICE = 'MANAFORGE is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.';

  const HOWTO = `
    <h2>How to play</h2>
    <p><b>Goal.</b> Bring the opponent from 20 life to 0. A player who must draw from an empty library loses too.</p>
    <p><b>Your turn</b> runs untap → upkeep → draw → main phase → combat → second main phase → end. The player who goes first skips their first draw.</p>
    <p><b>Lands and mana.</b> Play one land per turn in a main phase. Tap lands for mana to cast spells; the mana cost is in the card’s top right. When you cast something the game proposes which lands to tap — confirm it, or click lands yourself. Unspent mana empties at the end of each step.</p>
    <p><b>Timing.</b> Creatures, sorceries, enchantments and artifacts are cast in your main phase with nothing on the stack. Instants can be cast whenever you have priority. Spells go on the <b>stack</b>; when both players pass, the top one resolves.</p>
    <p><b>Combat.</b> Choose attackers (they tap, unless they have vigilance). The defender chooses blockers. A creature can’t attack the turn it arrives unless it has haste. Damage marked on a creature wears off at end of turn.</p>
    <p><b>Targets</b> are chosen as you cast. If every target is gone or illegal by the time it resolves, the spell does nothing — the log says so.</p>
    <p><b>Stops.</b> The bar across the middle of the table lists the steps. Lit steps are where the game pauses for you when you could act; click a step to change it. “Pass to end of turn” passes until the turn ends, but the game still stops if the opponent casts something you can answer.</p>
    <p><b>Reading the board.</b> Hover any card — board, hand, stack, log — to read its Oracle text and current numbers. Click a graveyard or exile pile to look through it. Escape hides the prompt so you can see the board. The log and the settings are in the drawer on the right edge.</p>
    <p><b>The table.</b> Your half is the lower one: your life and mana pool on the left, your creatures and other permanents in the near row, your lands behind them, your library and graveyard on the right, exile under your life. The opponent’s half mirrors it. The stack stands between the halves on the right.</p>
    <p><b>Keys.</b> Space presses the highlighted button. Escape closes a window or hides the prompt. L opens and closes the log.</p>`;

  function deckCard(d, side) {
    const sel = pick[side] === d.id;
    const colors = [...new Set(d.main.flatMap(e => MF.cards[e.id].colors))];
    return `<div class="deckcard ${sel ? 'sel' : ''} ${focus === d.id ? 'focus' : ''}" data-pick="${side}:${d.id}">
      <div class="dart" style="background-image:${MF.art.css(starOf(d).id)}"></div>
      <div class="dname">${esc(d.name)}</div><div class="dtype">${colors.map(c => T.sym(c)).join('')} ${subOf(d)}</div></div>`;
  }
  const starOf = d => d.main.map(e => MF.cards[e.id]).filter(c => c.supers.includes('Legendary'))[0] || MF.cards[d.main[0].id];
  const subOf = d => d.era ? (d.rank ? 'Finished #' + d.rank : d.players + ' top-ranked lists') : esc(d.product) + ' · ' + esc(d.set);
  // PLAN D15: the decks come from two Standard eras, plus the Bloomburrow starter decks.
  const ERAS = [['fin', 'Final Fantasy era — Pro Tour Final Fantasy (June 2025)'], ['hob', 'Hobbit era — top-ranked Arena Standard (Aug–Oct 2026)'], [null, 'Bloomburrow Starter Kit']];
  function deckRows(decks, side) {
    return ERAS.map(([era, label]) => { const ds = decks.filter(d => (d.era || null) === era); return ds.length ? `<div class="eralbl">${label}</div><div class="deckrow">${ds.map(d => deckCard(d, side)).join('')}</div>` : ''; }).join('');
  }
  function deckDetail(id) {
    const d = MF.decks[id];
    const row = e => `<div class="drow" data-cid="${e.id}"><span>${e.n}×</span> ${esc(MF.cards[e.id].name)} <span class="dcost">${T.symbols(MF.cards[e.id].mana)}</span></div>`;
    const lands = d.main.filter(e => MF.cards[e.id].types.includes('Land')), spells = d.main.filter(e => !MF.cards[e.id].types.includes('Land'));
    const n = d.main.reduce((a, e) => a + e.n, 0);
    return `<div class="ddetail"><h3>${esc(d.name)} — ${n} cards</h3>
      ${d.era ? `<p>${d.rank ? `Played by <b>${esc(d.player)}</b>, who finished <b>#${d.rank}</b> at ${esc(d.product)} (${esc(d.released)}); the best-placed list of its archetype, ${d.players} in the field.` : `The most typical of ${d.players} top-ranked lists in this archetype from ${esc(d.product)}, ${esc(d.released)} (${esc(d.player)}).`} Main deck as published, ${n} cards; sideboard not used (best of one).</p>
      <p class="prov">List from Wizards' magic.gg: <a href="${esc(d.source)}" target="_blank" rel="noopener">source</a> (fetched ${esc(d.fetched)}). Card text is Oracle text (MTGJSON).</p>`
      : `<p>${esc(d.product)} for <b>${esc(d.set)}</b>, released ${esc(d.released)}. Played as published, all ${n} cards, at 20 life; format: ${esc(d.format)}.</p>
      <p class="prov">List from MTGJSON: <a href="${esc(d.source)}" target="_blank" rel="noopener">${esc(d.file)}</a> (fetched ${esc(d.fetched)}). Card text is Oracle text.</p>`}
      <div class="dcols"><div><h4>Spells</h4>${spells.map(row).join('')}</div><div><h4>Lands</h4>${lands.map(row).join('')}${d.tokens.length ? `<h4>Tokens it makes</h4>${d.tokens.map(t => row({ id: t, n: '' })).join('')}` : ''}</div></div></div>`;
  }

  // Three screens before the table (PLAN D19): the title, the picker (two deck slots and a seed),
  // and the chooser for one slot. Each is drawn from `screen`; the table is js/ui.js.
  let screen = 'title', chooser = 'me', focus = null, seedText = '';
  const notice = `<div class="title-notice"><p>${esc(NOTICE)}</p><p>No official art, frames, set symbols, mana-symbol artwork or logos are used; every picture is generated or drawn for this project. Nothing here is sold or distributed.</p></div>`;
  function slot(side) {
    const d = MF.decks[pick[side]], colors = [...new Set(d.main.flatMap(e => MF.cards[e.id].colors))];
    return `<div class="slot-row"><button class="pick-slot" data-choose="${side}" title="Choose ${side === 'me' ? 'your' : 'the opponent’s'} deck">
        <span class="slot-art" style="background-image:${MF.art.css(starOf(d).id)}"></span>
        <span class="slot-text"><span class="slot-name">${esc(d.name)}</span><span class="slot-sub">${colors.map(c => T.sym(c)).join('')} ${subOf(d)}</span></span></button>
      <button class="pick-dice" data-dice="${side}" title="A random deck" aria-label="A random deck">${DIE}</button></div>`;
  }
  const DIE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="8" r="1.7"/><circle cx="16" cy="8" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="8" cy="16" r="1.7"/><circle cx="16" cy="16" r="1.7"/></svg>';
  function menu(to) {
    MF.ui.stop();
    const decks = reg();
    if (!pick.me) { pick.me = decks[0].id; pick.opp = decks[1 % decks.length].id; }
    if (to) screen = to;
    const keep = document.querySelector('.chooser-list'), top = keep ? keep.scrollTop : 0;
    const how = overlay ? `<div class="modal" data-close="1"><div class="mbox howto">${overlay}<button class="btn" data-close="1">Close</button></div></div>` : '';
    if (screen === 'title') {
      app().innerHTML = `<div class="screen title-screen" data-continue="1">${MF.boardArt.scene()}
        <div class="title-block"><div class="title-kicker">An unofficial Magic: The Gathering fan project</div>
          <h1 class="title-word">MANAFORGE</h1><div class="title-rule"><span>✦</span></div>
          <div class="title-sub">Every card by its Oracle text, every rule by the book — you against the machine.</div>
          <div class="title-cta">Click to enter the forge</div></div>${notice}</div>`;
      return;
    }
    if (screen === 'chooser') {
      const f = focus || pick[chooser];
      app().innerHTML = `<div class="screen chooser-screen">
        <div class="chooser-head"><div><h1>Choose ${chooser === 'me' ? 'your' : 'the opponent’s'} deck</h1>
          <p>Twenty championship decks from two Standard eras, each the best-placed or most typical list of its archetype, and the two Bloomburrow Starter Kits. Hover a card name to read it.</p></div>
          <div class="chooser-btns"><button class="btn" data-dice="${chooser}">Leave it to chance</button><button class="btn primary" data-back="1">Done</button></div></div>
        <div class="chooser-body"><div class="chooser-list">${deckRows(decks, chooser)}</div><div class="chooser-detail">${deckDetail(f)}</div></div>
        ${how}<div id="zoom" class="zoom"></div></div>`;
      document.querySelector('.chooser-list').scrollTop = top;
      return;
    }
    app().innerHTML = `<div class="screen picker-screen">${MF.boardArt.scene()}
      <div class="panel picker"><div class="panel-kicker">An unofficial Magic: The Gathering fan project</div><h1>MANAFORGE</h1>
        <div class="deck-field"><div class="field-lbl">Your deck</div>${slot('me')}</div>
        <div class="deck-field"><div class="field-lbl">Opponent’s deck</div>${slot('opp')}</div>
        <p class="picker-note">A 1v1 game at 20 life with the London mulligan; the opponent is the computer. Same seed, same decks and the same choices replay the same game.</p>
        <label class="seed-row"><span>Seed</span><input id="seed" size="10" placeholder="random" value="${esc(seedText)}"></label>
        <button class="btn primary big" data-go="1">Start the duel</button>
        <div class="picker-row"><button class="btn" data-howto="1">How to play</button><button class="btn" data-motion="1" title="Cards slide, die and fly to their zones; damage floats">Motion: ${MF.anim.on ? 'on' : 'off'}</button></div>
      </div>${notice}${how}<div id="zoom" class="zoom"></div></div>`;
  }
  function start(setup, again) {
    if (again) setup = Object.assign({}, setup, { seed: (setup.seed * 1664525 + 1013904223) | 0 });
    MF.ui.begin(setup, MF.newGame(setup));
  }
  document.addEventListener('click', e => {
    if (MF.ui.s) return;
    const t = e.target;
    if (!t.closest) return;
    if (t.closest('[data-continue]')) return menu('picker');
    if (t.closest('[data-howto]')) { overlay = HOWTO; menu(); return; }
    if (t.hasAttribute('data-close')) { overlay = null; menu(); return; }
    if (overlay) return;
    const p = t.closest('[data-pick]');
    if (p) { const [side, id] = p.getAttribute('data-pick').split(':'); pick[side] = id; focus = id; menu(); return; }
    const c = t.closest('[data-choose]');
    if (c) { chooser = c.getAttribute('data-choose'); focus = pick[chooser]; menu('chooser'); return; }
    const d = t.closest('[data-dice]');
    if (d) { const ds = reg(), side = d.getAttribute('data-dice'); pick[side] = ds[Math.floor(Math.random() * ds.length)].id; focus = pick[side]; menu(); return; }   // a setup choice, not a game event: the game's own randomness is seeded inside apply
    if (t.closest('[data-back]')) return menu('picker');
    if (t.closest('[data-motion]')) { MF.anim.toggle(); menu(); return; }
    if (t.closest('[data-go]')) {
      const v = document.getElementById('seed').value.trim();
      const seed = v === '' ? (Date.now() & 0x7fffffff) : (parseInt(v, 10) | 0);
      start({ seed: seed, decks: [pick.me, pick.opp], human: 0 });
    }
  });
  document.addEventListener('input', e => { if (e.target.id === 'seed') seedText = e.target.value; });
  document.addEventListener('keydown', e => {
    if (MF.ui.s || e.target.tagName === 'INPUT') return;
    if (e.key === 'Escape' && overlay) { overlay = null; menu(); return; }
    if (screen === 'title' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); menu('picker'); return; }
    if (screen === 'chooser' && e.key === 'Escape') menu('picker');
  });
  // The menu's own zoom: the deck lists carry data-cid.
  document.addEventListener('mouseover', e => {
    if (MF.ui.s) return;
    const z = document.getElementById('zoom'); if (!z) return;
    const el = e.target.closest && e.target.closest('[data-cid]');
    if (!el) { z.classList.remove('on'); return; }
    const id = el.getAttribute('data-cid'), d = MF.cards[id];
    z.innerHTML = `<div class="zcard">${MF.ui.face(null, id, { size: 'lg' })}</div><div class="ztext"><div class="zname">${esc(d.name)} <span class="zcost">${T.symbols(d.mana)}</span></div><div class="ztype">${esc(d.typeLine)}</div><div class="zrules">${T.symbols(d.text).replace(/\(([^)]*)\)/g, '<i>($1)</i>').replace(/\n/g, '<br>') || '<i>No rules text.</i>'}</div>${d.power != null ? `<div class="zstats">${d.power}/${d.toughness}</div>` : ''}</div>`;
    z.classList.toggle('left', el.getBoundingClientRect().left > window.innerWidth * 0.45);
    z.classList.add('on');
  });

  MF.main = {
    menu: () => menu('picker'),
    start: start,
    howto: function () {
      const box = document.createElement('div');
      box.className = 'modal';
      box.innerHTML = `<div class="mbox howto">${HOWTO}<button class="btn">Close</button></div>`;
      box.addEventListener('click', ev => { if (ev.target === box || ev.target.tagName === 'BUTTON') box.remove(); ev.stopPropagation(); });
      document.querySelector('.game').appendChild(box);
    },
    // The black box: a game is its seed, its decks and its action list (tools/replay-report.mjs).
    report: function () { const u = MF.ui; return JSON.stringify({ v: 1, seed: u.setup.seed, decks: u.setup.decks, human: u.setup.human, actions: u.actions, log: u.s ? u.s.log.length : 0 }); },
    bugReport: function () {
      const txt = MF.main.report();
      const done = () => { const b = document.querySelector('[data-ui="bug"]'); if (b) b.textContent = 'Copied'; };
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, () => window.prompt('Copy this bug report:', txt));
      else window.prompt('Copy this bug report:', txt);
    },
    crash: function (err) {
      console.error(err);
      const txt = MF.main.report();
      app().insertAdjacentHTML('beforeend', `<div class="modal"><div class="mbox"><div class="mtitle">The game hit an error</div><p>${esc(err.message || err)}</p><p>This report replays the game exactly. Copy it and send it with a note of what you clicked:</p><textarea readonly rows="6" style="width:100%">${esc(txt)}</textarea><button class="btn" data-ui="menu">Back to menu</button></div></div>`);
    },
  };
  menu();
})();
