/**
 * RunState — the aggregate root for a single roguelike run.
 *
 * All gameplay derives from (seed, inputLog) → RunState via fold. State
 * is treated as immutable from outside the engine; the turn pipeline
 * returns a freshly-constructed RunState each step.
 */

import type { Cell } from "../core/types.js";
import type { HeroState } from "../entities/hero.js";
import type { EnemyState } from "../entities/enemy.js";
import { SMALL_GRID, type GridDimensions } from "../world/grid.js";
import { generateFloor } from "../generation/floor.js";
import { type LatticeSnapshot } from "../world/lattice.js";
import { spawnHero, WANDERER_TEMPLATE, type HeroTemplate } from "../entities/hero.js";

export type RunOutcome = "in_progress" | "win" | "death";

export type MetaState = {
  readonly gold: number;
  readonly shards: number;
  readonly insight: number;
  readonly score: number;
};

export type FloorState = {
  readonly index: number;
  readonly grid: import("../world/grid.js").Grid;
  readonly enemies: ReadonlyMap<string, EnemyState>;
  readonly lattices: LatticeSnapshot;
  readonly heroStart: Cell;
  readonly exitCell: Cell;
  readonly exitUnlocked: boolean;
  readonly exitRequiresKey: boolean;
  readonly keyPolicy: "none" | "assigned" | "last_enemy" | "reinforcement";
  readonly keyEnemyId: string | null;
  readonly runePassiveCounts: Partial<Record<import("../core/types.js").Rune, number>>;
  readonly turn: number;
};

export type PlayerInput =
  | {
      readonly type: "MOVE";
      readonly from: Cell;
      readonly to: Cell;
    }
  | { readonly type: "USE_POTION"; readonly potionId: string }
  | { readonly type: "EQUIP_WEAPON"; readonly itemId: string | null }
  | { readonly type: "DROP_ITEM"; readonly itemId: string }
  | { readonly type: "DROP_POTION"; readonly potionId: string }
  | { readonly type: "DROP_LEAF" }
  | { readonly type: "SET_WEAPON_LAYOUT"; readonly itemId: string; readonly x: number; readonly y: number }
  | {
      readonly type: "ABILITY";
      readonly abilityId: string;
      readonly target?: Cell;
    }
  | {
      readonly type: "END_FLOOR";
      readonly rewardChoice: number;
    };

export type RunConfig = {
  readonly maxFloors: number;
  readonly gridDims: GridDimensions;
};

export const DEFAULT_RUN_CONFIG: RunConfig = {
  maxFloors: Number.POSITIVE_INFINITY,
  gridDims: SMALL_GRID,
};

export type RunState = {
  readonly seed: string;
  readonly config: RunConfig;
  readonly hero: HeroState;
  readonly currentFloor: FloorState;
  readonly meta: MetaState;
  readonly turn: number;
  readonly inputLog: readonly PlayerInput[];
  readonly outcome: RunOutcome;
};

export type RunInit = {
  readonly seed: string;
  readonly heroTemplate?: HeroTemplate;
  /** Override the hero's starting cell. Defaults to floor's heroStart. */
  readonly heroSpawn?: Cell;
  /** Override the grid dimensions. Defaults to SMALL_GRID (3×3). */
  readonly gridDims?: GridDimensions;
  readonly config?: Partial<RunConfig>;
};

/**
 * Builds the starting RunState — Floor 0 generated, hero placed at the
 * floor's heroStart (or the override).
 */
export function makeInitialRunState(init: RunInit): RunState {
  const config: RunConfig = {
    ...DEFAULT_RUN_CONFIG,
    ...(init.config ?? {}),
    gridDims: init.gridDims ?? init.config?.gridDims ?? DEFAULT_RUN_CONFIG.gridDims,
  };
  const template = init.heroTemplate ?? WANDERER_TEMPLATE;
  const floor = generateFloor(init.seed, 0, config.gridDims);
  const heroPosition = init.heroSpawn ?? floor.heroStart;

  return {
    seed: init.seed,
    config,
    hero: spawnHero(template, heroPosition),
    currentFloor: floor,
    meta: { gold: 0, shards: 0, insight: 0, score: 0 },
    turn: 0,
    inputLog: [],
    outcome: "in_progress",
  };
}
