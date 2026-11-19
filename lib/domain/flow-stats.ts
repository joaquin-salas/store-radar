/**
 * Flows over a date range: how visitors move through the store, derived from
 * the finished-visit routes stored in daily summaries (`DaySummary.routes`).
 * A route is the zones between the entrance and the end of the visit; whether
 * it ended at checkout is counted alongside.
 */
import { STORES, ZONE_LABELS } from "./catalog";
import { getCustomer } from "./customers";
import { ROUTE_SEPARATOR } from "./generator";
import { safeDiv } from "./metrics";
import type { FlowSegment } from "./schemas";
import type { DaySummary, InStoreZone, RouteAgg } from "./types";

/** Visitor kinds (see `visitorKind`) each segment covers. */
const SEGMENT_KINDS: Record<FlowSegment, number[]> = {
  all: [0, 1, 2, 3],
  new: [0, 2],
  returning: [1, 3],
  members: [2, 3],
};

export interface Route extends RouteAgg {
  key: string;
  /** Zones between the entrance and checkout or leaving; empty when they left from the entrance. */
  zones: InStoreZone[];
}

/** Routes of the given segment across days, merged. */
export function mergeRoutes(days: readonly DaySummary[], segment: FlowSegment): Route[] {
  const merged = new Map<string, Route>();
  for (const day of days) {
    for (const kind of SEGMENT_KINDS[segment]) {
      for (const [key, r] of Object.entries(day.routes[kind])) {
        let m = merged.get(key);
        if (!m) {
          m = {
            key,
            zones: key ? (key.split(ROUTE_SEPARATOR) as InStoreZone[]) : [],
            visits: 0,
            checkouts: 0,
            dwellSec: 0,
          };
          merged.set(key, m);
        }
        m.visits += r.visits;
        m.checkouts += r.checkouts;
        m.dwellSec += r.dwellSec;
      }
    }
  }
  return [...merged.values()].sort((a, b) => b.visits - a.visits || a.key.localeCompare(b.key));
}

const PRODUCT: ReadonlySet<InStoreZone> = new Set(["womenswear", "menswear", "kids"]);
const wentBack = (zones: readonly InStoreZone[]) => new Set(zones).size < zones.length;

export interface FlowKpis {
  /** Finished visits. */
  visits: number;
  /** Share that visited at least one product zone. */
  browsedShare: number;
  /** Average zones visited between the entrance and checkout or leaving (revisits included). */
  avgStops: number;
  /** Share that went back to a zone already seen. */
  wentBackShare: number;
  /** Of those who used the fitting rooms, the share that reached checkout. */
  triedThenBoughtRate: number;
  /** Share that left without reaching checkout. */
  leftWithoutBuyingShare: number;
}

export function flowKpis(routes: readonly Route[]): FlowKpis {
  let visits = 0;
  let browsed = 0;
  let stops = 0;
  let back = 0;
  let tried = 0;
  let triedBought = 0;
  let checkouts = 0;
  for (const r of routes) {
    visits += r.visits;
    checkouts += r.checkouts;
    stops += r.zones.length * r.visits;
    if (r.zones.some((z) => PRODUCT.has(z))) browsed += r.visits;
    if (wentBack(r.zones)) back += r.visits;
    if (r.zones.includes("fitting-rooms")) {
      tried += r.visits;
      triedBought += r.checkouts;
    }
  }
  return {
    visits,
    browsedShare: safeDiv(browsed, visits),
    avgStops: safeDiv(stops, visits),
    wentBackShare: safeDiv(back, visits),
    triedThenBoughtRate: safeDiv(triedBought, tried),
    leftWithoutBuyingShare: safeDiv(visits - checkouts, visits),
  };
}

/** Stops shown one by one in the journey; later ones are grouped. */
export const JOURNEY_STEPS = 2;

export type JourneyNodeKind = "start" | "zone" | "more" | "checkout" | "left";

export interface JourneyNode {
  id: string;
  label: string;
  kind: JourneyNodeKind;
  /** Column: 0 = walked in, 1..JOURNEY_STEPS = nth stop, then more stops, then the outcome. */
  step: number;
  zone: InStoreZone | null;
  /** Visits passing through this node. */
  value: number;
}

export interface JourneyLink {
  /** Indexes into `nodes`. */
  source: number;
  target: number;
  value: number;
}

/**
 * The journey as a left-to-right flow: walked in → 1st stop → 2nd stop →
 * more stops → checkout or left without buying. Splitting zones by stop number
 * keeps the graph acyclic even though people go back to zones.
 */
export function journey(routes: readonly Route[]): { nodes: JourneyNode[]; links: JourneyLink[] } {
  const nodes: JourneyNode[] = [];
  const index = new Map<string, number>();
  const links = new Map<string, JourneyLink>();
  const outcomeStep = JOURNEY_STEPS + 2;

  const node = (id: string, make: () => Omit<JourneyNode, "id" | "value">) => {
    let i = index.get(id);
    if (i === undefined) {
      i = nodes.push({ id, value: 0, ...make() }) - 1;
      index.set(id, i);
    }
    return i;
  };
  const link = (source: number, target: number, value: number) => {
    const key = `${source}>${target}`;
    const l = links.get(key);
    if (l) l.value += value;
    else links.set(key, { source, target, value });
  };

  const start = node("start", () => ({ label: "Walked in", kind: "start", step: 0, zone: null }));
  // Outcome nodes first so they keep a stable order (checkout above).
  const checkout = node("checkout", () => ({
    label: "Checkout",
    kind: "checkout",
    step: outcomeStep,
    zone: "checkout",
  }));
  const left = node("left", () => ({
    label: "Left without buying",
    kind: "left",
    step: outcomeStep,
    zone: null,
  }));

  for (const r of routes) {
    const add = (i: number, n: number) => (nodes[i].value += n);
    add(start, r.visits);
    let prev = start;
    r.zones.slice(0, JOURNEY_STEPS).forEach((zone, k) => {
      const i = node(`${k + 1}:${zone}`, () => ({
        label: ZONE_LABELS[zone],
        kind: "zone",
        step: k + 1,
        zone,
      }));
      link(prev, i, r.visits);
      add(i, r.visits);
      prev = i;
    });
    if (r.zones.length > JOURNEY_STEPS) {
      const more = node("more", () => ({
        label: `${JOURNEY_STEPS + 1}+ stops`,
        kind: "more",
        step: JOURNEY_STEPS + 1,
        zone: null,
      }));
      link(prev, more, r.visits);
      add(more, r.visits);
      prev = more;
    }
    if (r.checkouts) link(prev, checkout, r.checkouts);
    if (r.visits - r.checkouts) link(prev, left, r.visits - r.checkouts);
    add(checkout, r.checkouts);
    add(left, r.visits - r.checkouts);
  }

  // Drop empty outcome nodes (e.g. a segment with no checkouts) and order each
  // column the same way every time (zones in walking order, checkout above
  // leaving), so the chart doesn't reshuffle between ranges; links are reindexed.
  const order = nodes
    .map((n, i) => ({ n, i }))
    .filter(({ n }) => n.value > 0)
    .sort((a, b) => a.n.step - b.n.step || rank(a.n) - rank(b.n));
  const remap = new Map(order.map(({ i }, j) => [i, j]));
  const kept = order.map(({ n }) => n);
  return {
    nodes: kept,
    links: [...links.values()]
      .filter((l) => l.value > 0)
      .map((l) => ({ ...l, source: remap.get(l.source)!, target: remap.get(l.target)! })),
  };
}

const NODE_RANK: InStoreZone[] = ["womenswear", "menswear", "kids", "fitting-rooms", "checkout"];
const rank = (n: JourneyNode) => (n.kind === "left" ? 99 : n.zone ? NODE_RANK.indexOf(n.zone) : 50);

export type MatrixEnd = InStoreZone | "left";

export interface ZoneMatrix {
  /** Row and column labels, in order: entrance, the zones, then leaving the store. */
  ends: MatrixEnd[];
  /** `counts[i][j]`: moves from `ends[i]` to `ends[j]`. */
  counts: number[][];
}

/**
 * Moves between zones: entrance → first zone, each zone to the next, and the
 * last zone (checkout included) to leaving the store.
 */
export function zoneMatrix(routes: readonly Route[], zones: readonly InStoreZone[]): ZoneMatrix {
  const inner = zones.filter((z) => z !== "entrance");
  const ends: MatrixEnd[] = ["entrance", ...inner, "left"];
  const at = new Map(ends.map((e, i) => [e, i]));
  const counts = ends.map(() => ends.map(() => 0));
  for (const r of routes) {
    const walked: MatrixEnd[] = ["entrance", ...r.zones];
    const finishedAtCheckout = r.checkouts;
    const leftDirectly = r.visits - r.checkouts;
    for (let i = 0; i < walked.length - 1; i++)
      counts[at.get(walked[i])!][at.get(walked[i + 1])!] += r.visits;
    const last = at.get(walked.at(-1)!)!;
    if (finishedAtCheckout) {
      counts[last][at.get("checkout")!] += finishedAtCheckout;
      counts[at.get("checkout")!][at.get("left")!] += finishedAtCheckout;
    }
    if (leftDirectly) counts[last][at.get("left")!] += leftDirectly;
  }
  return { ends, counts };
}

export interface TopRoute {
  key: string;
  zones: InStoreZone[];
  visits: number;
  /** Share of all finished visits in the segment. */
  share: number;
  checkoutRate: number;
  avgDwellSec: number;
}

export function topRoutes(
  routes: readonly Route[],
  limit = 10,
): { routes: TopRoute[]; coveredShare: number } {
  const total = routes.reduce((s, r) => s + r.visits, 0);
  const top = routes.slice(0, limit).map((r) => ({
    key: r.key,
    zones: r.zones,
    visits: r.visits,
    share: safeDiv(r.visits, total),
    checkoutRate: safeDiv(r.checkouts, r.visits),
    avgDwellSec: safeDiv(r.dwellSec, r.visits),
  }));
  return { routes: top, coveredShare: top.reduce((s, r) => s + r.share, 0) };
}

export interface CrossStore {
  stores: { id: string; name: string }[];
  /** `visits[i][j]`: visits by members of store i to store j. */
  visits: number[][];
  /** Share of member visits made away from the home store. */
  awayShare: number;
}

/** Member visits by home store × store visited. */
export function crossStore(days: readonly DaySummary[]): CrossStore {
  const at = new Map(STORES.map((s, i) => [s.id, i]));
  const visits = STORES.map(() => STORES.map(() => 0));
  let total = 0;
  let away = 0;
  for (const day of days) {
    const to = at.get(day.storeId)!;
    for (const ref of day.customerVisits) {
      const home = getCustomer(ref.customerId)?.homeStoreId;
      if (!home) continue;
      const from = at.get(home)!;
      visits[from][to]++;
      total++;
      if (from !== to) away++;
    }
  }
  return {
    stores: STORES.map((s) => ({ id: s.id, name: s.name })),
    visits,
    awayShare: safeDiv(away, total),
  };
}
