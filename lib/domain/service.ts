/**
 * Query layer: the functions the API routes and the AI assistant call.
 * Every function takes an optional `now` so results are reproducible in tests.
 */
import { STORES, getStore } from "./catalog";
import { allCustomers, getCustomer } from "./customers";
import { getDayStatus } from "./status";
import { getDaySummary, getDayVisits } from "./generator";
import { type Granularity, computeKpis, funnel, hourProfile, trafficSeries, zoneStats } from "./metrics";
import type { CustomersQuery, RangeInput, VisitsQuery } from "./schemas";
import { type LocalDate, type LocalDateTime, addDays, diffDays, eachDay, localNow } from "./time";
import type { Customer, DaySummary, InStoreZone, Visit } from "./types";

export type StoreScope = "all" | (string & {});

export interface DateRange {
  from: LocalDate;
  to: LocalDate;
}

export function resolveRange(input: RangeInput, now: LocalDateTime = localNow()): DateRange {
  if (input.from && input.to) return { from: input.from, to: input.to };
  switch (input.preset ?? "today") {
    case "today":
      return { from: now.date, to: now.date };
    case "yesterday": {
      const y = addDays(now.date, -1);
      return { from: y, to: y };
    }
    case "7d":
      return { from: addDays(now.date, -6), to: now.date };
    case "30d":
      return { from: addDays(now.date, -29), to: now.date };
  }
}

/** Same-length period immediately before `range`. */
export function previousRange(range: DateRange): DateRange {
  const len = diffDays(range.from, range.to) + 1;
  return { from: addDays(range.from, -len), to: addDays(range.to, -len) };
}

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

/** True when the range includes today, i.e. its numbers are still moving. */
const isLive = (range: DateRange, now: LocalDateTime) => range.to >= now.date && range.from <= now.date;

interface ScopedQuery {
  store: StoreScope;
  range: RangeInput;
}

export function getOverview(q: ScopedQuery, now: LocalDateTime = localNow()) {
  const range = resolveRange(q.range, now);
  const prev = previousRange(range);
  // When the range is live, compare against the previous period up to the same
  // time of day — otherwise "today so far" would be compared with a full day.
  const len = diffDays(range.from, range.to) + 1;
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

export interface VisitRow extends Omit<Visit, "enteredSec"> {
  customerName: string | null;
  customerTier: Customer["tier"] | null;
}

export function getVisitsPage(
  q: VisitsQuery,
  now: LocalDateTime = localNow(),
): Page<VisitRow> & {
  store: string;
  date: LocalDate;
} {
  const date = q.date ?? now.date;
  let visits = getDayVisits(q.store, date, now);

  if (q.segment === "registered") visits = visits.filter((v) => v.customerId);
  if (q.segment === "anonymous") visits = visits.filter((v) => !v.customerId);
  if (q.segment === "new") visits = visits.filter((v) => !v.returning);
  if (q.segment === "returning") visits = visits.filter((v) => v.returning);
  if (q.segment === "checkout") visits = visits.filter((v) => v.checkout);

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
    rows: page.rows.map((visit) => {
      const { enteredSec, ...v } = visit;
      void enteredSec; // internal sort key, not part of the API row
      const c = v.customerId ? getCustomer(v.customerId) : undefined;
      return { ...v, customerName: c?.name ?? null, customerTier: c?.tier ?? null };
    }),
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
