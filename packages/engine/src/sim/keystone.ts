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
      const cols = 4;
      const rows = 3;
      const occupied = Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
      const layout = nextHero.bagLayout;
      let ok = true;

      for (const pid of nextHero.potionIds) {
        const pos = layout[pid];
        if (!pos) {
          ok = false;
          break;
        }
        if (pos.x < 0 || pos.y < 0 || pos.x >= cols || pos.y >= rows) {
          ok = false;
          break;
        }
        if (occupied[pos.y]![pos.x]!) {
          ok = false;
          break;
        }
        occupied[pos.y]![pos.x] = true;
      }

      if (ok) {
        for (let i = 0; i < nextHero.brambleProgress; i++) {
          const lid = `leaf-${i}`;
          const pos = layout[lid];
          if (!pos) continue;
          if (pos.x < 0 || pos.y < 0 || pos.x >= cols || pos.y >= rows) continue;
          if (occupied[pos.y]![pos.x]!) {
            ok = false;
            break;
          }
          occupied[pos.y]![pos.x] = true;
        }
      }

      if (ok) {
        for (const it of nextHero.items) {
          if (it.kind !== "sword" && it.kind !== "staff") continue;
          const pos = layout[it.id];
          if (!pos) {
            ok = false;
            break;
          }
          const dims = it.kind === "sword" ? { w: 1, h: 2 } : { w: 2, h: 1 };
          if (pos.x < 0 || pos.y < 0 || pos.x + dims.w > cols || pos.y + dims.h > rows) {
            ok = false;
            break;
          }
          for (let yy = pos.y; yy < pos.y + dims.h; yy++) {
            for (let xx = pos.x; xx < pos.x + dims.w; xx++) {
              if (occupied[yy]![xx]!) {
                ok = false;
                break;
              }
              occupied[yy]![xx] = true;
            }
            if (!ok) break;
          }
          if (!ok) break;
        }
      }

      if (!ok) {
        effect = { kind: "bramble", potionGained: false, potions: nextHero.potionIds.length };
        break;
      }

      let spot: { x: number; y: number } | null = null;
      for (let y = 0; y < rows && !spot; y++) {
        for (let x = 0; x < cols; x++) {
          if (!occupied[y]![x]!) {
            spot = { x, y };
            break;
          }
        }
      }
      if (!spot) {
        effect = { kind: "bramble", potionGained: false, potions: nextHero.potionIds.length };
        break;
      }

      const id = `potion-${nextHero.potionCounter}`;
      const nextPotionIds = [...nextHero.potionIds, id];
      nextHero = {
        ...nextHero,
        potionIds: nextPotionIds,
        potionCounter: nextHero.potionCounter + 1,
        bagLayout: { ...nextHero.bagLayout, [id]: spot },
      };
      events.push({ type: "POTION_GAINED", potions: nextHero.potionIds.length });
      effect = {
        kind: "bramble",
        potionGained: true,
        potions: nextHero.potionIds.length,
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
