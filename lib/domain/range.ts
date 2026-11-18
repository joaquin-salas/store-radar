/**
 * Date ranges: resolving presets to concrete dates and the comparison period.
 * Kept apart from the service so the client can resolve ranges for display
 * without bundling the simulator.
 */
import type { RangeInput } from "./schemas";
import { type LocalDate, type LocalDateTime, addDays, diffDays, localNow } from "./time";

export interface DateRange {
  from: LocalDate;
  to: LocalDate;
}

export function resolveRange(input: RangeInput, now: LocalDateTime = localNow()): DateRange {
  if (input.from && input.to) return { from: input.from, to: input.to };
  switch (input.preset ?? "today") {
    case "today":
      return { from: now.date, to: now.date };
    case "yesterday": {
      const y = addDays(now.date, -1);
      return { from: y, to: y };
    }
    case "7d":
      return { from: addDays(now.date, -6), to: now.date };
    case "30d":
      return { from: addDays(now.date, -29), to: now.date };
  }
}

/** Same-length period immediately before `range`. */
export function previousRange(range: DateRange): DateRange {
  const len = rangeDays(range);
  return { from: addDays(range.from, -len), to: addDays(range.to, -len) };
}

/** Number of days in the range, both ends included. */
export const rangeDays = (range: DateRange) => diffDays(range.from, range.to) + 1;

/** True when the range includes today, i.e. its numbers are still moving. */
export const isLiveRange = (range: DateRange, now: LocalDateTime) =>
  range.to >= now.date && range.from <= now.date;
