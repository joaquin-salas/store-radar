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

const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
const parts = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return { y, m, day, month: monthFormat.format(new Date(Date.UTC(y, m - 1, 1))) };
};

/**
 * "2026-11-12", "2026-11-18" → "12–18 Nov 2026"; across months → "20 Oct – 18 Nov 2026";
 * a single day → "18 Nov 2026". Built by hand rather than with `formatRange`, whose
 * spacing differs between Node and browsers (hydration mismatches).
 */
export function formatDateRange(from: string, to: string): string {
  const a = parts(from);
  const b = parts(to);
  if (from === to) return `${b.day} ${b.month} ${b.y}`;
  if (a.y === b.y && a.m === b.m) return `${a.day}–${b.day} ${b.month} ${b.y}`;
  if (a.y === b.y) return `${a.day} ${a.month} – ${b.day} ${b.month} ${b.y}`;
  return `${a.day} ${a.month} ${a.y} – ${b.day} ${b.month} ${b.y}`;
}

/** 19 → "19:00". */
export const formatHour = (hour: number | null) =>
  hour === null ? "—" : `${String(hour).padStart(2, "0")}:00`;

/**
 * A relative change for display: "+1.2%", "−0.8%", or "0%" (flat) when it rounds
 * to zero, so a tiny drop never shows as "−0%".
 */
export function formatChange(change: number): { text: string; direction: "up" | "down" | "flat" } {
  const text = formatPercent(Math.abs(change));
  if (text === formatPercent(0)) return { text, direction: "flat" };
  return change > 0 ? { text: `+${text}`, direction: "up" } : { text: `−${text}`, direction: "down" };
}

/** Relative change between two values, or null when there is no baseline. */
export const relativeChange = (current: number, previous: number) =>
  previous > 0 ? (current - previous) / previous : null;

export const safeRatio = (a: number, b: number) => (b > 0 ? a / b : 0);
