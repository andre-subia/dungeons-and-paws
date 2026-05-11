/**
 * Replay = fold(applyInput) over (initialState, inputLog).
 *
 * This is the bedrock of:
 *   - Server-side validation / anti-cheat
 *   - Replay scrubbing in the UI
 *   - Property-based determinism tests
 *   - Multiplayer sync (clients exchange inputs, not state)
 */

import { applyInput } from "../sim/turn.js";
import type { GameEvent } from "../core/events.js";
import { makeInitialRunState, type PlayerInput, type RunInit, type RunState } from "./state.js";

export type ReplayResult = {
  readonly finalState: RunState;
  readonly events: readonly GameEvent[];
};

/**
 * Replay a run from its seed and an input log. Returns the final state
 * and the full event stream emitted across all turns.
 */
export function replay(init: RunInit, inputLog: readonly PlayerInput[]): ReplayResult {
  let state = makeInitialRunState(init);
  const events: GameEvent[] = [];
  for (const input of inputLog) {
    const result = applyInput(state, input);
    state = result.state;
    for (const e of result.events) events.push(e);
  }
  return { finalState: state, events };
}
