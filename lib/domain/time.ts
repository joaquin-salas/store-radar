/**
 * Date/time helpers. All stores are in Spain, so every timestamp in the domain
 * is store-local time (Europe/Madrid). Dates are plain "YYYY-MM-DD" strings and
 * date arithmetic is done in UTC to stay clear of DST edge cases.
 */

export const TIME_ZONE = "Europe/Madrid";

/** A calendar date in store-local time, formatted "YYYY-MM-DD". */
export type LocalDate = string;

export interface LocalDateTime {
  date: LocalDate;
  hour: number;
  minute: number;
  second: number;
}

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Current store-local date and time. */
export function localNow(at: Date = new Date()): LocalDateTime {
  const parts: Record<string, string> = {};
  for (const p of formatter.formatToParts(at)) parts[p.type] = p.value;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isLocalDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: LocalDate, to: LocalDate): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(date: LocalDate): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Inclusive list of dates from `from` to `to`. */
export function eachDay(from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Seconds since local midnight. */
export function secondsOfDay(t: Pick<LocalDateTime, "hour" | "minute" | "second">): number {
  return t.hour * 3600 + t.minute * 60 + t.second;
}

/** Seconds since midnight → "HH:MM:SS". */
export function formatClock(sec: number): string {
  return `${pad2(Math.floor(sec / 3600))}:${pad2(Math.floor((sec % 3600) / 60))}:${pad2(sec % 60)}`;
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
