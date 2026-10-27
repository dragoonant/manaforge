// The touch model (PLAN D20), after the way a phone card game plays: a TAP reads (the card
// sheet: the card, its Oracle text and current numbers, its legal actions as buttons), a DRAG
// commits (a hand card onto your battlefield, an attacker at the opponent, a blocker onto an
// attacker), a HOLD peeks (the card read for as long as the finger stays down). On a phone the
// hand rests as a fan of card tops along the bottom edge and rises on a tap; recent plays run
// down the left edge. Nothing here decides a rule: every drop is a legal action js/ui.js offers.
(function () {
  'use strict';
  const MF = window.MF;
  const DRAG_PX = 8, HOLD_MS = 450, HOLD_SLOP = 10, CLICK_GRACE = 350, HISTORY_MAX = 7;
  const coarse = window.matchMedia('(pointer: coarse)');
  let lastTouch = coarse.matches;
  document.addEventListener('pointerdown', e => { lastTouch = e.pointerType !== 'mouse'; }, true);

  // A phone is a coarse pointer on a small screen; portrait gets the "turn sideways" gate.
  function classify() {
    const h = document.documentElement, W = window.innerWidth, H = window.innerHeight;
    const phone = coarse.matches && Math.min(W, H) <= 540;
    h.classList.toggle('is-coarse', coarse.matches);
    h.classList.toggle('is-phone', phone);
    h.classList.toggle('is-portrait', H > W);
    if (!phone) lowerHand();
  }

  let raisedAt = 0;
  const handRaised = () => document.body.classList.contains('hand-raised');
  function raiseHand() { raisedAt = Date.now(); document.body.classList.add('hand-raised'); MF.ui.refit(); }
  function lowerHand() { if (!handRaised()) return; document.body.classList.remove('hand-raised'); MF.ui.refit(); }

  // A finger's tap is followed by a click hit-tested where the finger WAS: on the sheet or the
  // scrim the tap just opened, which would close it at once. After a drag or a hold, swallow it.
  function swallowClick() {
    const swallow = e => { e.stopPropagation(); e.preventDefault(); document.removeEventListener('click', swallow, true); };
    document.addEventListener('click', swallow, true);
    setTimeout(() => document.removeEventListener('click', swallow, true), CLICK_GRACE);
  }

  // ---- the drag: the card follows the finger (from the hand) or an arrow does (on the table) ----
  const centre = n => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  function drawArrow(from, to, hot) {
    const svg = document.getElementById('drag-arrow');
    if (!svg) throw new Error('touch: the page is missing #drag-arrow');
    const bow = Math.min(120, Math.abs(to.y - from.y) * 0.4) + 20, mx = (from.x + to.x) / 2, my = Math.min(from.y, to.y) - bow * 0.35;
    svg.innerHTML = `<path class="drag-arrow-line ${hot ? 'is-hot' : ''}" d="M${from.x},${from.y} Q${mx},${my} ${to.x},${to.y}"/><circle class="drag-arrow-head ${hot ? 'is-hot' : ''}" cx="${to.x}" cy="${to.y}" r="${hot ? 13 : 9}"/>`;
  }
  const clearArrow = () => { const svg = document.getElementById('drag-arrow'); if (svg) svg.innerHTML = ''; };

  let live = null;
  document.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !MF.ui.s) return;
    const card = e.target.closest && e.target.closest('.card[data-iid]');
    if (!card || card.closest('.mbox, .cmenu, #peek')) return;
    const spec = MF.ui.dragSpec(card);
    if (!spec) return;
    live = { node: card, spec: spec, x: e.clientX, y: e.clientY, moved: false };
    try { card.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
  });
  document.addEventListener('pointermove', e => {
    if (!live) return;
    const dx = e.clientX - live.x, dy = e.clientY - live.y;
    if (!live.moved) {
      if (Math.sqrt(dx * dx + dy * dy) < DRAG_PX) return;
      live.moved = true;
      for (const t of live.spec.targets) { const n = t.el(); if (n) n.classList.add('drop-ok'); }
      if (live.spec.kind === 'hand') {
        lowerHand();                                                                         // the drop targets are under a raised hand
        const c = live.node.cloneNode(true);
        c.classList.add('drag-clone'); c.removeAttribute('data-cid'); c.style.width = live.node.offsetWidth + 'px';
        document.body.appendChild(c); live.clone = c; live.node.classList.add('is-drag-source');
      }
    }
    if (live.clone) { live.clone.style.left = (e.clientX - live.clone.offsetWidth / 2) + 'px'; live.clone.style.top = (e.clientY - live.clone.offsetHeight * 0.85) + 'px'; }
    const hot = findDrop(e.clientX, e.clientY);
    document.querySelectorAll('.drop-hot').forEach(n => n.classList.remove('drop-hot'));
    if (hot) { const hn = hot.el(); if (hn) hn.classList.add('drop-hot'); }
    if (!live.clone) drawArrow(centre(live.node), { x: e.clientX, y: e.clientY }, !!hot);
  });
  document.addEventListener('pointerup', e => {
    if (!live) return;
    const L = live, drop = L.moved ? findDrop(e.clientX, e.clientY) : null;
    end();
    if (!L.moved) return;                                                                    // a tap: the click handler reads it
    swallowClick();
    if (drop) L.spec.onDrop(drop);
  });
  document.addEventListener('pointercancel', () => end());
  function end() {
    if (!live) return;
    if (live.clone) live.clone.remove();
    live.node.classList.remove('is-drag-source');
    clearArrow();
    document.querySelectorAll('.drop-ok, .drop-hot').forEach(n => n.classList.remove('drop-ok', 'drop-hot'));
    live = null;
  }
  function findDrop(x, y) {
    const under = document.elementFromPoint(x, y);
    if (!under || !live) return null;
    let best = null, bestDepth = -1;
    for (const t of live.spec.targets) {
      const n = t.el();
      if (!n || !(n === under || n.contains(under))) continue;
      let depth = 0; for (let p = n; p; p = p.parentElement) depth++;
      if (depth > bestDepth) { best = t; bestDepth = depth; }
    }
    return best;
  }

  // ---- hold to peek: touch and pen only; distance beats time, so a drag stays a drag ----------
  document.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    const t = e.target.closest && e.target.closest('[data-cid]');
    if (!t || t.closest('#peek')) return;
    const sx = e.clientX, sy = e.clientY;
    let peeking = false;
    const timer = setTimeout(() => { end(); swallowClick(); peeking = true; peek(t); }, HOLD_MS);
    const moved = ev => { if (peeking) return; const dx = ev.clientX - sx, dy = ev.clientY - sy; if (Math.sqrt(dx * dx + dy * dy) > HOLD_SLOP) done(); };
    const done = () => {
      clearTimeout(timer);
      document.removeEventListener('pointermove', moved, true);
      document.removeEventListener('pointerup', done, true);
      document.removeEventListener('pointercancel', done, true);
      if (peeking) unpeek();
    };
    document.addEventListener('pointermove', moved, true);
    document.addEventListener('pointerup', done, true);
    document.addEventListener('pointercancel', done, true);
  }, true);
  document.addEventListener('contextmenu', e => { if (lastTouch && e.target.closest && e.target.closest('[data-cid]')) e.preventDefault(); });
  function peek(el) {
    const box = document.getElementById('peek');
    if (!box) throw new Error('touch: the page is missing #peek');
    box.innerHTML = `<div class="peek-body">${MF.ui.readHTML(el.getAttribute('data-cid'), el.getAttribute('data-iid'), el.getAttribute('data-why'))}</div>`;
    box.classList.add('open');
  }
  function unpeek() { const box = document.getElementById('peek'); if (box) box.classList.remove('open'); }

  // ---- recent plays down the left edge: the table's memory, one tap from the card -------------
  function historyHTML(v, human) {
    const out = [];
    for (let i = v.log.length - 1; i >= 0 && out.length < HISTORY_MAX; i--) {
      const e = v.log[i];
      if ((e.t === 'cast' || e.t === 'land') && e.c && MF.cards[e.c]) out.push(e);
    }
    return out.map(e => `<div class="history-card ${e.who === human ? 'mine' : 'theirs'}" data-sheet="${MF.text.esc(e.c)}">${MF.ui.face(null, e.c, { size: 'xs' })}</div>`).join('');
  }

  function init() {
    classify();
    window.addEventListener('resize', classify);
    window.addEventListener('orientationchange', classify);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  MF.touch = {
    active: () => lastTouch,
    phone: () => document.documentElement.classList.contains('is-phone'),
    handRaised: handRaised, raiseHand: raiseHand, lowerHand: lowerHand,
    raisedRecently: () => Date.now() - raisedAt < CLICK_GRACE,
    swallowClick: swallowClick, historyHTML: historyHTML,
  };
})();
