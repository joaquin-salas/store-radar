import { openingHours } from "./generator";
import type { LocalDateTime } from "./time";
import type { OpeningHours, Store } from "./types";

export interface StoreStatus {
  openNow: boolean;
  /** Today's opening hours, or null if closed all day. */
  today: OpeningHours | null;
}

export function getDayStatus(store: Store, now: LocalDateTime): StoreStatus {
  const today = openingHours(store, now.date);
  return {
    openNow: today !== null && now.hour >= today.open && now.hour < today.close,
    today,
  };
}
