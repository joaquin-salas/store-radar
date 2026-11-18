/**
 * Flows: how many people moved from one zone to the next in a time window,
 * counted from visit paths. A visit contributes street → first zone when it
 * enters, then one transition each time its path moves to the next zone.
 */
import type { RawVisit } from "./generator";
import type { InStoreZone } from "./types";

export type FlowEnd = InStoreZone | "street";

export interface ZoneFlow {
  from: FlowEnd;
  to: InStoreZone;
  count: number;
}

/** Transitions that happened in [fromSec, toSec), largest first. Visits must be sorted by entry. */
export function zoneFlows(visits: readonly RawVisit[], fromSec: number, toSec: number): ZoneFlow[] {
  const counts = new Map<string, ZoneFlow>();
  const add = (from: FlowEnd, to: InStoreZone) => {
    const key = `${from}>${to}`;
    const f = counts.get(key);
    if (f) f.count++;
    else counts.set(key, { from, to, count: 1 });
  };

  for (const v of visits) {
    if (v.enteredSec >= toSec) break;
    if (v.enteredSec + v.totalDwellSec < fromSec) continue;
    let t = v.enteredSec;
    if (t >= fromSec) add("street", v.path[0].zone);
    for (let i = 0; i < v.path.length - 1; i++) {
      t += v.path[i].dwellSec;
      if (t >= toSec) break;
      if (t >= fromSec) add(v.path[i].zone, v.path[i + 1].zone);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}
