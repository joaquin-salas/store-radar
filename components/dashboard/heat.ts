import type { CSSProperties } from "react";

/** Sequential single-hue scale: step 0 for zero, then five steps up to `max`. */
export function heatStep(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(5, 1 + Math.floor((value / max) * 5));
}

/** Background (and readable ink on the dark steps) for a heat cell. */
export function heatStyle(value: number, max: number): CSSProperties {
  const step = heatStep(value, max);
  return { background: `var(--heat-${step})`, color: step >= 4 ? "var(--heat-ink-high)" : undefined };
}
