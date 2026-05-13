/**
 * Grid — flat array of Tiles representing the dungeon board.
 *
 * Stored row-major: index = y * width + x.
 * Supports rectangular boards (width × height).
 *
 * Mutations go through set() and return a new Grid (immutable from the
 * caller's perspective). Cloning is cheap because Tiles are shared by
 * reference until replaced.
 */

import type { Cell, Tile, Rune, ItemInstance } from "../core/types.js";

export type GridDimensions = {
  readonly width: number;
  readonly height: number;
  readonly chamberWidth: number;
  readonly chamberHeight: number;
};

export const STANDARD_GRID: GridDimensions = {
  width: 9,
  height: 9,
  chamberWidth: 3,
  chamberHeight: 3,
};
/**
 * 6x6 with a single chamber covering the whole grid.
 */
export const PUZZLE_GRID: GridDimensions = {
  width: 6,
  height: 6,
  chamberWidth: 6,
  chamberHeight: 6,
};
/**
 * 3x3 with one chamber covering the whole grid.
 */
export const SMALL_GRID: GridDimensions = {
  width: 3,
  height: 3,
  chamberWidth: 3,
  chamberHeight: 3,
};

export class Grid {
  readonly width: number;
  readonly height: number;
  readonly chamberWidth: number;
  readonly chamberHeight: number;
  private readonly cells: Tile[];

  constructor(dims: GridDimensions, cells: Tile[]) {
    if (cells.length !== dims.width * dims.height) {
      throw new Error(
        `Grid: expected ${dims.width * dims.height} cells, got ${cells.length}`,
      );
    }
    if (dims.width % dims.chamberWidth !== 0) {
      throw new Error(
        `Grid: width ${dims.width} not divisible by chamberWidth ${dims.chamberWidth}`,
      );
    }
    if (dims.height % dims.chamberHeight !== 0) {
      throw new Error(
        `Grid: height ${dims.height} not divisible by chamberHeight ${dims.chamberHeight}`,
      );
    }
    this.width = dims.width;
    this.height = dims.height;
    this.chamberWidth = dims.chamberWidth;
    this.chamberHeight = dims.chamberHeight;
    this.cells = cells;
  }

  static empty(dims: GridDimensions, tileFactory: (i: number) => Tile): Grid {
    const cells: Tile[] = new Array(dims.width * dims.height);
    for (let i = 0; i < cells.length; i++) cells[i] = tileFactory(i);
    return new Grid(dims, cells);
  }

  inBounds(c: Cell): boolean {
    return c.x >= 0 && c.x < this.width && c.y >= 0 && c.y < this.height;
  }

  private indexOf(c: Cell): number {
    if (!this.inBounds(c)) {
      throw new Error(`Grid: out of bounds (${c.x}, ${c.y})`);
    }
    return c.y * this.width + c.x;
  }

  get(c: Cell): Tile {
    return this.cells[this.indexOf(c)]!;
  }

  /** Returns a new Grid with cell c replaced by tile. */
  set(c: Cell, tile: Tile): Grid {
    const next = this.cells.slice();
    next[this.indexOf(c)] = tile;
    return new Grid(
      {
        width: this.width,
        height: this.height,
        chamberWidth: this.chamberWidth,
        chamberHeight: this.chamberHeight,
      },
      next,
    );
  }

  rowAt(y: number): Tile[] {
    if (y < 0 || y >= this.height) throw new Error(`rowAt: y=${y} out of range`);
    const out: Tile[] = [];
    for (let x = 0; x < this.width; x++) out.push(this.cells[y * this.width + x]!);
    return out;
  }

  colAt(x: number): Tile[] {
    if (x < 0 || x >= this.width) throw new Error(`colAt: x=${x} out of range`);
    const out: Tile[] = [];
    for (let y = 0; y < this.height; y++) out.push(this.cells[y * this.width + x]!);
    return out;
  }

  /** Index of the chamber containing cell c (row-major within the chamber grid). */
  chamberIndex(c: Cell): number {
    const cx = Math.floor(c.x / this.chamberWidth);
    const cy = Math.floor(c.y / this.chamberHeight);
    const chambersPerRow = this.width / this.chamberWidth;
    return cy * chambersPerRow + cx;
  }

  chamberAt(c: Cell): Tile[] {
    return this.chamberByIndex(this.chamberIndex(c));
  }

  chamberByIndex(idx: number): Tile[] {
    const chambersPerRow = this.width / this.chamberWidth;
    const chambersPerCol = this.height / this.chamberHeight;
    if (idx < 0 || idx >= chambersPerRow * chambersPerCol) {
      throw new Error(`chamberByIndex: idx=${idx} out of range`);
    }
    const cx = idx % chambersPerRow;
    const cy = Math.floor(idx / chambersPerRow);
    const x0 = cx * this.chamberWidth;
    const y0 = cy * this.chamberHeight;
    const out: Tile[] = [];
    for (let dy = 0; dy < this.chamberHeight; dy++) {
      for (let dx = 0; dx < this.chamberWidth; dx++) {
        out.push(this.cells[(y0 + dy) * this.width + (x0 + dx)]!);
      }
    }
    return out;
  }

  /** Number of chambers along the X axis. */
  get chamberCols(): number {
    return this.width / this.chamberWidth;
  }

  /** Number of chambers along the Y axis. */
  get chamberRows(): number {
    return this.height / this.chamberHeight;
  }

  /** Total chamber count. */
  get chamberCount(): number {
    return this.chamberCols * this.chamberRows;
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
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        yield { cell: { x, y }, tile: this.cells[y * this.width + x]! };
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

/** Convenience: a key tile (used to unlock exits on some floors). */
export function keyTile(id: string): Tile {
  return { id, kind: "key", rune: null, hidden: false, anchored: false };
}

/**
 * Convenience: an enemy tile.
 * The `rune` field is set to the enemy's rune so it counts toward
 * lattice charging; killing the enemy removes that contribution.
 */
export function enemyTile(id: string, enemyId: string, _rune: Rune): Tile {
  return {
    id,
    kind: "enemy",
    rune: null,
    hidden: false,
    anchored: false,
    payload: { kind: "enemy", enemyId },
  };
}

export function itemTile(id: string, item: ItemInstance): Tile {
  return {
    id,
    kind: "item",
    rune: null,
    hidden: false,
    anchored: false,
    payload: { kind: "item", item },
  };
}
