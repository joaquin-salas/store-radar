import { describe, expect, it } from "vitest";
import { getStore } from "./catalog";
import { createRng } from "./random";
import { generateDay, getDaySummary, routeKey, simulateDay, summarizeDay } from "./generator";
import type { LocalDateTime } from "./time";

const granVia = getStore("mad-granvia")!;
const barcelona = getStore("bcn-pdg")!;
const valencia = getStore("vlc-colon")!;
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

  it("goes to the fitting rooms straight from apparel; checkout only at the end", () => {
    for (const v of generateDay(granVia, "2026-11-10").visits) {
      const zones = v.path.map((s) => s.zone);
      const fitting = zones.indexOf("fitting-rooms");
      if (fitting >= 0) expect(["womenswear", "menswear"]).toContain(zones[fitting - 1]);
      expect(zones.filter((z) => z === "fitting-rooms").length).toBeLessThanOrEqual(1);
      expect(zones.includes("checkout")).toBe(v.checkout);
      if (v.checkout) expect(zones.at(-1)).toBe("checkout");
      for (let i = 1; i < zones.length; i++) expect(zones[i]).not.toBe(zones[i - 1]);
    }
  });

  it("walks the zones in varying order, sometimes going back", () => {
    const { visits } = generateDay(granVia, "2026-11-10");
    const routes = new Set(visits.map((v) => routeKey(v.path)));
    const share = (f: (z: string[]) => boolean) =>
      visits.filter((v) => f(v.path.map((s) => s.zone))).length / visits.length;
    expect(routes.size).toBeGreaterThan(40);
    // Womenswear first most often, but menswear first is common too.
    expect(share((z) => z[1] === "womenswear")).toBeGreaterThan(share((z) => z[1] === "menswear"));
    expect(share((z) => z[1] === "menswear")).toBeGreaterThan(0.1);
    // Going back: around one visit in six returns to a zone already seen.
    const back = share((z) => new Set(z).size < z.length);
    expect(back).toBeGreaterThan(0.08);
    expect(back).toBeLessThan(0.3);
    // Some leave straight from the entrance; most look around.
    const entranceOnly = share((z) => z.length === 1);
    expect(entranceOnly).toBeGreaterThan(0.1);
    expect(entranceOnly).toBeLessThan(0.35);
  });

  it("never visits zones a store doesn't have", () => {
    for (const v of generateDay(valencia, "2026-11-10").visits) {
      for (const s of v.path) expect(valencia.zones).toContain(s.zone);
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
    // Every visit lands in exactly one route group.
    const routed = summary.routes.flatMap((m) => Object.values(m)).reduce((s, r) => s + r.visits, 0);
    expect(routed).toBe(day.visits.length);
  });

  it("counts each visitor once per zone, even when they go back", () => {
    const day = simulateDay(granVia, "2026-11-10");
    const summary = summarizeDay(granVia, "2026-11-10", day);
    const womens = summary.byHour.reduce((s, h) => s + h.zones.womenswear.visitors, 0);
    expect(womens).toBe(day.visits.filter((v) => v.path.some((s) => s.zone === "womenswear")).length);
  });

  it("only counts what has happened by the cut-off", () => {
    const cut = 16 * 3600 + 30 * 60;
    const day = simulateDay(granVia, NOW.date);
    const summary = summarizeDay(granVia, NOW.date, day, cut);
    let reached = 0;
    let finished = 0;
    for (const v of day.visits) {
      if (v.enteredSec > cut) break;
      const left = v.enteredSec + v.totalDwellSec;
      if (left <= cut) finished++;
      // Checkout is the last stop: reached once its start is past.
      if (v.checkout && left - v.path.at(-1)!.dwellSec <= cut) reached++;
    }
    expect(summary.byHour.reduce((s, h) => s + h.checkouts, 0)).toBe(reached);
    const routed = summary.routes.flatMap((m) => Object.values(m)).reduce((s, r) => s + r.visits, 0);
    expect(routed).toBe(finished);
    for (const ref of summary.customerVisits) {
      if (ref.leftSec > cut) expect(ref.enteredSec).toBeLessThanOrEqual(cut);
    }
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
