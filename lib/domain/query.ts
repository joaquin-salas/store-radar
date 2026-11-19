/**
 * Ad-hoc metric queries: any of the dashboard KPIs, broken down by up to two
 * dimensions (store, date, weekday, hour, zone) and filtered by weekday, hour
 * and zone. The assistant uses it to build charts and tables on the fly, so it
 * reads the same daily summaries and follows the same rules as `metrics.ts`:
 * passers-by count during opening hours only, and today stops at `now`.
 */
import { STORES, ZONE_LABELS, getStore } from "./catalog";
import { hasDataAt, safeDiv } from "./metrics";
import { type DateRange, resolveRange } from "./range";
import {
  IN_STORE_ZONES,
  MAX_QUERY_ROWS,
  type MetricsQuery,
  type QueryDimension,
  type QueryMetric,
  WEEKDAYS,
  type Weekday,
} from "./schemas";
import { loadSummaries } from "./summaries";
import { type LocalDateTime, dayOfWeek } from "./time";
import type { HourAgg, InStoreZone } from "./types";

export type ValueFormat = "text" | "date" | "hour" | "count" | "percent" | "duration";

export interface QueryColumn {
  key: string;
  label: string;
  kind: "dimension" | "metric";
  format: ValueFormat;
}

export type QueryRow = Record<string, string | number>;

export interface MetricsResult {
  store: string;
  range: DateRange;
  groupBy: QueryDimension[];
  metrics: QueryMetric[];
  average: MetricsQuery["average"];
  columns: QueryColumn[];
  rows: QueryRow[];
  /** Rows before the limit / row cap. */
  totalRows: number;
  /** True when rows were cut at `MAX_QUERY_ROWS` (not by an explicit limit). */
  truncated: boolean;
}

export const METRIC_INFO: Record<QueryMetric, { label: string; format: ValueFormat }> = {
  streetPassersby: { label: "Passers-by", format: "count" },
  visitors: { label: "Visitors", format: "count" },
  captureRate: { label: "Capture rate", format: "percent" },
  avgDwellSec: { label: "Avg time in store", format: "duration" },
  checkouts: { label: "Checkouts", format: "count" },
  checkoutRate: { label: "Checkout rate", format: "percent" },
  browseRate: { label: "Browse rate", format: "percent" },
  registeredVisitors: { label: "Members", format: "count" },
  registeredShare: { label: "Member share", format: "percent" },
  returningVisitors: { label: "Returning visitors", format: "count" },
  returningShare: { label: "Returning share", format: "percent" },
  zoneVisitors: { label: "Zone visitors", format: "count" },
  zoneVisitRate: { label: "Zone visit rate", format: "percent" },
  zoneAvgDwellSec: { label: "Avg time in zone", format: "duration" },
};

export const DIMENSION_INFO: Record<QueryDimension, { label: string; format: ValueFormat }> = {
  store: { label: "Store", format: "text" },
  date: { label: "Date", format: "date" },
  weekday: { label: "Weekday", format: "text" },
  hour: { label: "Hour", format: "hour" },
  zone: { label: "Zone", format: "text" },
};

const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

/** `dayOfWeek` (0 = Sunday) to our Monday-first weekday ids. */
const weekdayOf = (date: string): Weekday => WEEKDAYS[(dayOfWeek(date) + 6) % 7];

interface Acc {
  /** Natural sort position per dimension. */
  order: number[];
  values: (string | number)[];
  dates: Set<string>;
  street: number;
  entrants: number;
  registered: number;
  returning: number;
  browsed: number;
  checkouts: number;
  dwellSec: number;
  zoneVisitors: number;
  zoneDwellSec: number;
}

/** A dimension's display value and natural sort position for one store-hour (and zone). */
function dimensionValue(
  dim: QueryDimension,
  ctx: { storeId: string; date: string; hour: number; zone: InStoreZone | null },
): [value: string | number, order: number] {
  switch (dim) {
    case "store": {
      const i = STORES.findIndex((s) => s.id === ctx.storeId);
      return [STORES[i].name, i];
    }
    case "date":
      return [ctx.date, Number(ctx.date.replaceAll("-", ""))];
    case "weekday": {
      const w = weekdayOf(ctx.date);
      return [WEEKDAY_LABELS[w], WEEKDAYS.indexOf(w)];
    }
    case "hour":
      return [ctx.hour, ctx.hour];
    case "zone":
      return [ZONE_LABELS[ctx.zone!], IN_STORE_ZONES.indexOf(ctx.zone!)];
  }
}

const round = (n: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

function metricValue(m: QueryMetric, a: Acc, perDay: boolean): number {
  const count = (n: number) => (perDay ? round(safeDiv(n, a.dates.size), 1) : n);
  // Rates to 0.1 percentage points, as the dashboard shows them.
  const rate = (n: number, d: number) => round(safeDiv(n, d), 3);
  switch (m) {
    case "streetPassersby":
      return count(a.street);
    case "visitors":
      return count(a.entrants);
    case "captureRate":
      return rate(a.entrants, a.street);
    case "avgDwellSec":
      return Math.round(safeDiv(a.dwellSec, a.entrants));
    case "checkouts":
      return count(a.checkouts);
    case "checkoutRate":
      return rate(a.checkouts, a.entrants);
    case "browseRate":
      return rate(a.browsed, a.entrants);
    case "registeredVisitors":
      return count(a.registered);
    case "registeredShare":
      return rate(a.registered, a.entrants);
    case "returningVisitors":
      return count(a.returning);
    case "returningShare":
      return rate(a.returning, a.entrants);
    case "zoneVisitors":
      return count(a.zoneVisitors);
    case "zoneVisitRate":
      return rate(a.zoneVisitors, a.entrants);
    case "zoneAvgDwellSec":
      return Math.round(safeDiv(a.zoneDwellSec, a.zoneVisitors));
  }
}

function addHour(acc: Acc, date: string, h: HourAgg, zone: InStoreZone | null) {
  acc.dates.add(date);
  acc.street += h.street;
  acc.entrants += h.entrants;
  acc.registered += h.registered;
  acc.returning += h.returning;
  acc.browsed += h.browsed;
  acc.checkouts += h.checkouts;
  acc.dwellSec += h.dwellSec;
  if (zone) {
    acc.zoneVisitors += h.zones[zone].visitors;
    acc.zoneDwellSec += h.zones[zone].dwellSec;
  }
}

/**
 * Runs a metric query (validated with `metricsQuerySchema`). Groups with no
 * open, already-started hours are left out, so closed Sundays or the rest of
 * today don't show up as zeros.
 */
export function queryMetrics(q: MetricsQuery, now: LocalDateTime): MetricsResult {
  const range = resolveRange(q.range, now);
  const byZone = q.groupBy.includes("zone");
  const weekdays = q.weekdays ? new Set(q.weekdays) : null;
  const zoneFilter = q.zones ? new Set<InStoreZone>(q.zones) : null;
  const groups = new Map<string, Acc>();

  for (const day of loadSummaries(q.store, range, now)) {
    if (weekdays && !weekdays.has(weekdayOf(day.date))) continue;
    const zones: (InStoreZone | null)[] = byZone
      ? getStore(day.storeId)!.zones.filter((z) => !zoneFilter || zoneFilter.has(z))
      : [null];

    for (const h of day.byHour) {
      if (!hasDataAt(day, h.hour)) continue;
      if (q.hours && (h.hour < q.hours.from || h.hour >= q.hours.to)) continue;
      for (const zone of zones) {
        const ctx = { storeId: day.storeId, date: day.date, hour: h.hour, zone };
        const dims = q.groupBy.map((d) => dimensionValue(d, ctx));
        const key = dims.map(([v]) => v).join("|");
        let acc = groups.get(key);
        if (!acc) {
          acc = {
            order: dims.map(([, o]) => o),
            values: dims.map(([v]) => v),
            dates: new Set(),
            street: 0,
            entrants: 0,
            registered: 0,
            returning: 0,
            browsed: 0,
            checkouts: 0,
            dwellSec: 0,
            zoneVisitors: 0,
            zoneDwellSec: 0,
          };
          groups.set(key, acc);
        }
        addHour(acc, day.date, h, zone);
      }
    }
  }

  const perDay = q.average === "perDay";
  let accs = [...groups.values()].sort((a, b) => {
    for (let i = 0; i < a.order.length; i++) if (a.order[i] !== b.order[i]) return a.order[i] - b.order[i];
    return 0;
  });
  let rows: QueryRow[] = accs.map((a) => {
    const row: QueryRow = {};
    q.groupBy.forEach((d, i) => (row[d] = a.values[i]));
    for (const m of q.metrics) row[m] = metricValue(m, a, perDay);
    return row;
  });

  if (q.sort) {
    const { by, dir } = q.sort;
    const sign = dir === "asc" ? 1 : -1;
    const isDim = (q.groupBy as string[]).includes(by);
    const dimIndex = q.groupBy.indexOf(by as QueryDimension);
    const order = rows.map((row, i) => ({ row, a: accs[i] }));
    order.sort((x, y) =>
      isDim
        ? sign * (x.a.order[dimIndex] - y.a.order[dimIndex])
        : sign * ((x.row[by] as number) - (y.row[by] as number)),
    );
    rows = order.map((o) => o.row);
    accs = order.map((o) => o.a);
  }

  const totalRows = rows.length;
  const truncated = q.limit === undefined && totalRows > MAX_QUERY_ROWS;
  rows = rows.slice(0, q.limit ?? MAX_QUERY_ROWS);

  const columns: QueryColumn[] = [
    ...q.groupBy.map((d) => ({ key: d, kind: "dimension" as const, ...DIMENSION_INFO[d] })),
    ...q.metrics.map((m) => ({ key: m, kind: "metric" as const, ...METRIC_INFO[m] })),
  ];

  return {
    store: q.store,
    range,
    groupBy: q.groupBy,
    metrics: q.metrics,
    average: q.average,
    columns,
    rows,
    totalRows,
    truncated,
  };
}
