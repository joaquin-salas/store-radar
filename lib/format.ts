const integer = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 1 });

export const formatInt = (n: number) => integer.format(n);
export const formatCompact = (n: number) => compact.format(n);
export const formatPercent = (ratio: number) => percent.format(ratio);

/** 615 → "10m 15s"; 45 → "45s". */
export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

/** 19 → "19:00". */
export const formatHour = (hour: number | null) =>
  hour === null ? "—" : `${String(hour).padStart(2, "0")}:00`;

/** Relative change between two values, or null when there is no baseline. */
export const relativeChange = (current: number, previous: number) =>
  previous > 0 ? (current - previous) / previous : null;
