/**
 * "Typical day" baselines: what a store normally looks like on this weekday,
 * at this time. Typical = average of the same weekday over the previous
 * TYPICAL_WEEKS weeks. Comparing with a typical Wednesday is fairer than
 * comparing with yesterday (a Tuesday).
 */
import { getStore } from "./catalog";
import { getDaySummary, getSimulatedDay, openingHours } from "./generator";
import { occupancyAt } from "./occupancy";
import { type Kpis, computeKpis, safeDiv } from "./metrics";
import { type LocalDate, type LocalDateTime, addDays, localNow, pad2, secondsOfDay } from "./time";
import type { DaySummary } from "./types";

export const TYPICAL_WEEKS = 4;

/** The same weekday in each of the previous `weeks` weeks, most recent first. */
export function typicalDates(date: LocalDate, weeks = TYPICAL_WEEKS): LocalDate[] {
  return Array.from({ length: weeks }, (_, i) => addDays(date, -7 * (i + 1)));
}

const weekdayFormatter = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" });
export const weekdayName = (date: LocalDate) => weekdayFormatter.format(new Date(`${date}T00:00:00Z`));

/** Summaries of the typical dates, each cut off at the same time of day as `now`. */
function typicalSummaries(storeId: string, now: LocalDateTime, fullDay: boolean): DaySummary[] {
  return typicalDates(now.date).map((date) =>
    fullDay ? getDaySummary(storeId, date, now) : getDaySummary(storeId, date, { ...now, date }),
  );
}

/** Average people inside at `atSec` on the typical dates. */
export function typicalOccupancyAt(storeId: string, date: LocalDate, atSec: number): number {
  const dates = typicalDates(date);
  let sum = 0;
  for (const d of dates) sum += occupancyAt(getSimulatedDay(storeId, d).visits, atSec).inside;
  return sum / dates.length;
}

/** Turns summed KPIs over N days into a per-day average (ratios are already averages). */
function perDay(k: Kpis, days: number): Kpis {
  return {
    ...k,
    streetPassersby: k.streetPassersby / days,
    visitors: k.visitors / days,
    checkouts: k.checkouts / days,
    registeredVisitors: k.registeredVisitors / days,
  };
}

export interface PaceHour {
  hour: number;
  /** Visitors this hour today; null for hours that haven't started. */
  visitors: number | null;
  /** Average visitors in this hour on a typical day. */
  typical: number;
}

/**
 * Today's pace for one store: KPIs so far vs. a typical day at the same time,
 * a forecast for the full day and when it's usually busiest.
 */
export function getPace(storeId: string, now: LocalDateTime = localNow()) {
  const store = getStore(storeId);
  if (!store) throw new Error(`Unknown store: ${storeId}`);
  const weeks = TYPICAL_WEEKS;

  const today = getDaySummary(storeId, now.date, now);
  const typicalSoFar = typicalSummaries(storeId, now, false);
  const typicalFull = typicalSummaries(storeId, now, true);

  const kpis = computeKpis([today]);
  const typicalKpis = perDay(computeKpis(typicalSoFar), weeks);
  const typicalFullDay = perDay(computeKpis(typicalFull), weeks).visitors;

  // Forecast: scale the typical full day by how today compares so far. Early in
  // the day (little data) lean on the typical day instead of extrapolating noise.
  const ratio = typicalKpis.visitors > 0 ? kpis.visitors / typicalKpis.visitors : 1;
  const progress = safeDiv(typicalKpis.visitors, typicalFullDay); // share of a typical day already done
  const weight = Math.min(1, progress * 2);
  const forecast = Math.round(typicalFullDay * (1 + (ratio - 1) * weight));

  const hours = openingHours(store, now.date);
  const hourly: PaceHour[] = [];
  let peak: { hour: number; visitors: number } | null = null;
  if (hours) {
    const nowSec = secondsOfDay(now);
    for (let h = hours.open; h < hours.close; h++) {
      const typical = typicalFull.reduce((s, d) => s + d.byHour[h].entrants, 0) / weeks;
      hourly.push({ hour: h, visitors: h * 3600 <= nowSec ? today.byHour[h].entrants : null, typical });
      if (!peak || typical > peak.visitors) peak = { hour: h, visitors: typical };
    }
  }

  return {
    storeId,
    asOf: now,
    weekday: weekdayName(now.date),
    typicalDates: typicalDates(now.date),
    openToday: hours !== null,
    kpis,
    typicalKpis,
    forecast: {
      visitors: hours ? forecast : 0,
      typicalFullDay: Math.round(typicalFullDay),
      /** 0–1: how much of a typical day's traffic has happened by now. */
      typicalProgress: progress,
    },
    /** Usually-busiest hour today, from the typical profile. */
    usualPeak: peak ? { hour: peak.hour, label: `${pad2(peak.hour)}:00–${pad2(peak.hour + 1)}:00` } : null,
    hourly,
  };
}

export type Pace = ReturnType<typeof getPace>;
