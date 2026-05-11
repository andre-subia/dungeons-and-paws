/**
 * @gridlore/engine — public API.
 *
 * Anything not re-exported here is considered internal and may change
 * without notice. Consumers (shell-web, tools, server) should import
 * only from this entry.
 */

export const ENGINE_VERSION = "0.0.0";

// Core
export {
  RUNES,
  RUNE_COUNT,
  cellEq,
  cellKey,
  chebyshev,
  manhattan,
} from "./core/types.js";
export type {
  Cell,
  Rune,
  Tile,
  TileKind,
  TilePayload,
  LatticeKind,
  LatticeId,
  EntityId,
} from "./core/types.js";

export type { GameEvent } from "./core/events.js";

export { SeededRNG, hashString } from "./core/rng.js";

// World
export {
  Grid,
  STANDARD_GRID,
  PUZZLE_GRID,
  SMALL_GRID,
  emptyTile,
  runeTile,
  exitTile,
  keyTile,
  enemyTile,
} from "./world/grid.js";
export type { GridDimensions } from "./world/grid.js";

// Generation
export { generateFloor } from "./generation/floor.js";

export {
  recomputeLattices,
  newlyDecharged,
  EMPTY_SNAPSHOT,
} from "./world/lattice.js";
export type { LatticeState, LatticeSnapshot } from "./world/lattice.js";

// Entities
export { spawnHero, WANDERER_TEMPLATE, xpToNextLevel } from "./entities/hero.js";
export type { HeroState, HeroTemplate } from "./entities/hero.js";

export type {
  EnemyState,
  EnemyArchetype,
  EnemyIntent,
} from "./entities/enemy.js";

export {
  ENEMY_TEMPLATES,
  ENEMY_TEMPLATE_IDS,
  EASY_TEMPLATES,
  MEDIUM_TEMPLATES,
  HARD_TEMPLATES,
  getEnemyTemplate,
} from "./entities/enemy-templates.js";
export type { EnemyTemplate, EnemyTemplateId } from "./entities/enemy-templates.js";

// Sim
export { applyInput } from "./sim/turn.js";
export type { TurnResult } from "./sim/turn.js";
export { chebyshevPath } from "./sim/path.js";
export { resolveTileAt } from "./sim/resolve.js";
export type { ResolveResult } from "./sim/resolve.js";
export { applyKeystone } from "./sim/keystone.js";
export { spawnEndOfTurnRune } from "./sim/spawn.js";
export { resolveCombatAt } from "./sim/combat.js";
export type { CombatResult } from "./sim/combat.js";
export { runEnemyTurn } from "./sim/enemy-turn.js";
export type { EnemyTurnResult } from "./sim/enemy-turn.js";

// Run
export { makeInitialRunState, DEFAULT_RUN_CONFIG } from "./run/state.js";
export type {
  RunState,
  RunInit,
  RunConfig,
  RunOutcome,
  FloorState,
  MetaState,
  PlayerInput,
} from "./run/state.js";

export { replay } from "./run/replay.js";
export type { ReplayResult } from "./run/replay.js";
