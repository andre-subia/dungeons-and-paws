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
import { grantXp } from "../entities/hero.js";

const TIDE_KEYSTONE_HEAL_CAP = 3;
const COIN_KEYSTONE_GOLD = 10;
const BONE_KEYSTONE_HEAL = 2;
const IRON_KEYSTONE_ARMOR = 2;
const EMBER_KEYSTONE_ATTACK = 1;
const EMBER_KEYSTONE_ATTACK_MAX = 5;
const STAR_KEYSTONE_XP = 6;
const BLOOD_KEYSTONE_HP_MAX = 1;
const BLOOD_KEYSTONE_HP_MAX_CAP = 12;
const BLOOD_KEYSTONE_HEAL = 1;
const VOID_KEYSTONE_STRIDE_MAX = 2;

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
      const gain = Math.min(TIDE_KEYSTONE_HEAL_CAP, tideRunes, nextHero.hpMax - nextHero.hp);
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
    case "ember": {
      const before = nextHero.attack;
      const after = Math.min(EMBER_KEYSTONE_ATTACK_MAX, before + EMBER_KEYSTONE_ATTACK);
      nextHero = { ...nextHero, attack: after };
      effect = { kind: "ember", attackGained: after - before, attack: after };
      break;
    }
    case "bramble": {
      const canGain = nextHero.potions < nextHero.potionsMax;
      if (canGain) {
        nextHero = { ...nextHero, potions: nextHero.potions + 1 };
        events.push({
          type: "POTION_GAINED",
          potions: nextHero.potions,
          potionsMax: nextHero.potionsMax,
        });
      }
      effect = {
        kind: "bramble",
        potionGained: canGain,
        potions: nextHero.potions,
        potionsMax: nextHero.potionsMax,
      };
      break;
    }
    case "star": {
      const xpResult = grantXp(nextHero, STAR_KEYSTONE_XP);
      nextHero = xpResult.hero;
      if (xpResult.levelsGained > 0) {
        events.push({ type: "HERO_LEVELED_UP", level: nextHero.level, hpMax: nextHero.hpMax });
      }
      effect = { kind: "star", xpGained: STAR_KEYSTONE_XP, level: nextHero.level };
      break;
    }
    case "void": {
      const before = nextHero.stride;
      const after = Math.min(VOID_KEYSTONE_STRIDE_MAX, before + 1);
      nextHero = { ...nextHero, stride: after };
      effect = { kind: "void", strideGained: after - before, stride: after };
      break;
    }
    case "blood": {
      const hpMax = Math.min(BLOOD_KEYSTONE_HP_MAX_CAP, nextHero.hpMax + BLOOD_KEYSTONE_HP_MAX);
      const healed = Math.min(BLOOD_KEYSTONE_HEAL, hpMax - nextHero.hp);
      nextHero = { ...nextHero, hpMax, hp: nextHero.hp + healed };
      if (healed > 0) events.push({ type: "HP_HEALED", amount: healed });
      effect = { kind: "blood", hpMaxGained: hpMax - state.hero.hpMax, healed, hpMax };
      break;
    }
  }

  events.push({ type: "KEYSTONE_BONUS", lattice, keystone, effect });

  return {
    state: { ...state, hero: nextHero, meta: nextMeta },
    events,
  };
}
