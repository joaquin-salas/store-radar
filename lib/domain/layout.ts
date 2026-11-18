/**
 * Floor plans: building shell, shopfront, zones, fixtures and sensor positions.
 *
 * Units are metres; y grows from the back wall (0) to the shopfront (`depth`),
 * and the street runs along the front. Each store has a hand-made plan spec
 * (lib/domain/plans), normalised here into one `FloorPlan` shape for the UI.
 */
import { STORES } from "./catalog";
import { type Point, type Polygon, inPolygon, polygonArea } from "./geometry";
import { BCN_PDG } from "./plans/bcn-pdg";
import { MAD_GRANVIA } from "./plans/mad-granvia";
import { VLC_COLON } from "./plans/vlc-colon";
import type { InStoreZone } from "./types";

export type SensorType = "street-counter" | "zone-sensor" | "checkout-sensor";

export const SENSOR_LABELS: Record<SensorType, string> = {
  "street-counter": "Street counter",
  "zone-sensor": "Zone sensor",
  "checkout-sensor": "Checkout sensor",
};

export type Fixture =
  | {
      kind: "rack" | "shelf" | "counter" | "till" | "plinth" | "window" | "mirror";
      x: number;
      y: number;
      w: number;
      h: number;
    }
  | { kind: "cubicle"; x: number; y: number; w: number; h: number; open: "left" | "right" | "top" | "bottom" }
  | { kind: "table"; cx: number; cy: number; r: number }
  | { kind: "barrier"; x1: number; y1: number; x2: number; y2: number };

export interface PlanZone {
  zone: InStoreZone;
  polygon: Polygon;
  /** Top-left corner of the zone's label pill. */
  labelAt: Point;
  /** Where flow arrows start and end for this zone. */
  anchor: Point;
  /** Label when the full zone name doesn't fit (e.g. "Fitting"). */
  shortLabel?: string;
}

interface SensorSpec {
  type: SensorType;
  zone: InStoreZone | "street";
  x: number;
  y: number;
  /** Detection radius in metres (drawn as the coverage circle). */
  rangeM: number;
}

export interface Sensor extends SensorSpec {
  id: string;
}

/** What a store's plan declares. */
export interface PlanSpec {
  width: number;
  depth: number;
  outline: Polygon;
  door: { x1: number; x2: number };
  glass: (readonly [Point, Point])[];
  columns: Point[];
  /** Square concrete pillars (default) or round cast-iron columns. */
  columnStyle?: "square" | "round";
  staffAreas: { label: string; polygon: Polygon }[];
  streetLabel: string;
  zones: PlanZone[];
  fixtures: Fixture[];
  sensors: SensorSpec[];
}

/** What the UI renders. */
export interface FloorPlan extends Omit<PlanSpec, "sensors"> {
  storeId: string;
  sensors: Sensor[];
  street: { x: number; y: number; w: number; h: number };
  /** Point outside the door that flows from the street start at. */
  streetAnchor: Point;
  /** SVG viewBox covering the building, street and scale bar. */
  viewBox: { x: number; y: number; w: number; h: number };
}

// --- Normalisation -------------------------------------------------------------

const STREET_GAP = 2.3;
const STREET_DEPTH = 7.4;

function normalise(storeId: string, spec: PlanSpec): FloorPlan {
  const street = { x: -2.5, y: spec.depth + STREET_GAP, w: spec.width + 5, h: STREET_DEPTH };
  return {
    ...spec,
    storeId,
    street,
    streetAnchor: [(spec.door.x1 + spec.door.x2) / 2, street.y + 3.7],
    sensors: spec.sensors.map((s, i) => ({ ...s, id: `${storeId}-S${String(i + 1).padStart(2, "0")}` })),
    viewBox: { x: -3, y: -2, w: spec.width + 6, h: spec.depth + STREET_GAP + STREET_DEPTH + 6 },
  };
}

// Every store has a hand-made plan (lib/domain/plans).
const SPECS: Record<string, PlanSpec> = {
  "mad-granvia": MAD_GRANVIA,
  "bcn-pdg": BCN_PDG,
  "vlc-colon": VLC_COLON,
};

const plans = new Map(
  STORES.map((s) => {
    const spec = SPECS[s.id];
    if (!spec) throw new Error(`No floor plan for store: ${s.id}`);
    return [s.id, normalise(s.id, spec)];
  }),
);

export function getFloorPlan(storeId: string): FloorPlan {
  const plan = plans.get(storeId);
  if (!plan) throw new Error(`Unknown store: ${storeId}`);
  return plan;
}

/** Points that people dots must avoid: inside a fixture (with a small margin) or a column. */
export function isBlocked(plan: FloorPlan, [x, y]: Point, margin = 0.45): boolean {
  for (const f of plan.fixtures) {
    if (f.kind === "cubicle") continue; // people can be inside a cubicle
    if (f.kind === "table") {
      if (Math.hypot(x - f.cx, y - f.cy) < f.r + margin) return true;
    } else if (f.kind === "barrier") {
      if (Math.abs(y - f.y1) < margin && x > f.x1 - margin && x < f.x2 + margin) return true;
    } else if (x > f.x - margin && x < f.x + f.w + margin && y > f.y - margin && y < f.y + f.h + margin) {
      return true;
    }
  }
  return plan.columns.some(([cx, cy]) => Math.hypot(x - cx, y - cy) < 0.9);
}

/** Total public floor area (zones) and staff area, for sanity checks. */
export function planAreas(plan: FloorPlan) {
  return {
    outline: polygonArea(plan.outline),
    zones: plan.zones.reduce((s, z) => s + polygonArea(z.polygon), 0),
    staff: plan.staffAreas.reduce((s, a) => s + polygonArea(a.polygon), 0),
  };
}

export { inPolygon };
