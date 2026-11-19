import { describe, expect, it } from "vitest";
import { STORES } from "./catalog";
import { crossStore, flowKpis, journey, mergeRoutes, topRoutes, zoneMatrix } from "./flow-stats";
import { getFlows } from "./service";
import type { LocalDateTime } from "./time";
import type { DaySummary, RouteAgg } from "./types";

const NOW: LocalDateTime = { date: "2026-11-18", hour: 16, minute: 30, second: 0 };

function summary(routes: Record<string, RouteAgg>[], customerVisits: DaySummary["customerVisits"] = []) {
  return {
    storeId: "mad-granvia",
    date: "2026-11-10",
    hours: { open: 10, close: 21 },
    cutoffSec: null,
    byHour: [],
    customerVisits,
    routes,
  } satisfies DaySummary;
}

// Anonymous new, anonymous returning, member new, member returning.
const sample = summary([
  {
    "": { visits: 20, checkouts: 0, dwellSec: 20 * 60 },
    womenswear: { visits: 40, checkouts: 8, dwellSec: 40 * 400 },
  },
  {
    "womenswear>fitting-rooms>womenswear": { visits: 10, checkouts: 7, dwellSec: 10 * 1200 },
  },
  {},
  {
    "menswear>womenswear": { visits: 5, checkouts: 1, dwellSec: 5 * 700 },
    womenswear: { visits: 5, checkouts: 2, dwellSec: 5 * 400 },
  },
]);

describe("mergeRoutes", () => {
  it("merges the kinds a segment covers", () => {
    const all = mergeRoutes([sample], "all");
    expect(all.reduce((s, r) => s + r.visits, 0)).toBe(80);
    expect(all[0]).toMatchObject({ key: "womenswear", visits: 45, checkouts: 10 });
    expect(all.find((r) => r.key === "")!.zones).toEqual([]);
    expect(mergeRoutes([sample], "members").reduce((s, r) => s + r.visits, 0)).toBe(10);
    expect(mergeRoutes([sample], "returning").reduce((s, r) => s + r.visits, 0)).toBe(20);
    expect(mergeRoutes([sample], "new").reduce((s, r) => s + r.visits, 0)).toBe(60);
  });
});

describe("flowKpis", () => {
  it("derives the route KPIs", () => {
    const k = flowKpis(mergeRoutes([sample], "all"));
    expect(k.visits).toBe(80);
    expect(k.browsedShare).toBeCloseTo(60 / 80);
    expect(k.avgStops).toBeCloseTo((45 * 1 + 10 * 3 + 5 * 2) / 80);
    expect(k.wentBackShare).toBeCloseTo(10 / 80);
    expect(k.triedThenBoughtRate).toBeCloseTo(7 / 10);
    expect(k.leftWithoutBuyingShare).toBeCloseTo((80 - 18) / 80);
  });

  it("is all zeros without visits", () => {
    expect(flowKpis([])).toEqual({
      visits: 0,
      browsedShare: 0,
      avgStops: 0,
      wentBackShare: 0,
      triedThenBoughtRate: 0,
      leftWithoutBuyingShare: 0,
    });
  });
});

describe("journey", () => {
  const { nodes, links } = journey(mergeRoutes([sample], "all"));
  const at = (id: string) => nodes.findIndex((n) => n.id === id);
  const inflow = (i: number) => links.filter((l) => l.target === i).reduce((s, l) => s + l.value, 0);
  const outflow = (i: number) => links.filter((l) => l.source === i).reduce((s, l) => s + l.value, 0);

  it("conserves visits through every node", () => {
    expect(outflow(at("start"))).toBe(80);
    expect(nodes[at("start")].value).toBe(80);
    expect(inflow(at("checkout")) + inflow(at("left"))).toBe(80);
    for (const [i, n] of nodes.entries()) {
      if (n.kind === "zone" || n.kind === "more") expect(inflow(i)).toBe(outflow(i));
    }
  });

  it("splits zones by stop number so going back stays acyclic", () => {
    expect(at("1:womenswear")).toBeGreaterThan(-1);
    expect(at("more")).toBeGreaterThan(-1);
    for (const l of links) expect(nodes[l.target].step).toBeGreaterThan(nodes[l.source].step);
    // Leaving from the entrance links straight to the outcome.
    const direct = links.find((l) => l.source === at("start") && l.target === at("left"));
    expect(direct?.value).toBe(20);
  });

  it("orders each column in walking order, checkout above leaving", () => {
    expect(nodes.map((n) => n.id)).toEqual([
      "start",
      "1:womenswear",
      "1:menswear",
      "2:womenswear",
      "2:fitting-rooms",
      "more",
      "checkout",
      "left",
    ]);
  });

  it("drops an outcome nobody reached", () => {
    const none = journey(
      mergeRoutes([summary([{ kids: { visits: 3, checkouts: 0, dwellSec: 600 } }, {}, {}, {}])], "all"),
    );
    expect(none.nodes.map((n) => n.id)).toEqual(["start", "1:kids", "left"]);
    for (const l of none.links) expect(none.nodes[l.source]).toBeDefined();
  });
});

describe("zoneMatrix", () => {
  it("counts every move, entering and leaving included", () => {
    const zones = ["entrance", "womenswear", "menswear", "fitting-rooms", "checkout"] as const;
    const m = zoneMatrix(mergeRoutes([sample], "all"), zones);
    const i = (e: string) => m.ends.indexOf(e as (typeof m.ends)[number]);
    expect(m.ends).toEqual(["entrance", "womenswear", "menswear", "fitting-rooms", "checkout", "left"]);
    expect(m.counts[i("entrance")][i("left")]).toBe(20);
    expect(m.counts[i("womenswear")][i("fitting-rooms")]).toBe(10);
    expect(m.counts[i("fitting-rooms")][i("womenswear")]).toBe(10);
    expect(m.counts[i("menswear")][i("womenswear")]).toBe(5);
    // Everyone enters once and leaves once.
    const row = (r: number) => m.counts[r].reduce((a, b) => a + b, 0);
    expect(row(i("entrance"))).toBe(80);
    expect(m.counts.reduce((s, r) => s + r[i("left")], 0)).toBe(80);
    expect(m.counts[i("checkout")][i("left")]).toBe(18);
  });
});

describe("topRoutes", () => {
  it("ranks routes with share, checkout rate and time", () => {
    const { routes, coveredShare } = topRoutes(mergeRoutes([sample], "all"), 2);
    expect(routes.map((r) => r.key)).toEqual(["womenswear", ""]);
    expect(routes[0].share).toBeCloseTo(45 / 80);
    expect(routes[0].checkoutRate).toBeCloseTo(10 / 45);
    expect(routes[0].avgDwellSec).toBeCloseTo(400);
    expect(coveredShare).toBeCloseTo(65 / 80);
  });
});

describe("crossStore", () => {
  it("counts member visits by home store and store visited", () => {
    const ref = (customerId: string) => ({
      customerId,
      enteredSec: 0,
      checkout: false,
      leftSec: 0,
      seq: 1,
      zones: 1,
    });
    const cs = crossStore([summary([{}, {}, {}, {}], [ref("C00001"), ref("C00002"), ref("C00003")])]);
    const total = cs.visits.flat().reduce((a, b) => a + b, 0);
    expect(total).toBe(3);
    expect(cs.stores).toHaveLength(STORES.length);
    const visited = cs.stores.findIndex((s) => s.id === "mad-granvia");
    expect(cs.visits.reduce((s, row) => s + row[visited], 0)).toBe(3);
  });
});

describe("getFlows", () => {
  it("covers the finished visits of the range, consistently", () => {
    const f = getFlows({ store: "mad-granvia", range: { preset: "7d" }, segment: "all" }, NOW);
    expect(f.kpis.visits).toBeGreaterThan(5000);
    expect(f.journey.nodes[0].value).toBe(f.kpis.visits);
    expect(f.matrix.counts[0].reduce((a, b) => a + b, 0)).toBe(f.kpis.visits);
    expect(f.crossStore).toBeNull();
    // Realistic shape: most browse, some go back, checkout after trying on is common.
    expect(f.kpis.browsedShare).toBeGreaterThan(0.6);
    expect(f.kpis.wentBackShare).toBeGreaterThan(0.08);
    expect(f.kpis.triedThenBoughtRate).toBeGreaterThan(0.5);
    expect(f.top.routes[0].visits).toBeGreaterThanOrEqual(f.top.routes[1].visits);
  });

  it("compares with the previous period and adds cross-store for the chain", () => {
    const f = getFlows({ store: "all", range: { preset: "7d" }, segment: "members" }, NOW);
    expect(f.previous.visits).toBeGreaterThan(0);
    expect(f.crossStore).not.toBeNull();
    expect(f.crossStore!.awayShare).toBeGreaterThan(0.03);
    expect(f.crossStore!.awayShare).toBeLessThan(0.3);
    expect(f.zones).toContain("kids");
  });

  it("leaves out zones the store doesn't have", () => {
    const f = getFlows({ store: "vlc-colon", range: { preset: "7d" }, segment: "all" }, NOW);
    expect(f.zones).not.toContain("kids");
    expect(f.journey.nodes.some((n) => n.zone === "kids")).toBe(false);
  });
});
