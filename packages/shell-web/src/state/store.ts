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
  /** Use a health potion. Returns true if accepted. */
  usePotion: () => boolean;
  /** Equip/unequip a weapon by item id (null to unequip). Returns true if accepted. */
  equipWeapon: (itemId: string | null) => boolean;
  /** Drop a weapon from inventory. Returns true if accepted. */
  dropItem: (itemId: string) => boolean;
  /** Tutorial-only: set starting potions to at least N. */
  boostTutorialPotions: (minPotions: number) => void;
  /** Tutorial-only: cap potions down to at most N. */
  capTutorialPotions: (maxPotions: number) => void;
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
  usePotion() {
    const { state } = get();
    if (state.outcome !== "in_progress") return false;
    const result = applyInput(state, { type: "USE_POTION" });
    set({ state: result.state, lastEvents: result.events });
    return result.state !== state;
  },
  equipWeapon(itemId) {
    const { state } = get();
    if (state.outcome !== "in_progress") return false;
    const result = applyInput(state, { type: "EQUIP_WEAPON", itemId });
    set({ state: result.state, lastEvents: result.events });
    return result.state !== state;
  },
  dropItem(itemId) {
    const { state } = get();
    if (state.outcome !== "in_progress") return false;
    const result = applyInput(state, { type: "DROP_ITEM", itemId });
    set({ state: result.state, lastEvents: result.events });
    return result.state !== state;
  },
  boostTutorialPotions(minPotions) {
    if (!Number.isFinite(minPotions)) return;
    const n = Math.max(0, Math.floor(minPotions));
    set((prev) => {
      const s = prev.state;
      if (s.outcome !== "in_progress") return prev;
      if (s.currentFloor.index !== 0) return prev;
      if (s.turn !== 0) return prev;
      if (s.hero.potions >= n) return prev;
      return { ...prev, state: { ...s, hero: { ...s.hero, potions: n } } };
    });
  },
  capTutorialPotions(maxPotions) {
    if (!Number.isFinite(maxPotions)) return;
    const n = Math.max(0, Math.floor(maxPotions));
    set((prev) => {
      const s = prev.state;
      if (s.outcome !== "in_progress") return prev;
      if (s.currentFloor.index !== 0) return prev;
      if (s.hero.potions <= n) return prev;
      return { ...prev, state: { ...s, hero: { ...s.hero, potions: n } } };
    });
  },
  reset(seed = DEFAULT_SEED) {
    set({ state: freshRun(seed), lastEvents: [] });
  },
}));
