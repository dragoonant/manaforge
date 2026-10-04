# TODO — wanted improvements to things that already work

- Art: every card in both decks is illustrated (D13). Re-roll any card with `--force <key> --seed-offset N` in `tools/gen-art-sdxl.py`; review with `tools/contact-sheet.ps1`.
- **Sound and music**: ElevenLabs effects and music with a synthesised fallback voice (D9).
- **The animation layer** (handoff 10): a presentation director playing the log; deferred by six
  games — budget it as a stage. Creatures dying with no motion are hard to follow.
- **More decks by compile rate** (`node tools/build-cards.mjs --report`): modal spells, linked
  exile ("until this leaves the battlefield"), "can't attack or block", landfall.
- Drag to play (CARD-PRESENTATION-SPEC: tap inspects, drag commits); today a click plays.
- The pre-game shows "Opponent's turn 0" in the step bar; say "Before the game".
- The AI uses instants in 1.9% of the windows where it could: it rarely holds mana for a trick
  (handoff 11.8.4 predicted this). Add an evaluator term for untapped mana with an instant in hand.
- Floating mana at priority (DEVIATIONS V1).
