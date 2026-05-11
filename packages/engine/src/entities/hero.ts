import type { Cell, Rune } from "../core/types.js";

export type HeroState = {
  readonly characterId: string;
  readonly position: Cell;
  readonly hp: number;
  readonly hpMax: number;
  readonly level: number;
  readonly xp: number;
  readonly potions: number;
  readonly potionsMax: number;
  readonly brambleProgress: number;
  readonly stride: number;
  readonly attack: number;
  readonly focus: number;
  readonly focusMax: number;
  readonly armor: number;
  readonly affinity: ReadonlyMap<Rune, number>;
};

export type HeroTemplate = {
  readonly characterId: string;
  readonly hpMax: number;
  readonly stride: number;
  readonly attack: number;
  readonly focusMax: number;
  readonly affinity?: ReadonlyMap<Rune, number>;
};

export const WANDERER_TEMPLATE: HeroTemplate = {
  characterId: "wanderer",
  hpMax: 8,
  stride: 1,
  attack: 1,
  focusMax: 2,
};

export function xpToNextLevel(level: number): number {
  const lvl = Math.max(1, Math.floor(level));
  return 20 + (lvl - 1) * 10;
}

export type XpGainResult = {
  readonly hero: HeroState;
  readonly levelsGained: number;
};

export function grantXp(hero: HeroState, amount: number): XpGainResult {
  let xp = hero.xp + Math.max(0, Math.floor(amount));
  let level = hero.level;
  let hpMax = hero.hpMax;
  let gained = 0;

  while (xp >= xpToNextLevel(level)) {
    xp -= xpToNextLevel(level);
    level += 1;
    gained += 1;
    const hpDelta = 2;
    hpMax += hpDelta;
  }

  if (gained === 0 && xp === hero.xp) return { hero, levelsGained: 0 };
  return {
    hero: { ...hero, xp, level, hpMax },
    levelsGained: gained,
  };
}

export function spawnHero(template: HeroTemplate, position: Cell): HeroState {
  return {
    characterId: template.characterId,
    position,
    hp: template.hpMax,
    hpMax: template.hpMax,
    level: 1,
    xp: 0,
    potions: 2,
    potionsMax: 2,
    brambleProgress: 0,
    stride: template.stride,
    attack: template.attack,
    focus: template.focusMax,
    focusMax: template.focusMax,
    armor: 0,
    affinity: template.affinity ?? new Map(),
  };
}
