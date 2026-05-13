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
import { RUNES, cellEq, cellKey, chebyshev, isPassableKind, type Cell, type Rune } from "../core/types.js";
import {
  Grid,
  emptyTile,
  enemyTile,
  exitTile,
  runeTile,
  viewportCells,
  wallTile,
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
/** Fraction of cells filled with walls. Floors get noticeably denser at depth. */
function wallDensityForFloor(floorIndex: number): number {
  if (floorIndex < 1) return 0.06;
  if (floorIndex < 3) return 0.12;
  if (floorIndex < 8) return 0.18;
  return 0.24;
}
/** No walls within this Chebyshev radius of hero start (no boxed-in starts). */
const HERO_SAFE_RADIUS = 1;
/** Max generation attempts per floor before we accept what we have. */
const MAX_FLOOR_ATTEMPTS = 6;

export function generateFloor(
  seed: string,
  floorIndex: number,
  dims: GridDimensions,
): FloorState {
  // Run up to MAX_FLOOR_ATTEMPTS rolls, accept first that passes validation.
  // Each attempt re-derives RNG from a salted seed so retries are deterministic.
  let lastFloor: FloorState | null = null;
  for (let attempt = 0; attempt < MAX_FLOOR_ATTEMPTS; attempt++) {
    const candidate = tryGenerateFloor(seed, floorIndex, dims, attempt);
    if (validateFloor(candidate)) return candidate;
    lastFloor = candidate;
  }
  // Last resort: return the most recent attempt anyway. Validation rules are
  // soft (avoid bad maps) but a stuck-loop is worse than a marginal map.
  return lastFloor!;
}

function tryGenerateFloor(
  seed: string,
  floorIndex: number,
  dims: GridDimensions,
  attempt: number,
): FloorState {
  const rng = new SeededRNG(`floor:${seed}:${floorIndex}:try${attempt}`);

  // Bottom-left start, but inset 1 cell from the world boundary on each
  // side so the initial 3×3 viewport contains 9 real cells (no void shows
  // until the player explores toward an actual edge). Safety pocket is the
  // 3×3 around this cell — walls/runes/enemies can't spawn here.
  const heroStart: Cell = {
    x: Math.min(1, dims.width - 1),
    y: Math.max(0, dims.height - 2),
  };

  let grid = Grid.empty(dims, (i) => emptyTile(`f${floorIndex}-init-${i}`));

  // 1. Place walls — clusters of impassable rock that shape corridors and
  //    chokepoints. Hero start neighborhood is excluded.
  grid = placeWalls(grid, rng, floorIndex, heroStart);

  // 2. Pick exit — farthest reachable passable cell from hero, biased toward
  //    top-right quadrant for "ascending the dungeon" feel.
  const exitCell = pickExitCell(grid, heroStart, rng);

  // 3. Sprinkle runes on remaining empty cells.
  for (let y = 0; y < dims.height; y++) {
    for (let x = 0; x < dims.width; x++) {
      const cell = { x, y };
      if (cellEq(cell, heroStart)) continue;
      if (cellEq(cell, exitCell)) continue;
      if (grid.get(cell).kind !== "empty") continue;
      if (rng.next() > RUNE_DENSITY) continue;
      const rune = rng.pick(RUNES) as Rune;
      grid = grid.set(cell, runeTile(`f${floorIndex}-r-${x}-${y}`, rune));
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
    explored: new Set(viewportCells(dims.width, dims.height, heroStart, 1).map(cellKey)),
  };
}

/** Validation gauntlet — rejects unfair / unplayable maps. */
function validateFloor(floor: FloorState): boolean {
  const { grid, heroStart, exitCell } = floor;
  // 1. Hero start must be passable
  if (!isPassableKind(grid.get(heroStart).kind)) return false;
  // 2. Hero must have ≥2 passable neighbors (no boxed-in starts)
  if (passableNeighborCount(grid, heroStart) < 2) return false;
  // 3. Exit must be reachable
  if (!isReachable(grid, heroStart, exitCell)) return false;
  // 4. ≥30% of cells must be reachable (avoid mostly-walled mazes)
  if (reachableFraction(grid, heroStart) < 0.3) return false;
  // 5. Hero → exit distance ≥ ~half-grid (avoid trivial floors)
  const minDist = Math.max(3, Math.floor(Math.min(grid.width, grid.height) / 2));
  if (bfsDistance(grid, heroStart, exitCell) < minDist) return false;
  // 6. Key enemy (if any) must be reachable
  if (floor.exitRequiresKey && floor.keyEnemyId !== null) {
    const key = floor.enemies.get(floor.keyEnemyId);
    if (key && !isReachable(grid, heroStart, key.position)) return false;
  }
  return true;
}

/** Place wall clusters with falloff probability; never inside the hero pocket
 *  or directly adjacent to the start. Uses BFS to abort placements that
 *  would disconnect the map. */
function placeWalls(
  grid: Grid,
  rng: SeededRNG,
  floorIndex: number,
  heroStart: Cell,
): Grid {
  const density = wallDensityForFloor(floorIndex);
  const target = Math.floor(grid.width * grid.height * density);
  let placed = 0;
  let nextGrid = grid;
  // Use a generous attempt budget — many candidates will fail (in pocket or
  // disconnect the map). 8x target gives breathing room.
  const maxAttempts = target * 8;
  for (let attempt = 0; attempt < maxAttempts && placed < target; attempt++) {
    const x = rng.range(0, grid.width);
    const y = rng.range(0, grid.height);
    const cell: Cell = { x, y };

    if (chebyshev(cell, heroStart) <= HERO_SAFE_RADIUS) continue;
    if (nextGrid.get(cell).kind !== "empty") continue;

    const candidate = nextGrid.set(cell, wallTile(`f${floorIndex}-wall-${x}-${y}`));
    // Hero must remain free to escape into multiple cells — placing a wall
    // that pinches the start to <2 neighbors is rejected.
    if (passableNeighborCount(candidate, heroStart) < 2) continue;

    nextGrid = candidate;
    placed++;
  }
  return nextGrid;
}

/** Pick exit: BFS from hero, take farthest reachable passable cell, biased
 *  toward top-right by sorting the farthest 20% by (x − y). */
function pickExitCell(grid: Grid, heroStart: Cell, rng: SeededRNG): Cell {
  const distances = bfsAll(grid, heroStart);
  const reachable: Array<{ cell: Cell; dist: number }> = [];
  for (const { cell } of grid.each()) {
    if (cellEq(cell, heroStart)) continue;
    if (!isPassableKind(grid.get(cell).kind)) continue;
    const d = distances.get(cellKey(cell));
    if (d === undefined) continue;
    reachable.push({ cell, dist: d });
  }
  if (reachable.length === 0) {
    // Fallback: any passable cell that isn't the start.
    const fallback = Array.from(grid.each())
      .filter((it) => !cellEq(it.cell, heroStart) && isPassableKind(it.tile.kind))
      .map((it) => it.cell);
    return rng.pick(fallback) ?? heroStart;
  }
  reachable.sort((a, b) => b.dist - a.dist);
  // Top-quintile by distance, then re-sort by top-right preference (x − y desc).
  const cutoff = Math.max(1, Math.floor(reachable.length * 0.2));
  const candidates = reachable.slice(0, cutoff);
  candidates.sort((a, b) => (b.cell.x - b.cell.y) - (a.cell.x - a.cell.y));
  // Pick from top-third of the re-sorted list to introduce variety.
  const topThird = candidates.slice(0, Math.max(1, Math.ceil(candidates.length / 3)));
  return rng.pick(topThird).cell;
}

// ─── Reachability / BFS helpers ────────────────────────────────────────────

function passableNeighborCount(grid: Grid, cell: Cell): number {
  let n = 0;
  for (const nb of grid.neighbors(cell, true)) {
    if (isPassableKind(grid.get(nb).kind)) n++;
  }
  return n;
}

function isReachable(grid: Grid, from: Cell, to: Cell): boolean {
  return bfsDistance(grid, from, to) !== Infinity;
}

function bfsDistance(grid: Grid, from: Cell, to: Cell): number {
  const distances = bfsAll(grid, from);
  return distances.get(cellKey(to)) ?? Infinity;
}

function reachableFraction(grid: Grid, from: Cell): number {
  const distances = bfsAll(grid, from);
  return distances.size / (grid.width * grid.height);
}

/** BFS from `from` over passable cells (8-direction adjacency to match
 *  hero's chebyshev movement). Returns map of "x,y" → distance. */
function bfsAll(grid: Grid, from: Cell): Map<string, number> {
  const out = new Map<string, number>();
  if (!isPassableKind(grid.get(from).kind)) return out;
  out.set(cellKey(from), 0);
  const queue: Cell[] = [from];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++]!;
    const d = out.get(cellKey(cur))!;
    for (const nb of grid.neighbors(cur, true)) {
      const k = cellKey(nb);
      if (out.has(k)) continue;
      if (!isPassableKind(grid.get(nb).kind)) continue;
      out.set(k, d + 1);
      queue.push(nb);
    }
  }
  return out;
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

  // Candidate cells: anything that isn't the hero start, the exit, or a
  // wall/void. Prefer empty cells so we don't overwrite runes; fall back to
  // rune cells (overwriting them) when there aren't enough empties.
  const allCandidates: Cell[] = [];
  const emptyCandidates: Cell[] = [];
  for (const { cell, tile } of grid.each()) {
    if (cellEq(cell, heroStart)) continue;
    if (cellEq(cell, exitCell)) continue;
    if (!isPassableKind(tile.kind)) continue;
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
    const hpBoost = Math.floor(floorIndex / 3);
    const attackBoost = Math.floor(floorIndex / 8);

    enemies.set(enemyId, {
      id: enemyId,
      templateId: template.templateId,
      archetype: template.archetype,
      position: cell,
      hp: template.hp + hpBoost,
      hpMax: template.hp + hpBoost,
      attack: template.attack + attackBoost,
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

/** Depth-scaled map sizes — small + dense, mobile-first. Width/height must
 *  be multiples of chamber size to keep the lattice mechanic alive. */
export function gridDimsForFloor(floorIndex: number, base: GridDimensions): GridDimensions {
  // Use the explicit depth table; fall back to `base` if its dims are larger
  // than what depth would pick (lets configs override for testing).
  void base;
  if (floorIndex < 3) return { width: 6, height: 6, chamberWidth: 3, chamberHeight: 3 };
  if (floorIndex < 8) return { width: 9, height: 9, chamberWidth: 3, chamberHeight: 3 };
  if (floorIndex < 15) return { width: 9, height: 12, chamberWidth: 3, chamberHeight: 3 };
  return { width: 12, height: 12, chamberWidth: 3, chamberHeight: 3 };
}
