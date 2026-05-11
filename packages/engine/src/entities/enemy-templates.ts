/**
 * Enemy template registry.
 *
 * Tuned for the 8-HP cat hero: most enemies need 2-3 hits and deal
 * 1-2 damage per retaliation. Ogre is a deliberate threat on the
 * final floor — 5 HP / 2 attack means 4 retaliations + 8 damage if
 * you fight head-on. You either out-Tide it or route around.
 *
 * Each enemy carries a rune so it contributes to the lattice when on
 * the grid and removes that contribution when killed — combat reshapes
 * the puzzle, exactly the loop interaction the design calls for.
 */

import type { EnemyArchetype } from "./enemy.js";
import type { Rune } from "../core/types.js";

export type EnemyTemplate = {
  readonly templateId: string;
  readonly archetype: EnemyArchetype;
  readonly hp: number;
  readonly attack: number;
  readonly rune: Rune;
};

export const ENEMY_TEMPLATES = {
  bat:      { templateId: "bat",      archetype: "hunter", hp: 2, attack: 1, rune: "void"    },
  rat:      { templateId: "rat",      archetype: "hunter", hp: 2, attack: 1, rune: "blood"   },
  snake:    { templateId: "snake",    archetype: "hunter", hp: 2, attack: 2, rune: "bramble" },
  spider:   { templateId: "spider",   archetype: "hunter", hp: 3, attack: 1, rune: "ember"   },
  skeleton: { templateId: "skeleton", archetype: "ward",   hp: 3, attack: 1, rune: "bone"    },
  ghost:    { templateId: "ghost",    archetype: "weaver", hp: 2, attack: 2, rune: "star"    },
  slime:    { templateId: "slime",    archetype: "ward",   hp: 4, attack: 1, rune: "tide"    },
  ogre:     { templateId: "ogre",     archetype: "ward",   hp: 5, attack: 2, rune: "iron"    },
} as const satisfies Record<string, EnemyTemplate>;

export type EnemyTemplateId = keyof typeof ENEMY_TEMPLATES;

export const ENEMY_TEMPLATE_IDS = Object.keys(ENEMY_TEMPLATES) as readonly EnemyTemplateId[];

/** Easier templates used for early floors. */
export const EASY_TEMPLATES: readonly EnemyTemplateId[] = ["bat", "rat", "spider"];
/** Mixed pool used for mid floors. */
export const MEDIUM_TEMPLATES: readonly EnemyTemplateId[] = [
  "bat", "rat", "snake", "spider", "skeleton",
];
/** Full pool including the dangerous ones for late floors. */
export const HARD_TEMPLATES: readonly EnemyTemplateId[] = [
  "snake", "spider", "skeleton", "ghost", "slime", "ogre",
];

export function getEnemyTemplate(id: EnemyTemplateId): EnemyTemplate {
  return ENEMY_TEMPLATES[id];
}
