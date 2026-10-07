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
- The AI pilots Izzet Prowess poorly (8 wins in 90 mixed sim games; it rarely sequences cheap
  spells for prowess, Vivi's mana or the Cutter's second-spell trigger). The rollout horizon ends
  at end of turn; an evaluator term for spells cast this turn would help.
- Log lines name a transformed permanent by its front face ("Esper Origins triggers" for Summon:
  Esper Maduin): log entries carry the card id, not the face. Carry the face with the id (about 25
  log sites) and let `tag` read it; the battlefield tile already shows the back face.
- 123 card illustrations are still procedural (Golgari Graveyard through Azorius Perilous Snare): the GPU
  was busy with the owner's Hunyuan3D jobs on 2026-10-06. `python tools/gen-art-sdxl.py` renders whatever has no art.
- Oblivious Bookworm reads "unless a permanent entered face down ... or you turned one face up": nothing in
  this engine turns a permanent face down, so the discard always happens. When a face-down mechanic
  arrives (morph, disguise, cloak), give that condition a real history.
- An X spell's cast label shows its cost without the {X} symbols (e.g. Oracle's Gift reads {U}).
