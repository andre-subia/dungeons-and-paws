import { describe, it, expect } from "vitest";
import { applyInput } from "../src/sim/turn.js";
import { makeInitialRunState } from "../src/run/state.js";
import { generateFloor } from "../src/generation/floor.js";
import { PUZZLE_GRID } from "../src/world/grid.js";

function adjacentTo(c: { x: number; y: number }, w: number, h: number) {
  const candidates = [
    { x: c.x - 1, y: c.y },
    { x: c.x + 1, y: c.y },
    { x: c.x, y: c.y - 1 },
    { x: c.x, y: c.y + 1 },
  ];
  for (const k of candidates) {
    if (k.x >= 0 && k.x < w && k.y >= 0 && k.y < h) return k;
  }
  return c;
}

describe("floor advance + win", () => {
  it("generateFloor produces a floor with heroStart, exitCell and an exit tile", () => {
    const f = generateFloor("ADV-01", 0, PUZZLE_GRID);
    expect(f.index).toBe(0);
    // Hero is inset 1 cell from the bottom-left so the initial 3×3 viewport
    // contains 9 real cells (no void at game start).
    expect(f.heroStart).toEqual({ x: 1, y: PUZZLE_GRID.height - 2 });
    expect(f.exitCell).not.toEqual(f.heroStart);
    expect(f.grid.get(f.exitCell).kind).toBe("exit");
  });

  it("stepping onto the exit advances to the next floor", () => {
    const state = makeInitialRunState({ seed: "ADV-02" });
    const adjacent = adjacentTo(
      state.currentFloor.exitCell,
      state.currentFloor.grid.width,
      state.currentFloor.grid.height,
    );
    const stateAdjacent = {
      ...state,
      hero: { ...state.hero, position: adjacent },
      currentFloor: { ...state.currentFloor, exitUnlocked: true, exitRequiresKey: false },
    };
    const result = applyInput(stateAdjacent, {
      type: "MOVE",
      from: adjacent,
      to: state.currentFloor.exitCell,
    });
    expect(result.state.currentFloor.index).toBe(1);
    expect(result.events.some((e) => e.type === "FLOOR_COMPLETED")).toBe(true);
    // Hero should be repositioned to the new floor's start.
    expect(result.state.hero.position).toEqual(result.state.currentFloor.heroStart);
  });

  it("clearing the final floor sets outcome to win", () => {
    const state = makeInitialRunState({
      seed: "ADV-03",
      config: { maxFloors: 1 },
    });
    const adjacent = adjacentTo(
      state.currentFloor.exitCell,
      state.currentFloor.grid.width,
      state.currentFloor.grid.height,
    );
    const stateAdjacent = {
      ...state,
      hero: { ...state.hero, position: adjacent },
      currentFloor: { ...state.currentFloor, exitUnlocked: true, exitRequiresKey: false },
    };
    const result = applyInput(stateAdjacent, {
      type: "MOVE",
      from: adjacent,
      to: state.currentFloor.exitCell,
    });
    expect(result.state.outcome).toBe("win");
  });

  it("exit transition does NOT spawn a rune for that turn", () => {
    const state = makeInitialRunState({ seed: "ADV-04", config: { maxFloors: 2 } });
    const adjacent = adjacentTo(
      state.currentFloor.exitCell,
      state.currentFloor.grid.width,
      state.currentFloor.grid.height,
    );
    const stateAdjacent = {
      ...state,
      hero: { ...state.hero, position: adjacent },
      currentFloor: { ...state.currentFloor, exitUnlocked: true, exitRequiresKey: false },
    };
    const result = applyInput(stateAdjacent, {
      type: "MOVE",
      from: adjacent,
      to: state.currentFloor.exitCell,
    });
    expect(result.events.some((e) => e.type === "RUNE_SPAWNED")).toBe(false);
  });
});
