/**
 * Live view of a store: who is inside right now, per zone, plus what each
 * sensor detected recently. Derived from the same simulated visits as every
 * other metric, so the live view and the KPIs agree.
 */
import { ZONE_LABELS, getStore } from "./catalog";
import { type RawVisit, getDaySummary, openingHours, simulateDay } from "./generator";
import { type Sensor, type SensorType, getFloorPlan } from "./layout";
import { zoneStats } from "./metrics";
import { createRng } from "./random";
import { type LocalDateTime, localNow, secondsOfDay } from "./time";
import type { InStoreZone } from "./types";

/** Window for "recent" sensor detections. */
export const RECENT_WINDOW_SEC = 15 * 60;

export interface Occupancy {
  inside: number;
  byZone: Record<InStoreZone, number>;
}

/** People inside at second `atSec`, and the zone each one is in. */
export function occupancyAt(visits: readonly RawVisit[], atSec: number): Occupancy {
  const byZone: Record<InStoreZone, number> = {
    entrance: 0,
    womenswear: 0,
    menswear: 0,
    kids: 0,
    "fitting-rooms": 0,
    checkout: 0,
  };
  let inside = 0;
  for (const v of visits) {
    if (v.enteredSec > atSec) break; // sorted by entry time
    if (v.enteredSec + v.totalDwellSec <= atSec) continue; // already left
    inside++;
    let t = v.enteredSec;
    for (const stop of v.path) {
      if (atSec < t + stop.dwellSec) {
        byZone[stop.zone]++;
        break;
      }
      t += stop.dwellSec;
    }
  }
  return { inside, byZone };
}

/** Street passers-by between two seconds of the day, assuming uniform flow within each hour. */
export function streetBetween(street: readonly number[], fromSec: number, toSec: number): number {
  let total = 0;
  for (let hour = 0; hour < 24; hour++) {
    const start = hour * 3600;
    const overlap = Math.min(toSec, start + 3600) - Math.max(fromSec, start);
    if (overlap > 0) total += (street[hour] * overlap) / 3600;
  }
  return Math.round(total);
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
  visitorsToday: number;
  avgDwellSec: number;
}

export function getLiveSnapshot(storeId: string, now: LocalDateTime = localNow()) {
  const store = getStore(storeId);
  if (!store) throw new Error(`Unknown store: ${storeId}`);
  const plan = getFloorPlan(storeId);
  const nowSec = secondsOfDay(now);
  const hours = openingHours(store, now.date);
  const openNow = hours !== null && now.hour >= hours.open && now.hour < hours.close;

  const { street, visits } = simulateDay(store, now.date);
  const occupancy = occupancyAt(visits, nowSec);

  // Zone entries in the recent window (a visit "enters" a zone when its path reaches it).
  const windowStart = nowSec - RECENT_WINDOW_SEC;
  const recentZoneEntries: Record<InStoreZone, number> = { ...occupancy.byZone };
  for (const z of Object.keys(recentZoneEntries) as InStoreZone[]) recentZoneEntries[z] = 0;
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

  const today = getDaySummary(storeId, now.date, now);
  const stats = zoneStats([today], store.zones);

  const zones: LiveZone[] = store.zones.map((zone) => {
    const s = stats.find((x) => x.zone === zone)!;
    return {
      zone,
      label: ZONE_LABELS[zone],
      occupancy: occupancy.byZone[zone],
      visitorsToday: s.visitors,
      avgDwellSec: s.avgDwellSec,
    };
  });

  // Split a zone's detections across its sensors so the numbers add up.
  const sensorsPerZone = new Map<string, number>();
  for (const s of plan.sensors) {
    if (s.type === "zone-sensor" || s.type === "checkout-sensor") {
      sensorsPerZone.set(s.zone, (sensorsPerZone.get(s.zone) ?? 0) + 1);
    }
  }
  const zoneSensorIndex = new Map<string, number>();
  const minuteSeed = `${now.date}|${now.hour}|${now.minute}`;

  const detectionsFor = (s: Sensor): number => {
    const byType: Record<SensorType, () => number> = {
      "street-counter": () => recentStreet,
      "door-counter": () => recentEntrants,
      "zone-sensor": () => share(s),
      "checkout-sensor": () => share(s),
    };
    return byType[s.type]();
  };
  const share = (s: Sensor) => {
    const total = recentZoneEntries[s.zone as InStoreZone] ?? 0;
    const n = sensorsPerZone.get(s.zone) ?? 1;
    const i = zoneSensorIndex.get(s.zone) ?? 0;
    zoneSensorIndex.set(s.zone, i + 1);
    return Math.floor(total / n) + (i < total % n ? 1 : 0);
  };

  const sensors: SensorReading[] = plan.sensors.map((s) => ({
    ...s,
    status: "online",
    lastSignalSec: createRng(`${s.id}|${minuteSeed}`).int(1, openNow ? 12 : 55),
    detections: detectionsFor(s),
  }));

  return {
    storeId,
    asOf: now,
    openNow,
    hoursToday: hours,
    peopleInside: occupancy.inside,
    recent: { windowSec: RECENT_WINDOW_SEC, entrants: recentEntrants, street: recentStreet },
    zones,
    sensors,
  };
}

export type LiveSnapshot = ReturnType<typeof getLiveSnapshot>;
