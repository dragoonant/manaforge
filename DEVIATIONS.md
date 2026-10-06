# DEVIATIONS — rules the engine does not yet keep

Each is a standing bug, named by its CR section. Fix it, or keep it here; never call it a design
choice. Newest first.

| # | CR | What the rules say | What the engine does | Matters for |
|---|---|---|---|---|
| V4 | 506.3, 508.1b | An attacking creature attacks a player, a planeswalker or a battle; abilities such as Preacher of the Schism's trigger only when a player is attacked. | Creatures can attack only the opposing player. No registered deck contains a planeswalker or a battle, so nothing can be attacked but a player; the attacks event names no defender. The first planeswalker or battle must add the choice of what to attack and the defender to the event. | none yet (Preacher of the Schism once one exists) |
| V2 | 616.1 | When two or more replacement or prevention effects apply to one event, the affected player or controller chooses the order. | The doors exist (`MF.replacers.damage`, `enterReplacements`, the life-loss door) but no order is ever asked. The one non-self replacement in a registered deck, Bloodletter of Aclazotz's doubling, gives the same result in any order. The first card whose order matters must add the question. | none yet |
| V1 | 117.1d, 605.3a | A player may activate a mana ability whenever they have priority. | Mana abilities are activated only inside a payment (where the rules also allow them). Floating mana before casting is not offered. Nothing in a registered deck cares about mana in the pool before a payment. | none yet |

## Fixed

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
