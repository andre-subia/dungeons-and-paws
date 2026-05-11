/**
 * Test helpers — not a test file (vitest picks up only *.test.ts).
 *
 * The default RunState now contains a generated floor with rune tiles +
 * an exit, which is great for the live game but inconvenient for unit
 * tests that want to control every cell. These helpers give tests a
 * blank canvas with explicit dimensions.
 */

import {
  Grid,
  STANDARD_GRID,
  emptyTile,
  type GridDimensions,
} from "../src/world/grid.js";
import { recomputeLattices } from "../src/world/lattice.js";
import { makeInitialRunState } from "../src/run/state.js";
import type { Cell } from "../src/core/types.js";
import type { RunState } from "../src/run/state.js";

export type BlankRunOpts = {
  readonly seed?: string;
  readonly heroSpawn?: Cell;
  readonly dims?: GridDimensions;
};

/** Returns a RunState with an empty grid of the requested dimensions. */
export function makeBlankRunState(opts: BlankRunOpts = {}): RunState {
  const seed = opts.seed ?? "TEST-SEED";
  const dims = opts.dims ?? STANDARD_GRID;
  const heroSpawn = opts.heroSpawn ?? { x: 0, y: 0 };
  const base = makeInitialRunState({ seed, heroSpawn, gridDims: dims });
  const grid = Grid.empty(dims, (i) => emptyTile(`blank-${i}`));
  return {
    ...base,
    currentFloor: {
      ...base.currentFloor,
      grid,
      // Generator now seeds enemies; blank tests don't want any.
      enemies: new Map(),
      lattices: recomputeLattices(grid),
      heroStart: heroSpawn,
      exitCell: { x: dims.width - 1, y: dims.height - 1 },
      exitUnlocked: true,
    },
  };
}
