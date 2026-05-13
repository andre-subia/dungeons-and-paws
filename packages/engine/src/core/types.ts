/**
 * Core types shared across the engine.
 *
 * Design notes:
 * - Cell is a value object — never mutated.
 * - RUNES is the canonical 9-rune list. Order is stable; new runes append.
 * - Tile carries everything needed to render and resolve a cell.
 */

export type Cell = { readonly x: number; readonly y: number };

export const RUNES = [
  "ember",
  "tide",
  "bramble",
  "iron",
  "bone",
  "star",
  "void",
  "coin",
  "blood",
] as const;
export type Rune = (typeof RUNES)[number];

export const RUNE_COUNT = RUNES.length;

export const ITEM_KINDS = ["sword", "staff"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export type ItemInstance =
  | {
      readonly id: string;
      readonly kind: "sword";
      readonly attackBonus: number;
      readonly durability: number;
      readonly durabilityMax: number;
    }
  | {
      readonly id: string;
      readonly kind: "staff";
      readonly attackBonus: number;
      readonly durability: number;
      readonly durabilityMax: number;
    };

export type TileKind =
  | "empty"
  | "rune"
  | "key"
  | "enemy"
  | "item"
  | "treasure"
  | "hazard"
  | "door"
  | "altar"
  | "fog"
  | "mimic"
  | "anchor"
  | "portal"
  | "exit";

export type TilePayload =
  | { readonly kind: "enemy"; readonly enemyId: string }
  | { readonly kind: "item"; readonly item: ItemInstance }
  | { readonly kind: "treasure"; readonly lootTable: string }
  | { readonly kind: "hazard"; readonly damage: number }
  | { readonly kind: "door"; readonly requiredLatticeKey: string }
  | { readonly kind: "portal"; readonly pairId: string };

export type Tile = {
  readonly id: string;
  readonly kind: TileKind;
  readonly rune: Rune | null;
  readonly hidden: boolean;
  readonly anchored: boolean;
  readonly payload?: TilePayload;
};

export type LatticeKind = "row" | "column" | "chamber";
export type LatticeId = `${LatticeKind}:${number}`;

export type EntityId = string;

export function cellEq(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

export function cellKey(c: Cell): string {
  return `${c.x},${c.y}`;
}

export function chebyshev(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function manhattan(a: Cell, b: Cell): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
