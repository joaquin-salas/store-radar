import { describe, expect, it } from "vitest";
import {
  compareTraffic,
  computeKpis,
  funnel,
  hourProfile,
  trafficSeries,
  weekdayHours,
  zoneStats,
} from "./metrics";
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
    returning: 0,
    browsed: 0,
    checkouts: 0,
    dwellSec: 0,
    zones,
    ...partial,
  };
}

function day(date: string, hours: HourAgg[], open = { open: 10, close: 12 }): DaySummary {
  const byHour = Array.from({ length: 24 }, (_, h) => hours.find((x) => x.hour === h) ?? hour(h));
  return {
    storeId: "test",
    date,
    hours: open,
    cutoffSec: null,
    byHour,
    customerVisits: [],
    routes: [{}, {}, {}, {}],
  };
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
    expect(steps.map((s) => s.nested)).toEqual([true, true, true, true, false]);
  });

  it("averages the hour profile across dates", () => {
    const other = day("2026-11-11", [hour(10, { street: 600, entrants: 50 })]);
    const profile = hourProfile([sample, other]);
    expect(profile.find((p) => p.hour === 10)?.avgVisitors).toBe(75);
  });
});

describe("compareTraffic", () => {
  const monday = day("2026-11-09", [hour(10, { street: 800, entrants: 80, returning: 30 })]);
  const tuesday = day("2026-11-10", [
    hour(10, { street: 1000, entrants: 100, returning: 40 }),
    hour(11, { street: 1000, entrants: 150 }),
  ]);

  it("lines up hours of day, current null where nothing happened yet", () => {
    const live = { ...tuesday, cutoffSec: 10 * 3600 + 1800 };
    const points = compareTraffic(trafficSeries([live], "hour"), trafficSeries([tuesday], "hour"), {
      granularity: "hour",
      range: { from: "2026-11-11", to: "2026-11-11" },
      previousRange: { from: "2026-11-10", to: "2026-11-10" },
      today: "2026-11-11",
    });
    expect(points.map((p) => p.hour)).toEqual([10, 11]);
    expect(points[0]).toMatchObject({ visitors: 100, returning: 40, previous: { visitors: 100 } });
    expect(points[1]).toMatchObject({ visitors: null, previous: { visitors: 150 } });
  });

  it("lines up days by position; closed days are zero and future days null", () => {
    const points = compareTraffic(trafficSeries([tuesday], "day"), trafficSeries([monday], "day"), {
      granularity: "day",
      range: { from: "2026-11-10", to: "2026-11-12" },
      previousRange: { from: "2026-11-07", to: "2026-11-09" },
      today: "2026-11-11",
    });
    expect(points.map((p) => [p.date, p.previousDate])).toEqual([
      ["2026-11-10", "2026-11-07"],
      ["2026-11-11", "2026-11-08"],
      ["2026-11-12", "2026-11-09"],
    ]);
    expect(points[0]).toMatchObject({ visitors: 250, previous: { visitors: 0 } });
    expect(points[1].visitors).toBe(0);
    expect(points[2]).toMatchObject({ visitors: null, previous: { visitors: 80 } });
  });
});

describe("weekdayHours", () => {
  it("averages visitors per weekday and hour across dates, Monday first", () => {
    const tue1 = day("2026-11-03", [hour(10, { entrants: 100 }), hour(11, { entrants: 40 })]);
    const tue2 = day("2026-11-10", [hour(10, { entrants: 60 }), hour(11, { entrants: 20 })]);
    const sun = { ...day("2026-11-08", []), hours: null };
    const h = weekdayHours([tue1, tue2, sun]);
    expect(h.hours).toEqual([10, 11]);
    expect(h.rows.map((r) => r.label)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    const tue = h.rows[1];
    expect(tue.dates).toBe(2);
    expect(tue.values).toEqual([80, 30]);
    expect(h.rows[0].values).toEqual([null, null]);
    expect(h.rows[6].dates).toBe(0);
    expect(h.max).toBe(80);
  });

  it("sums stores on the same date", () => {
    const a = day("2026-11-10", [hour(10, { entrants: 50 })]);
    const b = { ...day("2026-11-10", [hour(10, { entrants: 30 })]), storeId: "other" };
    expect(weekdayHours([a, b]).rows[1].values[0]).toBe(80);
  });
});
