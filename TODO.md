# TODO — wanted improvements to things that already work

- Art: every card in both decks is illustrated (D13). Re-roll any card with `--force <key> --seed-offset N` in `tools/gen-art-sdxl.py`; review with `tools/contact-sheet.ps1`.
- **Sound and music**: ElevenLabs effects and music with a synthesised fallback voice (D9).
- **The animation layer** (handoff 10): a presentation director playing the log; deferred by six
  games — budget it as a stage. Creatures dying with no motion are hard to follow.
- **More decks by compile rate** (`node tools/build-cards.mjs --report`): modal spells, linked
  exile ("until this leaves the battlefield"), "can't attack or block", landfall.
- Drag to play (CARD-PRESENTATION-SPEC: tap inspects, drag commits); today a click plays.
- The AI uses 7.7% of the opponent's-turn windows where it could cast (was 4.9%, `node tools/arena.mjs --mixed`)
  since the evaluator values instant mana left open at the end of its turn (2026-10-07; even in an A/B,
  30-29). It still rarely plans a trick two turns ahead: the roll-out horizon is one turn.
- Floating mana at priority (DEVIATIONS V1).
- The AI pilots Izzet Prowess poorly (8 wins in 90 mixed sim games; it rarely sequences cheap
  spells for prowess, Vivi's mana or the Cutter's second-spell trigger). The rollout horizon ends
  at end of turn; an evaluator term for spells cast this turn would help.
- Oblivious Bookworm reads "unless a permanent entered face down ... or you turned one face up": nothing in
  this engine turns a permanent face down, so the discard always happens. When a face-down mechanic
  arrives (morph, disguise, cloak), give that condition a real history.
