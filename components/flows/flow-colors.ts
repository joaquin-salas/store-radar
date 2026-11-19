import { ZONE_LABELS } from "@/lib/domain/catalog";
import type { MatrixEnd } from "@/lib/domain/flow-stats";
import type { InStoreZone } from "@/lib/domain/types";

/**
 * Zone identity colours, fixed per zone so a filter never repaints them:
 * the product zones take the first categorical slots in order, fitting rooms
 * the fourth; checkout and everything else stay neutral (identity comes from
 * the label, never from good/bad colouring).
 */
const ZONE_COLOR: Partial<Record<InStoreZone, string>> = {
  womenswear: "var(--zone-womenswear)",
  menswear: "var(--zone-menswear)",
  kids: "var(--zone-kids)",
  "fitting-rooms": "var(--zone-fitting-rooms)",
};

export const NEUTRAL = "var(--chart-other)";

export const zoneColor = (zone: InStoreZone | null) => (zone ? (ZONE_COLOR[zone] ?? NEUTRAL) : NEUTRAL);

export const END_LABELS: Record<MatrixEnd, string> = { ...ZONE_LABELS, left: "Left the store" };

/** Store identity colours for the cross-store chart, in catalogue order. */
export const STORE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];
