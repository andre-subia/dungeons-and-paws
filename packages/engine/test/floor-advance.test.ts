import { describe, it, expect } from "vitest";
import { applyInput } from "../src/sim/turn.js";
import { makeInitialRunState } from "../src/run/state.js";
import { generateFloor } from "../src/generation/floor.js";
import { PUZZLE_GRID } from "../src/world/grid.js";

describe("floor advance + win", () => {
  it("generateFloor produces a floor with heroStart, exitCell and an exit tile", () => {
    const f = generateFloor("ADV-01", 0, PUZZLE_GRID);
    expect(f.index).toBe(0);
    expect(f.heroStart).toEqual({ x: 0, y: PUZZLE_GRID.size - 1 });
    expect(f.exitCell).toEqual({ x: PUZZLE_GRID.size - 1, y: 0 });
    expect(f.grid.get(f.exitCell).kind).toBe("exit");
  });

  it("stepping onto the exit advances to the next floor", () => {
    const state = makeInitialRunState({ seed: "ADV-02" });
    // The exit is at (size-1, 0). Place hero adjacent so we can step on it.
    const adjacent = { x: state.currentFloor.exitCell.x - 1, y: 1 };
    const stateAdjacent = {
      ...state,
      hero: { ...state.hero, position: adjacent },
      currentFloor: { ...state.currentFloor, exitUnlocked: true },
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
    const adjacent = { x: state.currentFloor.exitCell.x - 1, y: 1 };
    const stateAdjacent = {
      ...state,
      hero: { ...state.hero, position: adjacent },
      currentFloor: { ...state.currentFloor, exitUnlocked: true },
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
    const adjacent = { x: state.currentFloor.exitCell.x - 1, y: 1 };
    const stateAdjacent = {
      ...state,
      hero: { ...state.hero, position: adjacent },
      currentFloor: { ...state.currentFloor, exitUnlocked: true },
    };
    const result = applyInput(stateAdjacent, {
      type: "MOVE",
      from: adjacent,
      to: state.currentFloor.exitCell,
    });
    expect(result.events.some((e) => e.type === "RUNE_SPAWNED")).toBe(false);
  });
});
