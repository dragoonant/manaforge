# DEVIATIONS — rules the engine does not yet keep

Each is a standing bug, named by its CR section. Fix it, or keep it here; never call it a design
choice. Newest first.

| # | CR | What the rules say | What the engine does | Matters for |
|---|---|---|---|---|
| V3 | 707.10 | A copy of a spell is created from the spell as it exists on the stack. | If the spell Alania would copy has already left the stack when her trigger resolves, nothing is copied (logged). Check Alania's rulings before deciding whether last known information applies. | Alania, Divergent Storm |
| V2 | 616.1 | When two or more replacement or prevention effects apply to one event, the affected player or controller chooses the order. | The doors exist (`MF.replacers.damage`, `enterReplacements`) but no registered card has a non-self replacement, so no order is ever asked. The first card that adds one must add the question. | none yet |
| V1 | 117.1d, 605.3a | A player may activate a mana ability whenever they have priority. | Mana abilities are activated only inside a payment (where the rules also allow them). Floating mana before casting is not offered. Nothing in a registered deck cares about mana in the pool before a payment. | none yet |

## Not deviations

- **Identical basic lands are not asked one by one** when paying: they are indistinguishable
  (CLAUDE.md hard rule 11). Lands that make different colours are offered separately.
- **The opponent's priority windows are shown only at stops** (PLAN D4). The engine gives every
  priority the rules give; skipping a window is the player's shortcut (CR 732), not the engine's.
- **A token in a graveyard** is removed by the state-based action (CR 704.5d), so "dies"
  triggers see it die first.
