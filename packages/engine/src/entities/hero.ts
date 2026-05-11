import type { Cell, Rune } from "../core/types.js";

export type HeroState = {
  readonly characterId: string;
  readonly position: Cell;
  readonly hp: number;
  readonly hpMax: number;
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

export function spawnHero(template: HeroTemplate, position: Cell): HeroState {
  return {
    characterId: template.characterId,
    position,
    hp: template.hpMax,
    hpMax: template.hpMax,
    stride: template.stride,
    attack: template.attack,
    focus: template.focusMax,
    focusMax: template.focusMax,
    armor: 0,
    affinity: template.affinity ?? new Map(),
  };
}
