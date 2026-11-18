/**
 * Distributions over individual visits: how long visits last and how long
 * people stay in each zone. Pure functions over visits "as known now" (see
 * `visitAsOf` in the service), so in-progress visits never count unfinished time.
 */
import { ZONE_LABELS } from "./catalog";
import type { InStoreZone, Visit } from "./types";

/**
 * Visit-length buckets, in minutes: [from, to), all the same width so bar
 * heights compare fairly. The last one (30+) is open-ended.
 */
export const BUCKET_MIN = 2;
export const OPEN_BUCKET_MIN = 30;
export const DURATION_BUCKETS: readonly number[] = Array.from(
  { length: OPEN_BUCKET_MIN / BUCKET_MIN + 1 },
  (_, i) => i * BUCKET_MIN,
);

export interface DurationBucket {
  /** Lower bound in minutes (inclusive). */
  fromMin: number;
  /** Upper bound in minutes (exclusive), or null for the last, open bucket. */
  toMin: number | null;
  label: string;
  visits: number;
  share: number;
}

/** Linear-interpolated quantile of an ascending list; 0 for an empty list. */
export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const bucketLabel = (from: number, to: number | null) => (to === null ? `${from}+ min` : `${from}–${to} min`);

export function durationHistogram(durationsSec: readonly number[]): DurationBucket[] {
  const counts = DURATION_BUCKETS.map(() => 0);
  for (const sec of durationsSec) {
    const min = sec / 60;
    let i = DURATION_BUCKETS.length - 1;
    while (i > 0 && min < DURATION_BUCKETS[i]) i--;
    counts[i]++;
  }
  const total = durationsSec.length;
  return DURATION_BUCKETS.map((fromMin, i) => {
    const toMin = DURATION_BUCKETS[i + 1] ?? null;
    return {
      fromMin,
      toMin,
      label: bucketLabel(fromMin, toMin),
      visits: counts[i],
      share: total ? counts[i] / total : 0,
    };
  });
}

export interface ZoneDwell {
  zone: InStoreZone;
  label: string;
  /** Completed stops in this zone. */
  stops: number;
  /** Share of visits that stopped here. */
  visitShare: number;
  medianSec: number;
  p25Sec: number;
  p75Sec: number;
}

/**
 * Time spent per zone over completed stops. `ongoing` marks visits whose last
 * stop hasn't ended yet (still inside); that stop is left out.
 */
export function zoneDwell(
  visits: readonly Pick<Visit, "path">[],
  zones: readonly InStoreZone[],
  ongoing: (index: number) => boolean = () => false,
): ZoneDwell[] {
  const byZone = new Map<InStoreZone, number[]>(zones.map((z) => [z, []]));
  const visitedBy = new Map<InStoreZone, number>(zones.map((z) => [z, 0]));
  visits.forEach((v, i) => {
    const seen = new Set<InStoreZone>();
    const last = ongoing(i) ? v.path.length - 1 : v.path.length;
    v.path.forEach((stop, j) => {
      seen.add(stop.zone);
      if (j < last) byZone.get(stop.zone)?.push(stop.dwellSec);
    });
    for (const z of seen) if (visitedBy.has(z)) visitedBy.set(z, visitedBy.get(z)! + 1);
  });
  return zones.map((zone) => {
    const d = byZone.get(zone)!.sort((a, b) => a - b);
    return {
      zone,
      label: ZONE_LABELS[zone],
      stops: d.length,
      visitShare: visits.length ? visitedBy.get(zone)! / visits.length : 0,
      medianSec: quantile(d, 0.5),
      p25Sec: quantile(d, 0.25),
      p75Sec: quantile(d, 0.75),
    };
  });
}
