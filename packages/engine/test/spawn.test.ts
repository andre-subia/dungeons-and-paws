import { describe, it, expect } from "vitest";
import { spawnEndOfTurnRune } from "../src/sim/spawn.js";
import { runeTile, STANDARD_GRID } from "../src/world/grid.js";
import { recomputeLattices } from "../src/world/lattice.js";
import { RUNES, type Rune } from "../src/core/types.js";
import { makeBlankRunState } from "./_helpers.js";

function runWithEnemy(seed: string) {
  const s = makeBlankRunState({ seed, heroSpawn: { x: 0, y: 0 }, dims: STANDARD_GRID });
  const enemies = new Map(s.currentFloor.enemies);
  enemies.set("e0", {
    id: "e0",
    templateId: "bat",
    archetype: "hunter",
    position: { x: 8, y: 8 },
    hp: 1,
    hpMax: 1,
    attack: 0,
    rune: "ember",
    intent: null,
    modifiers: [],
  });
  return { ...s, currentFloor: { ...s.currentFloor, enemies } };
}

function runNoEnemies(seed: string) {
  return makeBlankRunState({ seed, heroSpawn: { x: 0, y: 0 }, dims: STANDARD_GRID });
}

describe("spawnEndOfTurnRune", () => {
  it("places exactly one rune in an empty cell and emits RUNE_SPAWNED", () => {
    const state = runWithEnemy("GRD-SP-01");
    const result = spawnEndOfTurnRune(state);
    const spawned = result.events.filter((e) => e.type === "RUNE_SPAWNED");
    expect(spawned).toHaveLength(1);

    let runeCells = 0;
    for (const { tile } of result.state.currentFloor.grid.each()) {
      if (tile.kind === "rune") runeCells++;
    }
    expect(runeCells).toBe(1);
  });

  it("never spawns under the hero", () => {
    let state = runWithEnemy("GRD-SP-02");
    state = { ...state, hero: { ...state.hero, position: { x: 4, y: 4 } } };
    for (let i = 0; i < 30; i++) {
      const result = spawnEndOfTurnRune({ ...state, turn: i });
      expect(result.state.currentFloor.grid.get({ x: 4, y: 4 }).kind).toBe("empty");
    }
  });

  it("is deterministic across runs with the same (seed, turn)", () => {
    const a = spawnEndOfTurnRune(runWithEnemy("GRD-SP-DET"));
    const b = spawnEndOfTurnRune(runWithEnemy("GRD-SP-DET"));
    const aSpawn = a.events.find((e) => e.type === "RUNE_SPAWNED");
    const bSpawn = b.events.find((e) => e.type === "RUNE_SPAWNED");
    expect(aSpawn).toEqual(bSpawn);
  });

  it("does not spawn when there are no enemies left", () => {
    const state = runNoEnemies("GRD-SP-NOENEMY");
    const result = spawnEndOfTurnRune(state);
    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it("returns the input state when grid has no empty cells", () => {
    let state = runWithEnemy("GRD-SP-FULL");
    let g = state.currentFloor.grid;
    let i = 0;
    for (const { cell } of g.each()) {
      g = g.set(cell, runeTile(`f-${i++}`, "ember"));
    }
    const lattices = recomputeLattices(g);
    state = {
      ...state,
      currentFloor: { ...state.currentFloor, grid: g, lattices },
    };
    const result = spawnEndOfTurnRune(state);
    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it("biases toward the missing rune when spawn cell sits in an 8/9 lattice", () => {
    // We can't deterministically force the weighted pick to choose the
    // biased rune (it has ~50% probability with our weights), but we CAN
    // verify the bias is real by sampling many seeds and checking the
    // missing rune appears more often than chance.
    //
    // Setup: row 0 has 8 of 9 runes (missing "ember"). Empty cell at (4,0).
    // We sample 200 different (seed, turn) combos; the spawned rune at
    // (4,0) should be "ember" much more often than uniform 1/9 ≈ 11%.
    const baseRunes = RUNES.slice(1) as Rune[]; // 8 runes, missing "ember"
    let total = 0;
    let emberCount = 0;
    for (let i = 0; i < 200; i++) {
      let s = runWithEnemy(`GRD-SP-BIAS-${i}`);
      s = { ...s, hero: { ...s.hero, position: { x: 8, y: 8 } }, turn: i };
      let g = s.currentFloor.grid;
      let xPos = 0;
      for (let k = 0; k < baseRunes.length; k++) {
        if (xPos === 4) xPos++;
        g = g.set({ x: xPos, y: 0 }, runeTile(`pre-${k}`, baseRunes[k]!));
        xPos++;
      }
      for (const { cell, tile } of g.each()) {
        if (tile.kind !== "empty") continue;
        if (cell.x === 4 && cell.y === 0) continue;
        if (cell.x === 8 && cell.y === 8) continue;
        g = g.set(cell, runeTile(`fill-${cell.x}-${cell.y}`, "tide"));
      }
      const lattices = recomputeLattices(g);
      s = { ...s, currentFloor: { ...s.currentFloor, grid: g, lattices } };
      const result = spawnEndOfTurnRune(s);
      const sp = result.events.find((e) => e.type === "RUNE_SPAWNED");
      if (sp?.type === "RUNE_SPAWNED" && sp.cell.x === 4 && sp.cell.y === 0) {
        total++;
        if (sp.rune === "ember") emberCount++;
      }
    }
    expect(total).toBeGreaterThan(150);
    // Without bias: ember would be ~1/9 ≈ 11%. With our +6 bias: ~7/15 ≈ 47%.
    // Assert well above uniform baseline.
    expect(emberCount / total).toBeGreaterThan(0.3);
  });
});
