# DEVIATIONS — rules the engine does not yet keep

Each is a standing bug, named by its CR section. Fix it, or keep it here; never call it a design
choice. Newest first.

| # | CR | What the rules say | What the engine does | Matters for |
|---|---|---|---|---|
| V5 | 508.4 | A creature put onto the battlefield attacking attacks a player, planeswalker or battle its controller chooses (unless the effect says). | Tokens that enter attacking (mobilize, Dalkovan Encampment, The Last Ronin's Technique) always attack the opposing player; the choice of a planeswalker is not offered. Ninjutsu follows its returned creature, as the rules say. | Voice of Victory, Stadium Headliner, Dalkovan Encampment, The Last Ronin's Technique — when the opponent controls a planeswalker |
| V2 | 616.1 | When two or more replacement or prevention effects apply to one event, the affected player or controller chooses the order. | The doors exist (`MF.replacers.damage`, `enterReplacements`, the life-loss door) but no order is ever asked. The one non-self replacement in a registered deck, Bloodletter of Aclazotz's doubling, gives the same result in any order. The first card whose order matters must add the question. | none yet |
| V1 | 117.1d, 605.3a | A player may activate a mana ability whenever they have priority. | Mana abilities are activated only inside a payment (where the rules also allow them). Floating mana before casting is not offered. Nothing in a registered deck cares about mana in the pool before a payment. | none yet |

## Fixed

- **V4** (CR 506.3, 508.1b), 2026-10-06: attackers choose the player or a planeswalker (asked only
  when the defender controls one); combat damage goes to what was attacked; Preacher of the
  Schism's player-only trigger reads it.

- **V3** (CR 707.10), 2026-10-06: Alania now copies a spell that has left the stack, as it last
  existed there (her ruling), keeping paid kicker, offspring and gift; new targets are chosen
  target by target, and one with no legal new choice stays unchanged (CR 707.10c).

## Not deviations

- **Identical basic lands are not asked one by one** when paying: they are indistinguishable
  (CLAUDE.md hard rule 11). Lands that make different colours are offered separately.
- **The opponent's priority windows are shown only at stops** (PLAN D4). The engine gives every
  priority the rules give; skipping a window is the player's shortcut (CR 732), not the engine's.
- **A token in a graveyard** is removed by the state-based action (CR 704.5d), so "dies"
  triggers see it die first.
