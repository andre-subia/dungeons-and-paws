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

const RUNE_DENSITY = 0.55;
const MAX_GRID_DIM = 6;

export function generateFloor(
  seed: string,
  floorIndex: number,
  dims: GridDimensions,
): FloorState {
  const rng = new SeededRNG(`floor:${seed}:${floorIndex}`);
  const heroStart: Cell = { x: 0, y: dims.height - 1 };
  const exitCandidates: Cell[] = [];
  for (let y = 0; y < dims.height; y++) {
    for (let x = 0; x < dims.width; x++) {
      if (x === heroStart.x && y === heroStart.y) continue;
      exitCandidates.push({ x, y });
    }
  }
  const exitCell: Cell = rng.pick(exitCandidates);

  let grid = Grid.empty(dims, (i) => emptyTile(`f${floorIndex}-init-${i}`));

  for (let y = 0; y < dims.height; y++) {
    for (let x = 0; x < dims.width; x++) {
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

  const exitRequiresKey =
    floorIndex > 0 && enemies.size > 0 ? rng.next() < 0.35 : false;
  const keyEnemyId = exitRequiresKey ? (rng.pick(Array.from(enemies.keys())) as string) : null;

  return {
    index: floorIndex,
    grid,
    enemies,
    lattices,
    heroStart,
    exitCell,
    exitUnlocked: floorIndex > 0 && !exitRequiresKey,
    exitRequiresKey,
    keyEnemyId,
    turn: 0,
  };
}

/**
 * Enemy count scales with floor index. Capped to leave room for runes
 * on small boards (reserves hero start + exit + rune fuel).
 */
function enemyCountForFloor(floorIndex: number, width: number, height: number): number {
  const wanted = floorIndex < 3 ? 1 : floorIndex < 10 ? 2 : 3;
  const candidateCount = width * height - 2;
  const maxEnemies = Math.max(0, candidateCount - 4);
  return Math.max(0, Math.min(wanted, maxEnemies));
}

function placeEnemies(
  grid: Grid,
  rng: SeededRNG,
  floorIndex: number,
  heroStart: Cell,
  exitCell: Cell,
): { grid: Grid; enemies: Map<string, EnemyState> } {
  const enemies = new Map<string, EnemyState>();
  const count = enemyCountForFloor(floorIndex, grid.width, grid.height);
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
  if (floorIndex < 5) return EASY_TEMPLATES;
  if (floorIndex < 25) return MEDIUM_TEMPLATES;
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
      for (let x = 0; x < grid.width; x++) {
        const c = { x, y };
        if (grid.get(c).kind === "rune") return c;
      }
      return null;
    }
    case "column": {
      const x = index;
      for (let y = 0; y < grid.height; y++) {
        const c = { x, y };
        if (grid.get(c).kind === "rune") return c;
      }
      return null;
    }
    case "chamber": {
      const chambersPerRow = grid.chamberCols;
      const cx = index % chambersPerRow;
      const cy = Math.floor(index / chambersPerRow);
      const x0 = cx * grid.chamberWidth;
      const y0 = cy * grid.chamberHeight;
      for (let dy = 0; dy < grid.chamberHeight; dy++) {
        for (let dx = 0; dx < grid.chamberWidth; dx++) {
          const c = { x: x0 + dx, y: y0 + dy };
          if (grid.get(c).kind === "rune") return c;
        }
      }
      return null;
    }
  }
}

export function gridDimsForFloor(floorIndex: number, base: GridDimensions): GridDimensions {
  const steps = Math.floor(floorIndex / 10);
  let width = base.width;
  let height = base.height;

  for (let i = 1; i <= steps; i++) {
    if (width >= MAX_GRID_DIM && height >= MAX_GRID_DIM) break;
    if (i % 2 === 1) height = Math.min(MAX_GRID_DIM, height + 1);
    else width = Math.min(MAX_GRID_DIM, width + 1);
  }

  return {
    width,
    height,
    chamberWidth: width,
    chamberHeight: height,
  };
}
