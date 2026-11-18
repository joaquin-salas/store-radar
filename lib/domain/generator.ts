/**
 * Deterministic sensor-data simulator.
 *
 * `generateDay(store, date)` is the single source of truth: it produces the
 * street counts and every visit for one store-day from a seeded RNG. Daily
 * summaries (used by KPIs and charts) are derived from those visits, so tables,
 * charts and the AI assistant always agree.
 */
import { allCustomers, customersOfStore } from "./customers";
import { PRODUCT_ZONES, ZONE_BEHAVIOUR, getStore } from "./catalog";
import { createRng, hashString } from "./random";
import { type LocalDate, type LocalDateTime, dayOfWeek, pad2, secondsOfDay } from "./time";
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
export type RawVisit = Pick<Visit, "enteredSec" | "path" | "customerId" | "checkout" | "totalDwellSec">;

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

function formatTime(sec: number): string {
  return `${pad2(Math.floor(sec / 3600))}:${pad2(Math.floor((sec % 3600) / 60))}:${pad2(sec % 60)}`;
}

/**
 * Simulates one full store-day. Pure: same inputs, same output.
 * Returns lean visits — use `generateDay` when display fields are needed.
 */
export function simulateDay(store: Store, date: LocalDate): SimulatedDay {
  const rng = createRng(`${store.id}|${date}`);
  const hours = openingHours(store, date);
  const dayFactor = WEEKDAY_FACTOR[dayOfWeek(date)] * (1 + rng.normal(0, 0.06));
  const homeCustomers = customersOfStore(store.id);
  const anyCustomers = allCustomers();
  const hasZone = new Set(store.zones);

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
      const path: ZoneStop[] = [{ zone: "entrance", dwellSec: dwell(rng, ZONE_BEHAVIOUR.entrance.dwellSec) }];

      let browsedApparel = false;
      for (const zone of PRODUCT_ZONES) {
        if (!hasZone.has(zone) || !rng.chance(ZONE_BEHAVIOUR[zone].visitProb)) continue;
        path.push({ zone, dwellSec: dwell(rng, ZONE_BEHAVIOUR[zone].dwellSec) });
        if (zone !== "kids") browsedApparel = true;
      }

      const browsed = path.length > 1;
      // Fitting rooms only make sense after browsing apparel.
      const tried = browsedApparel && rng.chance(ZONE_BEHAVIOUR["fitting-rooms"].visitProb / 0.7);
      if (tried) {
        path.push({ zone: "fitting-rooms", dwellSec: dwell(rng, ZONE_BEHAVIOUR["fitting-rooms"].dwellSec) });
      }

      // Trying things on strongly increases the chance of reaching the till.
      const checkoutProb = !browsed ? 0.03 : tried ? 0.62 : 0.2;
      const checkout = rng.chance(checkoutProb);
      if (checkout) {
        path.push({ zone: "checkout", dwellSec: dwell(rng, ZONE_BEHAVIOUR.checkout.dwellSec) });
      }

      let customerId: string | null = null;
      if (rng.chance(store.registeredRate)) {
        const pool = rng.chance(0.9) && homeCustomers.length ? homeCustomers : anyCustomers;
        customerId = rng.pick(pool).id;
      }

      let totalDwellSec = 0;
      for (const s of path) totalDwellSec += s.dwellSec;
      visits.push({ enteredSec, path, customerId, checkout, totalDwellSec });
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
    visits: visits.map((v, i) => {
      const seq = i + 1;
      const visitorHash = v.customerId
        ? hashString(`visitor|${v.customerId}`)
        : hashString(`visitor|${store.id}|${date}|${seq}`);
      return {
        id: `${store.id}-${compactDate}-${String(seq).padStart(5, "0")}`,
        storeId: store.id,
        date,
        enteredAt: formatTime(v.enteredSec),
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
      browsed: 0,
      checkouts: 0,
      dwellSec: 0,
      zones: emptyZones(),
    };
  });

  const customerVisits: DaySummary["customerVisits"] = [];

  for (const v of day.visits) {
    if (cutoffSec !== undefined && v.enteredSec > cutoffSec) break; // visits are sorted
    const h = byHour[Math.floor(v.enteredSec / 3600)];
    h.entrants++;
    h.dwellSec += v.totalDwellSec;
    if (v.checkout) h.checkouts++;
    // Path is [entrance, ...product zones, fitting-rooms?, checkout?]
    const second = v.path[1]?.zone;
    if (second === "womenswear" || second === "menswear" || second === "kids") h.browsed++;
    if (v.customerId) {
      h.registered++;
      customerVisits.push({ customerId: v.customerId, enteredSec: v.enteredSec, checkout: v.checkout });
    }
    for (const stop of v.path) {
      h.zones[stop.zone].visitors++;
      h.zones[stop.zone].dwellSec += stop.dwellSec;
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
