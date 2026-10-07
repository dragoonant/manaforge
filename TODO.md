# TODO — wanted improvements to things that already work

- Art: every card in every registered deck is illustrated (D13, D17). Re-roll any card with `--force <key> --seed-offset N` in `tools/gen-art-sdxl.py`; review with `tools/contact-sheet.ps1`.
- **Sound and music**: ElevenLabs effects and music with a synthesised fallback voice (D9).
- The animation layer (D18) plays motion from a diff of each render. Not yet: an attacker lunging at
  combat damage, a spell resolving off the stack with an effect, a speed setting beyond on/off.
- **More decks by compile rate** (`node tools/build-cards.mjs --report`): modal spells, linked
  exile ("until this leaves the battlefield"), "can't attack or block", landfall.
- Drag to play (CARD-PRESENTATION-SPEC: tap inspects, drag commits); today a click plays.
- On the opponent's turn the AI acts only in response to something on the stack, at their beginning of
  combat, in combat, or at their end step, and values instant mana left open as its own turn ends
  (2026-10-07). It casts in 3.8% of the opponent's-turn windows where it could (`node tools/arena.mjs
  --mixed`); it still rarely plans a trick two turns ahead: the roll-out horizon is one turn.
- Izzet Prowess goes 16-26 against the other 21 decks from both seats in a 42-game run (2026-10-07; was
  8 of 90). Roll-outs now attack, so a pre-combat pump counts; the AI still rarely chains cheap spells
  for Vivi's mana or the Cutter's second-spell trigger: the horizon ends at end of turn.
- Oblivious Bookworm reads "unless a permanent entered face down ... or you turned one face up": nothing in
  this engine turns a permanent face down, so the discard always happens. When a face-down mechanic
  arrives (morph, disguise, cloak), give that condition a real history.
