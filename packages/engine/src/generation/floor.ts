/**
 * Floor generator. Step-5 scope is intentionally minimal:
 *
 * - Place hero start at top-left, exit at bottom-right (so hero must
 *   traverse the floor to reach it).
 * - Sprinkle rune tiles at ~50% density via a deterministic forked RNG.
 * - Return a complete FloorState with lattices precomputed.
 *
 * The full pipeline from design §3 (skeleton → CSP → enemies → solvability)
 * lands in step 6+. For now this gets us a floor with a clear objective
 * and enough rune density that lattice-charging is achievable.
 */

import { SeededRNG } from "../core/rng.js";
import { RUNES, cellEq, type Cell, type Rune } from "../core/types.js";
import {
  Grid,
  emptyTile,
  enemyTile,
  exitTile,
  runeTile,
  type GridDimensions,
} from "../world/grid.js";
import { recomputeLattices } from "../world/lattice.js";
import type { FloorState } from "../run/state.js";
import type { EnemyState } from "../entities/enemy.js";
import {
  EASY_TEMPLATES,
  ENEMY_TEMPLATES,
  HARD_TEMPLATES,
  MEDIUM_TEMPLATES,
  type EnemyTemplateId,
} from "../entities/enemy-templates.js";

const RUNE_DENSITY = 0.5;

export function generateFloor(
  seed: string,
  floorIndex: number,
  dims: GridDimensions,
): FloorState {
  const rng = new SeededRNG(`floor:${seed}:${floorIndex}`);
  const heroStart: Cell = { x: 0, y: dims.size - 1 };
  const exitCell: Cell = { x: dims.size - 1, y: 0 };

  let grid = Grid.empty(dims, (i) => emptyTile(`f${floorIndex}-init-${i}`));

  for (let y = 0; y < dims.size; y++) {
    for (let x = 0; x < dims.size; x++) {
      if (x === heroStart.x && y === heroStart.y) continue;
      if (x === exitCell.x && y === exitCell.y) continue;
      if (rng.next() > RUNE_DENSITY) continue;
      const rune = rng.pick(RUNES) as Rune;
      grid = grid.set({ x, y }, runeTile(`f${floorIndex}-r-${x}-${y}`, rune));
    }
  }

  grid = grid.set(exitCell, exitTile(`f${floorIndex}-exit`));

  if (floorIndex === 0) {
    grid = unchargeStartingGrid(grid, floorIndex);
  }

  const enemyPlacement = placeEnemies(grid, rng, floorIndex, heroStart, exitCell);
  grid = enemyPlacement.grid;
  const enemies = enemyPlacement.enemies;

  const lattices = recomputeLattices(grid);

  return {
    index: floorIndex,
    grid,
    enemies,
    lattices,
    heroStart,
    exitCell,
    exitUnlocked: floorIndex > 0,
    turn: 0,
  };
}

/**
 * Enemy count scales with floor index. Capped to leave room for runes
 * on the small board (3×3 = 9 cells; reserves hero start + exit).
 */
function enemyCountForFloor(floorIndex: number, gridSize: number): number {
  const wanted = Math.min(floorIndex + 2, 4);
  // Leave at least 2 non-enemy candidate cells so runes can survive the
  // overwrite step — we want some lattice fuel on the board.
  const candidateCount = gridSize * gridSize - 2;
  return Math.max(0, Math.min(wanted, candidateCount - 2));
}

function placeEnemies(
  grid: Grid,
  rng: SeededRNG,
  floorIndex: number,
  heroStart: Cell,
  exitCell: Cell,
): { grid: Grid; enemies: Map<string, EnemyState> } {
  const enemies = new Map<string, EnemyState>();
  const count = enemyCountForFloor(floorIndex, grid.size);
  if (count <= 0) return { grid, enemies };

  const pool = pickTemplatePool(floorIndex);

  // Candidate cells: anything that isn't the hero start or the exit.
  // Prefer empty cells so we don't overwrite runes; fall back to any
  // candidate when there aren't enough empties.
  const allCandidates: Cell[] = [];
  const emptyCandidates: Cell[] = [];
  for (const { cell, tile } of grid.each()) {
    if (cellEq(cell, heroStart)) continue;
    if (cellEq(cell, exitCell)) continue;
    allCandidates.push(cell);
    if (tile.kind === "empty") emptyCandidates.push(cell);
  }
  const pool2 = emptyCandidates.length >= count ? emptyCandidates : allCandidates;
  if (pool2.length === 0) return { grid, enemies };

  const shuffled = rng.shuffle(pool2);
  const placements = Math.min(count, shuffled.length);

  let nextGrid = grid;
  for (let i = 0; i < placements; i++) {
    const cell = shuffled[i]!;
    const templateId = rng.pick(pool) as EnemyTemplateId;
    const template = ENEMY_TEMPLATES[templateId];
    const enemyId = `e-f${floorIndex}-${i}`;

    enemies.set(enemyId, {
      id: enemyId,
      templateId: template.templateId,
      archetype: template.archetype,
      position: cell,
      hp: template.hp,
      hpMax: template.hp,
      attack: template.attack,
      rune: template.rune,
      intent: null,
      modifiers: [],
    });

    nextGrid = nextGrid.set(
      cell,
      enemyTile(`f${floorIndex}-enemy-${i}`, enemyId, template.rune),
    );
  }

  return { grid: nextGrid, enemies };
}

function pickTemplatePool(floorIndex: number): readonly EnemyTemplateId[] {
  if (floorIndex === 0) return EASY_TEMPLATES;
  if (floorIndex === 1) return MEDIUM_TEMPLATES;
  return HARD_TEMPLATES;
}

function unchargeStartingGrid(grid: Grid, floorIndex: number): Grid {
  let next = grid;
  for (let pass = 0; pass < 50; pass++) {
    const snap = recomputeLattices(next);
    const charged = Array.from(snap.byId.values()).filter((l) => l.isCharged);
    if (charged.length === 0) return next;
    charged.sort((a, b) => {
      if (a.kind < b.kind) return -1;
      if (a.kind > b.kind) return 1;
      return a.index - b.index;
    });
    for (const lat of charged) {
      const cell = firstRuneCellInLattice(next, lat.kind, lat.index);
      if (!cell) continue;
      next = next.set(
        cell,
        emptyTile(`f${floorIndex}-demote-${pass}-${cell.x}-${cell.y}`),
      );
    }
  }
  return next;
}

function firstRuneCellInLattice(grid: Grid, kind: "row" | "column" | "chamber", index: number): Cell | null {
  switch (kind) {
    case "row": {
      const y = index;
      for (let x = 0; x < grid.size; x++) {
        const c = { x, y };
        if (grid.get(c).kind === "rune") return c;
      }
      return null;
    }
    case "column": {
      const x = index;
      for (let y = 0; y < grid.size; y++) {
        const c = { x, y };
        if (grid.get(c).kind === "rune") return c;
      }
      return null;
    }
    case "chamber": {
      const chambersPerRow = grid.size / grid.chamberSize;
      const cx = index % chambersPerRow;
      const cy = Math.floor(index / chambersPerRow);
      const x0 = cx * grid.chamberSize;
      const y0 = cy * grid.chamberSize;
      for (let dy = 0; dy < grid.chamberSize; dy++) {
        for (let dx = 0; dx < grid.chamberSize; dx++) {
          const c = { x: x0 + dx, y: y0 + dy };
          if (grid.get(c).kind === "rune") return c;
        }
      }
      return null;
    }
  }
}
