import { describe, it, expect } from "vitest";
import { applyInput } from "../src/sim/turn.js";
import { makeInitialRunState, DEFAULT_RUN_CONFIG } from "../src/run/state.js";
import { SMALL_GRID } from "../src/world/grid.js";
import { makeBlankRunState } from "./_helpers.js";

describe("default run config", () => {
  it("uses SMALL_GRID (3×3)", () => {
    expect(DEFAULT_RUN_CONFIG.gridDims).toEqual(SMALL_GRID);
    const state = makeInitialRunState({ seed: "DEF-01" });
    expect(state.currentFloor.grid.width).toBe(3);
    expect(state.currentFloor.grid.height).toBe(3);
  });

  it("hero stride is 1", () => {
    const state = makeInitialRunState({ seed: "DEF-02" });
    expect(state.hero.stride).toBe(1);
  });

  it("a 2-cell diagonal step is rejected with stride 1", () => {
    const state = makeInitialRunState({ seed: "DEF-03" });
    // Hero starts at heroStart (0, size-1). Try to move 2 cells diagonally.
    const from = state.hero.position;
    const to = { x: from.x + 2, y: from.y - 2 };
    const { state: next, events } = applyInput(state, { type: "MOVE", from, to });
    expect(next).toBe(state);
    expect(events[0]?.type).toBe("INPUT_REJECTED");
  });

  it("a 1-cell adjacent step is accepted", () => {
    // Use a blank state so we don't collide with auto-generated enemies.
    const state = makeBlankRunState({
      seed: "DEF-04",
      heroSpawn: { x: 0, y: 2 },
      dims: SMALL_GRID,
    });
    const from = state.hero.position;
    const to = { x: from.x, y: from.y - 1 };
    const { state: next, events } = applyInput(state, { type: "MOVE", from, to });
    expect(next.hero.position).toEqual(to);
    expect(events.some((e) => e.type === "HERO_MOVED")).toBe(true);
  });
});
