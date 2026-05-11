import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { replay } from "../src/run/replay.js";
import { applyInput } from "../src/sim/turn.js";
import { makeInitialRunState, type PlayerInput, type RunState } from "../src/run/state.js";
import { SeededRNG } from "../src/core/rng.js";
import type { Cell } from "../src/core/types.js";

/**
 * Generates a sequence of plausible moves by simulating the engine to
 * pick legal destinations. This guarantees coverage instead of mostly
 * generating rejected inputs.
 */
function generateLegalMoves(seed: string, count: number): PlayerInput[] {
  const rng = new SeededRNG(`moves:${seed}`);
  let state = makeInitialRunState({ seed });
  const moves: PlayerInput[] = [];
  for (let i = 0; i < count; i++) {
    if (state.outcome !== "in_progress") break;
    const from = state.hero.position;
    const stride = state.hero.stride;
    const gridW = state.currentFloor.grid.width;
    const gridH = state.currentFloor.grid.height;
    const candidates: Cell[] = [];
    for (let dy = -stride; dy <= stride; dy++) {
      for (let dx = -stride; dx <= stride; dx++) {
        if (dx === 0 && dy === 0) continue;
        const c = { x: from.x + dx, y: from.y + dy };
        if (c.x < 0 || c.x >= gridW || c.y < 0 || c.y >= gridH) continue;
        candidates.push(c);
      }
    }
    if (candidates.length === 0) break;
    const to = rng.pick(candidates);
    const input: PlayerInput = { type: "MOVE", from, to };
    moves.push(input);
    state = applyInput(state, input).state;
  }
  return moves;
}

function stableHash(s: RunState): string {
  return JSON.stringify({
    pos: s.hero.position,
    hp: s.hero.hp,
    turn: s.turn,
    inputs: s.inputLog.length,
    floor: s.currentFloor.index,
    floorTurn: s.currentFloor.turn,
  });
}

describe("replay determinism", () => {
  it("two replays of the same seed + inputs produce the same final state", () => {
    const seed = "GRD-DET-01";
    const inputs = generateLegalMoves(seed, 50);
    const a = replay({ seed }, inputs);
    const b = replay({ seed }, inputs);
    expect(stableHash(a.finalState)).toBe(stableHash(b.finalState));
    expect(a.events.length).toBe(b.events.length);
  });

  it("property: random seeds replay identically across two runs", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 16 }),
        fc.integer({ min: 1, max: 60 }),
        (seed, n) => {
          const inputs = generateLegalMoves(seed, n);
          const a = replay({ seed }, inputs);
          const b = replay({ seed }, inputs);
          return stableHash(a.finalState) === stableHash(b.finalState);
        },
      ),
      { numRuns: 60 },
    );
  });
});
