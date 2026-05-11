import { describe, it, expect } from "vitest";
import { resolveCombatAt } from "../src/sim/combat.js";
import { applyInput } from "../src/sim/turn.js";
import { makeInitialRunState } from "../src/run/state.js";
import { generateFloor } from "../src/generation/floor.js";
import { enemyTile, SMALL_GRID } from "../src/world/grid.js";
import { recomputeLattices } from "../src/world/lattice.js";
import { ENEMY_TEMPLATES } from "../src/entities/enemy-templates.js";
import { makeBlankRunState } from "./_helpers.js";
import type { Cell } from "../src/core/types.js";
import type { EnemyState } from "../src/entities/enemy.js";

function placeEnemy(state: ReturnType<typeof makeBlankRunState>, cell: Cell, templateId: keyof typeof ENEMY_TEMPLATES) {
  const tpl = ENEMY_TEMPLATES[templateId];
  const enemyId = `t-${cell.x}-${cell.y}`;
  const enemy: EnemyState = {
    id: enemyId,
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
  const grid = state.currentFloor.grid.set(cell, enemyTile(`et-${cell.x}-${cell.y}`, enemyId, tpl.rune));
  const enemies = new Map(state.currentFloor.enemies);
  enemies.set(enemyId, enemy);
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

describe("resolveCombatAt — bump combat", () => {
  it("hero kills a 1-HP enemy in one hit and takes the cell", () => {
    let state = makeBlankRunState({ seed: "C-01", heroSpawn: { x: 0, y: 0 }, dims: SMALL_GRID });
    // Force a 1-HP enemy by manually overriding an existing template's hp.
    state = placeEnemy(state, { x: 1, y: 0 }, "bat");
    const enemyId = Array.from(state.currentFloor.enemies.keys())[0]!;
    const e0 = state.currentFloor.enemies.get(enemyId)!;
    const enemies = new Map(state.currentFloor.enemies);
    enemies.set(enemyId, { ...e0, hp: 1, hpMax: 1 });
    state = { ...state, currentFloor: { ...state.currentFloor, enemies } };

    const result = resolveCombatAt(state, { x: 1, y: 0 });
    expect(result.enemyKilled).toBe(true);
    expect(result.state.currentFloor.grid.get({ x: 1, y: 0 }).kind).toBe("empty");
    expect(result.state.currentFloor.enemies.size).toBe(0);
    expect(result.events.some((e) => e.type === "ENEMY_KILLED")).toBe(true);
    expect(result.state.hero.hp).toBe(state.hero.hp);
  });

  it("hero damages a multi-HP enemy and takes attack damage in retaliation", () => {
    let state = makeBlankRunState({ seed: "C-02", heroSpawn: { x: 0, y: 0 }, dims: SMALL_GRID });
    state = placeEnemy(state, { x: 1, y: 0 }, "skeleton"); // 3 HP / 1 atk
    const result = resolveCombatAt(state, { x: 1, y: 0 });
    expect(result.enemyKilled).toBe(false);
    expect(result.state.hero.hp).toBe(state.hero.hp - 1); // skeleton attack=1
    const enemy = Array.from(result.state.currentFloor.enemies.values())[0]!;
    expect(enemy.hp).toBe(2); // 3 - 1
    expect(result.events.some((e) => e.type === "ENEMY_DAMAGED")).toBe(true);
    expect(result.events.some((e) => e.type === "HERO_DAMAGED")).toBe(true);
  });

  it("armor absorbs incoming damage before HP", () => {
    let state = makeBlankRunState({ seed: "C-03", heroSpawn: { x: 0, y: 0 }, dims: SMALL_GRID });
    state = { ...state, hero: { ...state.hero, armor: 3 } };
    state = placeEnemy(state, { x: 1, y: 0 }, "skeleton");
    const result = resolveCombatAt(state, { x: 1, y: 0 });
    expect(result.state.hero.hp).toBe(state.hero.hp); // armor absorbed all of skeleton's 1 dmg
    expect(result.state.hero.armor).toBe(2); // 3 - 1
  });
});

describe("turn pipeline + combat", () => {
  it("walking onto a 1-HP enemy moves the hero into the cell after the kill", () => {
    let state = makeBlankRunState({ seed: "T-01", heroSpawn: { x: 0, y: 0 }, dims: SMALL_GRID });
    state = placeEnemy(state, { x: 1, y: 0 }, "bat");
    const enemyId = Array.from(state.currentFloor.enemies.keys())[0]!;
    const e0 = state.currentFloor.enemies.get(enemyId)!;
    const enemies = new Map(state.currentFloor.enemies);
    enemies.set(enemyId, { ...e0, hp: 1, hpMax: 1 });
    state = { ...state, currentFloor: { ...state.currentFloor, enemies } };

    const result = applyInput(state, { type: "MOVE", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } });
    expect(result.state.hero.position).toEqual({ x: 1, y: 0 });
    expect(result.events.some((e) => e.type === "HERO_MOVED")).toBe(true);
    expect(result.events.some((e) => e.type === "ENEMY_KILLED")).toBe(true);
  });

  it("killing the key-carrying enemy drops a key on its cell and does not move the hero onto it", () => {
    let state = makeBlankRunState({ seed: "T-KEY-01", heroSpawn: { x: 0, y: 0 }, dims: SMALL_GRID });
    state = placeEnemy(state, { x: 1, y: 0 }, "bat");
    const enemyId = Array.from(state.currentFloor.enemies.keys())[0]!;
    const e0 = state.currentFloor.enemies.get(enemyId)!;
    const enemies = new Map(state.currentFloor.enemies);
    enemies.set(enemyId, { ...e0, hp: 1, hpMax: 1 });
    state = {
      ...state,
      currentFloor: {
        ...state.currentFloor,
        enemies,
        exitRequiresKey: true,
        exitUnlocked: false,
        keyEnemyId: enemyId,
      },
    };

    const result = applyInput(state, { type: "MOVE", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } });
    expect(result.state.currentFloor.grid.get({ x: 1, y: 0 }).kind).toBe("key");
    expect(result.state.hero.position).toEqual({ x: 0, y: 0 });
    expect(result.events.some((e) => e.type === "KEY_DROPPED")).toBe(true);
    expect(result.events.some((e) => e.type === "HERO_MOVED")).toBe(false);

    const pickup = applyInput(result.state, {
      type: "MOVE",
      from: { x: 0, y: 0 },
      to: { x: 1, y: 0 },
    });
    expect(pickup.state.currentFloor.exitUnlocked).toBe(true);
    expect(pickup.events.some((e) => e.type === "KEY_COLLECTED")).toBe(true);
  });

  it("drops the key even if the enemy tile is stale (enemy missing in map)", () => {
    let state = makeBlankRunState({ seed: "T-KEY-STALE", heroSpawn: { x: 0, y: 0 }, dims: SMALL_GRID });
    state = {
      ...state,
      currentFloor: {
        ...state.currentFloor,
        exitRequiresKey: true,
        exitUnlocked: false,
        keyEnemyId: "stale-e0",
        enemies: new Map(),
        grid: state.currentFloor.grid.set({ x: 1, y: 0 }, enemyTile("stale-t", "stale-e0", "ember")),
      },
    };
    const result = applyInput(state, { type: "MOVE", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } });
    expect(result.state.currentFloor.grid.get({ x: 1, y: 0 }).kind).toBe("key");
    expect(result.state.hero.position).toEqual({ x: 0, y: 0 });
    expect(result.events.some((e) => e.type === "KEY_DROPPED")).toBe(true);
  });

  it("enemy does not hit twice in one turn when it survives the bump combat", () => {
    let state = makeBlankRunState({ seed: "T-HIT-ONCE", heroSpawn: { x: 0, y: 0 }, dims: SMALL_GRID });
    state = { ...state, hero: { ...state.hero, hp: 5, armor: 0 } };
    state = placeEnemy(state, { x: 1, y: 0 }, "skeleton"); // attack=1, hp>1

    const result = applyInput(state, { type: "MOVE", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } });
    expect(result.state.hero.hp).toBe(4);

    const heroDamagedEvents = result.events.filter((e) => e.type === "HERO_DAMAGED");
    expect(heroDamagedEvents).toHaveLength(1);
  });

  it("walking onto a tougher enemy keeps the hero in place if it survives", () => {
    let state = makeBlankRunState({ seed: "T-02", heroSpawn: { x: 0, y: 0 }, dims: SMALL_GRID });
    state = placeEnemy(state, { x: 1, y: 0 }, "slime"); // 3 HP
    const result = applyInput(state, { type: "MOVE", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } });
    expect(result.state.hero.position).toEqual({ x: 0, y: 0 });
    expect(result.events.some((e) => e.type === "HERO_MOVED")).toBe(false);
    expect(result.events.some((e) => e.type === "ENEMY_DAMAGED")).toBe(true);
  });

  it("hero dying from combat sets outcome=death and emits HERO_DIED", () => {
    // Slime: 3 HP, 1 attack. Survives our hit, retaliates, kills 1-HP hero.
    let state = makeBlankRunState({ seed: "T-03", heroSpawn: { x: 0, y: 0 }, dims: SMALL_GRID });
    state = { ...state, hero: { ...state.hero, hp: 1 } };
    state = placeEnemy(state, { x: 1, y: 0 }, "slime");
    const result = applyInput(state, { type: "MOVE", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } });
    expect(result.state.outcome).toBe("death");
    expect(result.state.hero.hp).toBe(0);
    expect(result.events.some((e) => e.type === "HERO_DIED")).toBe(true);
  });
});

describe("floor generator — enemy placement", () => {
  it("places a small number of enemies (difficulty lowered)", () => {
    const f0 = generateFloor("GEN-01", 0, SMALL_GRID);
    const f1 = generateFloor("GEN-01", 1, SMALL_GRID);
    const f2 = generateFloor("GEN-01", 2, SMALL_GRID);
    expect(f0.enemies.size).toBe(1);
    expect(f1.enemies.size).toBe(1);
    expect(f2.enemies.size).toBe(1);
  });

  it("never places an enemy on the hero start or exit cell", () => {
    for (let i = 0; i < 10; i++) {
      const f = generateFloor(`GEN-PLACE-${i}`, 1, SMALL_GRID);
      for (const enemy of f.enemies.values()) {
        expect(enemy.position).not.toEqual(f.heroStart);
        expect(enemy.position).not.toEqual(f.exitCell);
      }
      // Each enemy has a corresponding enemy tile on the grid.
      for (const enemy of f.enemies.values()) {
        const t = f.grid.get(enemy.position);
        expect(t.kind).toBe("enemy");
        expect(t.payload?.kind).toBe("enemy");
      }
    }
  });

  it("enemy tiles count toward lattices via their rune", () => {
    const f = generateFloor("GEN-LAT", 2, SMALL_GRID);
    let enemyRuneCells = 0;
    for (const { tile } of f.grid.each()) {
      if (tile.kind === "enemy" && tile.rune !== null) enemyRuneCells++;
    }
    expect(enemyRuneCells).toBeGreaterThan(0);
  });
});

describe("makeInitialRunState integration", () => {
  it("starts with at least one enemy on floor 0", () => {
    const state = makeInitialRunState({ seed: "INIT-01" });
    expect(state.currentFloor.enemies.size).toBeGreaterThan(0);
  });
});
