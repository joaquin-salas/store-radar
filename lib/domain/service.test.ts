import { describe, expect, it } from "vitest";
import { STORES } from "./catalog";
import { rangeSchema } from "./schemas";
import {
  compareStores,
  getCustomersPage,
  getOverview,
  getTraffic,
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
    expect(top.total).toBe(12_000);
    expect(top.rows[0].visits).toBeGreaterThanOrEqual(top.rows[9].visits);
    const gold = getCustomersPage({ ...base, tier: "gold", store: "bio-ercilla" }, NOW);
    expect(gold.rows.every((r) => r.tier === "gold" && r.homeStoreId === "bio-ercilla")).toBe(true);
    const search = getCustomersPage({ ...base, q: "C00042" }, NOW);
    expect(search.rows.map((r) => r.id)).toEqual(["C00042"]);
  });
});
