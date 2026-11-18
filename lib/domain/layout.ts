/**
 * Floor plans: where each zone sits and where the sensors are mounted.
 *
 * Coordinates are abstract plan units (0–100 wide). The store interior spans
 * y = 0…58 and the street strip runs along the bottom. Three templates cover the
 * chain; some stores use a mirrored copy so they don't all look identical.
 */
import { STORES, getStore } from "./catalog";
import type { InStoreZone, ZoneType } from "./types";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type SensorType = "street-counter" | "door-counter" | "zone-sensor" | "checkout-sensor";

export interface Sensor {
  id: string;
  type: SensorType;
  zone: ZoneType;
  x: number;
  y: number;
}

export interface ZoneShape {
  zone: ZoneType;
  rect: Rect;
}

export interface FloorPlan {
  storeId: string;
  width: number;
  height: number;
  /** Interior bounds (walls). */
  interior: Rect;
  /** Door gap on the street-facing wall. */
  door: { x: number; w: number };
  zones: ZoneShape[];
  sensors: Sensor[];
}

export const SENSOR_LABELS: Record<SensorType, string> = {
  "street-counter": "Street counter",
  "door-counter": "Door counter",
  "zone-sensor": "Zone sensor",
  "checkout-sensor": "Checkout sensor",
};

const WIDTH = 100;
const HEIGHT = 74;
const INTERIOR: Rect = { x: 0, y: 0, w: 100, h: 58 };
const STREET: Rect = { x: 0, y: 62, w: 100, h: 12 };

type Template = { zones: Partial<Record<InStoreZone, Rect>>; door: { x: number; w: number } };

/** Flagship-size store with every zone. */
const LARGE: Template = {
  zones: {
    womenswear: { x: 0, y: 0, w: 40, h: 28 },
    menswear: { x: 40, y: 0, w: 32, h: 28 },
    kids: { x: 72, y: 0, w: 28, h: 28 },
    "fitting-rooms": { x: 0, y: 28, w: 22, h: 30 },
    entrance: { x: 22, y: 28, w: 40, h: 30 },
    checkout: { x: 62, y: 28, w: 38, h: 30 },
  },
  door: { x: 34, w: 16 },
};

/** Mid-size store with every zone; checkout next to the door. */
const MEDIUM: Template = {
  zones: {
    womenswear: { x: 0, y: 0, w: 46, h: 30 },
    menswear: { x: 46, y: 0, w: 30, h: 30 },
    kids: { x: 76, y: 0, w: 24, h: 30 },
    checkout: { x: 0, y: 30, w: 30, h: 28 },
    entrance: { x: 30, y: 30, w: 44, h: 28 },
    "fitting-rooms": { x: 74, y: 30, w: 26, h: 28 },
  },
  door: { x: 44, w: 16 },
};

/** Compact store without a kids zone. */
const COMPACT: Template = {
  zones: {
    womenswear: { x: 0, y: 0, w: 56, h: 30 },
    menswear: { x: 56, y: 0, w: 44, h: 30 },
    "fitting-rooms": { x: 0, y: 30, w: 24, h: 28 },
    entrance: { x: 24, y: 30, w: 40, h: 28 },
    checkout: { x: 64, y: 30, w: 36, h: 28 },
  },
  door: { x: 36, w: 16 },
};

const STORE_TEMPLATES: Record<string, { template: Template; mirror: boolean }> = {
  "mad-granvia": { template: LARGE, mirror: false },
  "mad-serrano": { template: MEDIUM, mirror: false },
  "bcn-pdg": { template: LARGE, mirror: true },
  "vlc-colon": { template: COMPACT, mirror: false },
  "svq-sierpes": { template: COMPACT, mirror: true },
  "bio-ercilla": { template: MEDIUM, mirror: true },
};

const mirrorRect = (r: Rect): Rect => ({ ...r, x: WIDTH - r.x - r.w });

const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

function buildPlan(storeId: string): FloorPlan {
  const store = getStore(storeId);
  const config = STORE_TEMPLATES[storeId];
  if (!store || !config) throw new Error(`No floor plan for store: ${storeId}`);

  const { template, mirror } = config;
  const zones: ZoneShape[] = [{ zone: "street", rect: STREET }];
  for (const zone of store.zones) {
    const rect = template.zones[zone];
    if (!rect) throw new Error(`Template for ${storeId} lacks zone ${zone}`);
    zones.push({ zone, rect: mirror ? mirrorRect(rect) : rect });
  }
  const door = mirror ? { x: WIDTH - template.door.x - template.door.w, w: template.door.w } : template.door;

  // Sensors: street counter outside the door, door counter on the threshold,
  // one sensor per zone (two in large zones), placed off-centre so labels fit.
  const sensors: Omit<Sensor, "id">[] = [
    { type: "street-counter", zone: "street", x: door.x + door.w / 2, y: STREET.y + 4 },
    { type: "door-counter", zone: "entrance", x: door.x + door.w / 2, y: INTERIOR.h - 3 },
  ];
  for (const { zone, rect } of zones) {
    if (zone === "street") continue;
    const c = center(rect);
    if (zone === "entrance") {
      sensors.push({ type: "zone-sensor", zone, x: c.x, y: rect.y + 6 });
    } else if (zone === "checkout") {
      sensors.push({ type: "checkout-sensor", zone, x: c.x, y: rect.y + 6 });
    } else if (rect.w * rect.h > 1000) {
      sensors.push({ type: "zone-sensor", zone, x: rect.x + rect.w * 0.3, y: rect.y + 6 });
      sensors.push({ type: "zone-sensor", zone, x: rect.x + rect.w * 0.7, y: rect.y + 6 });
    } else {
      sensors.push({ type: "zone-sensor", zone, x: c.x, y: rect.y + 6 });
    }
  }

  return {
    storeId,
    width: WIDTH,
    height: HEIGHT,
    interior: INTERIOR,
    door,
    zones,
    sensors: sensors.map((s, i) => ({ ...s, id: `${storeId}-S${String(i + 1).padStart(2, "0")}` })),
  };
}

const plans = new Map(STORES.map((s) => [s.id, buildPlan(s.id)]));

export function getFloorPlan(storeId: string): FloorPlan {
  const plan = plans.get(storeId);
  if (!plan) throw new Error(`Unknown store: ${storeId}`);
  return plan;
}
