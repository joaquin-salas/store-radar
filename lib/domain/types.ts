import type { LocalDate } from "./time";

export const ZONE_TYPES = [
  "street",
  "entrance",
  "womenswear",
  "menswear",
  "kids",
  "fitting-rooms",
  "checkout",
] as const;

export type ZoneType = (typeof ZONE_TYPES)[number];

/** Zones a visitor can be in once inside the store. */
export type InStoreZone = Exclude<ZoneType, "street">;

/** Product zones — visiting one counts as "browsing" in the funnel. */
export type ProductZone = "womenswear" | "menswear" | "kids";

export interface OpeningHours {
  /** Opening hour (inclusive), store-local. */
  open: number;
  /** Closing hour (exclusive), store-local. */
  close: number;
}

export interface Store {
  id: string;
  name: string;
  city: string;
  sizeM2: number;
  /** In-store zones this store has (street + entrance are implicit). */
  zones: InStoreZone[];
  /** Mon–Sat opening hours. */
  hours: OpeningHours;
  /** Sunday opening hours, or null when closed on Sundays. */
  sundayHours: OpeningHours | null;
  /** Street passers-by per hour at the reference traffic level. */
  streetBase: number;
  /** Typical share of passers-by who walk in (capture rate). */
  captureBase: number;
  /** Share of visitors identified as registered customers (loyalty app). */
  registeredRate: number;
  /** Maximum people allowed inside at once (safety/comfort limit). */
  capacity: number;
  /** Comfortable maximum per zone; fitting rooms = 2 people per cubicle (customer + companion). */
  zoneCapacity: Record<InStoreZone, number>;
  /** Typical share of anonymous visitors whose device was seen before (locals vs. tourists). */
  returningRate: number;
  /** Size of the pool of known anonymous devices returning visitors are drawn from. */
  devicePool: number;
}

export type CustomerTier = "bronze" | "silver" | "gold";

export interface Customer {
  id: string;
  name: string;
  tier: CustomerTier;
  homeStoreId: string;
  memberSince: LocalDate;
}

export interface ZoneStop {
  zone: InStoreZone;
  dwellSec: number;
}

/** One visitor's trip through a store, as reconstructed from zone sensors. */
export interface Visit {
  id: string;
  storeId: string;
  date: LocalDate;
  /** Store-local time the visitor crossed the entrance, "HH:MM:SS". */
  enteredAt: string;
  /** Seconds since midnight — handy for sorting and live cut-offs. */
  enteredSec: number;
  /** Anonymous, stable visitor hash (derived from customer id when registered). */
  visitorId: string;
  customerId: string | null;
  path: ZoneStop[];
  totalDwellSec: number;
  /** Visitor reached the checkout zone (proxy for a purchase). */
  checkout: boolean;
  /** Device seen on an earlier day (new vs. returning visitor). */
  returning: boolean;
}

export interface ZoneAgg {
  visitors: number;
  /** Sum of dwell seconds — divide by visitors for the average. */
  dwellSec: number;
}

/** Aggregated sensor data for one store and one local hour. */
export interface HourAgg {
  hour: number;
  /** Passers-by detected by the street sensor. */
  street: number;
  /** Visitors who walked in. */
  entrants: number;
  /** Entrants identified as registered customers. */
  registered: number;
  /** Entrants whose device was seen on an earlier day. */
  returning: number;
  /** Entrants who visited at least one product zone. */
  browsed: number;
  /** Entrants who reached the checkout. */
  checkouts: number;
  /** Sum of total visit dwell seconds. */
  dwellSec: number;
  zones: Record<InStoreZone, ZoneAgg>;
}

export interface CustomerVisitRef {
  customerId: string;
  enteredSec: number;
  checkout: boolean;
  /** Second of the day the visitor leaves; later than the cut-off while still inside. */
  leftSec: number;
  /** Position of the visit in its day (1-based), i.e. the sequence in its visit id. */
  seq: number;
  /** In-store zones the visit went through, as a bitmask (see `ZONE_BIT`). */
  zones: number;
}

/** Everything the dashboard needs about one store-day, without per-visit detail. */
export interface DaySummary {
  storeId: string;
  date: LocalDate;
  /** Opening hours that day, or null if the store was closed. */
  hours: OpeningHours | null;
  /** Second of the day data is cut off at (today, "live"), or null for a complete day. */
  cutoffSec: number | null;
  byHour: HourAgg[];
  customerVisits: CustomerVisitRef[];
  /**
   * Finished visits grouped by route (see `routeKey`), one map per visitor kind
   * (see `visitorKind`). Flows are derived from these.
   */
  routes: Record<string, RouteAgg>[];
}

/** Finished visits that took the same route. */
export interface RouteAgg {
  visits: number;
  checkouts: number;
  /** Sum of time inside, seconds. */
  dwellSec: number;
}
