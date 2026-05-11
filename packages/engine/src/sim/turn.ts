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
import { resolveCombatAt } from "./combat.js";
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

  const distance = chebyshev(from, to);
  if (distance > hero.stride) {
    return reject(
      state,
      "destination_beyond_stride",
      { distance, stride: hero.stride },
      `Destination beyond stride (${distance} > ${hero.stride})`,
    );
  }

  const destTile = grid.get(to);
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

  // 1. Resolve each path cell EXCEPT the destination — destination
  //    handling is special (exit ends the floor; rune-at-dest is consumed;
  //    enemy-at-dest triggers combat).
  let nextState: RunState = state;
  for (let i = 0; i < path.length - 1; i++) {
    const cell = path[i]!;
    const result = resolveTileAt(nextState, cell);
    nextState = result.state;
    for (const e of result.events) events.push(e);
  }

  // 1b. Destination dispatch.
  const destIsExit = destTile.kind === "exit";
  const destIsEnemy = destTile.kind === "enemy";
  let heroEntersDest = !destIsEnemy; // exit/empty/rune always enter; enemy depends on kill

  if (destIsEnemy) {
    const destEnemyId =
      destTile.payload && destTile.payload.kind === "enemy" ? destTile.payload.enemyId : null;
    const shouldDropKeyHere =
      destEnemyId !== null &&
      currentFloor.exitRequiresKey &&
      !currentFloor.exitUnlocked &&
      currentFloor.keyEnemyId === destEnemyId;

    const combat = resolveCombatAt(nextState, to);
    nextState = combat.state;
    for (const e of combat.events) events.push(e);
    heroEntersDest = combat.enemyKilled;

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
    const enemyTurn = runEnemyTurn(nextState);
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
    potionsMax: nextState.hero.potionsMax,
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
