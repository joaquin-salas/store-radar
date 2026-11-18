import { describe, expect, it } from "vitest";
import { computeKpis, funnel, hourProfile, trafficSeries, zoneStats } from "./metrics";
import type { DaySummary, HourAgg, InStoreZone } from "./types";

const IN_STORE: InStoreZone[] = ["entrance", "womenswear", "menswear", "kids", "fitting-rooms", "checkout"];

function hour(h: number, partial: Partial<HourAgg> = {}): HourAgg {
  const zones = Object.fromEntries(
    IN_STORE.map((z) => [z, { visitors: 0, dwellSec: 0 }]),
  ) as HourAgg["zones"];
  return {
    hour: h,
    street: 0,
    entrants: 0,
    registered: 0,
    browsed: 0,
    checkouts: 0,
    dwellSec: 0,
    zones,
    ...partial,
  };
}

function day(date: string, hours: HourAgg[], open = { open: 10, close: 12 }): DaySummary {
  const byHour = Array.from({ length: 24 }, (_, h) => hours.find((x) => x.hour === h) ?? hour(h));
  return { storeId: "test", date, hours: open, cutoffSec: null, byHour, customerVisits: [] };
}

const sample = day("2026-11-10", [
  hour(9, { street: 500 }), // before opening: ignored for capture rate
  hour(10, { street: 1000, entrants: 100, registered: 20, browsed: 80, checkouts: 25, dwellSec: 60_000 }),
  hour(11, { street: 1000, entrants: 150, registered: 30, browsed: 120, checkouts: 35, dwellSec: 90_000 }),
]);
sample.byHour[10].zones.womenswear = { visitors: 60, dwellSec: 24_000 };
sample.byHour[11].zones.womenswear = { visitors: 90, dwellSec: 36_000 };
sample.byHour[11].zones["fitting-rooms"] = { visitors: 40, dwellSec: 16_000 };

describe("computeKpis", () => {
  it("computes the documented definitions", () => {
    const k = computeKpis([sample]);
    expect(k.streetPassersby).toBe(2000);
    expect(k.visitors).toBe(250);
    expect(k.captureRate).toBeCloseTo(0.125);
    expect(k.avgDwellSec).toBe(600);
    expect(k.checkoutRate).toBeCloseTo(0.24);
    expect(k.registeredShare).toBeCloseTo(0.2);
    expect(k.peakHour).toBe(11);
  });

  it("handles empty input without dividing by zero", () => {
    const k = computeKpis([]);
    expect(k.captureRate).toBe(0);
    expect(k.peakHour).toBeNull();
  });
});

describe("series and breakdowns", () => {
  it("builds hourly and daily traffic over opening hours only", () => {
    expect(trafficSeries([sample], "hour").map((p) => p.bucket)).toEqual([
      "2026-11-10T10:00",
      "2026-11-10T11:00",
    ]);
    const [daily] = trafficSeries([sample], "day");
    expect(daily).toMatchObject({ street: 2000, visitors: 250, captureRate: 0.125 });
  });

  it("skips hours after the live cut-off", () => {
    const live = { ...sample, cutoffSec: 10 * 3600 + 1800 };
    expect(trafficSeries([live], "hour").map((p) => p.hour)).toEqual([10]);
  });

  it("computes zone visit rates and dwell", () => {
    const [womens] = zoneStats([sample], ["womenswear"]);
    expect(womens).toMatchObject({ visitors: 150, visitRate: 0.6, avgDwellSec: 400 });
  });

  it("builds the funnel with step conversions", () => {
    const steps = funnel([sample]);
    expect(steps.map((s) => s.step)).toEqual(["street", "entrance", "browsed", "fitting-rooms", "checkout"]);
    expect(steps.map((s) => s.count)).toEqual([2000, 250, 200, 40, 60]);
    expect(steps[1].fromPrevious).toBeCloseTo(0.125);
    expect(steps[4].fromTop).toBeCloseTo(0.03);
  });

  it("averages the hour profile across dates", () => {
    const other = day("2026-11-11", [hour(10, { street: 600, entrants: 50 })]);
    const profile = hourProfile([sample, other]);
    expect(profile.find((p) => p.hour === 10)?.avgVisitors).toBe(75);
  });
});
