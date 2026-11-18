/**
 * Query layer: the functions the API routes and the AI assistant call.
 * Every function takes an optional `now` so results are reproducible in tests.
 */
import { STORES, ZONE_LABELS, getStore } from "./catalog";
import { allCustomers, getCustomer } from "./customers";
import { getDayStatus } from "./status";
import { getDaySummary, getDayVisits } from "./generator";
import { type Granularity, computeKpis, funnel, hourProfile, trafficSeries, zoneStats } from "./metrics";
import { type DateRange, isLiveRange as isLive, previousRange, rangeDays, resolveRange } from "./range";
import {
  type CustomersQuery,
  type RangeInput,
  VISIT_ID_PATTERN,
  type VisitStatsQuery,
  type VisitsQuery,
} from "./schemas";
import { durationHistogram, quantile, zoneDwell } from "./visit-stats";
import {
  type LocalDate,
  type LocalDateTime,
  addDays,
  eachDay,
  formatClock,
  isLocalDate,
  localNow,
  secondsOfDay,
} from "./time";
import type { Customer, DaySummary, InStoreZone, Visit } from "./types";

export { type DateRange, previousRange, resolveRange } from "./range";

export type StoreScope = "all" | (string & {});

function storeIds(scope: StoreScope): string[] {
  return scope === "all" ? STORES.map((s) => s.id) : [scope];
}

export function loadSummaries(scope: StoreScope, range: DateRange, now: LocalDateTime): DaySummary[] {
  const ids = storeIds(scope);
  const to = range.to < now.date ? range.to : now.date;
  const out: DaySummary[] = [];
  for (const date of eachDay(range.from, to)) {
    for (const id of ids) out.push(getDaySummary(id, date, now));
  }
  return out;
}

interface ScopedQuery {
  store: StoreScope;
  range: RangeInput;
}

export function getOverview(q: ScopedQuery, now: LocalDateTime = localNow()) {
  const range = resolveRange(q.range, now);
  const prev = previousRange(range);
  // When the range is live, compare against the previous period up to the same
  // time of day — otherwise "today so far" would be compared with a full day.
  const len = rangeDays(range);
  const prevNow: LocalDateTime = range.to >= now.date ? { ...now, date: addDays(now.date, -len) } : now;

  return {
    store: q.store,
    range,
    previousRange: prev,
    live: isLive(range, now),
    asOf: now,
    kpis: computeKpis(loadSummaries(q.store, range, now)),
    previous: computeKpis(loadSummaries(q.store, prev, prevNow)),
  };
}

export function getTraffic(q: ScopedQuery & { granularity?: Granularity }, now: LocalDateTime = localNow()) {
  const range = resolveRange(q.range, now);
  const granularity = q.granularity ?? (range.from === range.to ? "hour" : "day");
  return {
    store: q.store,
    range,
    granularity,
    points: trafficSeries(loadSummaries(q.store, range, now), granularity),
  };
}

export function getZones(q: ScopedQuery, now: LocalDateTime = localNow()) {
  const range = resolveRange(q.range, now);
  const zoneSet = new Set<InStoreZone>();
  for (const id of storeIds(q.store)) for (const z of getStore(id)!.zones) zoneSet.add(z);
  const order: InStoreZone[] = ["entrance", "womenswear", "menswear", "kids", "fitting-rooms", "checkout"];
  const zones = order.filter((z) => zoneSet.has(z));
  return { store: q.store, range, zones: zoneStats(loadSummaries(q.store, range, now), zones) };
}

export function getFunnel(q: ScopedQuery, now: LocalDateTime = localNow()) {
  const range = resolveRange(q.range, now);
  return { store: q.store, range, steps: funnel(loadSummaries(q.store, range, now)) };
}

export function getHourProfile(q: ScopedQuery, now: LocalDateTime = localNow()) {
  const range = resolveRange(q.range, now);
  return { store: q.store, range, hours: hourProfile(loadSummaries(q.store, range, now)) };
}

export function compareStores(q: { range: RangeInput }, now: LocalDateTime = localNow()) {
  const range = resolveRange(q.range, now);
  return {
    range,
    stores: STORES.map((s) => ({
      storeId: s.id,
      name: s.name,
      city: s.city,
      kpis: computeKpis(loadSummaries(s.id, range, now)),
    })),
  };
}

export function listStores(now: LocalDateTime = localNow()) {
  return STORES.map((s) => ({
    id: s.id,
    name: s.name,
    city: s.city,
    sizeM2: s.sizeM2,
    zones: s.zones,
    status: getDayStatus(s, now),
  }));
}

// --- Tables ------------------------------------------------------------------

export interface Page<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

function paginate<T>(rows: T[], page: number, pageSize: number): Page<T> {
  return { rows: rows.slice(page * pageSize, (page + 1) * pageSize), total: rows.length, page, pageSize };
}

const SEGMENT_FILTERS: Record<VisitsQuery["segment"], (v: Visit) => boolean> = {
  all: () => true,
  registered: (v) => v.customerId !== null,
  anonymous: (v) => v.customerId === null,
  new: (v) => !v.returning,
  returning: (v) => v.returning,
  checkout: (v) => v.checkout,
};

export interface VisitRow extends Omit<Visit, "enteredSec"> {
  customerName: string | null;
  customerTier: Customer["tier"] | null;
  /**
   * Still in the store at `now` (today only). Path, time inside and checkout
   * then cover only what has happened so far: real sensors can't know the rest.
   */
  inside: boolean;
}

export function getVisitsPage(
  q: VisitsQuery,
  now: LocalDateTime = localNow(),
): Page<VisitRow> & {
  store: string;
  date: LocalDate;
} {
  const date = q.date ?? now.date;
  const nowSec = date === now.date ? secondsOfDay(now) : Infinity;
  // Filter and sort on what is known now, so "Reached checkout" or "longest"
  // never count steps an in-progress visit hasn't taken yet.
  const known = getDayVisits(q.store, date, now).map((v) => visitAsOf(v, nowSec));
  const insideIds = new Set(known.filter((k) => k.inside).map((k) => k.visit.id));
  let visits = known.map((k) => k.visit);

  visits = visits.filter(SEGMENT_FILTERS[q.segment]);

  const key: Record<VisitsQuery["sort"], (v: Visit) => number> = {
    enteredAt: (v) => v.enteredSec,
    totalDwellSec: (v) => v.totalDwellSec,
    stops: (v) => v.path.length,
  };
  const sign = q.dir === "asc" ? 1 : -1;
  const sorted = [...visits].sort(
    (a, b) => sign * (key[q.sort](a) - key[q.sort](b)) || a.enteredSec - b.enteredSec,
  );

  const page = paginate(sorted, q.page, q.pageSize);
  return {
    store: q.store,
    date,
    ...page,
    rows: page.rows.map((v) => toVisitRow(v, insideIds.has(v.id))),
  };
}

function toVisitRow(visit: Visit, inside: boolean): VisitRow {
  const { enteredSec, ...v } = visit;
  void enteredSec; // internal sort key, not part of the API row
  const c = v.customerId ? getCustomer(v.customerId) : undefined;
  return { ...v, customerName: c?.name ?? null, customerTier: c?.tier ?? null, inside };
}

interface KnownVisit {
  /** The visit as known at `nowSec`. */
  visit: Visit;
  timeline: VisitStop[];
  /** Second of the day the visitor left, or null while still inside. */
  leftSec: number | null;
  inside: boolean;
}

/**
 * A visit as the sensors know it at `nowSec` (Infinity for past days): an
 * in-progress visit keeps only the stops reached so far, with time inside and
 * checkout up to now.
 */
export function visitAsOf(visit: Visit, nowSec: number): KnownVisit {
  const timeline: VisitStop[] = [];
  let t = visit.enteredSec;
  for (const s of visit.path) {
    if (t > nowSec) break;
    timeline.push({
      zone: s.zone,
      label: ZONE_LABELS[s.zone],
      enteredAt: formatClock(t),
      dwellSec: Math.min(s.dwellSec, nowSec - t),
    });
    t += s.dwellSec;
  }
  if (t <= nowSec) return { visit, timeline, leftSec: t, inside: false };
  return {
    visit: {
      ...visit,
      path: timeline.map(({ zone, dwellSec }) => ({ zone, dwellSec })),
      totalDwellSec: nowSec - visit.enteredSec,
      checkout: timeline.some((s) => s.zone === "checkout"),
    },
    timeline,
    leftSec: null,
    inside: true,
  };
}

export interface VisitStop {
  zone: InStoreZone;
  label: string;
  /** Store-local time the visitor reached this zone, "HH:MM:SS". */
  enteredAt: string;
  dwellSec: number;
}

export interface VisitDetail extends VisitRow {
  /** The path with the time each zone was reached. */
  timeline: VisitStop[];
  /** When the visitor left, "HH:MM:SS"; null while still inside. */
  leftAt: string | null;
}

/** One visit by id (`<store>-<yyyymmdd>-<seq>`), or null if it doesn't exist (yet). */
export function getVisit(visitId: string, now: LocalDateTime = localNow()): VisitDetail | null {
  const m = VISIT_ID_PATTERN.exec(visitId);
  if (!m) return null;
  const [, storeId, y, mo, d] = m;
  const date = `${y}-${mo}-${d}`;
  if (!getStore(storeId) || !isLocalDate(date)) return null;
  const visit = getDayVisits(storeId, date, now).find((v) => v.id === visitId);
  if (!visit) return null;

  const known = visitAsOf(visit, date === now.date ? secondsOfDay(now) : Infinity);
  return {
    ...toVisitRow(known.visit, known.inside),
    timeline: known.timeline,
    leftAt: known.leftSec === null ? null : formatClock(known.leftSec),
  };
}

/**
 * How long visits last and how long people stay per zone, for one store-day
 * and segment (the same visits the table lists). Durations use finished visits
 * only; zone times use completed stops, so nothing still under way is counted.
 */
export function getVisitStats(q: VisitStatsQuery, now: LocalDateTime = localNow()) {
  const date = q.date ?? now.date;
  const nowSec = date === now.date ? secondsOfDay(now) : Infinity;
  const known = getDayVisits(q.store, date, now)
    .map((v) => visitAsOf(v, nowSec))
    .filter((k) => SEGMENT_FILTERS[q.segment](k.visit));
  const finished = known.filter((k) => !k.inside).map((k) => k.visit.totalDwellSec);
  const sorted = [...finished].sort((a, b) => a - b);
  const zones = getStore(q.store)!.zones.filter((z) => z !== "entrance");

  return {
    store: q.store,
    date,
    segment: q.segment,
    visits: known.length,
    finished: finished.length,
    inside: known.length - finished.length,
    medianSec: quantile(sorted, 0.5),
    p90Sec: quantile(sorted, 0.9),
    histogram: durationHistogram(finished),
    zones: zoneDwell(
      known.map((k) => k.visit),
      zones,
      (i) => known[i].inside,
    ),
  };
}

/** Window used for per-customer activity stats. */
export const CUSTOMER_ACTIVITY_DAYS = 30;

export interface CustomerRow extends Customer {
  homeStoreName: string;
  visits: number;
  checkouts: number;
  lastVisit: LocalDate | null;
}

export function getCustomersPage(q: CustomersQuery, now: LocalDateTime = localNow()): Page<CustomerRow> {
  const range = { from: addDays(now.date, -(CUSTOMER_ACTIVITY_DAYS - 1)), to: now.date };
  const activity = new Map<string, { visits: number; checkouts: number; lastVisit: LocalDate }>();
  for (const day of loadSummaries("all", range, now)) {
    for (const ref of day.customerVisits) {
      const a = activity.get(ref.customerId);
      if (a) {
        a.visits++;
        if (ref.checkout) a.checkouts++;
        if (day.date > a.lastVisit) a.lastVisit = day.date;
      } else {
        activity.set(ref.customerId, { visits: 1, checkouts: ref.checkout ? 1 : 0, lastVisit: day.date });
      }
    }
  }

  const needle = q.q?.toLowerCase();
  let rows: CustomerRow[] = allCustomers()
    .filter(
      (c) =>
        (q.store === "all" || c.homeStoreId === q.store) &&
        (q.tier === "all" || c.tier === q.tier) &&
        (!needle || c.name.toLowerCase().includes(needle) || c.id.toLowerCase().includes(needle)),
    )
    .map((c) => {
      const a = activity.get(c.id);
      return {
        ...c,
        homeStoreName: getStore(c.homeStoreId)!.name,
        visits: a?.visits ?? 0,
        checkouts: a?.checkouts ?? 0,
        lastVisit: a?.lastVisit ?? null,
      };
    });

  const sign = q.dir === "asc" ? 1 : -1;
  const cmp: Record<CustomersQuery["sort"], (a: CustomerRow, b: CustomerRow) => number> = {
    name: (a, b) => a.name.localeCompare(b.name, "es"),
    visits: (a, b) => a.visits - b.visits,
    checkouts: (a, b) => a.checkouts - b.checkouts,
    lastVisit: (a, b) => (a.lastVisit ?? "").localeCompare(b.lastVisit ?? ""),
    memberSince: (a, b) => a.memberSince.localeCompare(b.memberSince),
  };
  rows = rows.sort((a, b) => sign * cmp[q.sort](a, b) || a.id.localeCompare(b.id));
  return paginate(rows, q.page, q.pageSize);
}
