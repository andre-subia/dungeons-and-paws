import { describe, it, expect } from "vitest";
import { applyInput } from "../src/sim/turn.js";
import { type PlayerInput } from "../src/run/state.js";
import { chebyshevPath } from "../src/sim/path.js";
import { enemyTile, runeTile, STANDARD_GRID } from "../src/world/grid.js";
import { recomputeLattices } from "../src/world/lattice.js";
import { makeBlankRunState } from "./_helpers.js";

function newRun() {
  return makeBlankRunState({
    seed: "GRD-TURN-001",
    heroSpawn: { x: 4, y: 4 },
    dims: STANDARD_GRID,
  });
}

describe("turn pipeline — MOVE", () => {
  it("moves the hero to a tile within stride", () => {
    const s0 = newRun();
    const input: PlayerInput = {
      type: "MOVE",
      from: { x: 4, y: 4 },
      to: { x: 5, y: 5 },
    };
    const { state, events } = applyInput(s0, input);
    expect(state.hero.position).toEqual({ x: 5, y: 5 });
    expect(state.turn).toBe(1);
    expect(state.inputLog).toHaveLength(1);
    expect(events.find((e) => e.type === "HERO_MOVED")).toBeDefined();
  });

  it("rejects moves beyond stride", () => {
    const s0 = newRun();
    const { state, events } = applyInput(s0, {
      type: "MOVE",
      from: { x: 4, y: 4 },
      to: { x: 8, y: 8 },
    });
    expect(state).toBe(s0);
    expect(events[0]?.type).toBe("INPUT_REJECTED");
  });

  it("rejects moves with mismatched origin", () => {
    const s0 = newRun();
    const { state, events } = applyInput(s0, {
      type: "MOVE",
      from: { x: 0, y: 0 },
      to: { x: 1, y: 1 },
    });
    expect(state).toBe(s0);
    expect(events[0]?.type).toBe("INPUT_REJECTED");
  });

  it("rejects out-of-bounds destinations", () => {
    const s0 = newRun();
    const { state, events } = applyInput(s0, {
      type: "MOVE",
      from: { x: 4, y: 4 },
      to: { x: 4, y: 9 },
    });
    expect(state).toBe(s0);
    expect(events[0]?.type).toBe("INPUT_REJECTED");
  });

  it("rejects no-op moves", () => {
    const s0 = newRun();
    const { events } = applyInput(s0, {
      type: "MOVE",
      from: { x: 4, y: 4 },
      to: { x: 4, y: 4 },
    });
    expect(events[0]?.type).toBe("INPUT_REJECTED");
  });

  it("does not mutate the input state object", () => {
    const s0 = newRun();
    const before = JSON.stringify({
      pos: s0.hero.position,
      turn: s0.turn,
    });
    applyInput(s0, {
      type: "MOVE",
      from: { x: 4, y: 4 },
      to: { x: 4, y: 5 },
    });
    expect(JSON.stringify({ pos: s0.hero.position, turn: s0.turn })).toBe(before);
  });
});

describe("turn pipeline — full step-4 wiring", () => {
  it("consumes a rune tile in the path and credits the passive", () => {
    let s0 = newRun();
    s0 = {
      ...s0,
      hero: { ...s0.hero, focus: 0 },
      currentFloor: {
        ...s0.currentFloor,
        grid: s0.currentFloor.grid.set({ x: 5, y: 5 }, runeTile("t", "tide")),
      },
    };
    const { state, events } = applyInput(s0, {
      type: "MOVE",
      from: { x: 4, y: 4 },
      to: { x: 5, y: 5 },
    });
    expect(state.hero.focus).toBe(1);
    expect(state.currentFloor.grid.get({ x: 5, y: 5 }).kind).toBe("empty");
    expect(events.some((e) => e.type === "TILE_RESOLVED")).toBe(true);
    expect(events.some((e) => e.type === "FOCUS_GAINED")).toBe(true);
  });

  it("emits a RUNE_SPAWNED event after every accepted move", () => {
    let s0 = newRun();
    const enemies = new Map(s0.currentFloor.enemies);
    enemies.set("e0", {
      id: "e0",
      templateId: "bat",
      archetype: "hunter",
      position: { x: 0, y: 0 },
      hp: 1,
      hpMax: 1,
      attack: 0,
      rune: "ember",
      intent: null,
      modifiers: [],
    });
    s0 = {
      ...s0,
      currentFloor: {
        ...s0.currentFloor,
        enemies,
        grid: s0.currentFloor.grid.set({ x: 0, y: 0 }, enemyTile("e0t", "e0", "ember")),
      },
    };
    const { events } = applyInput(s0, {
      type: "MOVE",
      from: { x: 4, y: 4 },
      to: { x: 5, y: 5 },
    });
    expect(events.some((e) => e.type === "RUNE_SPAWNED")).toBe(true);
  });

  it("re-recomputes lattices after consume so a charged row decharges", () => {
    let s0 = newRun();
    // Pre-charge row 5 with all 9 runes via direct setup, then walk through (5,5).
    let g = s0.currentFloor.grid;
    const runes = ["ember","tide","bramble","iron","bone","star","void","coin","blood"] as const;
    for (let x = 0; x < 9; x++) {
      g = g.set({ x, y: 5 }, runeTile(`r5-${x}`, runes[x]!));
    }
    const lattices = recomputeLattices(g);
    expect(lattices.byId.get("row:5")?.isCharged).toBe(true);
    s0 = { ...s0, currentFloor: { ...s0.currentFloor, grid: g, lattices } };

    const { state, events } = applyInput(s0, {
      type: "MOVE",
      from: { x: 4, y: 4 },
      to: { x: 5, y: 5 },
    });
    // Row 5's tile at (5,5) was consumed → row should decharge.
    expect(state.currentFloor.lattices.byId.get("row:5")?.isCharged).toBe(false);
    expect(events.some((e) => e.type === "LATTICE_DECHARGED")).toBe(true);
  });
});

describe("chebyshevPath", () => {
  it("walks diagonally then straight", () => {
    const path = chebyshevPath({ x: 0, y: 0 }, { x: 3, y: 5 });
    expect(path).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
      { x: 3, y: 4 },
      { x: 3, y: 5 },
    ]);
  });

  it("is empty when from==to", () => {
    expect(chebyshevPath({ x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([]);
  });
});
