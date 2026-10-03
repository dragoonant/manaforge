# Takedown — if Wizards of the Coast asks this project to stop

The repository is private and local (PLAN.md D1); nothing is published, so there is nothing to
take down remotely. If that ever changes, or if asked to stop entirely:

1. If a remote was ever added, delete it from the host first (in the browser; `gh` is not
   installed on this machine), then remove it locally:

```bash
git remote -v
```

```bash
git remote remove origin
```

2. Stop any local server (`node tools/serve.mjs`) with Ctrl+C.
3. To remove the project from this machine entirely (irreversible — the owner runs this, not an
   agent), delete the `Documents/MANAFORGE` folder, which also removes its OneDrive copy.

Record the date and the request in `PLAN.md` as a decision.
