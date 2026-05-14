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
  usePotion: (potionId: string) => boolean;
  /** Equip/unequip a weapon by item id (null to unequip). Returns true if accepted. */
  equipWeapon: (itemId: string | null) => boolean;
  /** Drop an item from the bag. Returns true if accepted. */
  dropItem: (itemId: string) => boolean;
  /** Update the stored bag layout for a weapon. */
  setWeaponLayout: (itemId: string, x: number, y: number) => boolean;
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

const INITIAL_STATE = freshRun(DEFAULT_SEED);

function occupiedFromHeroLayout(hero: RunState["hero"]): boolean[][] | null {
  const cols = 4;
  const rows = 3;
  const occupied = Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
  const layout = hero.bagLayout;

  for (const pid of hero.potionIds) {
    const pos = layout[pid];
    if (!pos) return null;
    if (pos.x < 0 || pos.y < 0 || pos.x >= cols || pos.y >= rows) return null;
    if (occupied[pos.y]![pos.x]!) return null;
    occupied[pos.y]![pos.x] = true;
  }
  for (let i = 0; i < hero.brambleProgress; i++) {
    const lid = `leaf-${i}`;
    const pos = layout[lid];
    if (!pos) continue;
    if (pos.x < 0 || pos.y < 0 || pos.x >= cols || pos.y >= rows) continue;
    if (occupied[pos.y]![pos.x]!) return null;
    occupied[pos.y]![pos.x] = true;
  }
  for (const it of hero.items) {
    if (it.kind !== "sword" && it.kind !== "staff") continue;
    const pos = layout[it.id];
    if (!pos) return null;
    const dims = it.kind === "sword" ? { w: 1, h: 2 } : { w: 2, h: 1 };
    if (pos.x < 0 || pos.y < 0 || pos.x + dims.w > cols || pos.y + dims.h > rows) return null;
    for (let yy = pos.y; yy < pos.y + dims.h; yy++) {
      for (let xx = pos.x; xx < pos.x + dims.w; xx++) {
        if (occupied[yy]![xx]!) return null;
        occupied[yy]![xx] = true;
      }
    }
  }

  return occupied;
}

function firstFit(occupied: boolean[][], w: number, h: number): { x: number; y: number } | null {
  const rows = occupied.length;
  const cols = occupied[0]?.length ?? 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (x + w > cols || y + h > rows) continue;
      let ok = true;
      for (let yy = y; yy < y + h && ok; yy++) {
        for (let xx = x; xx < x + w; xx++) {
          if (occupied[yy]![xx]!) {
            ok = false;
            break;
          }
        }
      }
      if (ok) return { x, y };
    }
  }
  return null;
}

export const useRunStore = create<RunStore>((set, get) => ({
  state: INITIAL_STATE,
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
  usePotion(potionId) {
    const { state } = get();
    if (state.outcome !== "in_progress") return false;
    const result = applyInput(state, { type: "USE_POTION", potionId });
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
    const result = itemId.startsWith("potion-")
      ? applyInput(state, { type: "DROP_POTION", potionId: itemId })
      : itemId.startsWith("leaf-")
        ? applyInput(state, { type: "DROP_LEAF" })
        : applyInput(state, { type: "DROP_ITEM", itemId });
    set({ state: result.state, lastEvents: result.events });
    return result.state !== state;
  },
  setWeaponLayout(itemId, x, y) {
    const { state } = get();
    if (state.outcome !== "in_progress") return false;
    const result = applyInput(state, { type: "SET_WEAPON_LAYOUT", itemId, x, y });
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
      if (s.hero.potionIds.length >= n) return prev;

      const occupied = occupiedFromHeroLayout(s.hero);
      if (!occupied) return prev;

      let hero = s.hero;
      let potionIds = hero.potionIds;
      let potionCounter = hero.potionCounter;
      let bagLayout = { ...hero.bagLayout };
      let occ = occupied;

      while (potionIds.length < n) {
        const spot = firstFit(occ, 1, 1);
        if (!spot) break;
        const id = `potion-${potionCounter}`;
        potionCounter += 1;
        potionIds = [...potionIds, id];
        bagLayout[id] = spot;
        occ = occ.map((row) => [...row]);
        occ[spot.y]![spot.x] = true;
      }

      hero = { ...hero, potionIds, potionCounter, bagLayout };
      return { ...prev, state: { ...s, hero } };
    });
  },
  capTutorialPotions(maxPotions) {
    if (!Number.isFinite(maxPotions)) return;
    const n = Math.max(0, Math.floor(maxPotions));
    set((prev) => {
      const s = prev.state;
      if (s.outcome !== "in_progress") return prev;
      if (s.currentFloor.index !== 0) return prev;
      if (s.hero.potionIds.length <= n) return prev;
      const kept = s.hero.potionIds.slice(0, n);
      const nextLayout = { ...s.hero.bagLayout };
      for (const id of s.hero.potionIds) {
        if (!kept.includes(id)) delete nextLayout[id];
      }
      return { ...prev, state: { ...s, hero: { ...s.hero, potionIds: kept, bagLayout: nextLayout } } };
    });
  },
  reset(seed = DEFAULT_SEED) {
    const nextState = freshRun(seed);
    set({ state: nextState, lastEvents: [] });
  },
}));
