import { describe, it, expect } from "vitest";
import { runEnemyTurn } from "../src/sim/enemy-turn.js";
import { applyInput } from "../src/sim/turn.js";
import { enemyTile, runeTile, SMALL_GRID } from "../src/world/grid.js";
import { recomputeLattices } from "../src/world/lattice.js";
import { ENEMY_TEMPLATES, type EnemyTemplateId } from "../src/entities/enemy-templates.js";
import { makeBlankRunState } from "./_helpers.js";
import type { Cell } from "../src/core/types.js";
import type { EnemyState } from "../src/entities/enemy.js";

function withEnemy(
  state: ReturnType<typeof makeBlankRunState>,
  cell: Cell,
  templateId: EnemyTemplateId,
  id = `t-${cell.x}-${cell.y}`,
) {
  const tpl = ENEMY_TEMPLATES[templateId];
  const enemy: EnemyState = {
    id,
    templateId: tpl.templateId,
    archetype: tpl.archetype,
    position: cell,
    hp: tpl.hp,
    hpMax: tpl.hp,
    attack: tpl.attack,
    rune: tpl.rune,
    intent: null,
    modifiers: [],
  };
  const grid = state.currentFloor.grid.set(cell, enemyTile(`et-${cell.x}-${cell.y}`, id, tpl.rune));
  const enemies = new Map(state.currentFloor.enemies);
  enemies.set(id, enemy);
  return {
    ...state,
    currentFloor: {
      ...state.currentFloor,
      grid,
      enemies,
      lattices: recomputeLattices(grid),
    },
  };
}

describe("runEnemyTurn", () => {
  it("moves an enemy one cell closer to the hero (diagonal preferred)", () => {
    let state = makeBlankRunState({ seed: "ET-01", heroSpawn: { x: 0, y: 0 }, dims: SMALL_GRID });
    state = withEnemy(state, { x: 2, y: 2 }, "skeleton");
    const result = runEnemyTurn(state);
    const enemy = Array.from(result.state.currentFloor.enemies.values())[0]!;
    // Hero at (0,0); diagonal step from (2,2) → (1,1).
    expect(enemy.position).toEqual({ x: 1, y: 1 });
    expect(result.events.some((e) => e.type === "ENEMY_MOVED")).toBe(true);
    // Old cell vacated.
    expect(result.state.currentFloor.grid.get({ x: 2, y: 2 }).kind).toBe("empty");
    // New cell occupied with enemy tile.
    const newTile = result.state.currentFloor.grid.get({ x: 1, y: 1 });
    expect(newTile.kind).toBe("enemy");
    expect(newTile.payload?.kind).toBe("enemy");
  });

  it("attacks the hero when adjacent instead of moving", () => {
    let state = makeBlankRunState({ seed: "ET-02", heroSpawn: { x: 1, y: 1 }, dims: SMALL_GRID });
    state = withEnemy(state, { x: 2, y: 2 }, "snake"); // 2 atk
    const before = state.hero.hp;
    const result = runEnemyTurn(state);
    expect(result.state.hero.hp).toBe(before - 2);
    expect(result.events.some((e) => e.type === "ENEMY_ATTACKED")).toBe(true);
    expect(result.events.some((e) => e.type === "HERO_DAMAGED")).toBe(true);
    // Enemy did NOT move.
    const enemy = Array.from(result.state.currentFloor.enemies.values())[0]!;
    expect(enemy.position).toEqual({ x: 2, y: 2 });
  });

  it("stays put when blocked by runes in every direction", () => {
    let state = makeBlankRunState({ seed: "ET-03", heroSpawn: { x: 0, y: 0 }, dims: SMALL_GRID });
    state = withEnemy(state, { x: 2, y: 2 }, "bat");
    // Wall off the enemy with rune tiles in the diagonal/cardinal candidates.
    let g = state.currentFloor.grid;
    g = g.set({ x: 1, y: 1 }, runeTile("r-1-1", "ember"));
    g = g.set({ x: 1, y: 2 }, runeTile("r-1-2", "ember"));
    g = g.set({ x: 2, y: 1 }, runeTile("r-2-1", "ember"));
    state = {
      ...state,
      currentFloor: {
        ...state.currentFloor,
        grid: g,
        lattices: recomputeLattices(g),
      },
    };
    const result = runEnemyTurn(state);
    const enemy = Array.from(result.state.currentFloor.enemies.values())[0]!;
    expect(enemy.position).toEqual({ x: 2, y: 2 });
    expect(result.events.some((e) => e.type === "ENEMY_MOVED")).toBe(false);
  });

  it("hero death from enemy attack short-circuits and stops further enemies acting", () => {
    let state = makeBlankRunState({ seed: "ET-04", heroSpawn: { x: 1, y: 1 }, dims: SMALL_GRID });
    state = { ...state, hero: { ...state.hero, hp: 1 } };
    // Two enemies adjacent; the first by id alphabetically should kill hero
    // and prevent the second from acting.
    state = withEnemy(state, { x: 0, y: 0 }, "snake", "a-snake");
    state = withEnemy(state, { x: 2, y: 2 }, "snake", "b-snake");
    const result = runEnemyTurn(state);
    expect(result.state.outcome).toBe("death");
    // Only one ENEMY_ATTACKED event before short-circuit.
    const attacks = result.events.filter((e) => e.type === "ENEMY_ATTACKED");
    expect(attacks).toHaveLength(1);
  });

  it("is deterministic across repeated runs of the same setup", () => {
    function setup() {
      let s = makeBlankRunState({ seed: "ET-DET", heroSpawn: { x: 0, y: 0 }, dims: SMALL_GRID });
      s = withEnemy(s, { x: 2, y: 2 }, "skeleton", "z");
      s = withEnemy(s, { x: 2, y: 0 }, "spider", "a");
      return s;
    }
    const a = runEnemyTurn(setup());
    const b = runEnemyTurn(setup());
    const aPos = Array.from(a.state.currentFloor.enemies.values())
      .map((e) => `${e.id}:${e.position.x},${e.position.y}`)
      .sort();
    const bPos = Array.from(b.state.currentFloor.enemies.values())
      .map((e) => `${e.id}:${e.position.x},${e.position.y}`)
      .sort();
    expect(aPos).toEqual(bPos);
  });
});

describe("turn pipeline + enemy AI", () => {
  it("a far enemy moves closer at end of player's turn", () => {
    let state = makeBlankRunState({ seed: "PT-01", heroSpawn: { x: 0, y: 0 }, dims: SMALL_GRID });
    state = withEnemy(state, { x: 2, y: 2 }, "skeleton");
    // Player moves down-right (a small step), then end-of-turn enemy moves.
    const result = applyInput(state, {
      type: "MOVE",
      from: { x: 0, y: 0 },
      to: { x: 1, y: 0 },
    });
    const enemy = Array.from(result.state.currentFloor.enemies.values())[0]!;
    // Hero now at (1,0); enemy was at (2,2) → diagonal toward → (1,1).
    expect(enemy.position).toEqual({ x: 1, y: 1 });
  });
});
