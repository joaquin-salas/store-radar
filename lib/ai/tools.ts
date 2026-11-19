/**
 * The assistant's tools: thin wrappers over `lib/domain/service.ts`, with the
 * same Zod inputs as the API routes. They only trim and reshape results so the
 * model gets fewer tokens; every number is computed by the domain.
 */
import { type InferUITools, tool } from "ai";
import { z } from "zod";
import { ZONE_LABELS } from "@/lib/domain/catalog";
import { getLiveSnapshot } from "@/lib/domain/live";
import {
  checkMetricsQuery,
  customerIdSchema,
  customersQuerySchema,
  flowsQuerySchema,
  memberOverviewQuerySchema,
  metricsQueryFields,
  scopedRangeSchema,
  storeIdSchema,
  visitStatsQuerySchema,
  visitsQuerySchema,
} from "@/lib/domain/schemas";
import {
  getCustomerProfile,
  getCustomersPage,
  getFlows,
  getFunnel,
  getMemberOverview,
  getMetrics,
  getOverview,
  getVisitStats,
  getVisitsPage,
} from "@/lib/domain/service";
import { getPace } from "@/lib/domain/typical";
import { displaySchema } from "./display";

const zoneLabel = (z: string) => ZONE_LABELS[z as keyof typeof ZONE_LABELS] ?? z;

export const tools = {
  queryMetrics: tool({
    description:
      "Main tool for numbers, charts and tables. Any KPI for any store and date range, optionally broken down " +
      "by store, date, weekday, hour or zone and filtered by weekday, hour or zone. The result is shown to " +
      "the user as a chart or table (pick it in `display`), so don't repeat the rows in your answer.",
    inputSchema: metricsQueryFields.extend({ display: displaySchema }).superRefine(checkMetricsQuery),
    execute: async ({ display, ...query }) => ({ display, ...getMetrics(query) }),
  }),

  getKpis: tool({
    description:
      "Headline KPIs for a store (or all) and date range, each next to the previous period of the same " +
      "length. Shown to the user as KPI tiles. Use for 'how did we do', 'compare with last week' questions.",
    inputSchema: scopedRangeSchema,
    execute: async (q) => {
      const o = getOverview(q);
      return {
        store: o.store,
        range: o.range,
        previousRange: o.previousRange,
        kpis: o.kpis,
        previous: o.previous,
      };
    },
  }),

  getLiveStatus: tool({
    description:
      "One store right now: people inside vs. capacity and a typical day, zone occupancy, alerts, loyalty " +
      "members inside, and today's pace vs. a typical day with a full-day forecast.",
    inputSchema: z.object({ store: storeIdSchema }),
    execute: async ({ store }) => {
      const live = getLiveSnapshot(store);
      const pace = getPace(store);
      return {
        store,
        asOf: live.asOf,
        openNow: live.openNow,
        hoursToday: live.hoursToday,
        peopleInside: live.peopleInside,
        capacity: live.capacity,
        fill: live.fill,
        typicalInsideNow: live.typicalInsideNow,
        returningInside: live.returningInside,
        last15Min: live.recent,
        zones: live.zones.map((z) => ({
          zone: z.label,
          inside: z.occupancy,
          capacity: z.capacity,
          fill: z.fill,
        })),
        alerts: live.alerts.map((a) => ({ level: a.level, title: a.title, detail: a.detail })),
        membersInside: live.registered.length,
        members: live.registered.slice(0, 10).map((m) => ({
          id: m.customerId,
          name: m.name,
          tier: m.tier,
          zone: m.zoneLabel,
          minutesInside: m.minutesInside,
        })),
        pace: {
          visitorsSoFar: pace.kpis.visitors,
          typicalSoFar: Math.round(pace.typicalKpis.visitors),
          forecastVisitors: pace.forecast.visitors,
          typicalFullDay: pace.forecast.typicalFullDay,
          usualPeak: pace.usualPeak?.label ?? null,
        },
      };
    },
  }),

  getFunnel: tool({
    description:
      "Conversion funnel for a store (or all) and range: passed by → walked in → browsed a product zone → " +
      "used fitting rooms → reached checkout. Checkout isn't nested in fitting rooms.",
    inputSchema: scopedRangeSchema,
    execute: async (q) => getFunnel(q),
  }),

  getFlows: tool({
    description:
      "How visitors move through the store(s) in a range: route KPIs vs. the previous period, the most " +
      "common routes, zone-to-zone moves (where people go next) and, for all stores, members shopping " +
      "away from their home store.",
    inputSchema: flowsQuerySchema,
    execute: async (q) => {
      const f = getFlows(q);
      const ends = f.matrix.ends.map((e) => (e === "left" ? "Left the store" : zoneLabel(e)));
      return {
        store: f.store,
        range: f.range,
        segment: f.segment,
        kpis: f.kpis,
        previous: f.previous,
        topRoutes: f.top.routes.map((r) => ({ ...r, zones: r.zones.map(zoneLabel) })),
        /** Share of all visits the listed routes cover. */
        topRoutesCover: f.top.coveredShare,
        /** moves[from][to] = number of moves. */
        moves: Object.fromEntries(
          ends.map((from, i) => [
            from,
            Object.fromEntries(ends.map((to, j) => [to, f.matrix.counts[i][j]]).filter(([, n]) => n)),
          ]),
        ),
        crossStore: f.crossStore,
      };
    },
  }),

  findVisits: tool({
    description:
      "List individual visits for one store and day, filtered by segment and sorted (e.g. longest visits " +
      "today). Shown to the user as a table.",
    inputSchema: visitsQuerySchema,
    execute: async (q) => {
      const p = getVisitsPage({ ...q, pageSize: Math.min(q.pageSize, 25) });
      return {
        store: p.store,
        date: p.date,
        total: p.total,
        rows: p.rows.map((v) => ({
          id: v.id,
          enteredAt: v.enteredAt,
          minutesInside: Math.round(v.totalDwellSec / 60),
          zones: v.path.map((s) => zoneLabel(s.zone)),
          checkout: v.checkout,
          returning: v.returning,
          member: v.customerName,
          tier: v.customerTier,
          inside: v.inside,
        })),
      };
    },
  }),

  getVisitStats: tool({
    description:
      "How long visits last for one store and day: median and p90 time in store, a duration histogram and " +
      "average time per zone, for a segment (e.g. returning visitors).",
    inputSchema: visitStatsQuerySchema,
    execute: async (q) => getVisitStats(q),
  }),

  findMembers: tool({
    description:
      "Search and rank loyalty members: by name/id, home store, tier and activity segment (active ≤ 14 days " +
      "since last visit, lapsing ≤ 60, lapsed) or days since the last visit (inactiveDays). Visits and checkouts " +
      "cover the last 30 days. Shown as a list.",
    inputSchema: customersQuerySchema,
    execute: async (q) => {
      const p = getCustomersPage({ ...q, pageSize: Math.min(q.pageSize, 25) });
      return {
        total: p.total,
        rows: p.rows.map((c) => ({
          id: c.id,
          name: c.name,
          tier: c.tier,
          homeStore: c.homeStoreName,
          visits30d: c.visits,
          checkouts30d: c.checkouts,
          lastVisit: c.lastVisit,
          segment: c.segment,
          storesVisited: c.storesVisited,
        })),
      };
    },
  }),

  getMemberProfile: tool({
    description: "One loyalty member: visits, checkout rate, stores and zones they visit, and recent visits.",
    inputSchema: z.object({ customerId: customerIdSchema }),
    execute: async ({ customerId }) => {
      const p = getCustomerProfile(customerId);
      if (!p) return { error: `No member with id ${customerId}` };
      const { calendar, recentVisits, ...rest } = p;
      void calendar; // day-by-day calendar is for the profile page
      return { ...rest, recentVisits: recentVisits.slice(0, 5) };
    },
  }),

  getMemberProgramme: tool({
    description:
      "Loyalty programme KPIs for members of a home store (or all) over the last 30 days vs. the 30 before: " +
      "active members, visits per member, member vs. non-member checkout rate, new members, segments.",
    inputSchema: memberOverviewQuerySchema,
    execute: async (q) => getMemberOverview(q),
  }),
};

export type AssistantTools = InferUITools<typeof tools>;
