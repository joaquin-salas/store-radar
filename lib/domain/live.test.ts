import { describe, expect, it } from "vitest";
import { getStore } from "./catalog";
import { simulateDay } from "./generator";
import { getLiveSnapshot, occupancyAt, streetBetween } from "./live";
import type { LocalDateTime } from "./time";

const at = (hour: number, minute = 0): LocalDateTime => ({ date: "2026-11-18", hour, minute, second: 0 });

describe("occupancy", () => {
  const store = getStore("mad-granvia")!;
  const { visits, street } = simulateDay(store, "2026-11-18");

  it("counts everyone inside exactly once across zones", () => {
    const occ = occupancyAt(visits, 17 * 3600);
    const zoneSum = Object.values(occ.byZone).reduce((a, b) => a + b, 0);
    expect(occ.inside).toBeGreaterThan(10);
    expect(zoneSum).toBe(occ.inside);
  });

  it("is empty before opening and long after closing", () => {
    expect(occupancyAt(visits, 9 * 3600).inside).toBe(0);
    expect(occupancyAt(visits, 23 * 3600 + 59 * 60).inside).toBe(0);
  });

  it("integrates street counts across hours", () => {
    expect(streetBetween(street, 0, 86_400)).toBe(street.reduce((a, b) => a + b, 0));
    expect(streetBetween(street, 10 * 3600, 10 * 3600 + 1800)).toBe(Math.round(street[10] / 2));
  });
});

describe("live snapshot", () => {
  it("matches occupancy and splits zone detections across sensors", () => {
    const snap = getLiveSnapshot("mad-granvia", at(18, 15));
    expect(snap.openNow).toBe(true);
    expect(snap.zones.reduce((s, z) => s + z.occupancy, 0)).toBe(snap.peopleInside);
    const street = snap.sensors.find((s) => s.type === "street-counter")!;
    expect(street.detections).toBe(snap.recent.street);
    expect(snap.sensors.every((s) => s.status === "online" && s.lastSignalSec > 0)).toBe(true);
  });

  it("reports a closed store with nobody inside", () => {
    const snap = getLiveSnapshot("bcn-pdg", { date: "2026-11-15", hour: 13, minute: 0, second: 0 }); // Sunday
    expect(snap.openNow).toBe(false);
    expect(snap.peopleInside).toBe(0);
  });
});
