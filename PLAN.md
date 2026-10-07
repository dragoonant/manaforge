# PLAN — every decision, with a dated Status

This file owns decisions. No other file states one.

## Decisions

| # | Date | Decision | By |
|---|---|---|---|
| D1 | 2026-10-03 | **Private and local.** No remote repository, no deployment, until the owner explicitly asks. Wizards' Fan Content Policy does not cover a rules-enforcing client (docs/rights.md). | owner, before the first session |
| D2 | 2026-10-03 | **The name is MANAFORGE.** Neither "Magic" (a Wizards trademark) nor bare "Forge" (an existing fan engine). | owner, before the first session |
| D3 | 2026-10-03 | **Scope: preconstructed decks from Wizards-owned settings.** First pair: the two Bloomburrow Starter Kit decks (Hare Raising, Otter Limits), built to play each other. More precons by compile rate later; tournament lists and a deck builder after that. | default (handoff §13 Q2) — owner may override |
| D4 | 2026-10-03 | **Priority feel: stops.** A window with nothing legal is auto-passed. Default stops: your own main phases, declare attackers and declare blockers on either side, and the opponent's end step when you can cast something. A "pass to end of turn" button, and a stop toggle per step. CR 732 (shortcuts) makes this legitimate. | default (handoff §13 Q4) — owner may override |
| D5 | 2026-10-03 | **Copy FABFORGE's engine shape**: one invocation queue, `ask` with no auto-take path, effects run on a clone and re-run on each answer. Add the four Magic subsystems on day one: state-based actions (CR 704), the layer system (CR 613), replacement ordering (CR 616), APNAP trigger ordering (CR 603.3b). | handoff §0 |
| D6 | 2026-10-03 | **Oracle text on the face, verbatim**, reminder text kept on the face and stripped before compiling. | handoff §3 |
| D7 | 2026-10-03 | **Format label:** the Starter Kit decks are 60-card decks played as a 1v1 game at 20 life with the London mulligan (CR 103.5). No sideboards. Labelled "Starter Kit (preconstructed)" on the deck screen, not "Standard". | default |
| D8 | 2026-10-03 | **Mana payment**: the solver proposes a complete payment, shown land by land; one click confirms, or the player taps lands one at a time. Identical basics are indistinguishable and are not asked one by one. | handoff §11.3 |
| D9 | 2026-10-03 | Defaults not asked: 1v1 against the AI; art style "E" (anime trading-card illustration, cel shading, thick ink outlines) unless the owner auditions another; ElevenLabs sound and music with a synthesised fallback; keys only from `tokens.txt.txt` in this folder; single agent. | handoff §13 |

| D10 | 2026-10-03 | **Art: super-deformed versions of what each card shows.** Owner's choice. Concern stated once: Wizards' official illustrations are never used as input, traced or reproduced — each prompt describes the card's subject (the same character, creature or moment) in this project's own words, drawn super-deformed: chibi, two heads tall. `STYLE` in `tools/build-art-prompts.mjs` leads every prompt; FLUX.1-schnell at 768×1088, 560 px JPEG delivered. Sample one (style last) came out only half super-deformed; sample two (style first) approved for review. | owner |
| D11 | 2026-10-03 | The repository's `main` is the build: the first session's branch was fast-forwarded into it. Still no remote (D1). | owner |

| D12 | 2026-10-03 | **Supersedes D1: public repository `dragoonant/manaforge` on GitHub, deployed to GitHub Pages for web playtesting.** Owner's call, with the concern stated once beforehand: the Pages site is public whatever the repository's visibility, and Wizards' Fan Content Policy does not cover a rules-enforcing client (docs/rights.md). NOTICE.md carries the policy's sentence; docs/takedown.md says how to take it down. | owner |

| D13 | 2026-10-03 | **Art is rendered locally with Stable Diffusion XL base 1.0** (the owner's install under Hunyuan3D-2, weights in `~/.cache/hy3dgen/sdxl`), by `tools/gen-art-sdxl.py`: no network, no cost. Owner's call, after first asking for Hunyuan (HunyuanDiT was tried for one round of three, then set aside on request). SDXL reads 77 tokens per text encoder, so both encoders lead with a short style clause and the subject; the second also carries the setting and the full STYLE. Monochrome, line art and frames are in the negative prompt. `tools/gen-art.mjs` (FLUX via Hugging Face, paid) is kept as an alternative, unused. | owner |

| D14 | 2026-10-04 | **Supersedes D10's look: direction D, "Grim Dark".** Owner's brief: warriors, fighters and mages trying to kill or undo each other, never cute; a master-grade super-deformed build (stocky, three heads tall, scarred and armoured); lands are pure landscape with every living thing in the negative prompt; cues from the real cards' art direction, no copying. Chosen from a five-direction audition (`tools/art-style-audition.mjs`, `tools/audition-sheet.ps1`). The lint now also refuses cute words. | owner |

| D15 | 2026-10-05 | **Supersedes D3's scope: the game offers decks from two Standard eras only — the Final Fantasy era and the Hobbit era — plus the two Bloomburrow Starter Kit decks.** (The owner said "limited, last 2 trilogies"; in Magic "Limited" names draft and sealed, so the docs say "the two eras".) **10 distinct archetypes per era**, owner's choice. **Final Fantasy era:** Pro Tour Magic: The Gathering—FINAL FANTASY (Standard, 2025-06-20), the best-finishing list of each of the 10 best-placed archetypes, joined to the final standings. **Hobbit era:** no championship-level Standard event has run since The Hobbit (2026-08-14) — the September 2026 Regional Championship and China Open lists on magic.gg are Modern despite their "Standard" label — so, by the owner's choice, Wizards' weekly published top-ranked Arena Traditional Standard lists (2026-08-17 to 2026-10-05, 283 lists), clustered into archetypes (`tools/fetch-championship.mjs`), the 10 largest, each represented by its most typical list. A deck registers only when every card in it compiles. Card text from MTGJSON AtomicCards (MIT). | owner |
| D16 | 2026-10-05 | **Final Fantasy and Hobbit characters are painted** in the Grim Dark style, owner's choice, after the concern was stated once: both sets are licensed crossovers with a second rights holder (Square Enix; the Tolkien rights holders), and the site is public (D12). | owner |
| D17 | 2026-10-05 | **The card art is a mix of fifteen styles**, as Magic's art comes from many artists: the five audition directions (A–E) plus ten more (F–O), all in tools/art-styles.mjs. Each card takes one by a stable hash of its key. Every style keeps the D14 brief (master grade super deformed fighters and mages, never cute; lands are landscape only). Supersedes D14's single style; Grim Dark is style D. | owner |

## Cut order if time runs short

Deck count, never quality. A deck that does not compile in full is not registered.

## Status

**2026-10-06 — the championship decks (D15) under way: 19 of 20 registered; a per-card audit done.**

- Boros (Dáin's Company) brought activated-ability cost changes (per Equipment, per target colour,
  "equip abilities that target this", Kíli's {0} equip with an enduring story), storied (CR 702.195),
  opening-hand actions (103.6a, Leyline Axe), hone counters (122.1j), hexproof from monocolored
  (702.11d), ward granted by Equipment, Equipment tokens defined by their creator's text, attaching
  any number of Equipment with a reflexive trigger bound to that creature, a legendary's short name
  in its own text.
- Golgari Roots (Eli Kassis, #19) brought Agatha's Soul Cauldron (linked exile, activated abilities
  granted in layer 6, mana of any colour for creatures' abilities, 609.4b), forage (701.61), costs
  that exile a chosen graveyard card — inside a mana ability's payment too —, "as though they had
  haste" for abilities, typed "cards leave your graveyard" batches, Food tokens (111.10b). Fixed: a
  reflexive trigger re-checked its condition at resolution; the AI could again add and undo a lone
  blocker on a menace attacker (now filtered from its search).
- Sultai (Ardyn, the Usurper) brought preparation cards (CR 722: entering prepared, the prepare-spell
  copy in exile, unpreparing as it is cast), evoke (702.74), "if {G}{G} was spent to cast it" (mana
  spent by colour, 601.2h), "if you cast it", an additional life cost to target (Terror of the Peaks),
  entering as a copy of a graveyard card with a name exception (707.9b), token copies with colour and
  type exceptions, Bringer of the Last Gift. Fixed for every deck: HTML escaping missed the apostrophe,
  so a button whose label held a card name like "Oracle's Gift" did nothing (now gated by check-pages).
- Azorius Omniscience (Shaun Henry, #10) brought casting without paying the mana cost (CR 118.9),
  Phyrexian mana and compleated (107.4f, 702.150), [−X] loyalty abilities with X announced before
  targets (601.2b, 107.3k), a modal trigger on two events, exiling and returning a permanent as a new
  object (400.7), a card returning as a creature with extra types and base P/T (layers 4, 6, 7b).
- Domain Overlords (Edgar Magalhaes, #9) brought choosing a creature type (CR 205.3m, every type
  offered, the player's own first) and mana restricted to it that makes a spell uncounterable (106.6),
  a cost that depends on the chosen targets (601.2f), domain, "each player can't cast more than one
  spell each turn", opponents' creatures entering tapped (614.1d), a land token with every basic land
  type (305.6), an enchantment becoming a creature with base P/T equal to its mana value (layers 4, 7b).
- Azorius Control (Mitchell Tamblyn, #11) brought spree (CR 702.172), ending the turn (724.1),
  modal triggered abilities with targeted modes (700.2a), modes chosen together sharing one target
  list, "its controller" effects, exile instead of the graveyard on a counter, exile-until for each of
  several permanents, mana value compared with a count. Fixed: the AI could loop forever adding and
  undoing a blocker when a lone blocker stood on a menace attacker.
- Golgari Graveyard (Jody Keith, #34) brought impending (CR 702.176), abilities that function in
  the graveyard (113.6m) and hand, cost reductions per card in the graveyard and exile (601.2f),
  combat-damage prevention through the damage door (615), discard-or-sacrifice costs, a */*+1 CDA
  in every zone (604.3), flavor words (207.2d). Fixed for Mardu: Carnage's "mana value 3 or less"
  was not checked on graveyard targets, which let two Carnages loop.
- Selesnya (Llanowar Elves) brought hybrid mana (CR 107.4e, announced as a nonhybrid cost, 601.2b),
  modal double-faced cards (712.3, 712.8f; either face cast, the front transforms), plot (702.170),
  keyword counters (122.1b), a chosen basic land type (305.7), exile-until-it-leaves returning to the
  battlefield (610.3), "do this only once each turn", and a block menu that never offers a blocker
  past "can't be blocked by more than one creature".
- Mono-Green (Earthbender Ascension) brought Sagas (CR 714: lore counters, chapter triggers, the
  sacrifice SBA), earthbend (701.66), finality counters (122.1h), additional land plays and lands
  from the graveyard (305.2), crew (702.122), affinity (702.41), "can't be countered" (113.6g),
  "can't be blocked by more than one creature" (509.1b), a front face put onto the battlefield
  transformed, and statics that grant abilities.
- Mono-Black (Desolation Prowler) brought crimes (700.13), choices made as a permanent enters
  (614.12a), unique-mode triggers, ward by discard, job select (702.182), descended (700.11), paying
  during resolution, type-adding Equipment.
- Mardu (Bloodghast) brought batched "one or more" events (CR 603.2c), discard costs and events,
  graveyard abilities (113.6m), flashback (702.34) and mayhem (702.187), reflexive triggers (603.12),
  attack requirements (508.1d), granted abilities, enters-with-counters.
- Dimir (Bitter Triumph) brought additional costs (blight 701.68, teamwork 702.194, discard-or-life),
  abilities on the stack as targets and countering them, "for as long as ~ remains" (611.2b), Map
  tokens (111.10s), outlaws (700.12), X on a permanent (107.3m), search events.
- Dimir Midrange brought planeswalkers (CR 306, 606, 704.5i, 120.3c; attacking them, 508.1b — V4
  closed), ninjutsu (702.49), transforming double-faced cards (712), emblems (114), layer 6 in
  timestamp order with "loses all abilities", "until your next turn", choose-two modes, draw events.
- Registered: Mono-Red Aggro (PT Final Fantasy #1), Gruul Delirium (#35), Orzhov Demons (#28), Izzet
  Prowess (#2), Dimir Midrange, Golgari Graveyard (#34), Azorius Control (#11), Domain Overlords (#9), Azorius Omniscience (#10) and Golgari Roots (#19); from the Hobbit era, Boros (Belladonna Took), Orzhov (Amalia Benavides Aguirre), Dimir (Bitter Triumph), Mardu (Bloodghast), Mono-Black (Desolation Prowler), Mono-Green (Earthbender Ascension), Selesnya (Llanowar Elves), Sultai (Ardyn, the Usurper) and Boros (Dáin's Company) — beside the two Starter Kits. Boros
  brought delayed triggers (CR 603.7), mobilize (702.181), creatures entering attacking (508.4),
  sneak (702.190), Treasure (111.10a), "can't cast spells" (601.3), plan counters. Orzhov (Amalia) brought ward (702.21), explore (701.44), warp (702.185), Cases
  (719), exile-until-it-leaves (610.3), returning as a non-creature, life-gained/lost conditions. Izzet brought Class levels (CR 716), bargain (702.166),
  harmonize (702.180), counterspells, X-mana abilities, flurry, gift-dependent targets. Orzhov brought Rooms (CR 709.5), stun counters (122.1d), gift
  (702.174), cycling (702.29), hexproof from (702.11d), a life-loss replacement, hand reveals. Gruul brought modal spells (CR 700.2), fight (701.14), extra
  combat phases (500.8), linked exile, mill/surveil, "can't attack or block unless".
- Gates: `tools/test.mjs` 181/181; audit 167 cards 0 FAIL / 0 WARN; check-pages clean (102 log types,
  50 question kinds); `tools/sim.mjs` 120 mixed games; `tools/policy-sweep.mjs` 80 games, 0 violations.
- Audit (2026-10-06): all 83 cards then registered checked against Oracle text, rulings and the CR;
  13 defects fixed, each with a test (tests/08); DEVIATIONS V3 closed, V4 opened.
- Art: all 186 keys painted in the fifteen-style mix (D17), reviewed on contact sheets.
- Next: the remaining 5 Pro Tour Final Fantasy and 5 Hobbit-era archetypes, closest first.

**2026-10-03, end of the first session — playable against the AI, private and local.**

- Built: the engine (CR 103, 117, 302.6, 400.7, 500–514, 601–608, 613 with all seven layers
  named, the 616 doors, 704.5a–q, 733), the cost door with the mana solver, the AI with its
  behaviour counters, the interface (board, stack, stops, prompts, preview, log, zone viewers,
  combat arrows), the compiler (a grammar), the Oracle-text auditor, 51 behaviour and rules tests.
- Registered: the two Bloomburrow Starter Kit decks, Hare Raising and Otter Limits, all 60 cards
  of each (D3).
- Gates, all green: `tools/test.mjs` 51/51; `tools/audit-cards.mjs` 0 FAIL / 0 WARN on 90
  compiled cards (`--selftest` PASS); `tools/check-pages.mjs` clean; `tools/sim.mjs` 150 random
  games, 0 violations; `tools/replay-report.mjs --selftest` PASS; 134 CR sections cited, all real.
- Arena, AI in both seats, holdout seed 2000, 20 games: first player 45.0% of decisive games;
  lands 0.98 per turn through turn 10; attacks 60.0% of chances; blocks 32.8%; empty turns 2.2%;
  instant windows used 1.9%; mean 17.1 turns.
- Not yet: art (the procedural fallback only), sound and music, the animation layer, more decks.
  The compile report's work order: modal spells ("Choose one —", 4 candidate decks), linked exile
  ("until this leaves the battlefield"), "can't attack or block", landfall.
- Open for the owner: Q2 and Q4 were taken as the stated defaults (D3, D4). Round two (art style,
  the animation layer, the generation budget) has not been asked.
