import type { Cell, EntityId, Rune } from "../core/types.js";

export type EnemyArchetype = "hunter" | "ward" | "weaver";

export type EnemyIntent =
  | { readonly type: "attack"; readonly target: Cell; readonly damage: number }
  | { readonly type: "move"; readonly to: Cell }
  | { readonly type: "mutate"; readonly cell: Cell; readonly toRune: Rune }
  | { readonly type: "spawn"; readonly cell: Cell; readonly templateId: string };

export type EnemyState = {
  readonly id: EntityId;
  readonly templateId: string;
  readonly archetype: EnemyArchetype;
  readonly position: Cell;
  readonly hp: number;
  readonly hpMax: number;
  readonly attack: number;
  readonly rune: Rune;
  readonly intent: EnemyIntent | null;
  readonly modifiers: readonly string[];
};
