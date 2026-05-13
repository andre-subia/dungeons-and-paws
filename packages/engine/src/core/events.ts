/**
 * GameEvent — pure data emitted by the engine for renderers to animate.
 *
 * Renderers must NEVER mutate state; they observe events and project them
 * onto sprites/audio/haptics. The complete state lives only in RunState.
 */

import type { Cell, EntityId, LatticeId, Rune } from "./types.js";

export type InputRejectedEvent = {
  readonly type: "INPUT_REJECTED";
  /** Stable i18n key for UI translation. */
  readonly reasonKey: string;
  /** Interpolation payload for the reasonKey template. */
  readonly details?: Readonly<Record<string, string | number>>;
  /** Optional debug string (not meant for end-user UI). */
  readonly debugReason?: string;
};

export type KeystoneBonusEffect =
  | { readonly kind: "tide"; readonly hpGained: number; readonly tideOnGrid: number }
  | { readonly kind: "coin"; readonly goldGained: number }
  | { readonly kind: "bone"; readonly hpGained: number }
  | { readonly kind: "iron"; readonly armorGained: number }
  | { readonly kind: "ember"; readonly attackGained: number; readonly attack: number }
  | { readonly kind: "bramble"; readonly potionGained: boolean; readonly potions: number }
  | { readonly kind: "star"; readonly xpGained: number; readonly level: number }
  | { readonly kind: "void"; readonly strideGained: number; readonly stride: number }
  | { readonly kind: "blood"; readonly hpMaxGained: number; readonly healed: number; readonly hpMax: number }
  | { readonly kind: "pending" };

export type GameEvent =
  | { readonly type: "TURN_STARTED"; readonly turn: number }
  | InputRejectedEvent
  | {
      readonly type: "HERO_MOVED";
      readonly from: Cell;
      readonly to: Cell;
      readonly path: readonly Cell[];
    }
  | { readonly type: "EXIT_UNLOCKED" }
  | {
      readonly type: "TILE_RESOLVED";
      readonly cell: Cell;
      readonly rune: Rune | null;
    }
  | {
      readonly type: "RUNE_SPAWNED";
      readonly cell: Cell;
      readonly rune: Rune;
    }
  | { readonly type: "FOCUS_GAINED"; readonly amount: number }
  | { readonly type: "GOLD_GAINED"; readonly amount: number }
  | { readonly type: "HP_HEALED"; readonly amount: number }
  | { readonly type: "ARMOR_GAINED"; readonly amount: number }
  | {
      readonly type: "LATTICE_CHARGED";
      readonly lattice: LatticeId;
      readonly keystone: Rune;
    }
  | { readonly type: "LATTICE_DECHARGED"; readonly lattice: LatticeId }
  | {
      readonly type: "KEYSTONE_BONUS";
      readonly lattice: LatticeId;
      readonly keystone: Rune;
      readonly effect: KeystoneBonusEffect;
    }
  | {
      readonly type: "DAMAGE_DEALT";
      readonly source: EntityId;
      readonly target: EntityId;
      readonly amount: number;
    }
  | {
      readonly type: "ENEMY_DAMAGED";
      readonly enemyId: EntityId;
      readonly cell: Cell;
      readonly hpAfter: number;
    }
  | {
      readonly type: "ENEMY_KILLED";
      readonly enemyId: EntityId;
      readonly cell: Cell;
    }
  | {
      readonly type: "HERO_DAMAGED";
      readonly amount: number;
      readonly absorbed: number;
      readonly hpAfter: number;
    }
  | {
      readonly type: "ENEMY_MOVED";
      readonly enemyId: EntityId;
      readonly from: Cell;
      readonly to: Cell;
    }
  | {
      readonly type: "ENEMY_ATTACKED";
      readonly enemyId: EntityId;
      readonly cell: Cell;
    }
  | {
      readonly type: "HERO_LEVELED_UP";
      readonly level: number;
      readonly hpMax: number;
    }
  | {
      readonly type: "POTION_GAINED";
      readonly potions: number;
    }
  | {
      readonly type: "POTION_USED";
      readonly healed: number;
      readonly potions: number;
    }
  | { readonly type: "KEY_DROPPED"; readonly cell: Cell }
  | { readonly type: "KEY_COLLECTED"; readonly cell: Cell }
  | { readonly type: "FLOOR_COMPLETED"; readonly floorIndex: number }
  | { readonly type: "HERO_DIED"; readonly atTurn: number };
