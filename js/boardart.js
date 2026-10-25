// The table, DRAWN rather than photographed (PLAN D19): a basalt slab in a riveted bronze rim,
// runic hairline frames for every zone, and a molten seam across the middle where the two halves
// meet. ONE geometry table in a fixed 2048x1180 board space is used twice — to draw each zone and
// to place each DOM zone by percentage — so a painted frame and the hitbox inside it are the same
// numbers by construction.
//
// Per side, the zones a player owns (CR 400.1), with the battlefield (CR 403) shown as two rows:
//   plate (life, pool) | battlefield — creatures and other permanents |  | library
//   exile              | battlefield — lands                              | graveyard
// The opponent's half is yours mirrored top to bottom, so both life totals sit in one column and
// both libraries in another. The stack (CR 405) and the turn's steps (CR 500) are shared and sit
// between the halves. Also the title scene and the card back's emblem; nothing here reads a rule.
(function () {
  'use strict';
  const MF = window.MF;
  const W = 2048, H = 1180;

  const MINE = {
    plate:   { x: 40,   y: 640, w: 250,  h: 330 },
    exile:   { x: 40,   y: 984, w: 250,  h: 170 },
    front:   { x: 306,  y: 640, w: 1100, h: 290 },
    lands:   { x: 306,  y: 944, w: 1416, h: 210 },
    library: { x: 1738, y: 640, w: 270,  h: 250 },
    grave:   { x: 1738, y: 904, w: 270,  h: 250 },
  };
  const mirror = r => ({ x: r.x, y: H - r.y - r.h, w: r.w, h: r.h });
  const THEIRS = {};
  for (const k in MINE) THEIRS[k] = mirror(MINE[k]);
  const SHARED = {
    stack: { x: 1420, y: 250, w: 302,  h: 680 },
    steps: { x: 40,   y: 552, w: 1366, h: 76 },
  };
  const CAPTION = { front: 'Battlefield', lands: 'Lands', library: 'Library', grave: 'Graveyard', exile: 'Exile' };

  // A seeded generator: the grain and the sparks are the same every frame and every game.
  function rand(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const f1 = n => n.toFixed(1);

  function defs() {
    return `<defs>
      <linearGradient id="mf-rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a3c1e"/><stop offset=".5" stop-color="#2a1b0e"/><stop offset="1" stop-color="#5a3c1e"/></linearGradient>
      <linearGradient id="mf-bronze" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe7b0"/><stop offset=".35" stop-color="#d7a65a"/><stop offset=".7" stop-color="#8a5d27"/><stop offset="1" stop-color="#f0c97e"/></linearGradient>
      <radialGradient id="mf-slab" cx="50%" cy="50%" r="75%"><stop offset="0" stop-color="#25222b"/><stop offset=".6" stop-color="#18161d"/><stop offset="1" stop-color="#0c0b10"/></radialGradient>
      <radialGradient id="mf-heat" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ff9a3c" stop-opacity=".22"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/></radialGradient>
      <linearGradient id="mf-seam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff7a1a" stop-opacity="0"/><stop offset=".12" stop-color="#ff8a2a"/><stop offset=".5" stop-color="#ffd27a"/><stop offset=".88" stop-color="#ff8a2a"/><stop offset="1" stop-color="#ff7a1a" stop-opacity="0"/></linearGradient>
      <radialGradient id="mf-zone" cx="50%" cy="50%" r="75%"><stop offset="0" stop-color="#000" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>
      <filter id="mf-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .45  0 0 0 0 .55  0 0 0 .55 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
      <filter id="mf-veins" x="0" y="0" width="100%" height="100%"><feTurbulence type="turbulence" baseFrequency=".004 .012" numOctaves="3" seed="11"/><feColorMatrix values="0 0 0 0 .55  0 0 0 0 .5  0 0 0 0 .62  0 0 0 -2.6 1.5"/><feComposite in2="SourceGraphic" operator="in"/></filter>
      <filter id="mf-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>`;
  }

  // A zone: a recessed panel, a hairline in its side's metal, and a small rune diamond at each corner.
  function frame(r, cls) {
    const rx = 14, k = 9;
    const corners = [[r.x + k, r.y + k], [r.x + r.w - k, r.y + k], [r.x + k, r.y + r.h - k], [r.x + r.w - k, r.y + r.h - k]]
      .map(([x, y]) => `<path class="mf-rune" d="M${x},${y - 7} L${x + 7},${y} L${x},${y + 7} L${x - 7},${y} Z"/>`).join('');
    return `<g class="mf-zone ${cls}">
      <rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${rx}" class="mf-zone-fill"/>
      <rect x="${r.x + 1}" y="${r.y + 1}" width="${r.w - 2}" height="${r.h - 2}" rx="${rx}" class="mf-zone-edge"/>
      <rect x="${r.x + k}" y="${r.y + k}" width="${r.w - 2 * k}" height="${r.h - 2 * k}" rx="${rx - 6}" class="mf-zone-inner"/>${corners}</g>`;
  }
  const word = (t, x, y, size, cls) => `<text x="${x}" y="${y}" text-anchor="middle" class="${cls || 'mf-watermark'}" style="font-size:${size}px">${t}</text>`;

  // A faint engraved circle under the middle of the table: rings, ticks, and a ring of runes
  // made of strokes (no letters from any real script).
  function circle(cx, cy, R) {
    const r = rand(23);
    let s = `<g class="mf-circle" transform="translate(${cx} ${cy})"><circle r="${R}"/><circle r="${R - 18}"/><circle r="${R * .62}"/><circle r="${R * .6}"/>`;
    for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2, l = i % 6 ? 8 : 18; s += `<line x1="${f1(Math.cos(a) * (R - 18))}" y1="${f1(Math.sin(a) * (R - 18))}" x2="${f1(Math.cos(a) * (R - 18 - l))}" y2="${f1(Math.sin(a) * (R - 18 - l))}"/>`; }
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2, rr = R * .8, x = Math.cos(a) * rr, y = Math.sin(a) * rr, deg = a * 180 / Math.PI + 90;
      const g = [0, 1, 2].map(() => { const x1 = r() * 16 - 8, y1 = r() * 22 - 11; return `M${f1(x1)},${f1(y1)} l${f1(r() * 14 - 7)},${f1(r() * 18 - 9)}`; }).join(' ');
      s += `<path transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(deg)})" d="${g}"/>`;
    }
    const hex = [0, 1, 2, 3, 4, 5].map(i => { const a = i * Math.PI / 3; return f1(Math.cos(a) * R * .6) + ',' + f1(Math.sin(a) * R * .6); }).join(' ');
    return s + `<polygon points="${hex}"/></g>`;
  }

  // An anvil, the project's emblem: used on the table, the title scene and the card back.
  function anvil(x, y, s, cls) {
    return `<g class="${cls || 'mf-anvil'}" transform="translate(${x} ${y}) scale(${s})">
      <path d="M-62,-30 H40 Q70,-30 86,-44 Q84,-18 52,-12 H34 Q22,-12 22,0 V8 Q22,18 40,24 H50 V34 H-42 V24 H-32 Q-14,18 -14,8 V0 Q-14,-12 -26,-12 H-50 Q-62,-12 -62,-24 Z"/>
      <path class="mf-anvil-hot" d="M-58,-30 H40 Q66,-30 80,-41"/></g>`;
  }

  function build() {
    const r = rand(5);
    const P = 26;
    let svg = `<svg id="board-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" focusable="false">${defs()}
      <rect width="${W}" height="${H}" rx="30" fill="url(#mf-rim)"/>
      <rect x="9" y="9" width="${W - 18}" height="${H - 18}" rx="24" class="mf-rim-line"/>
      <rect x="${P}" y="${P}" width="${W - 2 * P}" height="${H - 2 * P}" rx="14" fill="url(#mf-slab)"/>
      <rect x="${P}" y="${P}" width="${W - 2 * P}" height="${H - 2 * P}" rx="14" fill="#fff" filter="url(#mf-veins)" opacity=".16"/>
      <rect x="${P}" y="${P}" width="${W - 2 * P}" height="${H - 2 * P}" rx="14" fill="#fff" filter="url(#mf-grain)" opacity=".2"/>
      <ellipse cx="${W / 2}" cy="${H / 2}" rx="${W * .42}" ry="${H * .34}" fill="url(#mf-heat)"/>
      ${circle(W / 2 - 120, H / 2, 380)}`;
    // Rivets along the rim.
    for (let x = 90; x < W - 60; x += 120) svg += `<circle cx="${x}" cy="13" r="4" class="mf-rivet"/><circle cx="${x}" cy="${H - 13}" r="4" class="mf-rivet"/>`;
    for (let y = 90; y < H - 60; y += 120) svg += `<circle cx="13" cy="${y}" r="4" class="mf-rivet"/><circle cx="${W - 13}" cy="${y}" r="4" class="mf-rivet"/>`;
    // The seam: a molten crack across the table between the halves, with embers along it.
    const sy = SHARED.steps.y + SHARED.steps.h / 2;
    let crack = `M${P},${sy}`;
    for (let x = P; x < W - P; x += 40) crack += ` L${x + 40},${f1(sy + (r() * 10 - 5))}`;
    svg += `<path d="${crack}" class="mf-seam-glow"/><path d="${crack}" class="mf-seam"/>`;
    for (let i = 0; i < 40; i++) svg += `<circle cx="${f1(P + r() * (W - 2 * P))}" cy="${f1(sy + r() * 30 - 15)}" r="${f1(1 + r() * 2.2)}" class="mf-ember" style="animation-delay:${f1(r() * 4)}s"/>`;
    svg += `<line x1="${P}" x2="${W - P}" y1="${SHARED.steps.y - 6}" y2="${SHARED.steps.y - 6}" class="mf-edge is-theirs"/><line x1="${P}" x2="${W - P}" y1="${SHARED.steps.y + SHARED.steps.h + 6}" y2="${SHARED.steps.y + SHARED.steps.h + 6}" class="mf-edge is-mine"/>`;
    // Each side's zones, captions upright for the viewer.
    for (const [side, R] of [['mine', MINE], ['theirs', THEIRS]]) {
      svg += `<g class="mf-side mf-${side}">`;
      for (const k in R) svg += frame(R[k], 'mf-' + k);
      svg += word(CAPTION.front.toUpperCase(), R.front.x + R.front.w / 2, R.front.y + R.front.h / 2 + 22, 64);
      svg += word(CAPTION.lands.toUpperCase(), R.lands.x + R.lands.w / 2, R.lands.y + R.lands.h / 2 + 16, 46);
      for (const k of ['library', 'grave', 'exile']) {
        const z = R[k], y = side === 'mine' ? z.y + 32 : z.y + z.h - 14;
        svg += word(CAPTION[k].toUpperCase(), z.x + z.w / 2, y, 22, 'mf-caption');
      }
      svg += '</g>';
    }
    const st = SHARED.stack;
    svg += frame(st, 'mf-stack') + word('THE STACK', st.x + st.w / 2, st.y + 36, 24, 'mf-caption') + anvil(st.x + st.w / 2 - 6, st.y + st.h * .3, 1.25) + anvil(st.x + st.w / 2 - 6, st.y + st.h * .74, 1.25);
    // Bronze corner plates.
    for (const [x, y, sx, sy2] of [[P - 4, P - 4, 1, 1], [W - P + 4, P - 4, -1, 1], [P - 4, H - P + 4, 1, -1], [W - P + 4, H - P + 4, -1, -1]]) {
      const s = 84;
      svg += `<g transform="translate(${x} ${y}) scale(${sx} ${sy2})"><path d="M0,0 H${s} Q${s * .5},${s * .5} 0,${s} Z" fill="url(#mf-bronze)" class="mf-plate"/><circle cx="${s * .2}" cy="${s * .12}" r="3.5" class="mf-rivet"/><circle cx="${s * .12}" cy="${s * .2}" r="3.5" class="mf-rivet"/></g>`;
    }
    return svg + '</svg>';
  }

  const pct = (v, t) => (v / t * 100).toFixed(4) + '%';
  const place = r => `left:${pct(r.x, W)};top:${pct(r.y, H)};width:${pct(r.w, W)};height:${pct(r.h, H)}`;
  let cached = null;

  // The title scene: a forge at night — a hearth's glow behind an anvil between two stone
  // pillars, sparks rising (CSS animates them; still under prefers-reduced-motion).
  function scene() {
    const r = rand(41), VW = 1600, VH = 900;
    let s = `<svg class="scene-svg" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07060b"/><stop offset=".55" stop-color="#1a0f16"/><stop offset="1" stop-color="#2b120a"/></linearGradient>
        <radialGradient id="sc-hearth" cx="50%" cy="78%" r="55%"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".95"/><stop offset=".18" stop-color="#ff8a2a" stop-opacity=".7"/><stop offset=".5" stop-color="#7a2a0e" stop-opacity=".3"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
        <linearGradient id="sc-stone" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0b090d"/><stop offset=".8" stop-color="#1c1519"/><stop offset="1" stop-color="#3a2216"/></linearGradient>
        <linearGradient id="sc-stone-r" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#0b090d"/><stop offset=".8" stop-color="#1c1519"/><stop offset="1" stop-color="#3a2216"/></linearGradient>
        <linearGradient id="sc-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a1c10"/><stop offset="1" stop-color="#0a0708"/></linearGradient>
        <filter id="sc-soft"><feGaussianBlur stdDeviation="3"/></filter>
      </defs>
      <rect width="${VW}" height="${VH}" fill="url(#sc-sky)"/>
      <path d="M380,900 V330 Q800,40 1220,330 V900 Z" fill="#120b0e"/>
      <path d="M440,900 V350 Q800,100 1160,350 V900 Z" fill="url(#sc-hearth)"/>
      <path d="M560,760 Q800,600 1040,760 Z" fill="#ffb347" opacity=".35" filter="url(#sc-soft)"/>`;
    for (const [x, g] of [[230, 'sc-stone'], [1210, 'sc-stone-r']]) {
      s += `<rect x="${x}" y="120" width="160" height="780" fill="url(#${g})"/>`;
      for (let y = 160; y < 900; y += 70) s += `<line x1="${x}" x2="${x + 160}" y1="${y}" y2="${y}" class="sc-joint"/>`;
    }
    s += `<path d="M380,330 Q800,40 1220,330" class="sc-arch"/>
      <rect x="0" y="780" width="${VW}" height="120" fill="url(#sc-floor)"/>
      <ellipse cx="800" cy="790" rx="420" ry="40" fill="#ff8a2a" opacity=".22" filter="url(#sc-soft)"/>
      ${anvil(800, 712, 3.1, 'sc-anvil')}
      <rect x="742" y="784" width="116" height="20" rx="4" fill="#0b0809"/>
      <g class="sc-hammer" transform="translate(905 620) rotate(-28)"><rect x="-6" y="0" width="12" height="120" rx="5"/><rect x="-34" y="-26" width="68" height="34" rx="6"/></g>
      <g class="sc-sparks">`;
    const cols = ['#ffd27a', '#ffb347', '#ff8a2a', '#ffe6b0', '#ff7a1a'];
    for (let i = 0; i < 60; i++) {
      const x = 640 + r() * 320, y = 600 + r() * 120, d = (2.5 + r() * 4).toFixed(2), dl = (r() * 6).toFixed(2), dx = (r() * 260 - 130).toFixed(0);
      s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(1.2 + r() * 2.4)}" fill="${cols[i % cols.length]}" style="--dx:${dx}px;animation-duration:${d}s;animation-delay:-${dl}s"/>`;
    }
    return s + '</g></svg>';
  }

  MF.boardArt = {
    layout: { w: W, h: H, mine: MINE, theirs: THEIRS, shared: SHARED },
    svg: () => cached || (cached = build()),
    // The style that pins a DOM zone to its painted frame: side is 'mine', 'theirs' or 'shared'.
    place: (side, k) => { const R = side === 'mine' ? MINE : side === 'theirs' ? THEIRS : SHARED; if (!R[k]) throw new Error('boardArt: no zone ' + side + '.' + k); return place(R[k]); },
    scene: scene,
    anvil: anvil,
  };
})();
