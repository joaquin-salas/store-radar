import type { InStoreZone, ProductZone, Store, ZoneType } from "./types";

/** Fictional fashion retail chain used for the simulation. */
export const CHAIN = {
  name: "Lumen",
  description: "Fictional fashion retailer with three stores across Spain",
} as const;

export const ZONE_LABELS: Record<ZoneType, string> = {
  street: "Street",
  entrance: "Entrance",
  womenswear: "Womenswear",
  menswear: "Menswear",
  kids: "Kids",
  "fitting-rooms": "Fitting rooms",
  checkout: "Checkout",
};

/** Bit per in-store zone, for compact zone sets (e.g. which zones a visit covered). */
export const ZONE_BIT: Record<InStoreZone, number> = {
  entrance: 1,
  womenswear: 2,
  menswear: 4,
  kids: 8,
  "fitting-rooms": 16,
  checkout: 32,
};

export const PRODUCT_ZONES: readonly ProductZone[] = ["womenswear", "menswear", "kids"];

/**
 * How visitors behave in each zone: probability that an entrant visits it and
 * the typical dwell time (seconds). Fitting rooms and checkout are conditional
 * and handled in the generator.
 */
export const ZONE_BEHAVIOUR: Record<InStoreZone, { visitProb: number; dwellSec: number }> = {
  entrance: { visitProb: 1, dwellSec: 25 },
  womenswear: { visitProb: 0.56, dwellSec: 390 },
  menswear: { visitProb: 0.38, dwellSec: 290 },
  kids: { visitProb: 0.2, dwellSec: 250 },
  "fitting-rooms": { visitProb: 0.34, dwellSec: 420 },
  checkout: { visitProb: 0.27, dwellSec: 160 },
};

const ALL_ZONES: InStoreZone[] = ["entrance", "womenswear", "menswear", "kids", "fitting-rooms", "checkout"];

const NO_KIDS: InStoreZone[] = ALL_ZONES.filter((z) => z !== "kids");

const WEEKDAY = { open: 10, close: 22 };

export const STORES: readonly Store[] = [
  {
    id: "mad-granvia",
    name: "Madrid Gran Vía",
    city: "Madrid",
    sizeM2: 2400,
    zones: ALL_ZONES,
    hours: WEEKDAY,
    sundayHours: { open: 11, close: 21 },
    streetBase: 1650,
    captureBase: 0.105,
    registeredRate: 0.12,
    capacity: 100,
    returningRate: 0.28,
    devicePool: 40_000,
    zoneCapacity: { entrance: 15, womenswear: 40, menswear: 24, kids: 14, "fitting-rooms": 20, checkout: 12 },
  },
  {
    id: "bcn-pdg",
    name: "Barcelona Passeig de Gràcia",
    city: "Barcelona",
    sizeM2: 1600,
    zones: ALL_ZONES,
    hours: { open: 10, close: 21 },
    sundayHours: null,
    streetBase: 1400,
    captureBase: 0.11,
    registeredRate: 0.11,
    capacity: 85,
    returningRate: 0.33,
    devicePool: 30_000,
    zoneCapacity: { entrance: 12, womenswear: 32, menswear: 20, kids: 12, "fitting-rooms": 20, checkout: 10 },
  },
  {
    id: "vlc-colon",
    name: "Valencia Colón",
    city: "Valencia",
    sizeM2: 600,
    zones: NO_KIDS,
    hours: { open: 10, close: 21 },
    sundayHours: null,
    streetBase: 500,
    captureBase: 0.14,
    registeredRate: 0.15,
    capacity: 40,
    returningRate: 0.45,
    devicePool: 8_000,
    zoneCapacity: { entrance: 6, womenswear: 20, menswear: 14, kids: 0, "fitting-rooms": 12, checkout: 8 },
  },
];

export const STORE_IDS = STORES.map((s) => s.id) as [string, ...string[]];

const storesById = new Map(STORES.map((s) => [s.id, s]));

export function getStore(id: string): Store | undefined {
  return storesById.get(id);
}
