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
import { pad2 } from "./time";
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
        };
        buckets.set(key, point);
      }
      point.street += h.street;
      point.visitors += h.entrants;
    }
  }

  return [...buckets.values()]
    .map((p) => ({ ...p, captureRate: safeDiv(p.visitors, p.street) }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));
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
  /** Conversion from the previous step. */
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
