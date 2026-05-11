/**
 * LatticeTracker — tracks rune sets per Row, Column, and Chamber.
 *
 * A Lattice "Charges" when its cells contain all RUNES (live count of
 * unique runes present). The keystone is the rune that completed it
 * (i.e. the rune that became the 9th unique entry on the most recent
 * recompute).
 *
 * For a 9x9 grid: 9 rows + 9 columns + 9 chambers = 27 lattices.
 *
 * State design: lattices live as a snapshot per turn. Recomputed
 * after each grid mutation by diffing against the previous snapshot.
 * Cheap (27 sets of ≤9 entries) and avoids subscription bookkeeping.
 */

import { RUNE_COUNT, type LatticeId, type LatticeKind, type Rune } from "../core/types.js";
import { Grid } from "./grid.js";

export type LatticeState = {
  readonly id: LatticeId;
  readonly kind: LatticeKind;
  readonly index: number;
  readonly runesPresent: ReadonlySet<Rune>;
  readonly isCharged: boolean;
  /** Number of unique runes required to charge this lattice. */
  readonly chargeThreshold: number;
  /** Rune that pushed this lattice to its charged state on the latest recompute. */
  readonly keystone: Rune | null;
};

export type LatticeSnapshot = {
  /** All lattices, indexed by id for O(1) lookup. */
  readonly byId: ReadonlyMap<LatticeId, LatticeState>;
  /** Lattices that BECAME charged on the most recent recompute. */
  readonly newlyCharged: readonly LatticeState[];
};

export const EMPTY_SNAPSHOT: LatticeSnapshot = {
  byId: new Map(),
  newlyCharged: [],
};

function latticeId(kind: LatticeKind, index: number): LatticeId {
  return `${kind}:${index}` as LatticeId;
}

/**
 * Recomputes the full lattice state from a Grid.
 *
 * - `previous` is the prior snapshot. Used to detect newly-charged
 *   lattices and identify keystones (the rune that wasn't present in
 *   the previous snapshot but is in the new one).
 * - If a lattice was charged before and is no longer (decharge), it
 *   simply appears as not-charged in the new snapshot. Decharge is
 *   surfaced by callers by diffing.
 */
export function recomputeLattices(
  grid: Grid,
  previous: LatticeSnapshot = EMPTY_SNAPSHOT,
): LatticeSnapshot {
  const byId = new Map<LatticeId, LatticeState>();
  const newlyCharged: LatticeState[] = [];

  // Rows
  for (let y = 0; y < grid.size; y++) {
    const tiles = grid.rowAt(y);
    const id = latticeId("row", y);
    const state = buildLattice(id, "row", y, tiles, previous);
    byId.set(id, state);
    if (state.isCharged && !wasCharged(previous, id)) newlyCharged.push(state);
  }

  // Columns
  for (let x = 0; x < grid.size; x++) {
    const tiles = grid.colAt(x);
    const id = latticeId("column", x);
    const state = buildLattice(id, "column", x, tiles, previous);
    byId.set(id, state);
    if (state.isCharged && !wasCharged(previous, id)) newlyCharged.push(state);
  }

  // Chambers
  for (let c = 0; c < grid.chamberCount; c++) {
    const tiles = grid.chamberByIndex(c);
    const id = latticeId("chamber", c);
    const state = buildLattice(id, "chamber", c, tiles, previous);
    byId.set(id, state);
    if (state.isCharged && !wasCharged(previous, id)) newlyCharged.push(state);
  }

  return { byId, newlyCharged };
}

function buildLattice(
  id: LatticeId,
  kind: LatticeKind,
  index: number,
  tiles: readonly { rune: Rune | null }[],
  previous: LatticeSnapshot,
): LatticeState {
  const runesPresent = new Set<Rune>();
  for (const t of tiles) {
    if (t.rune !== null) runesPresent.add(t.rune);
  }
  // Adaptive threshold: a 6-cell line can never hold more than 6 unique
  // runes; a 9-cell line caps at the full RUNE_COUNT. This lets the same
  // lattice system work on grids of any size.
  const chargeThreshold = Math.min(tiles.length, RUNE_COUNT);
  const isCharged = runesPresent.size === chargeThreshold;
  let keystone: Rune | null = null;

  if (isCharged) {
    const prev = previous.byId.get(id);
    if (prev && prev.isCharged) {
      // Already charged before — preserve prior keystone.
      keystone = prev.keystone;
    } else if (prev) {
      // Just charged — keystone is the rune absent from prev set.
      for (const r of runesPresent) {
        if (!prev.runesPresent.has(r)) {
          keystone = r;
          break;
        }
      }
    } else {
      // No prior snapshot. Keystone unknown — pick deterministically.
      // Iteration order on a Set in JS is insertion order, which is
      // grid traversal order, which is deterministic.
      for (const r of runesPresent) {
        keystone = r;
      }
    }
  }

  return { id, kind, index, runesPresent, chargeThreshold, isCharged, keystone };
}

function wasCharged(snap: LatticeSnapshot, id: LatticeId): boolean {
  const prev = snap.byId.get(id);
  return prev?.isCharged === true;
}

/**
 * Identifies lattices that lost their charged status between snapshots.
 * Useful for emitting LATTICE_DECHARGED events.
 */
export function newlyDecharged(
  before: LatticeSnapshot,
  after: LatticeSnapshot,
): LatticeId[] {
  const out: LatticeId[] = [];
  for (const [id, prev] of before.byId) {
    if (!prev.isCharged) continue;
    const next = after.byId.get(id);
    if (!next || !next.isCharged) out.push(id);
  }
  return out;
}
