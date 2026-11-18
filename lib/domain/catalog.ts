import type { InStoreZone, ProductZone, Store, ZoneType } from "./types";

/** Fictional fashion retail chain used for the simulation. */
export const CHAIN = {
  name: "Lumen",
  description: "Fictional fashion retailer with six stores across Spain",
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
  },
  {
    id: "mad-serrano",
    name: "Madrid Serrano",
    city: "Madrid",
    sizeM2: 1300,
    zones: ALL_ZONES,
    hours: WEEKDAY,
    sundayHours: { open: 12, close: 20 },
    streetBase: 820,
    captureBase: 0.13,
    registeredRate: 0.17,
  },
  {
    id: "bcn-pdg",
    name: "Barcelona Passeig de Gràcia",
    city: "Barcelona",
    sizeM2: 2000,
    zones: ALL_ZONES,
    hours: { open: 10, close: 21 },
    sundayHours: null,
    streetBase: 1400,
    captureBase: 0.11,
    registeredRate: 0.11,
  },
  {
    id: "vlc-colon",
    name: "Valencia Colón",
    city: "Valencia",
    sizeM2: 1100,
    zones: NO_KIDS,
    hours: { open: 10, close: 21 },
    sundayHours: null,
    streetBase: 700,
    captureBase: 0.14,
    registeredRate: 0.15,
  },
  {
    id: "svq-sierpes",
    name: "Sevilla Sierpes",
    city: "Sevilla",
    sizeM2: 900,
    zones: NO_KIDS,
    hours: { open: 10, close: 21 },
    sundayHours: null,
    streetBase: 620,
    captureBase: 0.15,
    registeredRate: 0.14,
  },
  {
    id: "bio-ercilla",
    name: "Bilbao Ercilla",
    city: "Bilbao",
    sizeM2: 1000,
    zones: ALL_ZONES,
    hours: { open: 10, close: 21 },
    sundayHours: null,
    streetBase: 560,
    captureBase: 0.135,
    registeredRate: 0.19,
  },
];

export const STORE_IDS = STORES.map((s) => s.id) as [string, ...string[]];

const storesById = new Map(STORES.map((s) => [s.id, s]));

export function getStore(id: string): Store | undefined {
  return storesById.get(id);
}
