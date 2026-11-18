import { describe, expect, it } from "vitest";
import type { Visit } from "./types";
import { durationHistogram, quantile, zoneDwell } from "./visit-stats";

describe("quantile", () => {
  it("interpolates and handles edge cases", () => {
    expect(quantile([], 0.5)).toBe(0);
    expect(quantile([5], 0.9)).toBe(5);
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([10, 20, 30], 1)).toBe(30);
  });
});

describe("durationHistogram", () => {
  it("puts visits in equal [from, to) buckets with an open last bucket", () => {
    const h = durationHistogram([30, 119, 120, 600, 1799, 1800, 7200]);
    expect(h).toHaveLength(16);
    expect(h.every((b) => b.toMin === null || b.toMin - b.fromMin === 2)).toBe(true);
    const byLabel = Object.fromEntries(h.filter((b) => b.visits).map((b) => [b.label, b.visits]));
    expect(byLabel).toEqual({ "0–2 min": 2, "2–4 min": 1, "10–12 min": 1, "28–30 min": 1, "30+ min": 2 });
    expect(h.reduce((a, b) => a + b.share, 0)).toBeCloseTo(1);
    expect(durationHistogram([]).every((b) => b.visits === 0 && b.share === 0)).toBe(true);
  });
});

describe("zoneDwell", () => {
  const visits = [
    {
      path: [
        { zone: "entrance", dwellSec: 20 },
        { zone: "womenswear", dwellSec: 300 },
      ],
    },
    {
      path: [
        { zone: "entrance", dwellSec: 30 },
        { zone: "womenswear", dwellSec: 100 },
      ],
    },
    // Still inside: the womenswear stop is ongoing and must not count as dwell.
    {
      path: [
        { zone: "entrance", dwellSec: 25 },
        { zone: "womenswear", dwellSec: 5 },
      ],
    },
  ] satisfies Pick<Visit, "path">[];

  it("summarises completed stops and counts who visited", () => {
    const [entrance, women, men] = zoneDwell(visits, ["entrance", "womenswear", "menswear"], (i) => i === 2);
    expect(entrance).toMatchObject({ stops: 3, visitShare: 1, medianSec: 25 });
    expect(women).toMatchObject({ stops: 2, medianSec: 200, p25Sec: 150, p75Sec: 250 });
    expect(women.visitShare).toBe(1);
    expect(men).toMatchObject({ stops: 0, visitShare: 0, medianSec: 0 });
  });
});
