/**
 * Bump combat: hero walks onto an enemy tile.
 *
 * Resolution:
 *   1. Hero deals `hero.attack` damage to the enemy.
 *   2. If the enemy survives, it retaliates for `enemy.attack`.
 *      - Hero armor absorbs first; remainder hits HP.
 *   3. If the enemy dies, its tile is replaced with empty (taking the
 *      enemy's rune off the lattice — combat reshapes the puzzle).
 *
 * Returns:
 *   - `state` — the new RunState (hero hp/armor + enemies map updated).
 *   - `events` — DAMAGE_DEALT / ENEMY_DAMAGED / ENEMY_KILLED / HERO_DAMAGED
 *   - `enemyKilled` — convenience flag so the turn pipeline knows whether
 *     the hero takes the cell.
 */

import type { Cell } from "../core/types.js";
import type { GameEvent } from "../core/events.js";
import { emptyTile, keyTile } from "../world/grid.js";
import type { RunState } from "../run/state.js";
import { grantXp } from "../entities/hero.js";

export type CombatResult = {
  readonly state: RunState;
  readonly events: readonly GameEvent[];
  readonly enemyKilled: boolean;
};

const HERO_ID = "hero";

export function resolveCombatAt(state: RunState, cell: Cell): CombatResult {
  return resolveCombatInternal(state, cell, true);
}

export function resolveCombatAtRanged(state: RunState, cell: Cell): CombatResult {
  return resolveCombatInternal(state, cell, false);
}

function resolveCombatInternal(state: RunState, cell: Cell, allowRetaliation: boolean): CombatResult {
  const tile = state.currentFloor.grid.get(cell);
  if (tile.kind !== "enemy" || !tile.payload || tile.payload.kind !== "enemy") {
    return { state, events: [], enemyKilled: false };
  }

  const hasKeyAlready = gridHasAnyKey(state.currentFloor.grid);
  const keyPolicy = state.currentFloor.keyPolicy;

  const enemyId = tile.payload.enemyId;
  const enemy = state.currentFloor.enemies.get(enemyId);
  if (!enemy) {
    // Stale tile referencing a missing enemy — clean it up.
    const dropsKey =
      state.currentFloor.exitRequiresKey &&
      !state.currentFloor.exitUnlocked &&
      !hasKeyAlready &&
      shouldDropKey(keyPolicy, state.currentFloor.keyEnemyId, enemyId, state.currentFloor.enemies.size);
    const shouldClearKeyEnemyId =
      state.currentFloor.keyEnemyId === enemyId ||
      (keyPolicy === "last_enemy" && state.currentFloor.enemies.size === 0);
    const grid = state.currentFloor.grid.set(
      cell,
      dropsKey
        ? keyTile(`key-${state.turn}-${cell.x}-${cell.y}`)
        : emptyTile(`stale-${state.turn}-${cell.x}-${cell.y}`),
    );
    return {
      state: {
        ...state,
        currentFloor: {
          ...state.currentFloor,
          grid,
          keyEnemyId: dropsKey || shouldClearKeyEnemyId ? null : state.currentFloor.keyEnemyId,
        },
      },
      events: dropsKey
        ? [{ type: "KEY_DROPPED", cell }, { type: "ENEMY_KILLED", enemyId, cell }]
        : [],
      enemyKilled: true,
    };
  }

  const events: GameEvent[] = [];
  const hero = state.hero;
  const meta = state.meta;

  const weapon = hero.equippedWeaponId ? hero.items.find((it) => it.id === hero.equippedWeaponId) : undefined;
  const weaponBonusAttack = weapon?.attackBonus ?? 0;

  // 1. Hero strikes.
  const damageToEnemy = hero.attack + weaponBonusAttack;
  const enemyHpAfter = Math.max(0, enemy.hp - damageToEnemy);
  events.push({
    type: "DAMAGE_DEALT",
    source: HERO_ID,
    target: enemyId,
    amount: damageToEnemy,
  });

  let nextEnemies = state.currentFloor.enemies;
  let nextGrid = state.currentFloor.grid;
  let nextHero = hero;
  let nextMeta = meta;
  let nextKeyEnemyId = state.currentFloor.keyEnemyId;
  let killed = false;

  if (weapon && "durability" in weapon) {
    const nextDur = weapon.durability - 1;
    if (nextDur <= 0) {
      nextHero = {
        ...nextHero,
        items: nextHero.items.filter((it) => it.id !== weapon.id),
        equippedWeaponId: null,
      };
      events.push({ type: "WEAPON_BROKE", itemKind: weapon.kind });
      events.push({ type: "WEAPON_EQUIPPED", itemKind: null });
    } else {
      nextHero = {
        ...nextHero,
        items: nextHero.items.map((it) => (it.id === weapon.id ? { ...weapon, durability: nextDur } : it)),
      };
    }
  }

  if (enemyHpAfter <= 0) {
    killed = true;
    const map = new Map(nextEnemies);
    map.delete(enemyId);
    nextEnemies = map;

    const dropsKey =
      state.currentFloor.exitRequiresKey &&
      !state.currentFloor.exitUnlocked &&
      !hasKeyAlready &&
      shouldDropKey(keyPolicy, state.currentFloor.keyEnemyId, enemyId, nextEnemies.size);
    nextGrid = nextGrid.set(
      cell,
      dropsKey
        ? keyTile(`key-${state.turn}-${cell.x}-${cell.y}`)
        : emptyTile(`killed-${state.turn}-${cell.x}-${cell.y}`),
    );
    events.push({ type: "ENEMY_KILLED", enemyId, cell });
    if (dropsKey) {
      events.push({ type: "KEY_DROPPED", cell });
    }
    if (state.currentFloor.keyEnemyId === enemyId || (keyPolicy === "last_enemy" && nextEnemies.size === 0)) {
      nextKeyEnemyId = null;
    }
    nextMeta = { ...nextMeta, score: nextMeta.score + 200 };

    const xpResult = grantXp(nextHero, 20);
    nextHero = xpResult.hero;
    if (xpResult.levelsGained > 0) {
      events.push({ type: "HERO_LEVELED_UP", level: nextHero.level, hpMax: nextHero.hpMax });
    }
  } else {
    const map = new Map(nextEnemies);
    map.set(enemyId, { ...enemy, hp: enemyHpAfter });
    nextEnemies = map;
    events.push({ type: "ENEMY_DAMAGED", enemyId, cell, hpAfter: enemyHpAfter });

    if (allowRetaliation) {
      // 2. Enemy retaliates.
      const incoming = enemy.attack;
      const absorbed = Math.min(hero.armor, incoming);
      const hpDamage = incoming - absorbed;
      const newArmor = hero.armor - absorbed;
      const newHp = Math.max(0, hero.hp - hpDamage);
      nextHero = { ...nextHero, armor: newArmor, hp: newHp };
      events.push({
        type: "DAMAGE_DEALT",
        source: enemyId,
        target: HERO_ID,
        amount: incoming,
      });
      events.push({
        type: "HERO_DAMAGED",
        amount: hpDamage,
        absorbed,
        hpAfter: newHp,
      });
    }
  }

  return {
    state: {
      ...state,
      hero: nextHero,
      meta: nextMeta,
      currentFloor: {
        ...state.currentFloor,
        grid: nextGrid,
        enemies: nextEnemies,
        keyEnemyId: nextKeyEnemyId,
      },
    },
    events,
    enemyKilled: killed,
  };
}

function gridHasAnyKey(grid: RunState["currentFloor"]["grid"]): boolean {
  for (const { tile } of grid.each()) {
    if (tile.kind === "key") return true;
  }
  return false;
}

function shouldDropKey(
  policy: RunState["currentFloor"]["keyPolicy"],
  keyEnemyId: string | null,
  enemyId: string,
  remainingEnemies: number,
): boolean {
  switch (policy) {
    case "assigned":
    case "reinforcement":
      return keyEnemyId !== null && keyEnemyId === enemyId;
    case "last_enemy":
      return remainingEnemies === 0;
    case "none":
      return false;
  }
}
