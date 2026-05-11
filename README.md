# Dungeon and Paws

Procedural dungeon-puzzle roguelike. Tap or swipe to move on a 9×9 lattice; charge Sudoku-like rune lines to unleash keystone effects.

## Workspace

```
packages/
  engine/      Pure TypeScript game core (deterministic, headless)
  shell-web/   Vite + React + PixiJS web shell (PWA-ready)
  content/     Hero/enemy/relic JSON content
  tools/       CLI utilities (seed exploration, batch generation)
```

## Getting started

```bash
pnpm install
pnpm dev         # runs the web shell at http://localhost:5173
pnpm test        # runs all package tests
pnpm typecheck   # type-checks every package
pnpm build       # builds every package
```

## Requirements

- Node ≥ 20
- pnpm ≥ 9
