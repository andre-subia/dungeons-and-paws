/**
 * SeededRNG — deterministic pseudo-random number generator.
 *
 * Algorithm: Mulberry32. Cheap, decent distribution for game use,
 * 32-bit state — easy to serialize and reproduce.
 *
 * Forking lets independent subsystems (generation, AI, rewards) draw
 * from independent streams so reordering an unrelated subsystem's calls
 * does not perturb the other streams' outputs.
 */

export class SeededRNG {
  private state: number;

  constructor(seed: string | number) {
    this.state = typeof seed === "number" ? seed >>> 0 : hashString(seed);
    // Step once to avoid bias when seed is 0 or very small.
    this.next();
  }

  /** Returns a float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns an integer in [min, maxExclusive). */
  range(min: number, maxExclusive: number): number {
    if (maxExclusive <= min) {
      throw new Error(`range: maxExclusive (${maxExclusive}) must exceed min (${min})`);
    }
    return Math.floor(this.next() * (maxExclusive - min)) + min;
  }

  /** Inclusive integer roll, e.g. d6 = rollDie(6). */
  rollDie(sides: number): number {
    return this.range(1, sides + 1);
  }

  /** Returns true with the given probability. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Picks a uniformly-random element. Throws if empty. */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error("pick: empty array");
    const item = arr[this.range(0, arr.length)];
    if (item === undefined) {
      throw new Error("pick: undefined slot (sparse array?)");
    }
    return item;
  }

  /** Picks an element weighted by parallel weights array. */
  weighted<T>(items: readonly T[], weights: readonly number[]): T {
    if (items.length === 0) throw new Error("weighted: empty items");
    if (items.length !== weights.length) {
      throw new Error(
        `weighted: length mismatch (${items.length} vs ${weights.length})`,
      );
    }
    let total = 0;
    for (const w of weights) {
      if (w < 0) throw new Error("weighted: negative weight");
      total += w;
    }
    if (total <= 0) throw new Error("weighted: total weight is 0");
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i]!;
      if (r <= 0) return items[i]!;
    }
    return items[items.length - 1]!;
  }

  /** Returns a Fisher-Yates shuffled copy. Does not mutate input. */
  shuffle<T>(arr: readonly T[]): T[] {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.range(0, i + 1);
      const tmp = copy[i]!;
      copy[i] = copy[j]!;
      copy[j] = tmp;
    }
    return copy;
  }

  /**
   * Forks an independent RNG seeded from this one's state + a label.
   * Use one fork per subsystem (generation, enemy AI, rewards, ...).
   */
  fork(label: string): SeededRNG {
    return new SeededRNG(`${this.state.toString(16)}:${label}`);
  }

  /** Exposed for snapshots and debugging. */
  getState(): number {
    return this.state;
  }
}

/** FNV-1a 32-bit string hash. Stable, fast, no external deps. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
