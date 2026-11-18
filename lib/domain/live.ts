/**
 * Live view of a store: who is inside right now and where, how full the store
 * and each zone are, alerts, registered customers present, and the last 90
 * minutes against a typical day. Derived from the same simulated visits as every
 * other metric, so the live view and the KPIs agree.
 */
import { ZONE_LABELS, getStore } from "./catalog";
import { getCustomer } from "./customers";
import { getDaySummary, getSimulatedDay, openingHours } from "./generator";
import { type Sensor, type SensorType, getFloorPlan } from "./layout";
import { zoneStats } from "./metrics";
import { emptyZoneCounts, streetBetween, whoIsInside } from "./occupancy";
import { zoneFlows } from "./flows";
import { createRng } from "./random";
import { type LocalDateTime, localNow, pad2, secondsOfDay } from "./time";
import { typicalOccupancyAt, weekdayName } from "./typical";
import type { CustomerTier, InStoreZone } from "./types";

export { occupancyAt, streetBetween } from "./occupancy";

/** Window for "recent" sensor detections and walk-ins. */
export const RECENT_WINDOW_SEC = 15 * 60;
/** Occupancy (share of capacity) that raises a warning / critical alert. */
export const ALERT_THRESHOLDS = { warning: 0.85, critical: 1 } as const;
/** Window for flow arrows on the floor plan. */
export const FLOW_WINDOW_SEC = 60 * 60;
/** Sparkline window and resolution. */
export const SERIES_WINDOW_SEC = 90 * 60;
export const SERIES_STEP_SEC = 5 * 60;

export type AlertLevel = "warning" | "critical";

export interface LiveAlert {
  id: string;
  level: AlertLevel;
  title: string;
  detail: string;
}

export interface SensorReading extends Sensor {
  status: "online";
  /** Seconds since the sensor last reported. */
  lastSignalSec: number;
  /** Detections in the last 15 minutes. */
  detections: number;
}

export interface LiveZone {
  zone: InStoreZone;
  label: string;
  /** People in the zone right now. */
  occupancy: number;
  capacity: number;
  /** occupancy / capacity (can exceed 1). */
  fill: number;
  visitorsToday: number;
  avgDwellSec: number;
}

export interface RegisteredInside {
  customerId: string;
  name: string;
  tier: CustomerTier;
  zone: InStoreZone;
  zoneLabel: string;
  /** Minutes since they walked in. */
  minutesInside: number;
}

export interface SeriesPoint {
  time: string;
  sec: number;
  inside: number;
  typical: number;
}

function alertLevel(fill: number): AlertLevel | null {
  if (fill >= ALERT_THRESHOLDS.critical) return "critical";
  if (fill >= ALERT_THRESHOLDS.warning) return "warning";
  return null;
}

const TIER_RANK: Record<CustomerTier, number> = { gold: 0, silver: 1, bronze: 2 };

export function getLiveSnapshot(storeId: string, now: LocalDateTime = localNow()) {
  const store = getStore(storeId);
  if (!store) throw new Error(`Unknown store: ${storeId}`);
  const plan = getFloorPlan(storeId);
  const nowSec = secondsOfDay(now);
  const hours = openingHours(store, now.date);
  const openNow = hours !== null && now.hour >= hours.open && now.hour < hours.close;

  const { street, visits } = getSimulatedDay(storeId, now.date);
  const present = whoIsInside(visits, nowSec);
  const byZone = emptyZoneCounts();
  for (const p of present) byZone[p.zone]++;
  const peopleInside = present.length;
  const returningInside = present.filter((p) => p.visit.returning).length;

  // --- Recent activity (last 15 min) -----------------------------------------
  const windowStart = nowSec - RECENT_WINDOW_SEC;
  const recentZoneEntries = emptyZoneCounts();
  let recentEntrants = 0;
  for (const v of visits) {
    if (v.enteredSec > nowSec) break;
    if (v.enteredSec + v.totalDwellSec < windowStart) continue;
    if (v.enteredSec >= windowStart) recentEntrants++;
    let t = v.enteredSec;
    for (const stop of v.path) {
      if (t > nowSec) break;
      if (t >= windowStart) recentZoneEntries[stop.zone]++;
      t += stop.dwellSec;
    }
  }
  const recentStreet = streetBetween(street, Math.max(0, windowStart), nowSec);

  // --- Zones & capacity --------------------------------------------------------
  const stats = zoneStats([getDaySummary(storeId, now.date, now)], store.zones);
  const zones: LiveZone[] = store.zones.map((zone) => {
    const s = stats.find((x) => x.zone === zone)!;
    const capacity = store.zoneCapacity[zone];
    return {
      zone,
      label: ZONE_LABELS[zone],
      occupancy: byZone[zone],
      capacity,
      fill: capacity > 0 ? byZone[zone] / capacity : 0,
      visitorsToday: s.visitors,
      avgDwellSec: s.avgDwellSec,
    };
  });
  const storeFill = peopleInside / store.capacity;

  // --- Alerts (status + text; never colour alone in the UI) --------------------
  const alerts: LiveAlert[] = [];
  const storeLevel = alertLevel(storeFill);
  if (storeLevel) {
    alerts.push({
      id: "store",
      level: storeLevel,
      title: storeLevel === "critical" ? "Store at capacity" : "Store nearly full",
      detail: `${peopleInside} of ${store.capacity} people (${Math.round(storeFill * 100)}%)`,
    });
  }
  for (const z of zones) {
    const level = alertLevel(z.fill);
    if (!level) continue;
    const full = z.zone === "fitting-rooms" ? "All cubicles in use" : `${z.label} at capacity`;
    alerts.push({
      id: z.zone,
      level,
      title: level === "critical" ? full : `${z.label} nearly full`,
      detail: `${z.occupancy} of ${z.capacity} (${Math.round(z.fill * 100)}%)`,
    });
  }
  alerts.sort((a, b) => (a.level === b.level ? 0 : a.level === "critical" ? -1 : 1));

  // --- Registered customers inside ---------------------------------------------
  const registered: RegisteredInside[] = [];
  for (const p of present) {
    if (!p.visit.customerId) continue;
    const c = getCustomer(p.visit.customerId);
    if (!c) continue;
    registered.push({
      customerId: c.id,
      name: c.name,
      tier: c.tier,
      zone: p.zone,
      zoneLabel: ZONE_LABELS[p.zone],
      minutesInside: Math.floor((nowSec - p.visit.enteredSec) / 60),
    });
  }
  registered.sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || b.minutesInside - a.minutesInside);

  // --- Last 90 minutes vs. typical ---------------------------------------------
  const series: SeriesPoint[] = [];
  if (hours) {
    const start = Math.max(hours.open * 3600, nowSec - SERIES_WINDOW_SEC);
    const end = Math.min(nowSec, hours.close * 3600 + 30 * 60); // a little after close as people leave
    // Align to the step grid so points don't jitter between refreshes; end on "now".
    const first = Math.ceil(start / SERIES_STEP_SEC) * SERIES_STEP_SEC;
    const times: number[] = [];
    for (let t = first; t < end; t += SERIES_STEP_SEC) times.push(t);
    if (end > start) times.push(end);
    for (const t of times) {
      series.push({
        time: `${pad2(Math.floor(t / 3600))}:${pad2(Math.floor((t % 3600) / 60))}`,
        sec: t,
        inside: whoIsInside(visits, t).length,
        typical: Math.round(typicalOccupancyAt(storeId, now.date, t) * 10) / 10,
      });
    }
  }
  const typicalInsideNow = typicalOccupancyAt(storeId, now.date, nowSec);

  // --- Sensors -----------------------------------------------------------------
  const sensorsPerZone = new Map<string, number>();
  for (const s of plan.sensors) {
    if (s.type === "zone-sensor" || s.type === "checkout-sensor") {
      sensorsPerZone.set(s.zone, (sensorsPerZone.get(s.zone) ?? 0) + 1);
    }
  }
  const zoneSensorIndex = new Map<string, number>();
  const share = (s: Sensor) => {
    // Split a zone's detections across its sensors so the numbers add up.
    const total = recentZoneEntries[s.zone as InStoreZone] ?? 0;
    const n = sensorsPerZone.get(s.zone) ?? 1;
    const i = zoneSensorIndex.get(s.zone) ?? 0;
    zoneSensorIndex.set(s.zone, i + 1);
    return Math.floor(total / n) + (i < total % n ? 1 : 0);
  };
  const detectionsFor: Record<SensorType, (s: Sensor) => number> = {
    "street-counter": () => recentStreet,
    "zone-sensor": share,
    "checkout-sensor": share,
  };
  const minuteSeed = `${now.date}|${now.hour}|${now.minute}`;
  const sensors: SensorReading[] = plan.sensors.map((s) => ({
    ...s,
    status: "online",
    lastSignalSec: createRng(`${s.id}|${minuteSeed}`).int(1, openNow ? 12 : 55),
    detections: detectionsFor[s.type](s),
  }));

  return {
    storeId,
    asOf: now,
    weekday: weekdayName(now.date),
    openNow,
    hoursToday: hours,
    peopleInside,
    /** Of the people inside, how many are returning visitors (device seen on an earlier day). */
    returningInside,
    capacity: store.capacity,
    fill: storeFill,
    typicalInsideNow: Math.round(typicalInsideNow),
    recent: { windowSec: RECENT_WINDOW_SEC, entrants: recentEntrants, street: recentStreet },
    zones,
    alerts,
    registered,
    /** Zone-to-zone movements in the last hour, largest first. */
    flows: zoneFlows(visits, Math.max(0, nowSec - FLOW_WINDOW_SEC), nowSec + 1),
    series,
    sensors,
  };
}

export type LiveSnapshot = ReturnType<typeof getLiveSnapshot>;
