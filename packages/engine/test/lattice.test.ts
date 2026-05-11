import { describe, it, expect } from "vitest";
import { Grid, STANDARD_GRID, emptyTile, runeTile } from "../src/world/grid.js";
import { recomputeLattices, newlyDecharged } from "../src/world/lattice.js";
import { RUNES, type Rune } from "../src/core/types.js";
import { enemyTile } from "../src/world/grid.js";

function blankGrid() {
  return Grid.empty(STANDARD_GRID, (i) => emptyTile(`t${i}`));
}

/** Fills a row with all 9 runes; the rune at `keystoneIndex` is placed last. */
function fillRowWithAllRunes(g: Grid, y: number): Grid {
  let next = g;
  for (let x = 0; x < 9; x++) {
    const rune = RUNES[x] as Rune;
    next = next.set({ x, y }, runeTile(`row-${y}-${x}`, rune));
  }
  return next;
}

describe("LatticeTracker", () => {
  it("EMPTY_SNAPSHOT charges nothing", () => {
    const g = blankGrid();
    const snap = recomputeLattices(g);
    expect(snap.newlyCharged).toHaveLength(0);
    for (const lattice of snap.byId.values()) {
      expect(lattice.isCharged).toBe(false);
    }
  });

  it("charges a row when all 9 unique runes are present", () => {
    let g = blankGrid();
    g = fillRowWithAllRunes(g, 4);
    const snap = recomputeLattices(g);
    const row4 = snap.byId.get("row:4");
    expect(row4?.isCharged).toBe(true);
    expect(row4?.runesPresent.size).toBe(9);
    expect(snap.newlyCharged.some((l) => l.id === "row:4")).toBe(true);
  });

  it("identifies the keystone as the rune absent from the prior snapshot", () => {
    let g = blankGrid();
    // First place 8 of 9 runes in row 0.
    for (let x = 0; x < 8; x++) {
      g = g.set({ x, y: 0 }, runeTile(`t${x}`, RUNES[x] as Rune));
    }
    const snap1 = recomputeLattices(g);
    expect(snap1.byId.get("row:0")?.isCharged).toBe(false);

    // Add the 9th. Should charge with that rune as keystone.
    const ninth = RUNES[8] as Rune;
    g = g.set({ x: 8, y: 0 }, runeTile("t8", ninth));
    const snap2 = recomputeLattices(g, snap1);
    const row0 = snap2.byId.get("row:0");
    expect(row0?.isCharged).toBe(true);
    expect(row0?.keystone).toBe(ninth);
    expect(snap2.newlyCharged).toHaveLength(1);
  });

  it("does not re-emit newlyCharged for an already-charged lattice", () => {
    let g = blankGrid();
    g = fillRowWithAllRunes(g, 1);
    const snap1 = recomputeLattices(g);
    const snap2 = recomputeLattices(g, snap1);
    expect(snap2.byId.get("row:1")?.isCharged).toBe(true);
    expect(snap2.newlyCharged).toHaveLength(0);
  });

  it("decharges when a rune becomes absent and emits via newlyDecharged", () => {
    let g = blankGrid();
    g = fillRowWithAllRunes(g, 2);
    const snap1 = recomputeLattices(g);
    expect(snap1.byId.get("row:2")?.isCharged).toBe(true);

    // Remove one rune.
    g = g.set({ x: 4, y: 2 }, emptyTile("emptied"));
    const snap2 = recomputeLattices(g, snap1);
    expect(snap2.byId.get("row:2")?.isCharged).toBe(false);
    expect(newlyDecharged(snap1, snap2)).toContain("row:2");
  });

  it("can charge a chamber via 3x3 placement", () => {
    let g = blankGrid();
    let i = 0;
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        g = g.set({ x: dx, y: dy }, runeTile(`c-${dx}-${dy}`, RUNES[i] as Rune));
        i++;
      }
    }
    const snap = recomputeLattices(g);
    expect(snap.byId.get("chamber:0")?.isCharged).toBe(true);
  });

  it("does not count enemy tiles toward rune sets", () => {
    let g = blankGrid();
    g = g
      .set({ x: 0, y: 0 }, enemyTile("e0", "e0", "ember"))
      .set({ x: 1, y: 0 }, enemyTile("e1", "e1", "tide"))
      .set({ x: 2, y: 0 }, enemyTile("e2", "e2", "bone"));
    const snap = recomputeLattices(g);
    const row0 = snap.byId.get("row:0");
    expect(row0?.runesPresent.size).toBe(0);
    expect(row0?.isCharged).toBe(false);
  });
});
