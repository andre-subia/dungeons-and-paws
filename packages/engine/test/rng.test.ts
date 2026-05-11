import { describe, it, expect } from "vitest";
import { SeededRNG, hashString } from "../src/core/rng.js";

describe("SeededRNG", () => {
  it("is deterministic across two instances with the same seed", () => {
    const a = new SeededRNG("GRD-TEST-001");
    const b = new SeededRNG("GRD-TEST-001");
    const seqA: number[] = [];
    const seqB: number[] = [];
    for (let i = 0; i < 100; i++) {
      seqA.push(a.next());
      seqB.push(b.next());
    }
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = new SeededRNG("seed-A");
    const b = new SeededRNG("seed-B");
    expect(a.next()).not.toBe(b.next());
  });

  it("range respects bounds", () => {
    const r = new SeededRNG("bounds");
    for (let i = 0; i < 200; i++) {
      const n = r.range(5, 10);
      expect(n).toBeGreaterThanOrEqual(5);
      expect(n).toBeLessThan(10);
    }
  });

  it("pick selects an array element deterministically", () => {
    const r1 = new SeededRNG("pick");
    const r2 = new SeededRNG("pick");
    const arr = ["a", "b", "c", "d", "e"];
    for (let i = 0; i < 20; i++) {
      expect(r1.pick(arr)).toBe(r2.pick(arr));
    }
  });

  it("weighted respects bias roughly over many trials", () => {
    const r = new SeededRNG("weighted");
    const items = ["A", "B"];
    const weights = [9, 1];
    let aCount = 0;
    const N = 5000;
    for (let i = 0; i < N; i++) {
      if (r.weighted(items, weights) === "A") aCount++;
    }
    // Expect ~90% A; tolerate ±3%.
    expect(aCount / N).toBeGreaterThan(0.87);
    expect(aCount / N).toBeLessThan(0.93);
  });

  it("shuffle produces a permutation and does not mutate input", () => {
    const r = new SeededRNG("shuffle");
    const orig = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const out = r.shuffle(orig);
    expect(out).toHaveLength(orig.length);
    expect([...out].sort()).toEqual([...orig].sort());
    expect(orig).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("forks produce independent streams keyed by label", () => {
    const root = new SeededRNG("root");
    const a1 = root.fork("subsystem-A");
    const a2 = new SeededRNG("root").fork("subsystem-A");
    expect(a1.next()).toBe(a2.next());

    const b = new SeededRNG("root").fork("subsystem-B");
    // Different label → different stream.
    const a3 = new SeededRNG("root").fork("subsystem-A");
    expect(a3.next()).not.toBe(b.next());
  });

  it("hashString is stable", () => {
    expect(hashString("GRD-TEST-001")).toBe(hashString("GRD-TEST-001"));
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});
