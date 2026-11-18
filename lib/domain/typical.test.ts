import { describe, expect, it } from "vitest";
import { getLiveSnapshot } from "./live";
import { getPace, typicalDates, typicalOccupancyAt, weekdayName } from "./typical";
import type { LocalDateTime } from "./time";

const WED_AFTERNOON: LocalDateTime = { date: "2026-11-18", hour: 17, minute: 30, second: 0 };

describe("typical day", () => {
  it("uses the same weekday of the previous four weeks", () => {
    expect(typicalDates("2026-11-18")).toEqual(["2026-11-11", "2026-11-04", "2026-10-28", "2026-10-21"]);
    expect(weekdayName("2026-11-18")).toBe("Wednesday");
  });

  it("averages occupancy across the typical dates", () => {
    const typical = typicalOccupancyAt("mad-granvia", "2026-11-18", 17 * 3600);
    expect(typical).toBeGreaterThan(10);
    expect(typicalOccupancyAt("mad-granvia", "2026-11-18", 8 * 3600)).toBe(0);
  });
});

describe("pace", () => {
  it("compares today so far with a typical day at the same time", () => {
    const pace = getPace("mad-granvia", WED_AFTERNOON);
    expect(pace.weekday).toBe("Wednesday");
    expect(pace.kpis.visitors).toBeGreaterThan(0);
    expect(pace.typicalKpis.visitors).toBeGreaterThan(0);
    // Typical so far is a fraction of a typical full day.
    expect(pace.typicalKpis.visitors).toBeLessThan(pace.forecast.typicalFullDay);
    expect(pace.forecast.typicalProgress).toBeGreaterThan(0.3);
    expect(pace.forecast.typicalProgress).toBeLessThan(0.9);
    // The forecast can't be below what has already happened.
    expect(pace.forecast.visitors).toBeGreaterThan(pace.kpis.visitors);
  });

  it("lists every opening hour, with future hours empty, and an evening usual peak", () => {
    const pace = getPace("mad-granvia", WED_AFTERNOON);
    expect(pace.hourly.map((h) => h.hour)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
    expect(pace.hourly.find((h) => h.hour === 16)?.visitors).toBeGreaterThan(0);
    expect(pace.hourly.find((h) => h.hour === 18)?.visitors).toBeNull();
    expect(pace.usualPeak?.hour).toBeGreaterThanOrEqual(17);
  });

  it("forecasts nothing for a store that is closed today", () => {
    const pace = getPace("bcn-pdg", { date: "2026-11-15", hour: 13, minute: 0, second: 0 }); // Sunday
    expect(pace.openToday).toBe(false);
    expect(pace.forecast.visitors).toBe(0);
    expect(pace.hourly).toHaveLength(0);
  });
});

describe("live snapshot extras", () => {
  it("reports capacity, a 90-minute series and registered customers", () => {
    const snap = getLiveSnapshot("mad-granvia", WED_AFTERNOON);
    expect(snap.capacity).toBe(100);
    expect(snap.fill).toBeCloseTo(snap.peopleInside / 100);
    expect(snap.series.at(-1)?.inside).toBe(snap.peopleInside);
    expect(snap.series.at(-1)?.time).toBe("17:30");
    expect(snap.series.length).toBeGreaterThanOrEqual(18);
    for (const z of snap.zones) expect(z.fill).toBeCloseTo(z.capacity ? z.occupancy / z.capacity : 0);
    expect(snap.registered.every((r) => snap.zones.some((z) => z.zone === r.zone))).toBe(true);
    const ranks = snap.registered.map((r) => ({ gold: 0, silver: 1, bronze: 2 })[r.tier]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("raises alerts for full zones, critical first", () => {
    // Scan a busy Saturday afternoon for a moment with at least one alert.
    const saturday = "2026-11-14";
    let found = false;
    for (let m = 0; m < 6 * 60 && !found; m += 10) {
      const now = { date: saturday, hour: 15 + Math.floor(m / 60), minute: m % 60, second: 0 };
      const snap = getLiveSnapshot("mad-granvia", now);
      if (snap.alerts.length === 0) continue;
      found = true;
      for (const a of snap.alerts) expect(a.detail).toMatch(/\d+ of \d+ \(\d+%\)/);
      const levels = snap.alerts.map((a) => a.level);
      expect(levels).toEqual([...levels].sort((a, b) => (a === b ? 0 : a === "critical" ? -1 : 1)));
    }
    expect(found).toBe(true);
  });
});
