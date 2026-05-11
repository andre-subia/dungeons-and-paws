/**
 * Keystone bonus dispatch.
 *
 * When a Lattice charges, the rune that completed it (the keystone)
 * determines the bonus. This is the system's headline payoff and the
 * most extensible surface in the engine — every future relic, mutator,
 * and hero passive eventually reads from here.
 *
 * Step 4 implements the resource-grant keystones (Tide, Coin, Bone, Iron)
 * fully. Combat keystones (Ember, Bramble, Star, Void, Blood) emit a
 * descriptive KEYSTONE_BONUS event but do not yet apply effects, since
 * enemies don't exist in step 4.
 */

import type { LatticeId, Rune } from "../core/types.js";
import type { GameEvent, KeystoneBonusEffect } from "../core/events.js";
import type { RunState } from "../run/state.js";
import type { ResolveResult } from "./resolve.js";

const COIN_KEYSTONE_GOLD = 25;
const BONE_KEYSTONE_HEAL = 5;
const IRON_KEYSTONE_ARMOR = 5;

export function applyKeystone(
  state: RunState,
  lattice: LatticeId,
  keystone: Rune,
): ResolveResult {
  const events: GameEvent[] = [];
  let nextHero = state.hero;
  let nextMeta = state.meta;
  let effect: KeystoneBonusEffect = { kind: "pending" };

  switch (keystone) {
    case "tide": {
      // Per design §4.3: heal = min(5, Tide runes on grid, hpMax - hp).
      let tideRunes = 0;
      for (const { tile } of state.currentFloor.grid.each()) {
        if (tile.rune === "tide") tideRunes++;
      }
      const gain = Math.min(5, tideRunes, nextHero.hpMax - nextHero.hp);
      if (gain > 0) {
        nextHero = { ...nextHero, hp: nextHero.hp + gain };
        events.push({ type: "HP_HEALED", amount: gain });
      }
      effect = { kind: "tide", hpGained: gain, tideOnGrid: tideRunes };
      break;
    }
    case "coin": {
      nextMeta = { ...nextMeta, gold: nextMeta.gold + COIN_KEYSTONE_GOLD };
      events.push({ type: "GOLD_GAINED", amount: COIN_KEYSTONE_GOLD });
      effect = { kind: "coin", goldGained: COIN_KEYSTONE_GOLD };
      break;
    }
    case "bone": {
      const gain = Math.min(BONE_KEYSTONE_HEAL, nextHero.hpMax - nextHero.hp);
      if (gain > 0) {
        nextHero = { ...nextHero, hp: nextHero.hp + gain };
        events.push({ type: "HP_HEALED", amount: gain });
      }
      effect = { kind: "bone", hpGained: gain };
      break;
    }
    case "iron": {
      nextHero = { ...nextHero, armor: nextHero.armor + IRON_KEYSTONE_ARMOR };
      events.push({ type: "ARMOR_GAINED", amount: IRON_KEYSTONE_ARMOR });
      effect = { kind: "iron", armorGained: IRON_KEYSTONE_ARMOR };
      break;
    }
    case "ember":
      effect = { kind: "pending" };
      break;
    case "bramble":
      effect = { kind: "pending" };
      break;
    case "star":
      effect = { kind: "pending" };
      break;
    case "void":
      effect = { kind: "pending" };
      break;
    case "blood":
      effect = { kind: "pending" };
      break;
  }

  events.push({ type: "KEYSTONE_BONUS", lattice, keystone, effect });

  return {
    state: { ...state, hero: nextHero, meta: nextMeta },
    events,
  };
}
