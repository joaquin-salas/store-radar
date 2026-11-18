import { describe, expect, it } from "vitest";
import { getStore } from "./catalog";
import { createRng } from "./random";
import { generateDay, getDaySummary, simulateDay, summarizeDay } from "./generator";
import type { LocalDateTime } from "./time";

const granVia = getStore("mad-granvia")!;
const barcelona = getStore("bcn-pdg")!;
const NOW: LocalDateTime = { date: "2026-11-18", hour: 16, minute: 30, second: 0 };

describe("random", () => {
  it("is deterministic per seed", () => {
    const a = createRng("seed");
    const b = createRng("seed");
    const c = createRng("other");
    const seqA = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(seqA);
    expect(Array.from({ length: 5 }, () => c.next())).not.toEqual(seqA);
  });
});

describe("generateDay", () => {
  it("produces identical data for the same store and day", () => {
    expect(generateDay(granVia, "2026-11-10")).toEqual(generateDay(granVia, "2026-11-10"));
  });

  it("only creates visits during opening hours, sorted by entry time", () => {
    const { visits } = generateDay(granVia, "2026-11-10");
    expect(visits.length).toBeGreaterThan(500);
    for (let i = 0; i < visits.length; i++) {
      const hour = Math.floor(visits[i].enteredSec / 3600);
      expect(hour).toBeGreaterThanOrEqual(granVia.hours.open);
      expect(hour).toBeLessThan(granVia.hours.close);
      if (i > 0) expect(visits[i].enteredSec).toBeGreaterThanOrEqual(visits[i - 1].enteredSec);
      expect(visits[i].path[0].zone).toBe("entrance");
    }
  });

  it("has no visits on Sunday for stores closed on Sundays", () => {
    const sunday = "2026-11-15";
    expect(generateDay(barcelona, sunday).visits).toHaveLength(0);
    expect(generateDay(granVia, sunday).visits.length).toBeGreaterThan(0);
  });

  it("only uses fitting rooms after apparel browsing; checkout flag matches path", () => {
    for (const v of generateDay(granVia, "2026-11-10").visits) {
      const zones = v.path.map((s) => s.zone);
      if (zones.includes("fitting-rooms")) {
        expect(zones.some((z) => z === "womenswear" || z === "menswear")).toBe(true);
      }
      expect(zones.includes("checkout")).toBe(v.checkout);
    }
  });
});

describe("summaries", () => {
  it("aggregate exactly the generated visits", () => {
    const day = simulateDay(granVia, "2026-11-10");
    const summary = summarizeDay(granVia, "2026-11-10", day);
    const entrants = summary.byHour.reduce((s, h) => s + h.entrants, 0);
    const checkouts = summary.byHour.reduce((s, h) => s + h.checkouts, 0);
    expect(entrants).toBe(day.visits.length);
    expect(checkouts).toBe(day.visits.filter((v) => v.checkout).length);
    expect(summary.customerVisits).toHaveLength(day.visits.filter((v) => v.customerId).length);
  });

  it("cuts today off at the current time", () => {
    const today = getDaySummary("mad-granvia", NOW.date, NOW);
    expect(today.cutoffSec).toBe(16 * 3600 + 30 * 60);
    expect(today.byHour[17].entrants).toBe(0);
    expect(today.byHour[17].street).toBe(0);
    expect(today.byHour[15].entrants).toBeGreaterThan(0);
    // Current hour is half elapsed: street count is pro-rated.
    const full = generateDay(granVia, NOW.date).street[16];
    expect(today.byHour[16].street).toBe(Math.round(full / 2));
  });

  it("returns empty summaries for future days", () => {
    const future = getDaySummary("mad-granvia", "2026-11-19", NOW);
    expect(future.byHour.every((h) => h.entrants === 0 && h.street === 0)).toBe(true);
  });
});
