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
| D18 | 2026-10-07 | **The animation layer (handoff 10) is a diff director, js/anim.js.** Each render records where every card was; after it, the difference plays: moved cards slide (FLIP), taps turn, a permanent that left the battlefield leaves a ghost that flashes for how it left (destroyed or sacrificed: red; exiled: white; bounced: blue) and flies to that zone, new permanents arrive from the hand or stack, damage and life float as numbers. It reads the log, decides nothing. The opponent and auto-pass wait for the motion (Mallet-42k §4); elements are removed by timer, not onfinish (a hidden tab never finishes). "Motion: on/off" in the sidebar; off by default under prefers-reduced-motion. Built under the owner's standing "keep going" on TODO; the owner can turn it off. | session |
| D19 | 2026-10-25 | **The interface is a drawn forge table, after the sister projects' layout.** Owner: "great job doing the interfaces for grand line and lorecannae, do manaforge next." Carried over is the structure: a title splash, a parchment picker with two deck slots and dice, a deck chooser (era groups, D15's provenance kept beside each list), a mat whose zones are placed from one geometry table that also draws them (`js/boardart.js`), a dock (what just happened · your hand · the prompt), a log-and-settings drawer on the right edge, a ribbon as each turn begins. The dress is a basalt slab in a riveted bronze rim with a molten seam between the halves, ember gold for you and arcane violet for the opponent, an anvil for an emblem. The opponent's half mirrors yours top to bottom rather than rotating, so the shared stack column and both life totals line up. Every backdrop is drawn in SVG; nothing is generated. The card back (`art/ui/cardback.svg`) and every frame are this project's own; no Wizards card back, frame or symbol is imitated (docs/rights.md). Card faces are unchanged. D18's "Motion" toggle moved from the sidebar to the drawer and the picker. | owner |
| D20 | 2026-10-27 | **Touch: a tap reads, a drag commits, a hold peeks.** Owner: "give these games the hearthstone treatment on mobile. I hate that I can't zoom in on cards and that when tapping on cards they automatically play." Agreed with the owner: drag and buttons both, landscape only, the same model in all three sister projects. On touch a tap on a card opens the card sheet — the card with its Oracle text, current numbers and why it can't be played, beside its legal actions as buttons with their costs; nothing a finger touches commits except a button. A drag commits: a hand card onto your battlefield plays it when there is exactly one way to (a land, or a spell with one cost; several — a back face, an alternative cost — open the sheet); during declare attackers an attacker dragged at the opponent is added; during declare blockers a blocker dragged onto an attacker is assigned; Confirm still ends either declaration. A hold shows the card until the finger lifts. On a phone (coarse pointer, short side ≤ 540 px) the hand rests as a fan of card tops and rises on a tap; recent plays run down the left edge; the prompt is a column on the right with its buttons stacked at the thumb; the mat shows art and numbers and a hold reads the rest; portrait shows a "turn sideways" gate; Add to Home Screen opens it full-screen and landscape (`manifest.webmanifest`). A mouse plays as before. `js/touch.js`. | owner |

| D21 | 2026-10-31 | **Kujo's Commander deck, under a heading of its own.** Owner: "My friend Kujo put a decklist together … add this decklist to the game. Implement it in game with art, and add it to the deck lists under a new heading for Kujo." The list — "Zellix, of Halaster", commanders Zellix, Sanity Flayer and Scion of Halaster (choose a Background) — is kept as `data/lists/kujo-zellix.txt` and compiled like every other deck; it registers only because all 100 cards compile. Owner's choices, asked before work began: **the Commander rules in full (CR 903)** — 40 life, the command zone, commander tax, 903.9a-b, 21 commander damage, colour identity — so a Commander deck plays only another Commander deck (a mirror until there is a second); and **art prompts written here, rendered at home** with `tools/gen-art-sdxl.py` (D13), since this session's container has no GPU; until then those cards show the procedural fallback. Its two-card Moxfield sideboard is left out (CR 903.5e). Two of its cards come from licensed crossovers beyond D16's: Raul, Trouble Shooter (Fallout) and Hidden Lair (a Marvel set); Raul's prompt paints a generic undead rogue, not the licensed character, and Hidden Lair is a landscape — the owner may want to say otherwise. | owner |
| D22 | 2026-10-31 | **Commander as a mode of its own, and five championship Commander decks.** Owner: "it plays under the commander format - you will need to add that too as a separate mode. Implement 5 championship commander decks (all different) to play with." The picker has two modes, **Duel** (20 life, 60-card decks) and **Commander** (40 life, 100 cards, CR 903); each lists only its own decks, so a Commander deck always meets another. The five decks are championship cEDH lists from EDHTop16 (the standings and decklists of competitive Commander events): from the top 16 of the 16 largest open events of 2026, the best-placed list of each commander, choosing five different commanders whose lists together needed the fewest cards the compiler could not yet read (120). Kraum & Tymna (1st of 200, Just Jam D-Grid), Thrasios & Vial Smasher (1st of 209, The Fish Bowl 7), Scion of the Ur-Dragon (3rd of 156, cEDH UK Open — Benfest III), Najeela (7th of 173, Commandergeddon 10), Terra (8th of 195, Pittsburgh 2026). `tools/fetch-cedh.mjs` writes them to `data/lists/cedh-*.txt` with their provenance; they compile like any other list and register only because every card compiles. They play under the "cEDH championship" heading, beside Kujo's. Licensed crossover cards in them, beyond D16 and D21: Terra, Tataru Taru, Flash Photography and Starting Town (Final Fantasy), Borne Upon a Wind and Lotho, Corrupt Shirriff (The Lord of the Rings), Redirect Lightning and The Cabbage Merchant (Avatar), Permission Denied (a Jurassic World set); their prompts paint generic figures. | owner |
| D23 | 2026-10-31 | **Art may also be rendered through Hugging Face** — the same SDXL base 1.0 model, prompts, seeds, size and negative prompt as D13, run by Hugging Face's inference router with the fal-ai provider (`fal-ai/fast-sdxl`) by `tools/gen-art-hf.py`, which also makes the 560 px delivery JPEG that `tools/shrink-art.ps1` makes. Owner: "We have eleven labs and hugging face on env vars right? Can we use hf to gen?" — the cloud session has no GPU and could not reach the owner's machine. The hosted endpoint takes one prompt for both text encoders, so it gets the second encoder's full text; the router bills the owner's Hugging Face account per image. Hugging Face's own `hf-inference` provider no longer serves SDXL (HTTP 410). D13's local script stays the first choice on the GPU machine. | owner |
| D24 | 2026-10-31 | **The AI plays the championship Commander decks toward their wins.** Owner: "start making the improvements to AI so commander feels more competitive." The roll-out AI (one turn ahead) is kept and given what one turn can't see: **win lines**, each run in the engine on a determinized copy with the opponent passing and started only if it wins there (Thassa's Oracle with Demonic Consultation or Tainted Pact; Underworld Breach with Lion's Eye Diamond and Brain Freeze), then followed while this turn's casts show it under way; **threats** on the stack (an opponent's library win, Consultation, Breach, Ad Nauseam, a tutor, a commander, a counterspell on its own spell), worth their value in a roll-out that stops them; **tutors** that fetch the missing piece of the nearest line; an evaluator that counts an empty library (CR 704.5b), the colours its permanents make, mana rocks, and a Pact it couldn't pay at its next upkeep; and, in Commander games only, a small value for each spell cast. No rule moves into the AI: it plays through `legalActions`/`apply` as before. | owner |

## Cut order if time runs short

Deck count, never quality. A deck that does not compile in full is not registered.

## Status

**2026-10-31 — Commander mode and five championship Commander decks (D22): all registered, 100 of 100 cards each.**

- The picker has a Duel / Commander switch; the chooser lists only that mode's decks, under "cEDH
  championship" and "Kujo" headings in Commander mode. `tools/fetch-cedh.mjs` writes the five
  EDHTop16 lists with their event, standing, record, player and source page.
- 120 cards new to the compiler, each by an anchored sentence, with no change to any card compiled
  before (checked card by card against the last commit). New in the engine: alternative costs (CR 118.9:
  Force of Will, Force of Negation, Fierce Guardianship, Mindbreak Trap, Flare of Duplication,
  Misdirection, Commandeer, Snapback, Deflecting Swat); dash (702.109) and escape granted by Underworld
  Breach (702.138); spells and abilities as targets by type, colour and "a single target" (115.10);
  changing targets (115.7) and gaining control of a spell (Commandeer); split second (702.61); casting
  prohibitions and permissions (Silence, Orim's Chant, Grand Abolisher, Dosan, Ranger-Captain, Revel in
  Silence; Borne Upon a Wind, Valley Floodcaller, Emergence Zone, Flash Photography); Veil of Summer and
  Autumn's Veil; a general library search (701.23, with 701.23d's "must find"); mana abilities that work
  from the hand (the spirit guides), Lion's Eye Diamond, Mox Diamond's replacement, Gemstone Caverns in
  the opening hand, Food Chain's creature-only mana, Jeweled Amulet, Carpet of Flowers; partner pairs
  (702.124h); Derevi's command-zone ability; extra turns (500.7, Final Fortune); "becomes a copy until
  end of turn" (Scion of the Ur-Dragon, Shifting Woodland); copies that enter as an enchantment, artifact
  or an opponent's creature (Imposter Mech, a Vehicle); Demonic Consultation naming any card name (CR
  201.3: every Oracle name is offered, the cards in the game first); Intuition and Gifts Ungiven (the
  opponent chooses); Praetor's Grasp (a face-down card its caster may look at and play); Tainted Pact,
  Ad Nauseam, Lim-Dûl's Vault, Chain of Vapor, Terra // Esper Terra (transform, a Saga back face).
- Checked in the real browser (Playwright, Chromium, 1600×900 and a touch phone at 844×390): the Duel /
  Commander switch moving both slots; the chooser's two Commander headings, the six Commander decks and a
  championship deck's detail with its standing, record, player and EDHTop16 link; Kraum & Tymna against
  Najeela played by the AI on both seats to turn 14 with both partner commanders on the plate, each with
  its own tax; and Force of Will cast for its alternative cost on the opponent's turn — target, then
  "exile a blue card", 1 life paid, the spell countered. No page error.
- Gates: `tools/test.mjs` 438/438 (75 new in tests/27-cedh.mjs); audit 535 cards 0 FAIL / 0 WARN;
  check-pages clean (193 log types, 104 question kinds); `tools/sim.mjs` 12 random mirror games for each
  of the five decks and 40 across every deck, 0 violations; two AI-vs-AI mirror games for each deck run
  to a finish (40–120 ms a step); `tools/policy-sweep.mjs 60`, every AI answer legal (74 question kinds).
- Art: 143 prompts added to `tools/art-identity.mjs` (the five decks' cards and tokens), linted. Rendered
  the same day through Hugging Face (D23) with Kujo's 95 (D21): 238 images, 0 failures; three re-rolled
  after a look at the contact sheet (Fractured Sanity in black and white, Guiltfeeder with a painted frame,
  Manic Scribe with lettering). `tools/check-art.mjs`: 581 of 581 illustrated. Checked in the browser: the
  Commander chooser's deck art and the cards in hand and on the battlefield load, no failed request.

**2026-10-31 — Kujo's Commander deck (D21) registered: 100 of 100 cards compile.**

- The Commander variant (CR 903): commanders in a command zone (shown on each plate, cast from there,
  {2} more per earlier cast and per commander, 702.124d), 903.9a's choice as a state-based action and
  903.9b's as a replacement, 40 life, 21 combat damage from one commander (704.6c), the combined colour
  identity for Command Tower and Arcane Signet, validation of 903.5 and 702.124k. The deck chooser has a
  "Kujo" heading; choosing a Commander deck for one side moves the other side to one.
- New in the engine: a mill door with its replacements in the order the milling player chooses (Bruvac,
  The Water Crystal; CR 616.1); events for cards put into a graveyard from a library or from anywhere,
  cards leaving a graveyard, life lost, permanents becoming tapped or untapped, "attacks and isn't
  blocked"; look-back for creatures that die together (603.10a); the first-draw replacement (Scion of
  Halaster); multi-mana abilities and mana abilities with mana costs in the solver and the proposed
  payment (Sol Ring, Mana Vault, Ancient Tomb, Cabal Coffers, Darkwater Catacombs, Sunken Ruins,
  Phyrexian Tower); mana read from the game (106.7: Fellwar Stone, Exotic Orchard, Reflecting Pool;
  imprint); morph and face-down spells and permanents with their hidden information (702.37, 708);
  storm (702.40); cumulative upkeep (702.24); fear (702.36); exhaust (702.177); devotion (700.5) and a
  God that stops being a creature; Painter's Servant's colour in every zone; Urborg (305.6); Animate
  Dead; copies of cards cast during resolution (Isochron Scepter, 707.12, 704.5e); Doomsday, Thassa's
  Oracle (104.2b), Yawgmoth's Will, Mnemonic Betrayal, Necropotence (cards exiled face down, 406.3),
  Hullbreaker Horror's "choose up to one" (603.3c), Raul, Emry, Braids, Grindstone, Urza's Saga.
- Fixed for every deck: Captain N'ghathrod-style "Whenever a [subtype] you control deals combat
  damage" now checks the subtype; a mana ability activated at priority whose cost can't be completed is
  reversed (CR 733) instead of stopping the game; Oblivious Bookworm's face-down history is real.
- Checked in the real browser (Playwright, Chromium, 1600×900): the chooser's Kujo heading and deck
  detail, the mirror pairing and the Commander note on the picker, 40 life and both command zones at
  the start, a commander's chip glowing and casting from it, a game played to turn 15 by the AI on both
  seats with no page error, and an opponent's face-down creature and face-down exiled card whose names
  appear nowhere in the page.
- Gates: `tools/test.mjs` 361/361 (68 new in tests/26-kujo-zellix.mjs); audit 402 cards 0 FAIL / 0 WARN;
  check-pages clean (159 log types, 83 question kinds); `tools/sim.mjs --deck kujo-zellix-of-halaster`
  16 random mirror games over four seeds and `tools/sim.mjs --games 44` across every deck, 0
  violations; `tools/policy-sweep.mjs` 60 games, every AI answer legal; AI-vs-AI mirror games run to
  a finish (22 turns at about 80 ms a step) — the AI plays the deck card by card, not its combos (TODO).
- Found by the sims and fixed: the AI's answer to "choose a color" (Painter's Servant); a mana ability
  at priority that could stop the game when its own cost couldn't be finished; a stray comment that,
  for a few hours of this session, dropped "to a player" and "combat" from every deals-damage trigger
  (never committed to `main`; two regression tests now hold it).
- Speed: each event's trigger scan, the state-based actions, attack and block legality, the mill
  door and the damage replacements read the battlefield's layers once instead of once per permanent
  (an AI attack decision on a 36-permanent board: 8.5 s → 1.1 s). The AI rolls out at most 12 answers
  to one question (a 155-pair block once took 37 s). Big boards are still slow (TODO).
- Art: 95 prompts added to `tools/art-identity.mjs`, linted; not yet rendered (D21).

**2026-10-27 — the touch model (D20).** Checked under phone emulation (844×390, touch events):
two-column picker, the hand raised and read, the card sheet with its cast button and the payment
that follows, a land dragged onto the battlefield, an attacker dragged at the opponent, a blocker
dragged onto an attacker, hold to peek, the portrait gate, and a whole game to the end through
taps alone (38 sheet commits, no page errors); a desktop game unchanged.

**2026-10-25 — the interface re-dressed as a forge table (D19).**

- Title over a drawn forge at night; a picker and a deck chooser; the table drawn from one geometry
  table with every zone a player owns — plate (life, pool, speed, emblems), battlefield as a creature
  row and a land row, library, graveyard and exile as piles (the open ones click through to their
  viewers) — plus the stack and the step bar between the halves; the hand in a dock with the feed and
  the prompt; the log and settings in a drawer (L). Engine untouched; `tools/test.mjs` 293/293.

**2026-10-07 — the animation layer (D18); floating mana (V1 fixed); AI timing.**

- The AI holds instant mana open, attacks in its roll-outs, and acts on the opponent's turn only at
  their beginning of combat, in combat, at their end step, or in response; Izzet Prowess 16-26 against
  the field. Mana abilities at priority (CR 605.3a). All 343 cards illustrated in the D17 mix.

**2026-10-06 — the championship decks (D15) registered: 20 of 20; a per-card audit done.**

- Azorius (Perilous Snare), the last, brought speed and start your engines! (CR 702.179, max speed
  702.178 — V6), harness and ∞ (701.64, 702.186), craft (702.167) with a transforming artifact,
  choosing a land card name from the whole Oracle reference (201.4; MF.LAND_NAMES), Torpor Orb,
  mana spendable only on artifact spells, sacrifice and tap-other-artifacts costs, "for as long as it
  remains tapped", a card put third from the top, X counted as it resolves.
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
  Prowess (#2), Dimir Midrange, Golgari Graveyard (#34), Azorius Control (#11), Domain Overlords (#9), Azorius Omniscience (#10) and Golgari Roots (#19); from the Hobbit era, Boros (Belladonna Took), Orzhov (Amalia Benavides Aguirre), Dimir (Bitter Triumph), Mardu (Bloodghast), Mono-Black (Desolation Prowler), Mono-Green (Earthbender Ascension), Selesnya (Llanowar Elves), Sultai (Ardyn, the Usurper), Boros (Dáin's Company) and Azorius (Perilous Snare) — beside the two Starter Kits. Boros
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
