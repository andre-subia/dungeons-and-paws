import { describe, it, expect } from "vitest";
import { resolveTileAt } from "../src/sim/resolve.js";
import { runeTile, STANDARD_GRID } from "../src/world/grid.js";
import { makeBlankRunState } from "./_helpers.js";
import type { Cell, Rune } from "../src/core/types.js";

function stateWithRuneAt(cell: Cell, rune: Rune) {
  const base = makeBlankRunState({
    seed: "GRD-RES-01",
    heroSpawn: { x: 0, y: 0 },
    dims: STANDARD_GRID,
  });
  const grid = base.currentFloor.grid.set(cell, runeTile("rt", rune));
  return {
    ...base,
    currentFloor: { ...base.currentFloor, grid },
  };
}

describe("resolveTileAt", () => {
  it("is a no-op for empty tiles", () => {
    const state = makeBlankRunState({ seed: "x", dims: STANDARD_GRID });
    const result = resolveTileAt(state, { x: 4, y: 4 });
    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it("Tide rune grants +1 focus and consumes the tile", () => {
    let state = stateWithRuneAt({ x: 1, y: 1 }, "tide");
    // Lower focus so the gain has somewhere to go.
    state = {
      ...state,
      hero: { ...state.hero, focus: 0 },
    };
    const result = resolveTileAt(state, { x: 1, y: 1 });
    expect(result.state.hero.focus).toBe(1);
    expect(result.state.currentFloor.grid.get({ x: 1, y: 1 }).kind).toBe("empty");
    expect(result.events.some((e) => e.type === "FOCUS_GAINED")).toBe(true);
    expect(result.events.some((e) => e.type === "TILE_RESOLVED")).toBe(true);
  });

  it("Tide does not exceed focusMax", () => {
    const state = stateWithRuneAt({ x: 1, y: 1 }, "tide");
    // Focus already at max in default state.
    const result = resolveTileAt(state, { x: 1, y: 1 });
    expect(result.state.hero.focus).toBe(state.hero.focus);
    expect(result.events.some((e) => e.type === "FOCUS_GAINED")).toBe(false);
  });

  it("Coin rune grants +1 gold", () => {
    const state = stateWithRuneAt({ x: 2, y: 2 }, "coin");
    const result = resolveTileAt(state, { x: 2, y: 2 });
    expect(result.state.meta.gold).toBe(state.meta.gold + 1);
  });

  it("Bone rune heals 1 HP capped at hpMax", () => {
    let state = stateWithRuneAt({ x: 3, y: 3 }, "bone");
    state = { ...state, hero: { ...state.hero, hp: state.hero.hpMax - 5 } };
    const result = resolveTileAt(state, { x: 3, y: 3 });
    expect(result.state.hero.hp).toBe(state.hero.hp + 1);
  });

  it("Iron rune adds 1 armor (no cap)", () => {
    const state = stateWithRuneAt({ x: 4, y: 4 }, "iron");
    const result = resolveTileAt(state, { x: 4, y: 4 });
    expect(result.state.hero.armor).toBe(state.hero.armor + 1);
  });

  it("Other runes are still consumed but grant no resources", () => {
    const state = stateWithRuneAt({ x: 5, y: 5 }, "ember");
    const result = resolveTileAt(state, { x: 5, y: 5 });
    expect(result.state.currentFloor.grid.get({ x: 5, y: 5 }).kind).toBe("empty");
    expect(result.state.hero.hp).toBe(state.hero.hp);
    expect(result.state.meta.gold).toBe(state.meta.gold);
  });
});
