/**
 * Run store — Zustand wrapper around the engine's RunState.
 *
 * The engine is the source of truth. This store merely holds the current
 * RunState and exposes actions that call applyInput and replace state.
 */

import { create } from "zustand";
import {
  applyInput,
  makeInitialRunState,
  type Cell,
  type GameEvent,
  type RunState,
} from "@gridlore/engine";

export type RunStore = {
  state: RunState;
  lastEvents: readonly GameEvent[];
  /** Attempt a move. Returns true if accepted. */
  move: (to: Cell) => boolean;
  /** Reset to a fresh run with a new seed. */
  reset: (seed?: string) => void;
};

const DEFAULT_SEED = "GRD-DEMO-01";

function freshRun(seed: string): RunState {
  return makeInitialRunState({ seed });
}

export const useRunStore = create<RunStore>((set, get) => ({
  state: freshRun(DEFAULT_SEED),
  lastEvents: [],
  move(to) {
    const { state } = get();
    if (state.outcome !== "in_progress") return false;
    const result = applyInput(state, {
      type: "MOVE",
      from: state.hero.position,
      to,
    });
    set({ state: result.state, lastEvents: result.events });
    return result.state !== state;
  },
  reset(seed = DEFAULT_SEED) {
    set({ state: freshRun(seed), lastEvents: [] });
  },
}));
