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
    const placed = placeNewItem(state.hero, item);
    if (!placed) {
      return {
        state,
        events: [{ type: "ITEM_PICKUP_BLOCKED", cell, itemKind: item.kind, reason: "bag_full" }],
      };
    }
    const newGrid = state.currentFloor.grid.set(
      cell,
      emptyTile(`item-${state.turn}-${cell.x}-${cell.y}`),
    );
    const nextHero = { ...state.hero, items: [...state.hero.items, item], bagLayout: placed.layout };
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
    const total = nextHero.brambleProgress + 1;
    const gained = Math.floor(total / 3);
    const progress = total % 3;

    let potionIds = nextHero.potionIds;
    let potionCounter = nextHero.potionCounter;
    let bagLayout = { ...nextHero.bagLayout };

    for (let i = progress; i < 2; i++) delete bagLayout[`leaf-${i}`];

    for (let i = 0; i < gained; i++) {
      const id = `potion-${potionCounter}`;
      potionCounter += 1;
      const placed = placeNewOneByOne(
        {
          ...nextHero,
          brambleProgress: progress,
          potionIds,
          potionCounter,
          bagLayout,
        },
        id,
      );
      if (!placed) continue;
      potionIds = [...potionIds, id];
      bagLayout = placed.layout;
      events.push({ type: "POTION_GAINED", potions: potionIds.length });
    }

    for (let i = 0; i < progress; i++) {
      const leafId = `leaf-${i}`;
      if (bagLayout[leafId]) continue;
      const placed = placeNewOneByOne(
        {
          ...nextHero,
          brambleProgress: i,
          potionIds,
          potionCounter,
          bagLayout,
        },
        leafId,
      );
      if (!placed) break;
      bagLayout = placed.layout;
    }

    nextHero = { ...nextHero, brambleProgress: progress, potionIds, potionCounter, bagLayout };
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

function weaponDims(kind: "sword" | "staff"): { w: number; h: number } {
  return kind === "sword" ? { w: 1, h: 2 } : { w: 2, h: 1 };
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

function occupy(occupied: boolean[][], x: number, y: number, w: number, h: number): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) occupied[yy]![xx] = true;
  }
}

function firstFitFrom(
  occupied: boolean[][],
  cols: number,
  rows: number,
  w: number,
  h: number,
  minY: number,
): { x: number; y: number } | null {
  for (let y = Math.max(0, Math.floor(minY)); y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (canPlace(occupied, cols, rows, x, y, w, h)) return { x, y };
    }
  }
  return null;
}

function occupiedFromExactBagLayout(hero: RunState["hero"], excludeId?: string): boolean[][] | null {
  const cols = 4;
  const rows = 3;
  const occupied = Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
  const layout = hero.bagLayout;

  for (const pid of hero.potionIds) {
    if (pid === excludeId) continue;
    const pos = layout[pid];
    if (!pos) return null;
    if (pos.x < 0 || pos.y < 0 || pos.x + 1 > cols || pos.y + 1 > rows) return null;
    if (occupied[pos.y]![pos.x]!) return null;
    occupied[pos.y]![pos.x] = true;
  }
  for (let i = 0; i < hero.brambleProgress; i++) {
    const lid = `leaf-${i}`;
    if (lid === excludeId) continue;
    const pos = layout[lid];
    if (!pos) continue;
    if (pos.x < 0 || pos.y < 0 || pos.x + 1 > cols || pos.y + 1 > rows) return null;
    if (occupied[pos.y]![pos.x]!) return null;
    occupied[pos.y]![pos.x] = true;
  }
  for (const it of hero.items) {
    if (it.kind !== "sword" && it.kind !== "staff") continue;
    if (it.id === excludeId) continue;
    const pos = layout[it.id];
    if (!pos) return null;
    const d = weaponDims(it.kind);
    if (!canPlace(occupied, cols, rows, pos.x, pos.y, d.w, d.h)) return null;
    occupy(occupied, pos.x, pos.y, d.w, d.h);
  }

  return occupied;
}

function placeNewOneByOne(hero: RunState["hero"], id: string): { layout: Record<string, { x: number; y: number }> } | null {
  const cols = 4;
  const rows = 3;
  const occupied = occupiedFromExactBagLayout(hero);
  if (!occupied) return null;
  const spot = firstFitFrom(occupied, cols, rows, 1, 1, 0);
  if (!spot) return null;
  return { layout: { ...hero.bagLayout, [id]: spot } };
}

function placeNewItem(hero: RunState["hero"], item: ItemInstance): { layout: Record<string, { x: number; y: number }> } | null {
  if (item.kind !== "sword" && item.kind !== "staff") return { layout: { ...hero.bagLayout } };
  const cols = 4;
  const rows = 3;
  const occupied = occupiedFromExactBagLayout(hero);
  if (!occupied) return null;
  const dims = weaponDims(item.kind);
  const spot = firstFitFrom(occupied, cols, rows, dims.w, dims.h, 0);
  if (!spot) return null;
  return { layout: { ...hero.bagLayout, [item.id]: spot } };
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
