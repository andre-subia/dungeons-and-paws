/**
 * End-of-turn dungeon spawn.
 *
 * Each turn the dungeon places one fresh rune tile in a random empty cell,
 * keeping the grid populated as the hero consumes tiles. Without this,
 * the grid drains in ~25 moves and lattices become unreachable.
 *
 * Determinism: the RNG is freshly seeded from (seed, turn) so the same
 * input log always produces the same spawns. No mutable RNG state on
 * RunState, no global randomness — replay reconstructs everything.
 *
 * Bias: when the spawn cell sits inside a Lattice that's 8 of 9, we
 * weight the rune pick toward the missing rune. This produces the
 * intended "lucky timing" dramaturgy — players engineer a near-complete
 * lattice and the dungeon often (not always) lands the keystone.
 */

import { SeededRNG } from "../core/rng.js";
import {
  RUNES,
  chebyshev,
  cellEq,
  type Cell,
  type LatticeId,
  type Rune,
} from "../core/types.js";
import type { GameEvent } from "../core/events.js";
import { runeTile, type Grid } from "../world/grid.js";
import {
  newlyDecharged,
  recomputeLattices,
  type LatticeSnapshot,
  type LatticeState,
} from "../world/lattice.js";
import type { RunState } from "../run/state.js";
import { applyKeystone } from "./keystone.js";
import type { ResolveResult } from "./resolve.js";

const KEYSTONE_BIAS_WEIGHT = 6;
const BASE_WEIGHT = 1;

export function spawnEndOfTurnRune(state: RunState): ResolveResult {
  const tutorialNeedsSpawns = state.currentFloor.index === 0 && !state.currentFloor.exitUnlocked;

  if (!tutorialNeedsSpawns && state.currentFloor.enemies.size === 0) {
    return { state, events: [] };
  }

  if (!tutorialNeedsSpawns) {
    const heroPos = state.hero.position;
    let anyThreatNearby = false;
    for (const enemy of state.currentFloor.enemies.values()) {
      if (chebyshev(enemy.position, heroPos) <= 1) {
        anyThreatNearby = true;
        break;
      }
    }
    if (!anyThreatNearby) return { state, events: [] };
  }

  const empties: Cell[] = [];
  for (const { cell, tile } of state.currentFloor.grid.each()) {
    if (tile.kind !== "empty") continue;
    if (cellEq(cell, state.hero.position)) continue;
    if (cellEq(cell, state.currentFloor.exitCell)) continue;
    empties.push(cell);
  }
  if (empties.length === 0) return { state, events: [] };

  const rng = new SeededRNG(`spawn:${state.seed}:${state.turn}`);
  const target = rng.pick(empties);
  const rune = pickWeightedRune(state.currentFloor.grid, state.currentFloor.lattices, target, rng);

  const newGrid = state.currentFloor.grid.set(
    target,
    runeTile(`s-${state.turn}-${target.x}-${target.y}`, rune),
  );
  const events: GameEvent[] = [{ type: "RUNE_SPAWNED", cell: target, rune }];

  const prevLattices = state.currentFloor.lattices;
  const newLattices = recomputeLattices(newGrid, prevLattices);

  for (const charged of newLattices.newlyCharged) {
    if (charged.keystone === null) continue;
    events.push({
      type: "LATTICE_CHARGED",
      lattice: charged.id,
      keystone: charged.keystone,
    });
  }
  for (const dechargedId of newlyDecharged(prevLattices, newLattices)) {
    events.push({ type: "LATTICE_DECHARGED", lattice: dechargedId });
  }

  const latticeScore = newLattices.newlyCharged.length * 100;
  const nextMeta = latticeScore > 0 ? { ...state.meta, score: state.meta.score + latticeScore } : state.meta;

  const shouldUnlockExit =
    !state.currentFloor.exitUnlocked &&
    state.currentFloor.index === 0 &&
    hasAnyChargedLattice(newLattices);
  if (shouldUnlockExit) events.push({ type: "EXIT_UNLOCKED" });

  let nextState: RunState = {
    ...state,
    meta: nextMeta,
    currentFloor: {
      ...state.currentFloor,
      grid: newGrid,
      lattices: newLattices,
      exitUnlocked: state.currentFloor.exitUnlocked || shouldUnlockExit,
    },
  };

  // Fire keystone bonuses for each new charge.
  for (const charged of newLattices.newlyCharged) {
    if (charged.keystone === null) continue;
    const result = applyKeystone(nextState, charged.id, charged.keystone);
    nextState = result.state;
    for (const e of result.events) events.push(e);
  }

  return { state: nextState, events };
}

function hasAnyChargedLattice(snap: LatticeSnapshot): boolean {
  for (const lat of snap.byId.values()) {
    if (lat.isCharged) return true;
  }
  return false;
}

function pickWeightedRune(
  grid: Grid,
  lattices: LatticeSnapshot,
  target: Cell,
  rng: SeededRNG,
): Rune {
  const weights: number[] = RUNES.map(() => BASE_WEIGHT);

  for (const lat of latticesContaining(grid, target, lattices)) {
    if (lat.isCharged) continue;
    if (lat.runesPresent.size !== lat.chargeThreshold - 1) continue;
    for (let i = 0; i < RUNES.length; i++) {
      const r = RUNES[i] as Rune;
      if (!lat.runesPresent.has(r)) {
        weights[i] = (weights[i] ?? BASE_WEIGHT) + KEYSTONE_BIAS_WEIGHT;
        break;
      }
    }
  }

  return rng.weighted([...RUNES], weights);
}

function latticesContaining(
  grid: Grid,
  cell: Cell,
  snap: LatticeSnapshot,
): LatticeState[] {
  const out: LatticeState[] = [];
  const ids: LatticeId[] = [
    `row:${cell.y}`,
    `column:${cell.x}`,
    `chamber:${grid.chamberIndex(cell)}`,
  ];
  for (const id of ids) {
    const lat = snap.byId.get(id);
    if (lat) out.push(lat);
  }
  return out;
}
