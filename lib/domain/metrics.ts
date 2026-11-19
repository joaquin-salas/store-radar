/**
 * Retail KPIs computed from daily summaries. Pure functions, no I/O.
 *
 * Definitions (also documented in the README):
 * - Street passers-by: people detected by the street sensor during opening hours.
 * - Visitors: people who walked in (entrance sensor).
 * - Capture rate: visitors / street passers-by (during opening hours).
 * - Avg dwell: mean total time inside the store per visit.
 * - Checkout rate: visitors who reached the checkout zone / visitors.
 * - Registered share: visitors identified as loyalty members / visitors.
 * - Returning share: visitors whose device was seen on an earlier day / visitors.
 */
import { ZONE_LABELS } from "./catalog";
import { type LocalDate, addDays, dayOfWeek, eachDay, pad2 } from "./time";
import type { DaySummary, InStoreZone } from "./types";

export const safeDiv = (a: number, b: number) => (b > 0 ? a / b : 0);

export function isOpenAt(day: DaySummary, hour: number): boolean {
  return day.hours !== null && hour >= day.hours.open && hour < day.hours.close;
}

/** Open at that hour and the hour has started (excludes the future part of today). */
export function hasDataAt(day: DaySummary, hour: number): boolean {
  return isOpenAt(day, hour) && (day.cutoffSec === null || hour * 3600 <= day.cutoffSec);
}

export interface Kpis {
  streetPassersby: number;
  visitors: number;
  captureRate: number;
  avgDwellSec: number;
  checkouts: number;
  checkoutRate: number;
  registeredVisitors: number;
  registeredShare: number;
  /** Visitors whose device was seen on an earlier day. */
  returningVisitors: number;
  returningShare: number;
  /** Local hour with the most visitors, or null when there were none. */
  peakHour: number | null;
}

export function computeKpis(days: readonly DaySummary[]): Kpis {
  let street = 0;
  let visitors = 0;
  let dwell = 0;
  let checkouts = 0;
  let registered = 0;
  let returning = 0;
  const visitorsByHour = new Array<number>(24).fill(0);

  for (const day of days) {
    for (const h of day.byHour) {
      if (isOpenAt(day, h.hour)) street += h.street;
      visitors += h.entrants;
      dwell += h.dwellSec;
      checkouts += h.checkouts;
      registered += h.registered;
      returning += h.returning;
      visitorsByHour[h.hour] += h.entrants;
    }
  }

  const peak = Math.max(...visitorsByHour);
  return {
    streetPassersby: street,
    visitors,
    captureRate: safeDiv(visitors, street),
    avgDwellSec: safeDiv(dwell, visitors),
    checkouts,
    checkoutRate: safeDiv(checkouts, visitors),
    registeredVisitors: registered,
    registeredShare: safeDiv(registered, visitors),
    returningVisitors: returning,
    returningShare: safeDiv(returning, visitors),
    peakHour: peak > 0 ? visitorsByHour.indexOf(peak) : null,
  };
}

export type Granularity = "hour" | "day";

export interface TrafficPoint {
  /** "YYYY-MM-DD" for daily points, "YYYY-MM-DDTHH:00" for hourly points. */
  bucket: string;
  date: string;
  hour: number | null;
  street: number;
  visitors: number;
  captureRate: number;
  /** Visitors whose device was seen on an earlier day. */
  returning: number;
}

/**
 * Street vs. visitors over time. Days may belong to several stores; they are
 * summed per bucket. Only opening hours are included.
 */
export function trafficSeries(days: readonly DaySummary[], granularity: Granularity): TrafficPoint[] {
  const buckets = new Map<string, TrafficPoint>();

  for (const day of days) {
    if (!day.hours) continue;
    for (const h of day.byHour) {
      if (!hasDataAt(day, h.hour)) continue;
      const key = granularity === "day" ? day.date : `${day.date}T${pad2(h.hour)}:00`;
      let point = buckets.get(key);
      if (!point) {
        point = {
          bucket: key,
          date: day.date,
          hour: granularity === "day" ? null : h.hour,
          street: 0,
          visitors: 0,
          captureRate: 0,
          returning: 0,
        };
        buckets.set(key, point);
      }
      point.street += h.street;
      point.visitors += h.entrants;
      point.returning += h.returning;
    }
  }

  return [...buckets.values()]
    .map((p) => ({ ...p, captureRate: safeDiv(p.visitors, p.street) }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));
}

/** A traffic point next to the same position in the previous period. */
export interface ComparedPoint {
  /** The current bucket's date (for hourly points, the range's single day). */
  date: LocalDate;
  /** Local hour for hourly points, null for daily points. */
  hour: number | null;
  /** Current values; null when the bucket hasn't happened yet (later today, or a future day). */
  visitors: number | null;
  street: number | null;
  captureRate: number | null;
  returning: number | null;
  /** The matching bucket of the previous period: the same hour, or the same day position. */
  previousDate: LocalDate;
  previous: { visitors: number; street: number; captureRate: number } | null;
}

const EMPTY_POINT = { street: 0, visitors: 0, captureRate: 0, returning: 0 };

/**
 * Lines up a traffic series with the previous period's: hourly points by hour
 * of day (every hour either period was open), daily points by position in the
 * range, so day 1 sits next to day 1. Days the store was closed count as zero.
 */
export function compareTraffic(
  current: readonly TrafficPoint[],
  previous: readonly TrafficPoint[],
  opts: {
    granularity: Granularity;
    range: { from: LocalDate; to: LocalDate };
    previousRange: { from: LocalDate; to: LocalDate };
    today: LocalDate;
  },
): ComparedPoint[] {
  const pick = (p: Pick<TrafficPoint, "visitors" | "street" | "captureRate"> | undefined) =>
    p ? { visitors: p.visitors, street: p.street, captureRate: p.captureRate } : null;

  if (opts.granularity === "hour") {
    const cur = new Map(current.map((p) => [p.hour!, p]));
    const prev = new Map(previous.map((p) => [p.hour!, p]));
    const hours = [...new Set([...cur.keys(), ...prev.keys()])].sort((a, b) => a - b);
    return hours.map((hour) => {
      const c = cur.get(hour);
      return {
        date: opts.range.from,
        hour,
        visitors: c?.visitors ?? null,
        street: c?.street ?? null,
        captureRate: c?.captureRate ?? null,
        returning: c?.returning ?? null,
        previousDate: opts.previousRange.from,
        previous: pick(prev.get(hour)),
      };
    });
  }

  const cur = new Map(current.map((p) => [p.date, p]));
  const prev = new Map(previous.map((p) => [p.date, p]));
  return eachDay(opts.range.from, opts.range.to).map((date, i) => {
    const previousDate = addDays(opts.previousRange.from, i);
    const c = date > opts.today ? null : (cur.get(date) ?? EMPTY_POINT);
    return {
      date,
      hour: null,
      visitors: c?.visitors ?? null,
      street: c?.street ?? null,
      captureRate: c?.captureRate ?? null,
      returning: c?.returning ?? null,
      previousDate,
      previous: pick(prev.get(previousDate) ?? EMPTY_POINT),
    };
  });
}

/** Weekdays Monday first, as `dayOfWeek` numbers (0 = Sunday). */
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface WeekdayHours {
  /** Hours any store in the scope was open, in order. */
  hours: number[];
  /** One row per weekday, Monday first. */
  rows: {
    weekday: number;
    label: string;
    /** Dates of this weekday in the range with any data. */
    dates: number;
    /** Average visitors per hour (summed across stores) on those dates; null when closed. */
    values: (number | null)[];
  }[];
  /** Largest cell value, for the colour scale. */
  max: number;
}

/**
 * When the stores are busy: average visitors for each weekday × hour over the
 * range. Each date sums its stores; a cell averages the dates of that weekday
 * that had data at that hour (today counts only the hours so far).
 */
export function weekdayHours(days: readonly DaySummary[]): WeekdayHours {
  const perDate = new Map<string, { visitors: number[]; open: boolean[] }>();
  let first = 24;
  let last = -1;
  for (const day of days) {
    let acc = perDate.get(day.date);
    if (!acc) {
      acc = { visitors: new Array(24).fill(0), open: new Array(24).fill(false) };
      perDate.set(day.date, acc);
    }
    for (const h of day.byHour) {
      if (isOpenAt(day, h.hour)) {
        first = Math.min(first, h.hour);
        last = Math.max(last, h.hour);
      }
      if (!hasDataAt(day, h.hour)) continue;
      acc.open[h.hour] = true;
      acc.visitors[h.hour] += h.entrants;
    }
  }

  const hours = last < 0 ? [] : Array.from({ length: last - first + 1 }, (_, i) => first + i);
  let max = 0;
  const rows = WEEK.map((weekday) => {
    const dates = [...perDate.entries()].filter(
      ([date, acc]) => dayOfWeek(date) === weekday && acc.open.some(Boolean),
    );
    const values = hours.map((hour) => {
      const open = dates.filter(([, acc]) => acc.open[hour]);
      if (open.length === 0) return null;
      const avg = open.reduce((s, [, acc]) => s + acc.visitors[hour], 0) / open.length;
      max = Math.max(max, avg);
      return avg;
    });
    return { weekday, label: WEEKDAY_SHORT[weekday], dates: dates.length, values };
  });
  return { hours, rows, max };
}

export interface ZoneStat {
  zone: InStoreZone;
  label: string;
  visitors: number;
  /** Share of store visitors who passed through this zone. */
  visitRate: number;
  avgDwellSec: number;
}

export function zoneStats(days: readonly DaySummary[], zones: readonly InStoreZone[]): ZoneStat[] {
  let entrants = 0;
  const totals = new Map(zones.map((z) => [z, { visitors: 0, dwellSec: 0 }]));

  for (const day of days) {
    for (const h of day.byHour) {
      entrants += h.entrants;
      for (const [zone, acc] of totals) {
        acc.visitors += h.zones[zone].visitors;
        acc.dwellSec += h.zones[zone].dwellSec;
      }
    }
  }

  return zones.map((zone) => {
    const acc = totals.get(zone)!;
    return {
      zone,
      label: ZONE_LABELS[zone],
      visitors: acc.visitors,
      visitRate: safeDiv(acc.visitors, entrants),
      avgDwellSec: safeDiv(acc.dwellSec, acc.visitors),
    };
  });
}

export type FunnelStepId = "street" | "entrance" | "browsed" | "fitting-rooms" | "checkout";

export interface FunnelStep {
  step: FunnelStepId;
  label: string;
  count: number;
  /**
   * Whether everyone at this step also passed the previous one. Checkout isn't:
   * visitors reach it with or without the fitting rooms.
   */
  nested: boolean;
  /** Count ÷ the previous step's count; a true conversion only for nested steps. */
  fromPrevious: number;
  /** Conversion from the first step (street). */
  fromTop: number;
}

const FUNNEL_LABELS: Record<FunnelStepId, string> = {
  street: "Passed by",
  entrance: "Walked in",
  browsed: "Browsed a product zone",
  "fitting-rooms": "Used fitting rooms",
  checkout: "Reached checkout",
};

export function funnel(days: readonly DaySummary[]): FunnelStep[] {
  const counts: Record<FunnelStepId, number> = {
    street: 0,
    entrance: 0,
    browsed: 0,
    "fitting-rooms": 0,
    checkout: 0,
  };
  for (const day of days) {
    for (const h of day.byHour) {
      if (isOpenAt(day, h.hour)) counts.street += h.street;
      counts.entrance += h.entrants;
      counts.browsed += h.browsed;
      counts["fitting-rooms"] += h.zones["fitting-rooms"].visitors;
      counts.checkout += h.checkouts;
    }
  }

  const steps = Object.keys(counts) as FunnelStepId[];
  return steps.map((step, i) => ({
    step,
    label: FUNNEL_LABELS[step],
    count: counts[step],
    nested: step !== "checkout",
    fromPrevious: i === 0 ? 1 : safeDiv(counts[step], counts[steps[i - 1]]),
    fromTop: safeDiv(counts[step], counts.street),
  }));
}

export interface HourProfilePoint {
  hour: number;
  /** Average visitors in this hour across the days it was open. */
  avgVisitors: number;
  avgStreet: number;
}

/**
 * Typical day shape: for each hour, the average (per calendar date) of visitors
 * summed across the selected stores. Dates where nothing was open that hour are
 * skipped so Sundays don't drag averages down.
 */
export function hourProfile(days: readonly DaySummary[]): HourProfilePoint[] {
  const perDate = new Map<string, { visitors: number[]; street: number[]; open: boolean[] }>();

  for (const day of days) {
    let acc = perDate.get(day.date);
    if (!acc) {
      acc = {
        visitors: new Array(24).fill(0),
        street: new Array(24).fill(0),
        open: new Array(24).fill(false),
      };
      perDate.set(day.date, acc);
    }
    for (const h of day.byHour) {
      if (!hasDataAt(day, h.hour)) continue;
      acc.open[h.hour] = true;
      acc.visitors[h.hour] += h.entrants;
      acc.street[h.hour] += h.street;
    }
  }

  const out: HourProfilePoint[] = [];
  for (let hour = 0; hour < 24; hour++) {
    let n = 0;
    let visitors = 0;
    let street = 0;
    for (const acc of perDate.values()) {
      if (!acc.open[hour]) continue;
      n++;
      visitors += acc.visitors[hour];
      street += acc.street[hour];
    }
    if (n > 0) out.push({ hour, avgVisitors: visitors / n, avgStreet: street / n });
  }
  return out;
}
