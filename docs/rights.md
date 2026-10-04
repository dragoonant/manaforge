# Rights — what the publisher permits, and what this project does about it

Checked 2026-10-03. Re-check before any change to visibility (PLAN.md D1).

## Wizards of the Coast's Fan Content Policy

<https://company.wizards.com/en/legal/fancontentpolicy> — "Last Updated: November 15, 2017".
Fetched 2026-10-03 with `curl` and a browser user-agent: HTTP 200, 88,450 bytes (copy in
gitignored `scratch/web/fcp.html`).

What it says that bears on this project:

- Fan Content must be free to view, access and share: no paywall, no registration.
- No Wizards logos or trademarks may be used beyond what the policy allows.
- It asks for a set disclaimer naming the content as unofficial; the sentence is copied verbatim
  into `NOTICE.md`.
- Under what you may not do: do not use Wizards' IP in other games or game components, free or not.
- The FAQ says Wizards' patents, game mechanics, logos or trademarks may not be incorporated into
  Fan Content without prior written permission.
- Fan Content does not include verbatim copying and reposting of Wizards' IP.
- Wizards may withdraw permission at any time, for any reason or none.

**Conclusion, stated once (owner's rule 11):** a rules-enforcing Magic client is outside the
permission the policy publishes. Unlike Legend Story Studios' policy (FABFORGE), there is no
section that covers rules-enforcement apps.

## The owner's decision

**D1 (2026-10-03): private and local** — superseded the same day by **D12: a public repository
(`dragoonant/manaforge`) deployed to GitHub Pages so the owner can playtest on the web.** The
concern above was stated to the owner before D12. See `PLAN.md` and `docs/takedown.md`.

## Precedent

Searched 2026-10-03 ("Forge XMage Cockatrice Wizards of the Coast takedown"). Forge and XMage
(rules-enforcing, free, open source) and Cockatrice (no rules enforcement) are still listed as
active alternatives on software-comparison sites; the search returned **no report of a 2026
takedown** of any of them. Older takedowns of other fan clients are recalled from memory, not
re-checked. This is not permission; it is the current state of the world, dated.

## What the project does regardless

1. No official card image, set symbol, mana-symbol artwork, logo, frame or audio is in the repo.
   Mana symbols are drawn in CSS by this project. Art is generated (PLAN.md).
2. Decks come from Wizards-owned settings only — no licensed crossovers (Universes Beyond).
3. Card text is Oracle text, shown because fidelity is the product; the repo is private (D1).
4. `docs/takedown.md` says exactly what to run if asked to stop.

## Data sources and their licences

- **MTGJSON** (<https://mtgjson.com>), repository licence MIT. Its licence covers the dataset,
  not the card text, which is Wizards'. See `docs/sources.md`.
- **Scryfall** was not used for import. Its API docs page returned HTTP 403 to an automated fetch on
  2026-10-03; read its terms in a browser before using it.
