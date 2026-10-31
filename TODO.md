# TODO — wanted improvements to things that already work

- **Art for Kujo's deck (D21)**: 95 cards and tokens have prompts but no painting yet; they show the
  procedural fallback. On the GPU machine: `python tools/gen-art-sdxl.py` (it skips what exists), then
  `tools/shrink-art.ps1` and `node tools/write-manifest.mjs`.
- **The AI and a combo deck**: the AI plays Kujo's deck card by card with its one-turn roll-outs; it does
  not plan the deck's combos (Isochron Scepter + Dramatic Reversal, Painter's Servant + Grindstone,
  Doomsday into Thassa's Oracle, Bloodchief Ascension + Mindcrank). Its evaluator counts a short
  library only below three cards, so milling an opponent is barely valued.
- Art: every card in every registered deck is illustrated (D13, D17). Re-roll any card with `--force <key> --seed-offset N` in `tools/gen-art-sdxl.py`; review with `tools/contact-sheet.ps1`.
- **Sound and music**: ElevenLabs effects and music with a synthesised fallback voice (D9).
- The animation layer (D18) plays motion from a diff of each render. Not yet: an attacker lunging at
  combat damage, a spell resolving off the stack with an effect, a speed setting beyond on/off.
- **More decks by compile rate** (`node tools/build-cards.mjs --report`): modal spells, linked
  exile ("until this leaves the battlefield"), "can't attack or block", landfall.
- Drag to play is done on touch (D20). A mouse still clicks to play; dragging with a mouse would be the same code if wanted.
- On the opponent's turn the AI acts only in response to something on the stack, at their beginning of
  combat, in combat, or at their end step, and values instant mana left open as its own turn ends
  (2026-10-07). It casts in 3.8% of the opponent's-turn windows where it could (`node tools/arena.mjs
  --mixed`); it still rarely plans a trick two turns ahead: the roll-out horizon is one turn.
- Izzet Prowess goes 16-26 against the other 21 decks from both seats in a 42-game run (2026-10-07; was
  8 of 90). Roll-outs now attack, so a pre-combat pump counts; the AI still rarely chains cheap spells
  for Vivi's mana or the Cutter's second-spell trigger: the horizon ends at end of turn.
- The forge table (D19) is laid out for a landscape window. On a phone held upright the mat is under
  half the screen's height: a portrait layout (the halves stacked closer, the stack as a strip) would
  help. Phone landscape works, small.
- A battlefield row holds about six cards at full size; past that its cards shrink (to 55% at most),
  and past about ten the row scrolls. A second front row would be kinder to token decks.
- On a phone, paying mana land by land means tapping each land and confirming it in its sheet; the
  one-button suggested payment is the quick path. A tap-to-toggle mode for lands during payment
  would be faster.
