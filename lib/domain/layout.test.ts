import { describe, expect, it } from "vitest";
import { STORES, getStore } from "./catalog";
import { simulateDay } from "./generator";
import { inPolygon, polygonArea, rectPolygon } from "./geometry";
import { zoneFlows } from "./flows";
import { getFloorPlan, isBlocked, planAreas } from "./layout";
import { getLiveSnapshot } from "./live";

describe("geometry", () => {
  it("computes polygon area and containment", () => {
    expect(polygonArea(rectPolygon(0, 0, 10, 4))).toBe(40);
    const chamfered = [
      [0, 0],
      [60, 0],
      [60, 34],
      [54, 40],
      [0, 40],
    ] as const;
    expect(polygonArea(chamfered)).toBe(2400 - 18);
    expect(inPolygon([59, 39], chamfered)).toBe(false);
    expect(inPolygon([30, 20], chamfered)).toBe(true);
  });
});

describe.each(STORES.map((s) => s.id))("floor plan %s", (id) => {
  const plan = getFloorPlan(id);
  const store = getStore(id)!;

  it("has exactly the store's zones, tiling the building with the staff areas", () => {
    expect(plan.zones.map((z) => z.zone).sort()).toEqual([...store.zones].sort());
    const { outline, zones, staff } = planAreas(plan);
    expect(zones + staff).toBeCloseTo(outline, 6);
  });

  it("keeps labels, anchors, fixtures and indoor sensors inside the building", () => {
    for (const z of plan.zones) {
      expect(inPolygon([z.labelAt[0] + 0.1, z.labelAt[1] + 0.1], z.polygon)).toBe(true);
      expect(inPolygon(z.anchor, z.polygon)).toBe(true);
    }
    for (const f of plan.fixtures) {
      const p: [number, number] =
        f.kind === "table"
          ? [f.cx, f.cy]
          : f.kind === "barrier"
            ? [f.x1, f.y1]
            : [f.x + f.w / 2, f.y + f.h / 2];
      expect(inPolygon(p, plan.outline)).toBe(true);
    }
    for (const s of plan.sensors) {
      if (s.zone === "street") continue;
      expect(inPolygon([s.x, s.y], plan.outline)).toBe(true);
    }
  });

  it("covers every zone with a sensor and opens the door onto the entrance", () => {
    for (const z of plan.zones) expect(plan.sensors.some((s) => s.zone === z.zone)).toBe(true);
    expect(plan.sensors.some((s) => s.type === "street-counter")).toBe(true);
    expect(new Set(plan.sensors.map((s) => s.id)).size).toBe(plan.sensors.length);
    // Entry is detected by matching the street node with the entrance node, so no
    // indoor sensor sits in the doorway itself.
    for (const s of plan.sensors) {
      if (s.zone === "street") continue;
      const inDoorway = s.x >= plan.door.x1 && s.x <= plan.door.x2 && s.y > plan.depth - 3;
      expect(inDoorway).toBe(false);
    }
    const entrance = plan.zones.find((z) => z.zone === "entrance")!;
    expect(inPolygon([(plan.door.x1 + plan.door.x2) / 2, plan.depth - 0.5], entrance.polygon)).toBe(true);
  });
});

describe("Madrid Gran Vía hand-made plan", () => {
  const plan = getFloorPlan("mad-granvia");

  it("is the 60 × 40 m flagship with a stock room and 10 fitting cubicles", () => {
    expect(plan.handmade).toBe(true);
    expect(plan.staffAreas).toHaveLength(1);
    expect(plan.fixtures.filter((f) => f.kind === "cubicle")).toHaveLength(10);
    // Fitting-room capacity = 2 people per cubicle.
    expect(getStore("mad-granvia")!.zoneCapacity["fitting-rooms"]).toBe(20);
  });

  it("blocks fixtures and columns but not the inside of cubicles", () => {
    expect(isBlocked(plan, [23.5, 16])).toBe(true); // table
    expect(isBlocked(plan, [12, 13])).toBe(true); // column
    expect(isBlocked(plan, [32, 3.5])).toBe(false); // inside a cubicle
    expect(isBlocked(plan, [17.5, 20])).toBe(false); // aisle
  });
});

describe("flows", () => {
  const store = getStore("mad-granvia")!;
  const { visits } = simulateDay(store, "2026-11-18");

  it("counts one street → entrance flow per visitor entering in the window", () => {
    const from = 17 * 3600;
    const to = 18 * 3600;
    const flows = zoneFlows(visits, from, to);
    const entered = visits.filter((v) => v.enteredSec >= from && v.enteredSec < to).length;
    expect(flows.find((f) => f.from === "street" && f.to === "entrance")?.count).toBe(entered);
    expect(flows[0].count).toBeGreaterThanOrEqual(flows.at(-1)!.count);
  });

  it("only follows real path steps", () => {
    const flows = zoneFlows(visits, 10 * 3600, 22 * 3600);
    const legal = new Set<string>(["street>entrance"]);
    for (const v of visits)
      for (let i = 0; i < v.path.length - 1; i++) legal.add(`${v.path[i].zone}>${v.path[i + 1].zone}`);
    for (const f of flows) expect(legal.has(`${f.from}>${f.to}`)).toBe(true);
    expect(flows.some((f) => f.from === "fitting-rooms" && f.to === "checkout")).toBe(true);
  });

  it("are part of the live snapshot", () => {
    const snap = getLiveSnapshot("mad-granvia", { date: "2026-11-18", hour: 18, minute: 0, second: 0 });
    expect(snap.flows.length).toBeGreaterThan(3);
    expect(snap.flows[0].from).toBe("street");
  });
});
