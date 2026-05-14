/**
 * Per-tile resolution: applied to each cell the hero traverses on a MOVE.
 *
 * Step 4 scope: rune tiles are CONSUMED on traversal and trigger a small
 * passive effect by rune type. Non-rune tiles are not yet implemented
 * (treasure, hazard, etc. land in step 5/6 alongside enemies).
 *
 * Passive effects (intentionally small — keystone bonuses are the big
 * payoff; passives are the slow drip):
 *   - Tide   → +1 Focus (capped)
 *   - Coin   → +1 Gold
 *   - Bone   → +1 HP (capped)
 *   - Iron   → +1 Armor (no cap)
 *   - Others → no resource gain, tile still consumed
 */

import type { Cell, ItemInstance, Rune } from "../core/types.js";
import type { GameEvent } from "../core/events.js";
import { emptyTile } from "../world/grid.js";
import type { RunState } from "../run/state.js";
import { grantXp } from "../entities/hero.js";

export type ResolveResult = {
  readonly state: RunState;
  readonly events: readonly GameEvent[];
};

export function resolveTileAt(state: RunState, cell: Cell): ResolveResult {
  const tile = state.currentFloor.grid.get(cell);
  if (tile.kind === "item" && tile.payload && tile.payload.kind === "item") {
    const item = tile.payload.item;
    if (!canAddItemToBag(state.hero.items, item)) {
      return {
        state,
        events: [{ type: "ITEM_PICKUP_BLOCKED", cell, itemKind: item.kind, reason: "bag_full" }],
      };
    }
    const newGrid = state.currentFloor.grid.set(
      cell,
      emptyTile(`item-${state.turn}-${cell.x}-${cell.y}`),
    );
    const nextHero = { ...state.hero, items: [...state.hero.items, item] };
    const nextMeta = { ...state.meta, score: state.meta.score + 50 };
    return {
      state: { ...state, hero: nextHero, meta: nextMeta, currentFloor: { ...state.currentFloor, grid: newGrid } },
      events: [{ type: "ITEM_PICKED_UP", cell, itemKind: item.kind }],
    };
  }
  if (tile.kind === "key") {
    const newGrid = state.currentFloor.grid.set(
      cell,
      emptyTile(`key-${state.turn}-${cell.x}-${cell.y}`),
    );
    return {
      state: {
        ...state,
        currentFloor: {
          ...state.currentFloor,
          grid: newGrid,
          exitUnlocked: true,
        },
      },
      events: [
        { type: "KEY_COLLECTED", cell },
        { type: "EXIT_UNLOCKED" },
      ],
    };
  }
  if (tile.kind !== "rune" || tile.rune === null) {
    return { state, events: [] };
  }

  const events: GameEvent[] = [{ type: "TILE_RESOLVED", cell, rune: tile.rune }];

  let nextHero = state.hero;
  let nextMeta = state.meta;
  let nextPassiveCounts = state.currentFloor.runePassiveCounts;
  nextMeta = { ...nextMeta, score: nextMeta.score + 10 };

  const xpResult = grantXp(nextHero, 2);
  nextHero = xpResult.hero;
  if (xpResult.levelsGained > 0) {
    events.push({ type: "HERO_LEVELED_UP", level: nextHero.level, hpMax: nextHero.hpMax });
  }

  if (tile.rune === "bramble") {
    let progress = nextHero.brambleProgress + 1;
    let potions = nextHero.potions;
    while (progress >= 3) {
      potions += 1;
      progress -= 3;
      events.push({ type: "POTION_GAINED", potions });
    }
    nextHero = { ...nextHero, brambleProgress: progress, potions };
  }

  switch (tile.rune) {
    case "tide": {
      const gain = Math.min(1, nextHero.focusMax - nextHero.focus);
      if (gain > 0 && canGainPassive(nextPassiveCounts, "tide")) {
        nextHero = { ...nextHero, focus: nextHero.focus + gain };
        events.push({ type: "FOCUS_GAINED", amount: gain });
        nextPassiveCounts = incPassive(nextPassiveCounts, "tide");
      }
      break;
    }
    case "coin": {
      if (canGainPassive(nextPassiveCounts, "coin")) {
        nextMeta = { ...nextMeta, gold: nextMeta.gold + 1 };
        events.push({ type: "GOLD_GAINED", amount: 1 });
        nextPassiveCounts = incPassive(nextPassiveCounts, "coin");
      }
      break;
    }
    case "bone": {
      const gain = Math.min(1, nextHero.hpMax - nextHero.hp);
      if (gain > 0 && canGainPassive(nextPassiveCounts, "bone")) {
        nextHero = { ...nextHero, hp: nextHero.hp + gain };
        events.push({ type: "HP_HEALED", amount: gain });
        nextPassiveCounts = incPassive(nextPassiveCounts, "bone");
      }
      break;
    }
    case "iron": {
      if (canGainPassive(nextPassiveCounts, "iron")) {
        nextHero = { ...nextHero, armor: nextHero.armor + 1 };
        events.push({ type: "ARMOR_GAINED", amount: 1 });
        nextPassiveCounts = incPassive(nextPassiveCounts, "iron");
      }
      break;
    }
    default:
      // ember, bramble, star, void, blood — consumed, no passive effect
      // until enemies/combat exist to interact with.
      break;
  }

  const newGrid = state.currentFloor.grid.set(
    cell,
    emptyTile(`consumed-${state.turn}-${cell.x}-${cell.y}`),
  );

  return {
    state: {
      ...state,
      hero: nextHero,
      meta: nextMeta,
      currentFloor: { ...state.currentFloor, grid: newGrid, runePassiveCounts: nextPassiveCounts },
    },
    events,
  };
}

function canAddItemToBag(existing: readonly ItemInstance[], item: ItemInstance): boolean {
  if (item.kind !== "sword" && item.kind !== "staff") return true;
  const weapons = existing.filter((it) => it.kind === "sword" || it.kind === "staff");
  const BAG_COLS = 4;
  const BAG_ROWS = 3;
  const occupied = Array.from({ length: BAG_ROWS }, () => Array.from({ length: BAG_COLS }, () => false));

  const sorted = [...weapons].sort((a, b) => a.id.localeCompare(b.id));
  for (const w of sorted) {
    const dims = weaponDims(w.kind);
    if (!placeFirstFit(occupied, BAG_COLS, BAG_ROWS, dims.w, dims.h)) return false;
  }
  const newDims = weaponDims(item.kind);
  return placeFirstFit(occupied, BAG_COLS, BAG_ROWS, newDims.w, newDims.h);
}

function weaponDims(kind: "sword" | "staff"): { w: number; h: number } {
  return kind === "sword" ? { w: 1, h: 2 } : { w: 2, h: 1 };
}

function placeFirstFit(
  occupied: boolean[][],
  cols: number,
  rows: number,
  w: number,
  h: number,
): boolean {
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!canPlace(occupied, cols, rows, x, y, w, h)) continue;
      for (let yy = y; yy < y + h; yy++) {
        for (let xx = x; xx < x + w; xx++) occupied[yy]![xx] = true;
      }
      return true;
    }
  }
  return false;
}

function canPlace(
  occupied: boolean[][],
  cols: number,
  rows: number,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  if (x < 0 || y < 0 || x + w > cols || y + h > rows) return false;
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      if (occupied[yy]![xx]!) return false;
    }
  }
  return true;
}

function canGainPassive(counts: Partial<Record<Rune, number>>, rune: Rune): boolean {
  const MAX = 2;
  const n = counts[rune] ?? 0;
  return n < MAX;
}

function incPassive(counts: Partial<Record<Rune, number>>, rune: Rune): Partial<Record<Rune, number>> {
  const n = (counts[rune] ?? 0) + 1;
  if (counts[rune] === n) return counts;
  return { ...counts, [rune]: n };
}
