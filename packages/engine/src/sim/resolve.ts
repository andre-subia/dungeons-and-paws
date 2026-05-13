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

import type { Cell } from "../core/types.js";
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
      if (gain > 0) {
        nextHero = { ...nextHero, focus: nextHero.focus + gain };
        events.push({ type: "FOCUS_GAINED", amount: gain });
      }
      break;
    }
    case "coin": {
      nextMeta = { ...nextMeta, gold: nextMeta.gold + 1 };
      events.push({ type: "GOLD_GAINED", amount: 1 });
      break;
    }
    case "bone": {
      const gain = Math.min(1, nextHero.hpMax - nextHero.hp);
      if (gain > 0) {
        nextHero = { ...nextHero, hp: nextHero.hp + gain };
        events.push({ type: "HP_HEALED", amount: gain });
      }
      break;
    }
    case "iron": {
      nextHero = { ...nextHero, armor: nextHero.armor + 1 };
      events.push({ type: "ARMOR_GAINED", amount: 1 });
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
      currentFloor: { ...state.currentFloor, grid: newGrid },
    },
    events,
  };
}
