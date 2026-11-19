/**
 * Turns a metric query result and the model's display request into a concrete
 * chart: which kind, which series, the pivoted data. Pure, so the rules are
 * tested. The rules follow the project's chart guidelines (CLAUDE.md › Theme and charts):
 * one axis (only metrics with the same unit share a chart), at most four
 * series, colour by identity (store, zone, or fixed order) and never by rank,
 * lines only over time.
 */
import { STORES, ZONE_LABELS } from "../domain/catalog";
import type { MetricsResult, QueryColumn, QueryRow, ValueFormat } from "../domain/query";
import { IN_STORE_ZONES, type QueryDimension } from "../domain/schemas";
import type { InStoreZone } from "../domain/types";
import type { Display } from "./display";

export const MAX_SERIES = 4;

/** What a series is, so the client can give it its fixed colour. */
export type SeriesColor =
  { by: "store"; index: number } | { by: "zone"; zone: InStoreZone } | { by: "slot"; index: number };

export interface PlannedSeries {
  /** Key in each data point (safe for chart libraries: no dots or spaces). */
  key: string;
  label: string;
  color: SeriesColor;
}

export type ChartPlan =
  | { kind: "empty" }
  | { kind: "table"; note: string | null }
  | { kind: "number"; values: { label: string; value: number; format: ValueFormat }[] }
  | {
      kind: "bar" | "line";
      /** Bars run sideways for long category names (stores, zones). */
      horizontal: boolean;
      x: QueryColumn;
      series: PlannedSeries[];
      /** One point per x value: `{ x, [series.key]: number }`. */
      data: Record<string, string | number>[];
      /** Unit shared by every series (one axis). */
      format: ValueFormat;
      /** Bars coloured per category (single series over stores or zones). */
      colorBars: SeriesColor[] | null;
      /** Metrics left out of the chart; they're in the table view. */
      note: string | null;
    };

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const zoneByLabel = new Map(IN_STORE_ZONES.map((z) => [ZONE_LABELS[z], z]));
const storeIndexByName = new Map(STORES.map((s, i) => [s.name, i]));

/** Natural order of a dimension value (time, Monday first, catalogue, walking order). */
export function dimensionOrder(dim: QueryDimension, value: string | number): number {
  switch (dim) {
    case "store":
      return storeIndexByName.get(String(value)) ?? 99;
    case "zone":
      return IN_STORE_ZONES.indexOf(zoneByLabel.get(String(value)) ?? ("" as InStoreZone));
    case "weekday":
      return WEEKDAY_LABELS.indexOf(String(value));
    case "hour":
      return Number(value);
    case "date":
      return Number(String(value).replaceAll("-", ""));
  }
}

function colorFor(dim: QueryDimension, value: string | number, index: number): SeriesColor {
  if (dim === "store") return { by: "store", index: storeIndexByName.get(String(value)) ?? index };
  if (dim === "zone") {
    const zone = zoneByLabel.get(String(value));
    if (zone) return { by: "zone", zone };
  }
  return { by: "slot", index };
}

/** Zones without their own colour (entrance, checkout) share the neutral one. */
const NEUTRAL_ZONES: InStoreZone[] = ["entrance", "checkout"];

export function planChart(result: MetricsResult & { display: Display }): ChartPlan {
  const { rows, groupBy, columns, display } = result;
  if (rows.length === 0) return { kind: "empty" };

  const metricCols = columns.filter((c) => c.kind === "metric");
  if (groupBy.length === 0 || display.kind === "number") {
    if (rows.length === 1) {
      return {
        kind: "number",
        values: metricCols.map((c) => ({
          label: c.label,
          value: rows[0][c.key] as number,
          format: c.format,
        })),
      };
    }
    return { kind: "table", note: null };
  }
  if (display.kind === "table") return { kind: "table", note: null };

  const xDim = groupBy[0];
  const x = columns.find((c) => c.key === xDim)!;
  const overTime = xDim === "date" || xDim === "hour";
  const kind = display.kind === "line" && overTime ? "line" : "bar";
  // Lines read left to right in time; bars keep the query's order (it may be a ranking).
  const ordered =
    kind === "line"
      ? [...rows].sort((a, b) => dimensionOrder(xDim, a[xDim]) - dimensionOrder(xDim, b[xDim]))
      : rows;

  if (groupBy.length === 2) {
    const seriesDim = groupBy[1];
    const metric = metricCols[0];
    const values = [...new Set(rows.map((r) => r[seriesDim]))].sort(
      (a, b) => dimensionOrder(seriesDim, a) - dimensionOrder(seriesDim, b),
    );
    if (values.length > MAX_SERIES) {
      return { kind: "table", note: `${values.length} series are too many for one chart.` };
    }
    const series = values.map((v, i) => ({
      key: `s${i}`,
      label: String(v),
      color: colorFor(seriesDim, v, i),
    }));
    const neutral = series.filter((s) => s.color.by === "zone" && NEUTRAL_ZONES.includes(s.color.zone));
    if (neutral.length > 1)
      return { kind: "table", note: "These zones share a colour, so they're shown as a table." };

    const byX = new Map<string | number, Record<string, string | number>>();
    for (const r of ordered) {
      const point = byX.get(r[xDim]) ?? { x: r[xDim] };
      point[series[values.indexOf(r[seriesDim])].key] = r[metric.key];
      byX.set(r[xDim], point);
    }
    const others = metricCols.slice(1).map((c) => c.label);
    return {
      kind,
      horizontal: false,
      x,
      series,
      data: [...byX.values()],
      format: metric.format,
      colorBars: null,
      note: others.length ? `${others.join(", ")}: see the table.` : null,
    };
  }

  // One dimension: each metric with the same unit as the first is a series.
  const unit = metricCols[0].format;
  const charted = metricCols.filter((c) => c.format === unit).slice(0, MAX_SERIES);
  const left = metricCols.filter((c) => !charted.includes(c)).map((c) => c.label);
  const series = charted.map((c, i) => ({
    key: `s${i}`,
    label: c.label,
    color: { by: "slot", index: i } as const,
  }));
  const data = ordered.map((r: QueryRow) => {
    const point: Record<string, string | number> = { x: r[xDim] };
    charted.forEach((c, i) => (point[`s${i}`] = r[c.key]));
    return point;
  });
  const categorical = xDim === "store" || xDim === "zone";
  return {
    kind,
    horizontal: kind === "bar" && categorical,
    x,
    series,
    data,
    format: unit,
    colorBars: series.length === 1 && categorical ? ordered.map((r, i) => colorFor(xDim, r[xDim], i)) : null,
    note: left.length ? `${left.join(", ")}: see the table.` : null,
  };
}

/** The result as CSV (raw values, header labels), for download. */
export function toCsv(result: Pick<MetricsResult, "columns" | "rows">): string {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const head = result.columns.map((c) => cell(c.label)).join(",");
  const body = result.rows.map((r) => result.columns.map((c) => cell(r[c.key] ?? "")).join(","));
  return [head, ...body].join("\n");
}
