/**
 * Loyalty members: activity over recent visits, segments, programme KPIs and
 * the customer profile. Everything is inferred from member visits in the daily
 * summaries — the simulation's hidden member behaviour is never read here.
 *
 * Today's visits are only partly known (see `visitAsOf`): a visit still under
 * way counts as a visit, but its zones and checkout count once it has ended.
 */
import { STORES, ZONE_BIT, ZONE_LABELS, getStore } from "./catalog";
import { allCustomers, getCustomer } from "./customers";
import { safeDiv } from "./metrics";
import { type Page, paginate } from "./page";
import {
  type CustomerSegment,
  type CustomersQuery,
  type MemberOverviewQuery,
  SEGMENT_DAYS,
  SEGMENT_LABELS,
} from "./schemas";

export { SEGMENT_DAYS, SEGMENT_LABELS } from "./schemas";
import { loadSummaries } from "./summaries";
import {
  type LocalDate,
  type LocalDateTime,
  addDays,
  diffDays,
  eachDay,
  formatClock,
  localNow,
  secondsOfDay,
} from "./time";
import type { Customer, InStoreZone } from "./types";

/** How far back member activity is read (last visit, profile calendar). */
export const MEMBER_LOOKBACK_DAYS = 90;
/** Window for visit counts and programme KPIs. */
export const MEMBER_WINDOW_DAYS = 30;

export function segmentOf(lastVisit: LocalDate | null, today: LocalDate): CustomerSegment {
  if (!lastVisit) return "lapsed";
  const days = diffDays(lastVisit, today);
  return days <= SEGMENT_DAYS.active ? "active" : days <= SEGMENT_DAYS.lapsing ? "lapsing" : "lapsed";
}

interface MemberVisit {
  date: LocalDate;
  storeId: string;
  enteredSec: number;
  seq: number;
  /** Visit ended (always, except today's visits still under way). */
  ended: boolean;
  /** Checkout reached; false until an ongoing visit has ended. */
  checkout: boolean;
  /** Zone bitmask; 0 until an ongoing visit has ended. */
  zones: number;
}

/** Every member visit in the lookback window, grouped by member, oldest first. */
function memberVisits(now: LocalDateTime, days = MEMBER_LOOKBACK_DAYS): Map<string, MemberVisit[]> {
  const nowSec = secondsOfDay(now);
  const range = { from: addDays(now.date, -(days - 1)), to: now.date };
  const days_ = loadSummaries("all", range, now).sort(
    (a, b) => a.date.localeCompare(b.date) || a.storeId.localeCompare(b.storeId),
  );
  const out = new Map<string, MemberVisit[]>();
  for (const day of days_) {
    const today = day.date === now.date;
    for (const ref of day.customerVisits) {
      const ended = !today || ref.leftSec <= nowSec;
      let list = out.get(ref.customerId);
      if (!list) out.set(ref.customerId, (list = []));
      list.push({
        date: day.date,
        storeId: day.storeId,
        enteredSec: ref.enteredSec,
        seq: ref.seq,
        ended,
        checkout: ended && ref.checkout,
        zones: ended ? ref.zones : 0,
      });
    }
  }
  return out;
}

const inWindow = (v: MemberVisit, from: LocalDate, to: LocalDate) => v.date >= from && v.date <= to;
const visitId = (v: Pick<MemberVisit, "storeId" | "date" | "seq">) =>
  `${v.storeId}-${v.date.replaceAll("-", "")}-${String(v.seq).padStart(5, "0")}`;

// --- Member table --------------------------------------------------------------

export interface CustomerRow extends Customer {
  homeStoreName: string;
  /** Visits in the last MEMBER_WINDOW_DAYS days. */
  visits: number;
  /** Checkouts in the last MEMBER_WINDOW_DAYS days. */
  checkouts: number;
  /** Last visit within MEMBER_LOOKBACK_DAYS days, or null. */
  lastVisit: LocalDate | null;
  segment: CustomerSegment;
  /** Different stores visited within MEMBER_LOOKBACK_DAYS days. */
  storesVisited: number;
}

function customerRows(now: LocalDateTime): CustomerRow[] {
  const visits = memberVisits(now);
  const from = addDays(now.date, -(MEMBER_WINDOW_DAYS - 1));
  return allCustomers().map((c) => {
    const list = visits.get(c.id) ?? [];
    const recent = list.filter((v) => inWindow(v, from, now.date));
    const lastVisit = list.at(-1)?.date ?? null;
    return {
      ...c,
      homeStoreName: getStore(c.homeStoreId)!.name,
      visits: recent.length,
      checkouts: recent.filter((v) => v.checkout).length,
      lastVisit,
      segment: segmentOf(lastVisit, now.date),
      storesVisited: new Set(list.map((v) => v.storeId)).size,
    };
  });
}

export function getCustomersPage(q: CustomersQuery, now: LocalDateTime = localNow()): Page<CustomerRow> {
  const needle = q.q?.toLowerCase();
  let rows = customerRows(now).filter(
    (c) =>
      (q.store === "all" || c.homeStoreId === q.store) &&
      (q.tier === "all" || c.tier === q.tier) &&
      (q.segment === "all" || c.segment === q.segment) &&
      (!needle || c.name.toLowerCase().includes(needle) || c.id.toLowerCase().includes(needle)),
  );

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

// --- Programme overview ------------------------------------------------------------

export interface MemberKpis {
  /** Members who had joined by the end of the window. */
  members: number;
  /** Members with at least one visit in the window. */
  activeMembers: number;
  activeShare: number;
  memberVisits: number;
  visitsPerActive: number;
  /** Checkout rate of members' ended visits. */
  memberCheckoutRate: number;
  /** Checkout rate of everyone else at the same stores. */
  otherCheckoutRate: number;
  /** Members' share of all visits at the scope's stores. */
  memberVisitShare: number;
  newMembers: number;
}

/**
 * Programme KPIs for the members of a home store (or all), over the last 30
 * days vs. the 30 before, the latter up to the same time of day so a partial
 * today isn't compared with a full day.
 */
export function getMemberOverview(q: MemberOverviewQuery, now: LocalDateTime = localNow()) {
  const window = { from: addDays(now.date, -(MEMBER_WINDOW_DAYS - 1)), to: now.date };
  const previousWindow = {
    from: addDays(window.from, -MEMBER_WINDOW_DAYS),
    to: addDays(window.to, -MEMBER_WINDOW_DAYS),
  };
  const nowSec = secondsOfDay(now);
  const visits = memberVisits(now, MEMBER_WINDOW_DAYS * 2);
  const members = allCustomers().filter((c) => q.store === "all" || c.homeStoreId === q.store);
  const scopeStores = new Set(q.store === "all" ? STORES.map((s) => s.id) : [q.store]);
  const summaries = loadSummaries(q.store, { from: previousWindow.from, to: now.date }, now);

  const kpis = (w: { from: LocalDate; to: LocalDate }, cutLastDay: boolean): MemberKpis => {
    // The previous window's last day is cut at the current time of day.
    const counts = (v: MemberVisit) =>
      inWindow(v, w.from, w.to) && !(cutLastDay && v.date === w.to && v.enteredSec > nowSec);
    let active = 0;
    let memberVisits = 0;
    let ended = 0;
    let checkouts = 0;
    for (const c of members) {
      const list = (visits.get(c.id) ?? []).filter(counts);
      if (list.length) active++;
      memberVisits += list.length;
      for (const v of list) {
        if (!v.ended) continue;
        ended++;
        if (v.checkout) checkouts++;
      }
    }
    // Everyone visiting the scope's stores, members of any store included.
    let entrants = 0;
    let registered = 0;
    let allCheckouts = 0;
    let anyMemberCheckouts = 0;
    for (const day of summaries) {
      if (day.date < w.from || day.date > w.to || !scopeStores.has(day.storeId)) continue;
      const cut = cutLastDay && day.date === w.to ? nowSec : Infinity;
      for (const h of day.byHour) {
        if (h.hour * 3600 > cut) continue;
        entrants += h.entrants;
        registered += h.registered;
        allCheckouts += h.checkouts;
      }
      for (const ref of day.customerVisits) if (ref.enteredSec <= cut && ref.checkout) anyMemberCheckouts++;
    }
    const joined = members.filter((c) => c.memberSince <= w.to);
    return {
      members: joined.length,
      activeMembers: active,
      activeShare: safeDiv(active, joined.length),
      memberVisits,
      visitsPerActive: safeDiv(memberVisits, active),
      memberCheckoutRate: safeDiv(checkouts, ended),
      otherCheckoutRate: safeDiv(allCheckouts - anyMemberCheckouts, entrants - registered),
      memberVisitShare: safeDiv(registered, entrants),
      newMembers: members.filter((c) => c.memberSince >= w.from && c.memberSince <= w.to).length,
    };
  };

  return {
    store: q.store,
    window,
    previousWindow,
    kpis: kpis(window, false),
    previous: kpis(previousWindow, true),
    segments: getSegments(q, now),
  };
}

export interface SegmentCount {
  segment: CustomerSegment;
  label: string;
  total: number;
  byTier: Record<Customer["tier"], number>;
}

/** Members of a home store (or all) per segment and tier. */
export function getSegments(q: MemberOverviewQuery, now: LocalDateTime = localNow()): SegmentCount[] {
  const rows = customerRows(now).filter((c) => q.store === "all" || c.homeStoreId === q.store);
  return (Object.keys(SEGMENT_LABELS) as CustomerSegment[]).map((segment) => {
    const inSeg = rows.filter((r) => r.segment === segment);
    return {
      segment,
      label: SEGMENT_LABELS[segment],
      total: inSeg.length,
      byTier: {
        bronze: inSeg.filter((r) => r.tier === "bronze").length,
        silver: inSeg.filter((r) => r.tier === "silver").length,
        gold: inSeg.filter((r) => r.tier === "gold").length,
      },
    };
  });
}

// --- Profile ---------------------------------------------------------------------

/** Zones shown in a member's favourites (the entrance is part of every visit). */
const PROFILE_ZONES: InStoreZone[] = ["womenswear", "menswear", "kids", "fitting-rooms", "checkout"];

/** One member: activity, favourite stores and zones, a visit calendar and recent visits. */
export function getCustomerProfile(id: string, now: LocalDateTime = localNow()) {
  const customer = getCustomer(id);
  if (!customer) return null;
  const list = memberVisits(now).get(id) ?? [];
  const from30 = addDays(now.date, -(MEMBER_WINDOW_DAYS - 1));
  const lastVisit = list.at(-1)?.date ?? null;
  const ended = list.filter((v) => v.ended);

  const perDay = new Map<LocalDate, number>();
  for (const v of list) perDay.set(v.date, (perDay.get(v.date) ?? 0) + 1);
  const lookbackFrom = addDays(now.date, -(MEMBER_LOOKBACK_DAYS - 1));

  const perStore = new Map<string, number>();
  for (const v of list) perStore.set(v.storeId, (perStore.get(v.storeId) ?? 0) + 1);

  return {
    ...customer,
    homeStoreName: getStore(customer.homeStoreId)!.name,
    segment: segmentOf(lastVisit, now.date),
    lastVisit,
    daysSinceLastVisit: lastVisit ? diffDays(lastVisit, now.date) : null,
    visits30: list.filter((v) => inWindow(v, from30, now.date)).length,
    visits90: list.length,
    checkoutRate: safeDiv(ended.filter((v) => v.checkout).length, ended.length),
    stores: [...perStore]
      .map(([storeId, visits]) => ({
        storeId,
        name: getStore(storeId)!.name,
        visits,
        share: safeDiv(visits, list.length),
        home: storeId === customer.homeStoreId,
      }))
      .sort((a, b) => b.visits - a.visits),
    zones: PROFILE_ZONES.map((zone) => ({
      zone,
      label: ZONE_LABELS[zone],
      share: safeDiv(ended.filter((v) => v.zones & ZONE_BIT[zone]).length, ended.length),
    })),
    calendar: eachDay(lookbackFrom, now.date).map((date) => ({ date, visits: perDay.get(date) ?? 0 })),
    recentVisits: [...list].reverse().map((v) => ({
      visitId: visitId(v),
      date: v.date,
      storeId: v.storeId,
      storeName: getStore(v.storeId)!.name,
      enteredAt: formatClock(v.enteredSec),
      inProgress: !v.ended,
      checkout: v.checkout,
      zones: PROFILE_ZONES.filter((z) => v.zones & ZONE_BIT[z]),
    })),
  };
}

export type CustomerProfile = NonNullable<ReturnType<typeof getCustomerProfile>>;
