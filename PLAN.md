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

## Cut order if time runs short

Deck count, never quality. A deck that does not compile in full is not registered.

## Status

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
