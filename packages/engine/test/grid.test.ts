import { describe, it, expect } from "vitest";
import {
  Grid,
  STANDARD_GRID,
  PUZZLE_GRID,
  emptyTile,
  runeTile,
} from "../src/world/grid.js";
import type { Cell } from "../src/core/types.js";

function makeGrid() {
  return Grid.empty(STANDARD_GRID, (i) => emptyTile(`t${i}`));
}

describe("Grid", () => {
  it("constructs a 9x9 with 81 empty tiles", () => {
    const g = makeGrid();
    expect(g.width).toBe(9);
    expect(g.height).toBe(9);
    expect(g.chamberWidth).toBe(3);
    expect(g.chamberHeight).toBe(3);
    let count = 0;
    for (const _ of g.each()) count++;
    expect(count).toBe(81);
  });

  it("supports puzzle dimensions (6x6 with a single chamber)", () => {
    const g = Grid.empty(PUZZLE_GRID, (i) => emptyTile(`p${i}`));
    expect(g.width).toBe(6);
    expect(g.height).toBe(6);
    expect(g.chamberWidth).toBe(6);
    expect(g.chamberHeight).toBe(6);
    expect(g.chamberCount).toBe(1);
  });

  it("rejects out-of-bounds get", () => {
    const g = makeGrid();
    expect(() => g.get({ x: -1, y: 0 })).toThrow();
    expect(() => g.get({ x: 9, y: 0 })).toThrow();
    expect(() => g.get({ x: 0, y: 9 })).toThrow();
  });

  it("set returns a new Grid without mutating the original", () => {
    const g = makeGrid();
    const target: Cell = { x: 4, y: 4 };
    const original = g.get(target);
    const g2 = g.set(target, runeTile("ember-tile", "ember"));
    expect(g.get(target)).toBe(original);
    expect(g2.get(target).rune).toBe("ember");
  });

  it("rowAt / colAt return 9 tiles each", () => {
    const g = makeGrid();
    expect(g.rowAt(3)).toHaveLength(9);
    expect(g.colAt(7)).toHaveLength(9);
  });

  it("chamberIndex maps cells correctly on a 9x9", () => {
    const g = makeGrid();
    expect(g.chamberIndex({ x: 0, y: 0 })).toBe(0);
    expect(g.chamberIndex({ x: 2, y: 2 })).toBe(0);
    expect(g.chamberIndex({ x: 3, y: 0 })).toBe(1);
    expect(g.chamberIndex({ x: 8, y: 8 })).toBe(8);
    expect(g.chamberIndex({ x: 4, y: 4 })).toBe(4);
  });

  it("chamberByIndex returns 9 tiles in row-major order", () => {
    const g = makeGrid();
    const c0 = g.chamberByIndex(0);
    expect(c0).toHaveLength(9);
  });

  it("neighbors excludes self and respects bounds", () => {
    const g = makeGrid();
    const corner = g.neighbors({ x: 0, y: 0 });
    expect(corner).toHaveLength(3); // only 3 in-bounds diag neighbors
    const center = g.neighbors({ x: 4, y: 4 });
    expect(center).toHaveLength(8);
    const orthOnly = g.neighbors({ x: 4, y: 4 }, false);
    expect(orthOnly).toHaveLength(4);
  });
});
