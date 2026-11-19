import { describe, expect, it } from "vitest";
import { getStore } from "../domain/catalog";
import { type MetricsQuery, metricsQuerySchema } from "../domain/schemas";
import { getMetrics } from "../domain/service";
import type { LocalDateTime } from "../domain/time";
import { type ChartPlan, planChart, toCsv } from "./chart-plan";
import type { Display } from "./display";

const NOW: LocalDateTime = { date: "2026-11-18", hour: 16, minute: 30, second: 0 };

function plan(input: Partial<MetricsQuery> & Pick<MetricsQuery, "metrics">, display: Display): ChartPlan {
  return planChart({
    display,
    ...getMetrics(metricsQuerySchema.parse({ range: { preset: "7d" }, ...input }), NOW),
  });
}

const bar = (title = "t"): Display => ({ kind: "bar", title });
const line = (title = "t"): Display => ({ kind: "line", title });

describe("planChart", () => {
  it("shows a single total as a number", () => {
    const p = plan({ metrics: ["visitors", "checkoutRate"] }, bar());
    expect(p.kind).toBe("number");
    if (p.kind === "number") expect(p.values.map((v) => v.format)).toEqual(["count", "percent"]);
  });

  it("draws lines only over time", () => {
    expect(plan({ metrics: ["visitors"], groupBy: ["hour"] }, line()).kind).toBe("line");
    expect(plan({ metrics: ["visitors"], groupBy: ["weekday"] }, line()).kind).toBe("bar");
  });

  it("keeps one axis: metrics with another unit go to the table", () => {
    const p = plan({ metrics: ["visitors", "checkouts", "checkoutRate"], groupBy: ["date"] }, line());
    if (p.kind !== "line") throw new Error(p.kind);
    expect(p.series.map((s) => s.label)).toEqual(["Visitors", "Checkouts"]);
    expect(p.format).toBe("count");
    expect(p.note).toContain("Checkout rate");
  });

  it("pivots the second dimension into series coloured by identity", () => {
    const p = plan({ metrics: ["visitors"], groupBy: ["hour", "store"] }, line());
    if (p.kind !== "line") throw new Error(p.kind);
    expect(p.series.map((s) => s.label)).toEqual(
      ["mad-granvia", "bcn-pdg", "vlc-colon"].map((id) => getStore(id)!.name),
    );
    expect(p.series.map((s) => s.color)).toEqual([0, 1, 2].map((index) => ({ by: "store", index })));
    expect(Object.keys(p.data[0])).toEqual(["x", "s0", "s1", "s2"]);
    const hours = p.data.map((d) => d.x as number);
    expect(hours).toEqual([...hours].sort((a, b) => a - b));
  });

  it("falls back to a table with too many series or look-alike colours", () => {
    expect(plan({ metrics: ["visitors"], groupBy: ["date", "weekday"] }, bar()).kind).toBe("table");
    const zones = plan(
      { metrics: ["zoneVisitors"], groupBy: ["date", "zone"], zones: ["entrance", "checkout"] },
      bar(),
    );
    expect(zones.kind).toBe("table");
  });

  it("colours bars per store or zone and keeps a ranking's order", () => {
    const p = plan(
      {
        metrics: ["zoneVisitors"],
        groupBy: ["zone"],
        store: "mad-granvia",
        sort: { by: "zoneVisitors", dir: "desc" },
      },
      bar(),
    );
    if (p.kind !== "bar") throw new Error(p.kind);
    expect(p.horizontal).toBe(true);
    expect(p.colorBars?.[0]).toEqual({ by: "zone", zone: "entrance" });
    const values = p.data.map((d) => d.s0 as number);
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  it("honours an explicit table", () => {
    expect(plan({ metrics: ["visitors"], groupBy: ["store"] }, { kind: "table", title: "t" }).kind).toBe(
      "table",
    );
  });
});

describe("toCsv", () => {
  it("quotes cells that need it", () => {
    const csv = toCsv({
      columns: [
        { key: "store", label: "Store", kind: "dimension", format: "text" },
        { key: "visitors", label: "Visitors", kind: "metric", format: "count" },
      ],
      rows: [{ store: 'Shop, "A"', visitors: 3 }],
    });
    expect(csv).toBe('Store,Visitors\n"Shop, ""A""",3');
  });
});
