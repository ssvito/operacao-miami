# Operação Miami

A political satire game in pixel art: a cartoon senator has to slip out of Brasília and make it to Florida, dodging reporters, selfie-hunting supporters and airport bureaucracy. Built as an installable PWA for desktop and mobile.

**[Play it](https://ssvito.github.io/operacao-miami/)**

**This is parody and fiction.** Characters are caricatures of public figures; nothing in the game is a factual claim about anyone.

Same approach as [ICE Breaker](https://github.com/ssvito/ice-breaker): vanilla TypeScript and the raw Canvas API, no game framework.

## Docs

Design notes, roadmap and a dated log live in [`docs/`](./docs/Operacao%20Miami.md).

## Development

```
npm install
npm run dev      # Vite dev server
npm run build    # tsc && vite build
node scripts/gen-icons.mjs   # regenerate the PNG icons from the pixel grid
```

Push to `main` deploys to GitHub Pages via Actions.
