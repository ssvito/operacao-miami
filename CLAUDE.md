# Operação Miami

Canvas PWA in vanilla TypeScript, no game framework - same stack and working style as `../ice-breaker`. Political satire: keep it clearly parody, aim the jokes at situations (press, bureaucracy, trapalhadas), and never present specific accusations or court cases as fact.

## Docs

Design, roadmap and history live in `docs/`. Start at `docs/Operacao Miami.md`. Notes read like Obsidian notes (spaces in filenames); use relative markdown links, never `[[wikilinks]]`.

## Working rule: log in the same commit

A session that changes code updates `docs/` in the same commit: a dated line in the current month's note in `docs/Log/`, and the matching `docs/Roadmap.md` item ticked. Record deviations from the plan and why. Don't restate what git already knows.

## Commands

`npm run dev`, `npm run build` (`tsc && vite build`), `npm run preview`. Pushing to `main` deploys to GitHub Pages via Actions.
