/**
 * Date range in the page URL: `?preset=7d`, or `?from=YYYY-MM-DD&to=YYYY-MM-DD`
 * for a custom range. The same keys the API takes, validated with the same schema.
 */
import { type DateRange, rangeDays } from "./domain/range";
import { RANGE_PRESETS, type RangeInput, type RangePreset, rangeSchema } from "./domain/schemas";

export const DEFAULT_PRESET: RangePreset = "7d";
export const RANGE_KEYS = ["preset", "from", "to"] as const;

export const PRESET_LABELS: Record<RangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
};

type SearchLike = Pick<URLSearchParams, "get">;

/** Range from search params. Missing or invalid values fall back to `fallback`. */
export function rangeFromSearch(search: SearchLike, fallback: RangePreset = DEFAULT_PRESET): RangeInput {
  const from = search.get("from");
  const to = search.get("to");
  if (from && to) {
    const custom = rangeSchema.safeParse({ from, to });
    if (custom.success) return { from, to };
  }
  const preset = search.get("preset");
  if (preset && (RANGE_PRESETS as readonly string[]).includes(preset))
    return { preset: preset as RangePreset };
  return { preset: fallback };
}

/** Search params for a range (only the keys it uses). */
export function rangeToSearch(range: RangeInput): Record<string, string> {
  if (range.from && range.to) return { from: range.from, to: range.to };
  return { preset: range.preset ?? DEFAULT_PRESET };
}

/**
 * `search` with its range keys replaced by `range`; other keys are kept.
 * Returns a query string with a leading "?" (or "" when empty).
 */
export function withRange(search: URLSearchParams, range: RangeInput): string {
  const next = new URLSearchParams(search);
  for (const key of RANGE_KEYS) next.delete(key);
  for (const [k, v] of Object.entries(rangeToSearch(range))) next.set(k, v);
  const s = next.toString();
  return s ? `?${s}` : "";
}

/** Only the range keys of `search`, as a query string, to carry a range to another view. */
export function rangeQuery(search: SearchLike): string {
  const next = new URLSearchParams();
  for (const key of RANGE_KEYS) {
    const v = search.get(key);
    if (v) next.set(key, v);
  }
  const s = next.toString();
  return s ? `?${s}` : "";
}

/** Short comparison label for KPI cards (they are narrow), e.g. "vs. prior 7 days". */
export function comparisonLabel(range: RangeInput, resolved: DateRange): string {
  if (range.preset === "today" && !range.from) return "vs. yesterday";
  const days = rangeDays(resolved);
  return days === 1 ? "vs. prior day" : `vs. prior ${days} days`;
}
