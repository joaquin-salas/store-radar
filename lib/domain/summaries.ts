/** Loading daily summaries for a store scope and date range. */
import { STORES } from "./catalog";
import { getDaySummary } from "./generator";
import type { DateRange } from "./range";
import { type LocalDateTime, eachDay } from "./time";
import type { DaySummary } from "./types";

export type StoreScope = "all" | (string & {});

export function storeIds(scope: StoreScope): string[] {
  return scope === "all" ? STORES.map((s) => s.id) : [scope];
}

/** Summaries for every store-day in range, up to today (today cut off at `now`). */
export function loadSummaries(scope: StoreScope, range: DateRange, now: LocalDateTime): DaySummary[] {
  const ids = storeIds(scope);
  const to = range.to < now.date ? range.to : now.date;
  const out: DaySummary[] = [];
  for (const date of eachDay(range.from, to)) {
    for (const id of ids) out.push(getDaySummary(id, date, now));
  }
  return out;
}
