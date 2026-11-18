import { describe, expect, it } from "vitest";
import { STORES, getStore } from "./catalog";
import { simulateDay } from "./generator";
import { getFloorPlan } from "./layout";
import { getLiveSnapshot, occupancyAt, streetBetween } from "./live";
import type { LocalDateTime } from "./time";

const at = (hour: number, minute = 0): LocalDateTime => ({ date: "2026-11-18", hour, minute, second: 0 });

describe("floor plans", () => {
  it.each(STORES.map((s) => s.id))("%s: zones fit the interior without overlapping", (id) => {
    const plan = getFloorPlan(id);
    const store = getStore(id)!;
    const interior = plan.zones.filter((z) => z.zone !== "street");
    expect(interior.map((z) => z.zone).sort()).toEqual([...store.zones].sort());

    let area = 0;
    for (const { rect } of interior) {
      expect(rect.x).toBeGreaterThanOrEqual(plan.interior.x);
      expect(rect.y).toBeGreaterThanOrEqual(plan.interior.y);
      expect(rect.x + rect.w).toBeLessThanOrEqual(plan.interior.x + plan.interior.w);
      expect(rect.y + rect.h).toBeLessThanOrEqual(plan.interior.y + plan.interior.h);
      area += rect.w * rect.h;
    }
    // Tiles exactly cover the interior => no overlaps and no gaps.
    expect(area).toBe(plan.interior.w * plan.interior.h);
  });

  it.each(STORES.map((s) => s.id))(
    "%s: every zone has a sensor and the door opens onto the entrance",
    (id) => {
      const plan = getFloorPlan(id);
      for (const { zone } of plan.zones) {
        expect(plan.sensors.some((s) => s.zone === zone)).toBe(true);
      }
      const entrance = plan.zones.find((z) => z.zone === "entrance")!.rect;
      expect(plan.door.x).toBeGreaterThanOrEqual(entrance.x);
      expect(plan.door.x + plan.door.w).toBeLessThanOrEqual(entrance.x + entrance.w);
      expect(new Set(plan.sensors.map((s) => s.id)).size).toBe(plan.sensors.length);
    },
  );
});

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
    const door = snap.sensors.find((s) => s.type === "door-counter")!;
    expect(door.detections).toBe(snap.recent.entrants);
    expect(snap.sensors.every((s) => s.status === "online" && s.lastSignalSec > 0)).toBe(true);
  });

  it("reports a closed store with nobody inside", () => {
    const snap = getLiveSnapshot("bcn-pdg", { date: "2026-11-15", hour: 13, minute: 0, second: 0 }); // Sunday
    expect(snap.openNow).toBe(false);
    expect(snap.peopleInside).toBe(0);
  });
});
