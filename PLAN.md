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

## Cut order if time runs short

Deck count, never quality. A deck that does not compile in full is not registered.

## Status

**2026-10-05 — the championship decks (D15) under way: 2 of 20 registered.**

- Registered: Mono-Red Aggro (PT Final Fantasy #1) and Gruul Delirium (PT Final Fantasy #35),
  beside the two Starter Kits. Gruul brought modal spells (CR 700.2), fight (701.14), extra
  combat phases (500.8), linked exile, mill/surveil, "can't attack or block unless".
- Gates: `tools/test.mjs` 81/81; audit 66 cards 0 FAIL / 0 WARN; check-pages clean (68 log types,
  30 question kinds); `tools/sim.mjs` 60 mixed games, 0 violations.
- Art: Grim Dark subjects written for every registered card; the 6:00 AM run renders the missing
  ones (procedural until then, at the owner's request).
- Next: the remaining 8 Pro Tour Final Fantasy archetypes, then the 10 Hobbit-era Arena lists.

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
