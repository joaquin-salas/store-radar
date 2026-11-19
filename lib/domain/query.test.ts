import { describe, expect, it } from "vitest";
import { getStore } from "./catalog";
import { type MetricsQuery, metricsQuerySchema } from "./schemas";
import { compareStores, getMetrics, getOverview, getWeekdayHours, getZones } from "./service";
import type { LocalDateTime } from "./time";

const NOW: LocalDateTime = { date: "2026-11-18", hour: 16, minute: 30, second: 0 };
const WEEK = { preset: "7d" } as const;

const query = (input: Partial<MetricsQuery> & Pick<MetricsQuery, "metrics">) =>
  getMetrics(metricsQuerySchema.parse(input), NOW);

describe("queryMetrics", () => {
  it("matches the overview KPIs when not grouped", () => {
    const kpis = getOverview({ store: "all", range: WEEK }, NOW).kpis;
    const { rows } = query({
      metrics: ["visitors", "streetPassersby", "checkoutRate", "avgDwellSec"],
      range: WEEK,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].visitors).toBe(kpis.visitors);
    expect(rows[0].streetPassersby).toBe(kpis.streetPassersby);
    expect(rows[0].checkoutRate).toBeCloseTo(kpis.checkoutRate, 2);
    expect(rows[0].avgDwellSec).toBe(Math.round(kpis.avgDwellSec));
  });

  it("matches the store comparison when grouped by store", () => {
    const stores = compareStores({ range: WEEK }, NOW).stores;
    const { rows, columns } = query({
      metrics: ["visitors", "captureRate"],
      groupBy: ["store"],
      range: WEEK,
    });
    expect(columns.map((c) => c.key)).toEqual(["store", "visitors", "captureRate"]);
    expect(rows.map((r) => r.store)).toEqual(stores.map((s) => s.name));
    rows.forEach((r, i) => {
      expect(r.visitors).toBe(stores[i].kpis.visitors);
      expect(r.captureRate).toBeCloseTo(stores[i].kpis.captureRate, 2);
    });
  });

  it("matches the zone stats when grouped by zone", () => {
    const zones = getZones({ store: "mad-granvia", range: WEEK }, NOW).zones;
    const { rows } = query({
      metrics: ["zoneVisitors", "zoneVisitRate", "zoneAvgDwellSec"],
      groupBy: ["zone"],
      store: "mad-granvia",
      range: WEEK,
    });
    expect(rows.map((r) => r.zone)).toEqual(zones.map((z) => z.label));
    rows.forEach((r, i) => {
      expect(r.zoneVisitors).toBe(zones[i].visitors);
      expect(r.zoneVisitRate).toBeCloseTo(zones[i].visitRate, 2);
      expect(r.zoneAvgDwellSec).toBe(Math.round(zones[i].avgDwellSec));
    });
  });

  it("averages per day like the weekday × hour heatmap", () => {
    const heat = getWeekdayHours({ store: "all", range: { preset: "30d" } }, NOW);
    const { rows } = query({
      metrics: ["visitors"],
      groupBy: ["weekday", "hour"],
      range: { preset: "30d" },
      average: "perDay",
    });
    const monday = heat.rows[0];
    const at = (hour: number) => rows.find((r) => r.weekday === "Mon" && r.hour === hour)?.visitors;
    heat.hours.forEach((hour, i) => {
      const expected = monday.values[i];
      if (expected === null) expect(at(hour)).toBeUndefined();
      // Rounded to one decimal.
      else expect(Math.abs((at(hour)! as number) - expected)).toBeLessThanOrEqual(0.05 + 1e-9);
    });
  });

  it("leaves out hours that haven't happened yet and closed hours", () => {
    const { rows } = query({ metrics: ["visitors"], groupBy: ["hour"], store: "mad-granvia" });
    const hours = rows.map((r) => r.hour as number);
    const open = getStore("mad-granvia")!.hours.open;
    expect(hours[0]).toBe(open);
    expect(Math.max(...hours)).toBe(NOW.hour);
  });

  it("filters by weekday, hour and zone", () => {
    const sat = query({
      metrics: ["visitors"],
      groupBy: ["date"],
      range: { preset: "30d" },
      weekdays: ["sat"],
    });
    expect(sat.rows.length).toBeGreaterThan(0);
    for (const r of sat.rows) expect(new Date(`${r.date}T00:00:00Z`).getUTCDay()).toBe(6);

    const evening = query({
      metrics: ["visitors"],
      groupBy: ["hour"],
      range: WEEK,
      hours: { from: 18, to: 21 },
    });
    expect(evening.rows.map((r) => r.hour)).toEqual([18, 19, 20]);

    const kids = query({
      metrics: ["zoneVisitors"],
      groupBy: ["store", "zone"],
      range: WEEK,
      zones: ["kids"],
    });
    expect(kids.rows.every((r) => r.zone === "Kids")).toBe(true);
    // Valencia has no kids zone, so it has no row.
    expect(kids.rows.map((r) => r.store)).not.toContain(getStore("vlc-colon")!.name);
    expect(kids.rows).toHaveLength(2);
  });

  it("sorts and limits", () => {
    const top = query({
      metrics: ["visitors"],
      groupBy: ["hour"],
      range: WEEK,
      sort: { by: "visitors", dir: "desc" },
      limit: 3,
    });
    expect(top.rows).toHaveLength(3);
    expect(top.totalRows).toBeGreaterThan(3);
    expect(top.truncated).toBe(false);
    const values = top.rows.map((r) => r.visitors as number);
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  it("caps very detailed queries", () => {
    const big = query({ metrics: ["visitors"], groupBy: ["date", "hour"], range: { preset: "30d" } });
    expect(big.rows).toHaveLength(200);
    expect(big.truncated).toBe(true);
  });

  it("rejects combinations it can't answer", () => {
    const bad = (input: object) => metricsQuerySchema.safeParse(input).success;
    expect(bad({ metrics: ["zoneVisitors"] })).toBe(false);
    expect(bad({ metrics: ["visitors"], groupBy: ["zone"] })).toBe(false);
    expect(bad({ metrics: ["visitors"], groupBy: ["hour", "hour"] })).toBe(false);
    expect(bad({ metrics: ["visitors"], zones: ["kids"] })).toBe(false);
    expect(bad({ metrics: ["visitors"], hours: { from: 20, to: 18 } })).toBe(false);
    expect(bad({ metrics: ["visitors"], sort: { by: "checkouts" } })).toBe(false);
    expect(bad({ metrics: ["visitors"], groupBy: ["store", "hour"] })).toBe(true);
  });
});
