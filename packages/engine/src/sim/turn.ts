/**
 * Turn pipeline. Single entry point: applyInput.
 *
 * Pure: applyInput(state, input) → next state + events. No Math.random,
 * no Date.now, no DOM. Determinism guaranteed by routing all randomness
 * through SeededRNG keyed off (seed, turn).
 *
 * Step 4 pipeline for MOVE:
 *   1. Validate input
 *   2. Resolve each cell in the path (consume rune tiles + passive effects)
 *   3. Update hero position
 *   4. Recompute lattices → emit decharge events
 *   5. Bump turn counter
 *   6. Dungeon spawn → emit RUNE_SPAWNED, possibly LATTICE_CHARGED + KEYSTONE_BONUS
 *   7. Append input to log
 *
 * ABILITY and END_FLOOR remain stubbed; they ship in step 5.
 */

import { chebyshev, cellEq, type Cell } from "../core/types.js";
import type { GameEvent } from "../core/events.js";
import { newlyDecharged, recomputeLattices } from "../world/lattice.js";
import { chebyshevPath } from "./path.js";
import { resolveTileAt } from "./resolve.js";
import { spawnEndOfTurnRune } from "./spawn.js";
import { resolveCombatAt, resolveCombatAtRanged } from "./combat.js";
import { runEnemyTurn } from "./enemy-turn.js";
import { generateFloor, gridDimsForFloor } from "../generation/floor.js";
import type { PlayerInput, RunState } from "../run/state.js";
import { grantXp } from "../entities/hero.js";
import { keyTile } from "../world/grid.js";

export type TurnResult = {
  readonly state: RunState;
  readonly events: readonly GameEvent[];
};

export function applyInput(state: RunState, input: PlayerInput): TurnResult {
  if (state.outcome !== "in_progress") {
    return reject(state, "run_over", { outcome: state.outcome }, `Run is over (${state.outcome})`);
  }

  switch (input.type) {
    case "MOVE":
      return applyMove(state, input.from, input.to);
    case "USE_POTION":
      return applyUsePotion(state);
    case "EQUIP_WEAPON":
      return applyEquipWeapon(state, input.itemId);
    case "ABILITY":
      return reject(state, "ability_unimplemented", undefined, "ABILITY not implemented yet");
    case "END_FLOOR":
      return reject(state, "end_floor_unimplemented", undefined, "END_FLOOR not implemented yet");
  }
}

function reject(
  state: RunState,
  reasonKey: string,
  details?: Readonly<Record<string, string | number>>,
  debugReason?: string,
): TurnResult {
  return { state, events: [{ type: "INPUT_REJECTED", reasonKey, details, debugReason }] };
}

function applyMove(state: RunState, from: Cell, to: Cell): TurnResult {
  const { hero, currentFloor } = state;
  const { grid } = currentFloor;

  if (!cellEq(hero.position, from)) {
    return reject(state, "move_origin_mismatch", undefined, "Move origin does not match hero position");
  }
  if (!grid.inBounds(to)) return reject(state, "destination_oob", undefined, "Destination out of bounds");
  if (cellEq(from, to)) {
    const here = grid.get(from);
    if (here.kind !== "key") {
      return reject(state, "destination_same", undefined, "Destination equals origin");
    }
  }

  const destTile = grid.get(to);
  const hasStaffEquipped = hero.equippedWeaponId
    ? hero.items.some((it) => it.id === hero.equippedWeaponId && it.kind === "staff")
    : false;
  const STAFF_RANGE = 3;
  const distance = chebyshev(from, to);
  const canRangedAttack =
    hasStaffEquipped && destTile.kind === "enemy" && distance <= STAFF_RANGE && hasClearLine(grid, from, to);
  if (distance > hero.stride && !canRangedAttack) {
    return reject(
      state,
      "destination_beyond_stride",
      { distance, stride: hero.stride },
      `Destination beyond stride (${distance} > ${hero.stride})`,
    );
  }

  if (destTile.anchored) return reject(state, "destination_anchored", undefined, "Destination is anchored");
  if (destTile.kind === "exit" && !currentFloor.exitUnlocked) {
    return reject(
      state,
      currentFloor.exitRequiresKey ? "exit_locked_key" : "exit_locked",
      undefined,
      "Exit is locked",
    );
  }

  const path = chebyshevPath(from, to);
  const events: GameEvent[] = [{ type: "TURN_STARTED", turn: state.turn + 1 }];
  let skipEnemyIds: Set<string> | undefined;

  // 1. Resolve each path cell EXCEPT the destination — unless this is a ranged
  //    staff strike, in which case we don't traverse intermediate tiles.
  let nextState: RunState = state;
  if (!canRangedAttack) {
    for (let i = 0; i < path.length - 1; i++) {
      const cell = path[i]!;
      const result = resolveTileAt(nextState, cell);
      nextState = result.state;
      for (const e of result.events) events.push(e);
    }
  }

  // 1b. Destination dispatch.
  const destIsExit = destTile.kind === "exit";
  const destIsEnemy = destTile.kind === "enemy";
  let heroEntersDest = !destIsEnemy; // exit/empty/rune always enter; enemy depends on kill
  if (canRangedAttack) heroEntersDest = false;

  if (destIsEnemy) {
    const destEnemyId =
      destTile.payload && destTile.payload.kind === "enemy" ? destTile.payload.enemyId : null;
    const shouldDropKeyHere =
      destEnemyId !== null &&
      currentFloor.exitRequiresKey &&
      !currentFloor.exitUnlocked &&
      currentFloor.keyEnemyId === destEnemyId;

    const combat = canRangedAttack ? resolveCombatAtRanged(nextState, to) : resolveCombatAt(nextState, to);
    nextState = combat.state;
    for (const e of combat.events) events.push(e);
    heroEntersDest = canRangedAttack ? false : combat.enemyKilled;

    if (combat.enemyKilled && shouldDropKeyHere) {
      if (nextState.currentFloor.grid.get(to).kind !== "key") {
        nextState = {
          ...nextState,
          currentFloor: {
            ...nextState.currentFloor,
            grid: nextState.currentFloor.grid.set(to, keyTile(`key-${state.turn}-${to.x}-${to.y}`)),
            keyEnemyId: null,
          },
        };
      }
      const alreadyDropped = events.some(
        (e) => e.type === "KEY_DROPPED" && cellEq(e.cell, to),
      );
      if (!alreadyDropped) events.push({ type: "KEY_DROPPED", cell: to });
      heroEntersDest = false;
    } else if (heroEntersDest && nextState.currentFloor.grid.get(to).kind === "key") {
      heroEntersDest = false;
    }

    if (!combat.enemyKilled && destEnemyId !== null) {
      skipEnemyIds = new Set([destEnemyId]);
    }
  } else if (!destIsExit) {
    const result = resolveTileAt(nextState, to);
    nextState = result.state;
    for (const e of result.events) events.push(e);
  }

  // 2. Move the hero into the destination if appropriate.
  if (heroEntersDest) {
    nextState = {
      ...nextState,
      hero: { ...nextState.hero, position: to },
    };
    if (!cellEq(from, to)) {
      events.push({ type: "HERO_MOVED", from, to, path });
    }
  }

  // 3. Bump turn counter (so spawn RNG / death event use the new turn).
  nextState = {
    ...nextState,
    turn: state.turn + 1,
    currentFloor: {
      ...nextState.currentFloor,
      turn: nextState.currentFloor.turn + 1,
    },
  };

  // 4. Hero death from combat retaliation short-circuits the rest.
  if (nextState.hero.hp <= 0) {
    nextState = {
      ...nextState,
      outcome: "death",
      inputLog: [...nextState.inputLog, { type: "MOVE", from, to }],
    };
    events.push({ type: "HERO_DIED", atTurn: nextState.turn });
    return { state: nextState, events };
  }

  // 5. Floor transition on exit; otherwise normal end-of-turn.
  if (destIsExit && heroEntersDest) {
    nextState = transitionFloor(nextState, events);
  } else {
    // 5a. Enemy turn — each enemy moves toward hero or attacks if adjacent.
    const enemyTurn = runEnemyTurn(nextState, { skipEnemyIds });
    nextState = enemyTurn.state;
    for (const e of enemyTurn.events) events.push(e);

    // 5b. Hero may have died from an enemy attack.
    if (nextState.outcome === "death") {
      nextState = {
        ...nextState,
        inputLog: [...nextState.inputLog, { type: "MOVE", from, to }],
      };
      return { state: nextState, events };
    }

    // 5c. Recompute lattices after consume / kills / enemy moves.
    const prevLat = state.currentFloor.lattices;
    const postLat = recomputeLattices(nextState.currentFloor.grid, prevLat);
    for (const id of newlyDecharged(prevLat, postLat)) {
      events.push({ type: "LATTICE_DECHARGED", lattice: id });
    }
    nextState = {
      ...nextState,
      currentFloor: { ...nextState.currentFloor, lattices: postLat },
    };

    if (
      nextState.currentFloor.index === 0 &&
      !nextState.currentFloor.exitUnlocked &&
      hasAnyChargedLattice(postLat)
    ) {
      events.push({ type: "EXIT_UNLOCKED" });
      nextState = {
        ...nextState,
        currentFloor: { ...nextState.currentFloor, exitUnlocked: true },
      };
    }

    // 5d. Dungeon spawn — falls back to no-op if enemies filled the empties.
    const spawnResult = spawnEndOfTurnRune(nextState);
    nextState = spawnResult.state;
    for (const e of spawnResult.events) events.push(e);
  }

  // 6. Append input to log.
  nextState = {
    ...nextState,
    inputLog: [...nextState.inputLog, { type: "MOVE", from, to }],
  };

  return { state: nextState, events };
}

function applyUsePotion(state: RunState): TurnResult {
  const { hero } = state;
  if (hero.potions <= 0) return reject(state, "no_potions", undefined, "No potions");
  if (hero.hp >= hero.hpMax) return reject(state, "hp_full", undefined, "HP is already full");

  const events: GameEvent[] = [{ type: "TURN_STARTED", turn: state.turn + 1 }];

  const healAmount = 5;
  const healed = Math.min(healAmount, hero.hpMax - hero.hp);
  let nextState: RunState = {
    ...state,
    hero: { ...hero, hp: hero.hp + healed, potions: hero.potions - 1 },
  };

  events.push({ type: "HP_HEALED", amount: healed });
  events.push({
    type: "POTION_USED",
    healed,
    potions: nextState.hero.potions,
  });

  nextState = {
    ...nextState,
    turn: state.turn + 1,
    currentFloor: { ...nextState.currentFloor, turn: nextState.currentFloor.turn + 1 },
  };

  const enemyTurn = runEnemyTurn(nextState);
  nextState = enemyTurn.state;
  for (const e of enemyTurn.events) events.push(e);

  if (nextState.outcome === "death") {
    nextState = { ...nextState, inputLog: [...nextState.inputLog, { type: "USE_POTION" }] };
    return { state: nextState, events };
  }

  const prevLat = state.currentFloor.lattices;
  const postLat = recomputeLattices(nextState.currentFloor.grid, prevLat);
  for (const id of newlyDecharged(prevLat, postLat)) {
    events.push({ type: "LATTICE_DECHARGED", lattice: id });
  }
  nextState = { ...nextState, currentFloor: { ...nextState.currentFloor, lattices: postLat } };

  if (nextState.currentFloor.index === 0 && !nextState.currentFloor.exitUnlocked && hasAnyChargedLattice(postLat)) {
    events.push({ type: "EXIT_UNLOCKED" });
    nextState = { ...nextState, currentFloor: { ...nextState.currentFloor, exitUnlocked: true } };
  }

  const spawnResult = spawnEndOfTurnRune(nextState);
  nextState = spawnResult.state;
  for (const e of spawnResult.events) events.push(e);

  nextState = { ...nextState, inputLog: [...nextState.inputLog, { type: "USE_POTION" }] };
  return { state: nextState, events };
}

function applyEquipWeapon(state: RunState, itemId: string | null): TurnResult {
  const hero = state.hero;
  if (itemId === null) {
    if (hero.equippedWeaponId === null) {
      return reject(state, "equip_noop", undefined, "Already unequipped");
    }
    const nextState: RunState = {
      ...state,
      hero: { ...hero, equippedWeaponId: null },
      inputLog: [...state.inputLog, { type: "EQUIP_WEAPON", itemId: null }],
    };
    return { state: nextState, events: [{ type: "WEAPON_EQUIPPED", itemKind: null }] };
  }

  const item = hero.items.find((it) => it.id === itemId);
  if (!item) return reject(state, "equip_missing", undefined, "Item not in inventory");
  if (item.kind !== "sword" && item.kind !== "staff") {
    return reject(state, "equip_not_weapon", undefined, "Item is not a weapon");
  }
  if (hero.equippedWeaponId === itemId) {
    const nextState: RunState = {
      ...state,
      hero: { ...hero, equippedWeaponId: null },
      inputLog: [...state.inputLog, { type: "EQUIP_WEAPON", itemId: null }],
    };
    return { state: nextState, events: [{ type: "WEAPON_EQUIPPED", itemKind: null }] };
  }

  const nextState: RunState = {
    ...state,
    hero: { ...hero, equippedWeaponId: itemId },
    inputLog: [...state.inputLog, { type: "EQUIP_WEAPON", itemId }],
  };
  return { state: nextState, events: [{ type: "WEAPON_EQUIPPED", itemKind: item.kind }] };
}

function transitionFloor(state: RunState, events: GameEvent[]): RunState {
  const completedIndex = state.currentFloor.index;
  events.push({ type: "FLOOR_COMPLETED", floorIndex: completedIndex });

  const nextMeta = { ...state.meta, score: state.meta.score + 1000 };
  const xpResult = grantXp(state.hero, 30);
  if (xpResult.levelsGained > 0) {
    events.push({ type: "HERO_LEVELED_UP", level: xpResult.hero.level, hpMax: xpResult.hero.hpMax });
  }

  const nextIndex = completedIndex + 1;
  if (nextIndex >= state.config.maxFloors) {
    return { ...state, meta: nextMeta, hero: xpResult.hero, outcome: "win" };
  }

  const nextDims = gridDimsForFloor(nextIndex, state.config.gridDims);
  const nextFloor = generateFloor(state.seed, nextIndex, nextDims);
  return {
    ...state,
    meta: nextMeta,
    hero: { ...xpResult.hero, position: nextFloor.heroStart },
    currentFloor: nextFloor,
  };
}

function hasAnyChargedLattice(snap: import("../world/lattice.js").LatticeSnapshot): boolean {
  for (const lat of snap.byId.values()) {
    if (lat.isCharged) return true;
  }
  return false;
}

function hasClearLine(grid: RunState["currentFloor"]["grid"], from: Cell, to: Cell): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return true;
  if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return false;
  const stepX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
  const stepY = dy === 0 ? 0 : dy > 0 ? 1 : -1;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  for (let i = 1; i < steps; i++) {
    const c: Cell = { x: from.x + stepX * i, y: from.y + stepY * i };
    const tile = grid.get(c);
    if (tile.anchored) return false;
    if (tile.kind === "enemy") return false;
  }
  return true;
}
