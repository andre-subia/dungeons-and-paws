/**
 * Enemy turn — runs after the player resolves their move.
 *
 * Each enemy in deterministic order:
 *   - If adjacent to the hero (chebyshev 1) → attacks the hero.
 *   - Else → tries to step one cell closer to the hero. Diagonal first,
 *     then cardinal. Only steps into empty cells (won't trample runes
 *     or bump other enemies).
 *   - If blocked, stays put.
 *
 * Hero death from enemy attacks short-circuits the rest of the turn.
 * The pipeline in turn.ts checks `outcome === "death"` after this runs.
 */

import { chebyshev, type Cell } from "../core/types.js";
import type { GameEvent } from "../core/events.js";
import { emptyTile, enemyTile } from "../world/grid.js";
import type { EnemyState } from "../entities/enemy.js";
import type { RunState } from "../run/state.js";

const HERO_ID = "hero";

export type EnemyTurnResult = {
  readonly state: RunState;
  readonly events: readonly GameEvent[];
};

export function runEnemyTurn(state: RunState): EnemyTurnResult {
  const events: GameEvent[] = [];
  let nextState = state;

  // Sort by id for deterministic action order.
  const ids = Array.from(state.currentFloor.enemies.keys()).sort();

  for (const id of ids) {
    if (nextState.outcome !== "in_progress") break;
    const enemy = nextState.currentFloor.enemies.get(id);
    if (!enemy) continue;
    const result = takeEnemyAction(nextState, enemy);
    nextState = result.state;
    for (const e of result.events) events.push(e);
  }

  return { state: nextState, events };
}

function takeEnemyAction(state: RunState, enemy: EnemyState): EnemyTurnResult {
  const dist = chebyshev(enemy.position, state.hero.position);
  if (dist <= 1) return enemyAttacksHero(state, enemy);
  return moveEnemyTowardHero(state, enemy);
}

function enemyAttacksHero(state: RunState, enemy: EnemyState): EnemyTurnResult {
  const incoming = enemy.attack;
  const absorbed = Math.min(state.hero.armor, incoming);
  const hpDamage = incoming - absorbed;
  const newArmor = state.hero.armor - absorbed;
  const newHp = Math.max(0, state.hero.hp - hpDamage);

  const events: GameEvent[] = [
    { type: "ENEMY_ATTACKED", enemyId: enemy.id, cell: enemy.position },
    {
      type: "DAMAGE_DEALT",
      source: enemy.id,
      target: HERO_ID,
      amount: incoming,
    },
    { type: "HERO_DAMAGED", amount: hpDamage, absorbed, hpAfter: newHp },
  ];

  let nextState: RunState = {
    ...state,
    hero: { ...state.hero, hp: newHp, armor: newArmor },
  };

  if (newHp <= 0) {
    nextState = { ...nextState, outcome: "death" };
    events.push({ type: "HERO_DIED", atTurn: state.turn });
  }

  return { state: nextState, events };
}

function moveEnemyTowardHero(state: RunState, enemy: EnemyState): EnemyTurnResult {
  const grid = state.currentFloor.grid;
  const dx = sign(state.hero.position.x - enemy.position.x);
  const dy = sign(state.hero.position.y - enemy.position.y);

  // Try diagonal first (closes both axes), then each cardinal direction.
  const candidates: Cell[] = [];
  if (dx !== 0 && dy !== 0) {
    candidates.push({ x: enemy.position.x + dx, y: enemy.position.y + dy });
  }
  if (dx !== 0) candidates.push({ x: enemy.position.x + dx, y: enemy.position.y });
  if (dy !== 0) candidates.push({ x: enemy.position.x, y: enemy.position.y + dy });

  for (const target of candidates) {
    if (!grid.inBounds(target)) continue;
    const tile = grid.get(target);
    // Move only into empty cells. Runes / other enemies / exit / anchored block.
    if (tile.kind !== "empty") continue;

    const turn = state.turn;
    const newGrid = grid
      .set(
        enemy.position,
        emptyTile(`vacated-${turn}-${enemy.position.x}-${enemy.position.y}`),
      )
      .set(
        target,
        enemyTile(`moved-${turn}-${target.x}-${target.y}`, enemy.id, enemy.rune),
      );
    const enemies = new Map(state.currentFloor.enemies);
    enemies.set(enemy.id, { ...enemy, position: target });

    return {
      state: {
        ...state,
        currentFloor: { ...state.currentFloor, grid: newGrid, enemies },
      },
      events: [
        { type: "ENEMY_MOVED", enemyId: enemy.id, from: enemy.position, to: target },
      ],
    };
  }

  // Blocked from moving — stay put, no event.
  return { state, events: [] };
}

function sign(n: number): number {
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}
