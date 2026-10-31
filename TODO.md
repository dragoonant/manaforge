# TODO — wanted improvements to things that already work

- **Review the hosted renders (D23)**: Kujo's and the championship decks' 238 cards and tokens were rendered
  through Hugging Face on 2026-10-31; re-roll any that miss their subject with `python3 tools/gen-art-hf.py --force <key>
  --seed-offset N` (or the local GPU script), then `node tools/write-manifest.mjs`.
- **The AI and the championship Commander decks (D22)** — measured 2026-10-31 (`node tools/arena.mjs --mixed
  --commander`, 10 games): games last 20 turns (about 10 each) and end by combat or commander damage; 12.8
  spells cast per game for both players together; 13.9% of turns with no land, spell or attack; it casts in
  1.9% of the opponent's-turn windows where it could (counterspells and free spells are rarely used: its
  roll-out only sees to the end of the turn, so a counterspell's value is the card it stops, scored as
  board). Real cEDH games end on turn 3-6 with dozens of spells. The AI plays them card by card. It does not know
  their lines (Thassa's Oracle with Demonic Consultation or Tainted Pact, Underworld Breach with Lion's Eye
  Diamond, Food Chain, Najeela's extra combats, Kraum and Tymna's card draw); it names a card not in its
  library for Demonic Consultation only when a "win the game" card is in its hand or on its battlefield.
- **The AI and a combo deck**: the AI plays Kujo's deck card by card with its one-turn roll-outs; it does
  not plan the deck's combos (Isochron Scepter + Dramatic Reversal, Painter's Servant + Grindstone,
  Doomsday into Thassa's Oracle, Bloodchief Ascension + Mindcrank). Its evaluator counts a short
  library only below three cards, so milling an opponent is barely valued.
- **AI speed on very big boards**: in Kujo mirror games with 35–50 permanents (Zellix's Horror tokens) an
  AI decision takes up to about 4.5 s (99% under 3 s, median under 0.1 s; 2026-10-31, one core). Most of
  it is now `MF.clone`, a JSON copy of a state whose `cards` keeps every moved object as last known
  information; pruning objects nothing refers to would be the next step. A question with more than 12
  answers rolls out only 12 of them (the policy's own answer and "done" always among them).
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
