/**
 * Occupancy maths on simulated visits: who is inside at a given second, and in
 * which zone. A visitor is inside from entry until entry + total dwell; their
 * zone is found by walking their path's dwell times.
 */
import type { RawVisit } from "./generator";
import type { InStoreZone } from "./types";

export interface PresentVisitor {
  visit: RawVisit;
  zone: InStoreZone;
}

/** Everyone inside at second `atSec` and the zone they are in. Visits must be sorted by entry. */
export function whoIsInside(visits: readonly RawVisit[], atSec: number): PresentVisitor[] {
  const out: PresentVisitor[] = [];
  for (const visit of visits) {
    if (visit.enteredSec > atSec) break;
    if (visit.enteredSec + visit.totalDwellSec <= atSec) continue; // already left
    let t = visit.enteredSec;
    for (const stop of visit.path) {
      if (atSec < t + stop.dwellSec) {
        out.push({ visit, zone: stop.zone });
        break;
      }
      t += stop.dwellSec;
    }
  }
  return out;
}

export interface Occupancy {
  inside: number;
  byZone: Record<InStoreZone, number>;
}

export function emptyZoneCounts(): Record<InStoreZone, number> {
  return { entrance: 0, womenswear: 0, menswear: 0, kids: 0, "fitting-rooms": 0, checkout: 0 };
}

/** People inside at second `atSec`, total and per zone. */
export function occupancyAt(visits: readonly RawVisit[], atSec: number): Occupancy {
  const byZone = emptyZoneCounts();
  const present = whoIsInside(visits, atSec);
  for (const p of present) byZone[p.zone]++;
  return { inside: present.length, byZone };
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
