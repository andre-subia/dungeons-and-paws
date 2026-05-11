/**
 * Grid — flat array of Tiles representing the dungeon board.
 *
 * Stored row-major: index = y * size + x.
 * Default 9x9 with 3x3 chambers; puzzle floors use 6x6 with 2x2 chambers.
 *
 * Mutations go through set() and return a new Grid (immutable from the
 * caller's perspective). Cloning is cheap because Tiles are shared by
 * reference until replaced.
 */

import type { Cell, Tile, Rune } from "../core/types.js";

export type GridDimensions = {
  readonly size: number;
  readonly chamberSize: number;
};

export const STANDARD_GRID: GridDimensions = { size: 9, chamberSize: 3 };
/**
 * 6x6 with 3x3 chambers (2 chambers per axis = 4 chambers total).
 * Rows/cols charge at 6 unique runes (line length); chambers still need
 * 9 (full rune set). Easier rows/cols, harder chamber payoff.
 */
export const PUZZLE_GRID: GridDimensions = { size: 6, chamberSize: 3 };
/**
 * 3x3 with one chamber covering the whole grid. Rows/cols charge at 3
 * unique runes (very reachable); chamber needs all 9 runes (stretch goal
 * — only achievable across many turns of careful spawn timing).
 */
export const SMALL_GRID: GridDimensions = { size: 3, chamberSize: 3 };

export class Grid {
  readonly size: number;
  readonly chamberSize: number;
  private readonly cells: Tile[];

  constructor(dims: GridDimensions, cells: Tile[]) {
    if (cells.length !== dims.size * dims.size) {
      throw new Error(
        `Grid: expected ${dims.size * dims.size} cells, got ${cells.length}`,
      );
    }
    if (dims.size % dims.chamberSize !== 0) {
      throw new Error(
        `Grid: size ${dims.size} not divisible by chamberSize ${dims.chamberSize}`,
      );
    }
    this.size = dims.size;
    this.chamberSize = dims.chamberSize;
    this.cells = cells;
  }

  static empty(dims: GridDimensions, tileFactory: (i: number) => Tile): Grid {
    const cells: Tile[] = new Array(dims.size * dims.size);
    for (let i = 0; i < cells.length; i++) cells[i] = tileFactory(i);
    return new Grid(dims, cells);
  }

  inBounds(c: Cell): boolean {
    return c.x >= 0 && c.x < this.size && c.y >= 0 && c.y < this.size;
  }

  private indexOf(c: Cell): number {
    if (!this.inBounds(c)) {
      throw new Error(`Grid: out of bounds (${c.x}, ${c.y})`);
    }
    return c.y * this.size + c.x;
  }

  get(c: Cell): Tile {
    return this.cells[this.indexOf(c)]!;
  }

  /** Returns a new Grid with cell c replaced by tile. */
  set(c: Cell, tile: Tile): Grid {
    const next = this.cells.slice();
    next[this.indexOf(c)] = tile;
    return new Grid({ size: this.size, chamberSize: this.chamberSize }, next);
  }

  rowAt(y: number): Tile[] {
    if (y < 0 || y >= this.size) throw new Error(`rowAt: y=${y} out of range`);
    const out: Tile[] = [];
    for (let x = 0; x < this.size; x++) out.push(this.cells[y * this.size + x]!);
    return out;
  }

  colAt(x: number): Tile[] {
    if (x < 0 || x >= this.size) throw new Error(`colAt: x=${x} out of range`);
    const out: Tile[] = [];
    for (let y = 0; y < this.size; y++) out.push(this.cells[y * this.size + x]!);
    return out;
  }

  /** Index of the chamber containing cell c (row-major within the chamber grid). */
  chamberIndex(c: Cell): number {
    const cx = Math.floor(c.x / this.chamberSize);
    const cy = Math.floor(c.y / this.chamberSize);
    const chambersPerRow = this.size / this.chamberSize;
    return cy * chambersPerRow + cx;
  }

  chamberAt(c: Cell): Tile[] {
    return this.chamberByIndex(this.chamberIndex(c));
  }

  chamberByIndex(idx: number): Tile[] {
    const chambersPerRow = this.size / this.chamberSize;
    if (idx < 0 || idx >= chambersPerRow * chambersPerRow) {
      throw new Error(`chamberByIndex: idx=${idx} out of range`);
    }
    const cx = idx % chambersPerRow;
    const cy = Math.floor(idx / chambersPerRow);
    const x0 = cx * this.chamberSize;
    const y0 = cy * this.chamberSize;
    const out: Tile[] = [];
    for (let dy = 0; dy < this.chamberSize; dy++) {
      for (let dx = 0; dx < this.chamberSize; dx++) {
        out.push(this.cells[(y0 + dy) * this.size + (x0 + dx)]!);
      }
    }
    return out;
  }

  /** Number of chambers along one axis (3 for a 9x9). */
  get chambersPerAxis(): number {
    return this.size / this.chamberSize;
  }

  /** Total chamber count. */
  get chamberCount(): number {
    const n = this.chambersPerAxis;
    return n * n;
  }

  neighbors(c: Cell, includeDiagonal: boolean = true): Cell[] {
    const out: Cell[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (!includeDiagonal && dx !== 0 && dy !== 0) continue;
        const n: Cell = { x: c.x + dx, y: c.y + dy };
        if (this.inBounds(n)) out.push(n);
      }
    }
    return out;
  }

  /** Iterate every cell coordinate + tile. Read-only. */
  *each(): Generator<{ cell: Cell; tile: Tile }> {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        yield { cell: { x, y }, tile: this.cells[y * this.size + x]! };
      }
    }
  }

  /** Returns the underlying array as a snapshot copy (do not mutate). */
  toArray(): readonly Tile[] {
    return this.cells.slice();
  }
}

/** Convenience: a fresh empty tile. */
export function emptyTile(id: string): Tile {
  return { id, kind: "empty", rune: null, hidden: false, anchored: false };
}

/** Convenience: a fresh rune tile. */
export function runeTile(id: string, rune: Rune): Tile {
  return { id, kind: "rune", rune, hidden: false, anchored: false };
}

/** Convenience: an exit tile (advances to next floor on entry). */
export function exitTile(id: string): Tile {
  return { id, kind: "exit", rune: null, hidden: false, anchored: false };
}

/**
 * Convenience: an enemy tile.
 * The `rune` field is set to the enemy's rune so it counts toward
 * lattice charging; killing the enemy removes that contribution.
 */
export function enemyTile(id: string, enemyId: string, rune: Rune): Tile {
  return {
    id,
    kind: "enemy",
    rune,
    hidden: false,
    anchored: false,
    payload: { kind: "enemy", enemyId },
  };
}
