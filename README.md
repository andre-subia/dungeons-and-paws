# GRIDLORE

Procedural dungeon-puzzle roguelike. Tap-to-move on a 9×9 lattice; charge Sudoku-like rune Lines to detonate the dungeon.

See `/Users/exponentiadev/.claude/plans/yes-i-want-you-snappy-blanket.md` for the full design + technical plan.

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
