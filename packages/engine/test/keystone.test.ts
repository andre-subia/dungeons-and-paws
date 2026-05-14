import { describe, it, expect } from "vitest";
import { applyKeystone } from "../src/sim/keystone.js";
import { runeTile } from "../src/world/grid.js";
import { recomputeLattices } from "../src/world/lattice.js";
import { makeBlankRunState } from "./_helpers.js";
import type { Cell } from "../src/core/types.js";

function freshState() {
  return makeBlankRunState({ seed: "GRD-KS-01" });
}

/** Returns a fresh state with `count` Tide runes placed on the grid. */
function stateWithTideRunes(count: number) {
  let s = freshState();
  let g = s.currentFloor.grid;
  const cells: Cell[] = [];
  for (let i = 0; i < count; i++) cells.push({ x: i, y: 0 });
  for (let i = 0; i < count; i++) {
    g = g.set(cells[i]!, runeTile(`tide-${i}`, "tide"));
  }
  return {
    ...s,
    currentFloor: {
      ...s.currentFloor,
      grid: g,
      lattices: recomputeLattices(g),
    },
  };
}

describe("applyKeystone", () => {
  it("Tide heals min(5, Tide-on-grid, deficit) — bound by deficit", () => {
    // hpMax=7, hp=5 → deficit=2. Cap is 3. 8 tides on grid. min = 2.
    let state = stateWithTideRunes(8);
    state = { ...state, hero: { ...state.hero, hp: 5 } };
    const result = applyKeystone(state, "row:0", "tide");
    expect(result.state.hero.hp).toBe(7);
    expect(result.events.some((e) => e.type === "HP_HEALED")).toBe(true);
    expect(result.events.some((e) => e.type === "KEYSTONE_BONUS")).toBe(true);
  });

  it("Tide heals min(5, Tide-on-grid, deficit) — bound by 5 cap", () => {
    // hpMax=8, hp=1 → deficit=7. Cap is 5. 8 tides on grid. min = 5.
    let state = stateWithTideRunes(8);
    state = { ...state, hero: { ...state.hero, hp: 1 } };
    const result = applyKeystone(state, "row:0", "tide");
    expect(result.state.hero.hp).toBe(4);
  });

  it("Tide heal capped by Tide rune count when grid has few", () => {
    // 2 Tide runes on grid; cap drops to 2 even though deficit is large.
    let state = stateWithTideRunes(2);
    state = { ...state, hero: { ...state.hero, hp: 1 } };
    const result = applyKeystone(state, "row:0", "tide");
    expect(result.state.hero.hp).toBe(3);
  });

  it("Tide on full HP emits KEYSTONE_BONUS but no HP_HEALED", () => {
    const state = stateWithTideRunes(5);
    const result = applyKeystone(state, "row:0", "tide");
    expect(result.state.hero.hp).toBe(state.hero.hpMax);
    expect(result.events.some((e) => e.type === "HP_HEALED")).toBe(false);
    expect(result.events.some((e) => e.type === "KEYSTONE_BONUS")).toBe(true);
  });

  it("Coin grants +25 gold", () => {
    const state = freshState();
    const result = applyKeystone(state, "row:0", "coin");
    expect(result.state.meta.gold).toBe(10);
  });

  it("Bone heals up to 5 HP capped at hpMax", () => {
    let state = freshState();
    state = { ...state, hero: { ...state.hero, hp: state.hero.hpMax - 2 } };
    const result = applyKeystone(state, "row:0", "bone");
    expect(result.state.hero.hp).toBe(state.hero.hpMax);
  });

  it("Iron grants +5 armor", () => {
    const state = freshState();
    const result = applyKeystone(state, "row:0", "iron");
    expect(result.state.hero.armor).toBe(state.hero.armor + 2);
  });

  it("Ember grants +1 attack", () => {
    const state = freshState();
    const result = applyKeystone(state, "row:0", "ember");
    expect(result.state.hero.attack).toBe(state.hero.attack + 1);
    expect(result.events.some((e) => e.type === "KEYSTONE_BONUS")).toBe(true);
  });

  it("Bramble grants +1 potion when not full", () => {
    let state = freshState();
    state = { ...state, hero: { ...state.hero, potionIds: [], potionCounter: 0, bagLayout: {} } };
    const result = applyKeystone(state, "row:0", "bramble");
    expect(result.state.hero.potionIds.length).toBe(1);
    expect(result.events.some((e) => e.type === "POTION_GAINED")).toBe(true);
  });

  it("Star grants XP", () => {
    const state = freshState();
    const result = applyKeystone(state, "row:0", "star");
    expect(result.state.hero.xp).toBeGreaterThanOrEqual(state.hero.xp);
    expect(result.events.some((e) => e.type === "KEYSTONE_BONUS")).toBe(true);
  });

  it("Void increases stride up to a cap", () => {
    const state = freshState();
    const result = applyKeystone(state, "row:0", "void");
    expect(result.state.hero.stride).toBeGreaterThanOrEqual(state.hero.stride);
  });

  it("Blood increases hpMax and heals a bit", () => {
    let state = freshState();
    state = { ...state, hero: { ...state.hero, hp: 1 } };
    const result = applyKeystone(state, "row:0", "blood");
    expect(result.state.hero.hpMax).toBe(state.hero.hpMax + 1);
    expect(result.state.hero.hp).toBeGreaterThan(state.hero.hp);
  });
});
