/**
 * Deterministic sensor-data simulator.
 *
 * `generateDay(store, date)` is the single source of truth: it produces the
 * street counts and every visit for one store-day from a seeded RNG. Daily
 * summaries (used by KPIs and charts) are derived from those visits, so tables,
 * charts and the AI assistant always agree.
 */
import { allCustomers, customersOfStore, memberPicker } from "./customers";
import { PRODUCT_ZONES, ZONE_BEHAVIOUR, ZONE_BIT, getStore } from "./catalog";
import { createRng, hashString } from "./random";
import { type LocalDate, type LocalDateTime, dayOfWeek, formatClock, secondsOfDay } from "./time";
import type {
  DaySummary,
  HourAgg,
  InStoreZone,
  OpeningHours,
  Store,
  Visit,
  ZoneAgg,
  ZoneStop,
} from "./types";

/** Relative street traffic per local hour (lunch and after-work peaks). */
export const STREET_CURVE = [
  0.05, 0.03, 0.02, 0.02, 0.02, 0.04, 0.12, 0.3, 0.55, 0.7, 0.85, 0.95, 1.1, 1.25, 1.15, 0.95, 0.9, 1.0, 1.2,
  1.3, 1.15, 0.85, 0.55, 0.25,
];

/** Relative traffic by weekday, Sunday first. */
export const WEEKDAY_FACTOR = [0.75, 0.85, 0.9, 0.95, 1.0, 1.15, 1.35];

/** Capture rate tends to rise in the evening (people shopping after work). */
const HOURLY_CAPTURE_ADJ = (hour: number) => (hour >= 18 ? 1.12 : hour <= 11 ? 0.88 : 1);

export function openingHours(store: Store, date: LocalDate): OpeningHours | null {
  return dayOfWeek(date) === 0 ? store.sundayHours : store.hours;
}

/** The fields of a visit needed for aggregation (no display strings). */
export type RawVisit = Pick<
  Visit,
  "enteredSec" | "path" | "customerId" | "checkout" | "totalDwellSec" | "returning"
> & {
  /** Index into the store's pool of known anonymous devices; -1 for new or registered visitors. */
  deviceIndex: number;
};

/** Share of registered members' visits that are repeat visits. */
const REGISTERED_RETURNING_RATE = 0.9;
/** Returning share by weekday (Sunday first): weekends bring more first-time visitors. */
const RETURNING_WEEKDAY_FACTOR = [0.8, 1.05, 1.05, 1.05, 1.05, 0.95, 0.8];
/** Returning visitors know the store: they reach the till a bit more often. */
const RETURNING_CHECKOUT_BOOST = 1.2;

export interface SimulatedDay {
  street: number[];
  visits: RawVisit[];
}

export interface GeneratedDay {
  street: number[];
  visits: Visit[];
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Dwell time around a mean, skewed so most stops are short and a few are long. */
function dwell(rng: ReturnType<typeof createRng>, mean: number): number {
  return Math.max(5, Math.round(mean * (0.35 + rng.next() * rng.next() * 2.6)));
}

/** Chance of going straight back to the rail after the fitting rooms (another size, another colour). */
const BACK_AFTER_FITTING = 0.35;
/** Chance of one last look at an earlier product zone before leaving or paying. */
const LAST_LOOK = 0.14;
/** A return to a zone already seen is quicker than the first look. */
const REVISIT_DWELL = 0.4;

/**
 * One visitor's walk: entrance, the product zones they pick in an order that
 * varies (popular zones tend to come first), the fitting rooms right after
 * browsing apparel, sometimes back to a zone already seen, then checkout or out.
 */
function walkStore(
  rng: ReturnType<typeof createRng>,
  hasZone: ReadonlySet<InStoreZone>,
  returning: boolean,
): { path: ZoneStop[]; checkout: boolean } {
  const stop = (zone: InStoreZone, factor = 1): ZoneStop => ({
    zone,
    dwellSec: dwell(rng, ZONE_BEHAVIOUR[zone].dwellSec * factor),
  });
  const path: ZoneStop[] = [stop("entrance")];

  // Which product zones, then a weighted shuffle (Efraimidis–Spirakis keys):
  // womenswear usually comes first, but not always.
  const picked = PRODUCT_ZONES.filter((z) => hasZone.has(z) && rng.chance(ZONE_BEHAVIOUR[z].visitProb))
    .map((zone) => ({ zone, key: rng.next() ** (1 / ZONE_BEHAVIOUR[zone].visitProb) }))
    .sort((a, b) => b.key - a.key)
    .map((p) => p.zone);

  const apparel = picked.filter((z) => z !== "kids");
  // Fitting rooms only make sense after browsing apparel; they follow one of the apparel zones.
  const tried = apparel.length > 0 && rng.chance(ZONE_BEHAVIOUR["fitting-rooms"].visitProb / 0.7);
  const triedAfter = tried ? rng.pick(apparel) : null;

  for (const zone of picked) {
    path.push(stop(zone));
    if (zone !== triedAfter) continue;
    path.push(stop("fitting-rooms"));
    if (rng.chance(BACK_AFTER_FITTING)) path.push(stop(zone, REVISIT_DWELL));
  }

  // One last look at an earlier zone (not the one just left).
  if (picked.length >= 2 && rng.chance(LAST_LOOK)) {
    const last = path.at(-1)!.zone;
    const options = picked.filter((z) => z !== last);
    path.push(stop(rng.pick(options), REVISIT_DWELL));
  }

  // Trying things on strongly increases the chance of reaching the till.
  const baseCheckout = picked.length === 0 ? 0.03 : tried ? 0.62 : 0.2;
  const checkout = rng.chance(Math.min(0.9, baseCheckout * (returning ? RETURNING_CHECKOUT_BOOST : 1)));
  if (checkout) path.push(stop("checkout"));
  return { path, checkout };
}

/**
 * Simulates one full store-day. Pure: same inputs, same output.
 * Returns lean visits — use `generateDay` when display fields are needed.
 */
export function simulateDay(store: Store, date: LocalDate): SimulatedDay {
  const rng = createRng(`${store.id}|${date}`);
  const hours = openingHours(store, date);
  const dayFactor = WEEKDAY_FACTOR[dayOfWeek(date)] * (1 + rng.normal(0, 0.06));
  // Members who shop that day (joined, not churned), weighted by how often they shop.
  const homeMembers = memberPicker(customersOfStore(store.id), date);
  const anyMembers = memberPicker(allCustomers(), date);
  const hasZone = new Set(store.zones);
  const returningRate = store.returningRate * RETURNING_WEEKDAY_FACTOR[dayOfWeek(date)];

  const street: number[] = [];
  const visits: RawVisit[] = [];

  for (let hour = 0; hour < 24; hour++) {
    const noise = 1 + rng.normal(0, 0.08);
    const passers = Math.max(0, Math.round(store.streetBase * dayFactor * STREET_CURVE[hour] * noise));
    street.push(passers);

    if (!hours || hour < hours.open || hour >= hours.close) continue;

    const capture = clamp(
      store.captureBase * HOURLY_CAPTURE_ADJ(hour) * (1 + rng.normal(0, 0.12)),
      0.02,
      0.4,
    );
    const entrants = Math.round(passers * capture);
    const startSecs = Array.from({ length: entrants }, () => hour * 3600 + rng.int(0, 3599)).sort(
      (a, b) => a - b,
    );

    for (const enteredSec of startSecs) {
      // Who is this? A registered member (identified via the app), a known anonymous
      // device seen on earlier days, or a device never seen before.
      let customerId: string | null = null;
      if (rng.chance(store.registeredRate)) {
        // Mostly their home store; sometimes a member of another store passes by.
        const pool = rng.chance(0.9) ? homeMembers : anyMembers;
        customerId = pool.pick(rng.next())?.id ?? null;
      }
      const returning = rng.chance(customerId ? REGISTERED_RETURNING_RATE : returningRate);
      const deviceIndex = returning && !customerId ? rng.int(0, store.devicePool - 1) : -1;

      const { path, checkout } = walkStore(rng, hasZone, returning);
      let totalDwellSec = 0;
      for (const s of path) totalDwellSec += s.dwellSec;
      visits.push({ enteredSec, path, customerId, checkout, totalDwellSec, returning, deviceIndex });
    }
  }

  return { street, visits };
}

/** Full store-day with display fields (ids, times, visitor hashes) for tables. */
export function generateDay(store: Store, date: LocalDate): GeneratedDay {
  const { street, visits } = simulateDay(store, date);
  const compactDate = date.replaceAll("-", "");
  return {
    street,
    visits: visits.map(({ deviceIndex, ...v }, i) => {
      const seq = i + 1;
      // Stable hashed device ids: registered members and known devices keep the same
      // id across days; a new device gets an id unique to this visit.
      const visitorHash = v.customerId
        ? hashString(`visitor|${v.customerId}`)
        : deviceIndex >= 0
          ? hashString(`device|${store.id}|${deviceIndex}`)
          : hashString(`visitor|${store.id}|${date}|${seq}`);
      return {
        id: `${store.id}-${compactDate}-${String(seq).padStart(5, "0")}`,
        storeId: store.id,
        date,
        enteredAt: formatClock(v.enteredSec),
        visitorId: visitorHash.toString(16).padStart(8, "0"),
        ...v,
      };
    }),
  };
}

function emptyZones(): Record<InStoreZone, ZoneAgg> {
  return {
    entrance: { visitors: 0, dwellSec: 0 },
    womenswear: { visitors: 0, dwellSec: 0 },
    menswear: { visitors: 0, dwellSec: 0 },
    kids: { visitors: 0, dwellSec: 0 },
    "fitting-rooms": { visitors: 0, dwellSec: 0 },
    checkout: { visitors: 0, dwellSec: 0 },
  };
}

/**
 * Aggregates a generated day into hourly buckets.
 * With `cutoffSec`, only data up to that second of the day is included
 * (street counts of the current hour are pro-rated) — this is how "live" works.
 */
export function summarizeDay(
  store: Store,
  date: LocalDate,
  day: SimulatedDay,
  cutoffSec?: number,
): DaySummary {
  const byHour: HourAgg[] = day.street.map((passers, hour) => {
    let street = passers;
    if (cutoffSec !== undefined) {
      const elapsed = clamp(cutoffSec - hour * 3600, 0, 3600);
      street = Math.round((passers * elapsed) / 3600);
    }
    return {
      hour,
      street,
      entrants: 0,
      registered: 0,
      returning: 0,
      browsed: 0,
      checkouts: 0,
      dwellSec: 0,
      zones: emptyZones(),
    };
  });

  const customerVisits: DaySummary["customerVisits"] = [];
  const cutoff = cutoffSec ?? Infinity;

  for (const [i, raw] of day.visits.entries()) {
    if (raw.enteredSec > cutoff) break; // visits are sorted
    // Only what has happened by the cut-off: an in-progress visit counts the
    // stops reached so far, its time inside so far and no checkout yet.
    const { path, totalDwellSec, checkout } = visitSoFar(raw, cutoff);
    const h = byHour[Math.floor(raw.enteredSec / 3600)];
    h.entrants++;
    h.dwellSec += totalDwellSec;
    if (checkout) h.checkouts++;
    if (path.some((s) => isProductZone(s.zone))) h.browsed++;
    if (raw.returning) h.returning++;

    let zones = 0;
    for (const stop of path) {
      // A zone counts each visitor once, however many times they go back.
      if (!(zones & ZONE_BIT[stop.zone])) h.zones[stop.zone].visitors++;
      h.zones[stop.zone].dwellSec += stop.dwellSec;
      zones |= ZONE_BIT[stop.zone];
    }
    if (raw.customerId) {
      h.registered++;
      customerVisits.push({
        customerId: raw.customerId,
        enteredSec: raw.enteredSec,
        checkout,
        leftSec: raw.enteredSec + raw.totalDwellSec,
        seq: i + 1,
        zones,
      });
    }
  }

  return {
    storeId: store.id,
    date,
    hours: openingHours(store, date),
    cutoffSec: cutoffSec ?? null,
    byHour,
    customerVisits,
  };
}

const isProductZone = (z: InStoreZone) => (PRODUCT_ZONES as readonly string[]).includes(z);

/**
 * A visit as known at `cutoffSec` (Infinity for a finished day): the stops
 * reached so far, the last one cut at the cut-off, and checkout only once reached.
 */
export function visitSoFar(
  visit: Pick<RawVisit, "enteredSec" | "path" | "totalDwellSec" | "checkout">,
  cutoffSec: number,
): { path: ZoneStop[]; totalDwellSec: number; checkout: boolean; ended: boolean } {
  if (visit.enteredSec + visit.totalDwellSec <= cutoffSec) {
    return { path: visit.path, totalDwellSec: visit.totalDwellSec, checkout: visit.checkout, ended: true };
  }
  const path: ZoneStop[] = [];
  let t = visit.enteredSec;
  for (const s of visit.path) {
    if (t > cutoffSec) break;
    path.push({ zone: s.zone, dwellSec: Math.min(s.dwellSec, cutoffSec - t) });
    t += s.dwellSec;
  }
  return {
    path,
    totalDwellSec: cutoffSec - visit.enteredSec,
    checkout: path.some((s) => s.zone === "checkout"),
    ended: false,
  };
}

// --- Caching -----------------------------------------------------------------
// Past days never change, so their summaries are memoised per server instance.
// Today's data depends on the current time and is always recomputed.

const SUMMARY_CACHE_LIMIT = 4000;
const summaryCache = new Map<string, DaySummary>();

/**
 * Summary for one store-day as seen at `now`.
 * Future days are empty; today is cut off at the current time.
 */
export function getDaySummary(storeId: string, date: LocalDate, now: LocalDateTime): DaySummary {
  const store = getStore(storeId);
  if (!store) throw new Error(`Unknown store: ${storeId}`);

  if (date > now.date) {
    return summarizeDay(store, date, { street: Array(24).fill(0), visits: [] }, 0);
  }
  if (date === now.date) {
    return summarizeDay(store, date, getSimulatedDay(storeId, date), secondsOfDay(now));
  }

  const key = `${storeId}|${date}`;
  let summary = summaryCache.get(key);
  if (!summary) {
    summary = summarizeDay(store, date, simulateDay(store, date));
    if (summaryCache.size >= SUMMARY_CACHE_LIMIT) {
      summaryCache.delete(summaryCache.keys().next().value!);
    }
    summaryCache.set(key, summary);
  }
  return summary;
}

// A full simulated day is deterministic — today's included, since "live" is only a
// cut-off applied afterwards — so a small LRU of lean simulations serves the live
// view (which reads several days every few seconds) without re-simulating.
const SIMULATION_CACHE_LIMIT = 48;
const simulationCache = new Map<string, SimulatedDay>();

/** Full-day lean simulation for a store-day, memoised (LRU). */
export function getSimulatedDay(storeId: string, date: LocalDate): SimulatedDay {
  const key = `${storeId}|${date}`;
  let day = simulationCache.get(key);
  if (day) {
    simulationCache.delete(key); // refresh LRU position
  } else {
    const store = getStore(storeId);
    if (!store) throw new Error(`Unknown store: ${storeId}`);
    day = simulateDay(store, date);
    if (simulationCache.size >= SIMULATION_CACHE_LIMIT) {
      simulationCache.delete(simulationCache.keys().next().value!);
    }
  }
  simulationCache.set(key, day);
  return day;
}

/** Visits for one store-day as seen at `now` (today only includes visits so far). */
export function getDayVisits(storeId: string, date: LocalDate, now: LocalDateTime): Visit[] {
  const store = getStore(storeId);
  if (!store) throw new Error(`Unknown store: ${storeId}`);
  if (date > now.date) return [];
  const { visits } = generateDay(store, date);
  if (date < now.date) return visits;
  const cutoff = secondsOfDay(now);
  return visits.filter((v) => v.enteredSec <= cutoff);
}
