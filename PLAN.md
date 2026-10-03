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

## Cut order if time runs short

Deck count, never quality. A deck that does not compile in full is not registered.

## Status

**2026-10-03** — Commit one was `.gitignore`. Rights recorded (docs/rights.md), owner's D1/D2
recorded, defaults D3–D9 stated. Next: CLAUDE.md, docs/rules.md, engine spine.
