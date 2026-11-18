import { describe, expect, it } from "vitest";
import { STORES } from "./catalog";
import { CUSTOMER_COUNT } from "./customers";
import { rangeSchema } from "./schemas";
import {
  compareStores,
  getCustomersPage,
  getOverview,
  getTraffic,
  getVisit,
  getVisitStats,
  getVisitsPage,
  getZones,
  previousRange,
  resolveRange,
} from "./service";
import type { LocalDateTime } from "./time";

const NOW: LocalDateTime = { date: "2026-11-18", hour: 16, minute: 30, second: 0 };

describe("ranges", () => {
  it("resolves presets relative to now", () => {
    expect(resolveRange({ preset: "today" }, NOW)).toEqual({ from: "2026-11-18", to: "2026-11-18" });
    expect(resolveRange({ preset: "7d" }, NOW)).toEqual({ from: "2026-11-12", to: "2026-11-18" });
    expect(resolveRange({}, NOW)).toEqual({ from: "2026-11-18", to: "2026-11-18" });
    expect(previousRange({ from: "2026-11-12", to: "2026-11-18" })).toEqual({
      from: "2026-11-05",
      to: "2026-11-11",
    });
  });

  it("validates custom ranges", () => {
    expect(rangeSchema.safeParse({ from: "2026-11-01" }).success).toBe(false);
    expect(rangeSchema.safeParse({ from: "2026-11-10", to: "2026-11-01" }).success).toBe(false);
    expect(rangeSchema.safeParse({ from: "2026-01-01", to: "2026-11-01" }).success).toBe(false);
    expect(rangeSchema.safeParse({ from: "2026-11-01", to: "2026-11-10" }).success).toBe(true);
  });
});

describe("overview", () => {
  it("compares today-so-far with yesterday up to the same time", () => {
    const o = getOverview({ store: "mad-granvia", range: { preset: "today" } }, NOW);
    expect(o.live).toBe(true);
    expect(o.previousRange).toEqual({ from: "2026-11-17", to: "2026-11-17" });
    const yesterdayFull = getOverview({ store: "mad-granvia", range: { preset: "yesterday" } }, NOW);
    expect(o.previous.visitors).toBeLessThan(yesterdayFull.kpis.visitors);
    expect(o.previous.visitors).toBeGreaterThan(0);
  });

  it("chain totals equal the sum of stores", () => {
    const range = { preset: "7d" as const };
    const chain = getOverview({ store: "all", range }, NOW).kpis;
    const stores = compareStores({ range }, NOW).stores;
    expect(stores).toHaveLength(STORES.length);
    expect(stores.reduce((s, x) => s + x.kpis.visitors, 0)).toBe(chain.visitors);
  });

  it("produces realistic retail numbers", () => {
    const { kpis } = getOverview({ store: "all", range: { preset: "30d" } }, NOW);
    expect(kpis.captureRate).toBeGreaterThan(0.08);
    expect(kpis.captureRate).toBeLessThan(0.2);
    expect(kpis.checkoutRate).toBeGreaterThan(0.15);
    expect(kpis.checkoutRate).toBeLessThan(0.4);
    expect(kpis.avgDwellSec).toBeGreaterThan(5 * 60);
    expect(kpis.avgDwellSec).toBeLessThan(25 * 60);
  });
});

describe("series", () => {
  it("uses hourly granularity for a single day and daily otherwise", () => {
    expect(getTraffic({ store: "all", range: { preset: "today" } }, NOW).granularity).toBe("hour");
    const week = getTraffic({ store: "all", range: { preset: "7d" } }, NOW);
    expect(week.granularity).toBe("day");
    expect(week.points).toHaveLength(7);
  });

  it("lists only zones the store has", () => {
    const zones = getZones({ store: "vlc-colon", range: { preset: "today" } }, NOW).zones.map((z) => z.zone);
    expect(zones).not.toContain("kids");
    expect(zones).toContain("womenswear");
  });
});

describe("tables", () => {
  const visitsBase = {
    store: "mad-granvia",
    segment: "all",
    sort: "enteredAt",
    dir: "desc",
    page: 0,
    pageSize: 20,
  } as const;

  it("visit totals match the KPI visitors for the same store-day", () => {
    const page = getVisitsPage({ ...visitsBase, date: "2026-11-17" }, NOW);
    const kpis = getOverview({ store: "mad-granvia", range: { preset: "yesterday" } }, NOW).kpis;
    expect(page.total).toBe(kpis.visitors);
    expect(page.rows).toHaveLength(20);
  });

  it("filters and sorts visits", () => {
    const page = getVisitsPage({ ...visitsBase, segment: "registered", sort: "totalDwellSec" }, NOW);
    expect(page.rows.every((r) => r.customerId && r.customerName)).toBe(true);
    for (let i = 1; i < page.rows.length; i++) {
      expect(page.rows[i].totalDwellSec).toBeLessThanOrEqual(page.rows[i - 1].totalDwellSec);
    }
  });

  it("pages, searches and filters customers", () => {
    const base = { store: "all", tier: "all", sort: "visits", dir: "desc", page: 0, pageSize: 10 } as const;
    const top = getCustomersPage(base, NOW);
    expect(top.total).toBe(CUSTOMER_COUNT);
    expect(top.rows[0].visits).toBeGreaterThanOrEqual(top.rows[9].visits);
    const gold = getCustomersPage({ ...base, tier: "gold", store: "vlc-colon" }, NOW);
    expect(gold.rows.every((r) => r.tier === "gold" && r.homeStoreId === "vlc-colon")).toBe(true);
    const search = getCustomersPage({ ...base, q: "C00042" }, NOW);
    expect(search.rows.map((r) => r.id)).toEqual(["C00042"]);
  });
});

describe("visit detail", () => {
  const visitsBase = {
    store: "mad-granvia",
    segment: "all",
    sort: "enteredAt",
    dir: "asc",
    page: 0,
    pageSize: 5,
  } as const;

  it("returns the visit with a timeline that adds up", () => {
    const row = getVisitsPage({ ...visitsBase, date: "2026-11-17" }, NOW).rows[2];
    const v = getVisit(row.id, NOW)!;
    expect(v.id).toBe(row.id);
    expect(v.timeline.map((s) => s.zone)).toEqual(row.path.map((s) => s.zone));
    expect(v.timeline[0].enteredAt).toBe(row.enteredAt);
    // Each stop starts when the previous one ends; the visit ends after the last.
    const sec = (t: string) =>
      t
        .split(":")
        .map(Number)
        .reduce((a, n) => a * 60 + n, 0);
    for (let i = 1; i < v.timeline.length; i++) {
      expect(sec(v.timeline[i].enteredAt)).toBe(
        sec(v.timeline[i - 1].enteredAt) + v.timeline[i - 1].dwellSec,
      );
    }
    expect(sec(v.leftAt!) - sec(v.timeline[0].enteredAt)).toBe(row.totalDwellSec);
    expect(v.inside).toBe(false);
  });

  it("returns null for unknown, malformed or future visits", () => {
    expect(getVisit("mad-granvia-20261117-99999", NOW)).toBeNull();
    expect(getVisit("nowhere-20261117-00001", NOW)).toBeNull();
    expect(getVisit("mad-granvia-20261340-00001", NOW)).toBeNull();
    expect(getVisit("not-a-visit", NOW)).toBeNull();
    // Today's visits after "now" don't exist yet.
    const today = getVisitsPage({ ...visitsBase, date: NOW.date, dir: "desc" }, NOW);
    const lastSeq = Number(today.rows[0].id.slice(-5));
    expect(getVisit(`mad-granvia-20261118-${String(lastSeq + 1).padStart(5, "0")}`, NOW)).toBeNull();
  });
});

describe("visit in progress", () => {
  const today = {
    store: "mad-granvia",
    date: NOW.date,
    sort: "enteredAt",
    dir: "desc",
    page: 0,
    pageSize: 100,
  } as const;
  const nowSec = 16 * 3600 + 30 * 60;
  const sec = (t: string) =>
    t
      .split(":")
      .map(Number)
      .reduce((a, n) => a * 60 + n, 0);

  it("shows only what has happened so far, in the list and the detail", () => {
    const rows = getVisitsPage({ ...today, segment: "all" }, NOW).rows;
    const inside = rows.filter((r) => r.inside);
    expect(inside.length).toBeGreaterThan(0);
    for (const r of inside) expect(sec(r.enteredAt) + r.totalDwellSec).toBe(nowSec);
    // Finished visits are untouched.
    expect(rows.filter((r) => !r.inside).every((r) => sec(r.enteredAt) + r.totalDwellSec <= nowSec)).toBe(
      true,
    );

    const v = getVisit(inside[0].id, NOW)!;
    expect(v.inside).toBe(true);
    expect(v.leftAt).toBeNull();
    expect(v.totalDwellSec).toBe(inside[0].totalDwellSec);
    expect(v.timeline.map((s) => s.zone)).toEqual(inside[0].path.map((s) => s.zone));
    const last = v.timeline.at(-1)!;
    expect(sec(last.enteredAt) + last.dwellSec).toBe(nowSec);
    expect(v.checkout).toBe(v.timeline.some((s) => s.zone === "checkout"));
  });

  it("filters on what is known now", () => {
    const rows = getVisitsPage({ ...today, segment: "checkout" }, NOW).rows;
    expect(rows.every((r) => r.checkout && r.path.some((s) => s.zone === "checkout"))).toBe(true);
  });
});

describe("visit stats", () => {
  it("matches the visits table and leaves unfinished time out", () => {
    const q = { store: "mad-granvia", date: NOW.date, segment: "all" } as const;
    const stats = getVisitStats(q, NOW);
    const page = getVisitsPage({ ...q, sort: "enteredAt", dir: "desc", page: 0, pageSize: 1 }, NOW);
    expect(stats.visits).toBe(page.total);
    expect(stats.finished + stats.inside).toBe(stats.visits);
    expect(stats.inside).toBeGreaterThan(0);
    expect(stats.histogram.reduce((a, b) => a + b.visits, 0)).toBe(stats.finished);
    expect(stats.medianSec).toBeGreaterThan(0);
    expect(stats.p90Sec).toBeGreaterThanOrEqual(stats.medianSec);
    expect(stats.zones.map((z) => z.zone)).not.toContain("entrance");
  });

  it("follows the segment filter", () => {
    const all = getVisitStats({ store: "vlc-colon", date: "2026-11-17", segment: "all" }, NOW);
    const checkout = getVisitStats({ store: "vlc-colon", date: "2026-11-17", segment: "checkout" }, NOW);
    expect(checkout.visits).toBeLessThan(all.visits);
    expect(checkout.inside).toBe(0); // past day: nobody is still inside
    expect(checkout.zones.find((z) => z.zone === "checkout")!.visitShare).toBe(1);
    expect(all.zones.map((z) => z.zone)).not.toContain("kids"); // Valencia has no kids zone
  });
});
