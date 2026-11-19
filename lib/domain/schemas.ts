/**
 * Zod schemas for query inputs. Shared by the API route handlers and the AI
 * assistant tools, so both accept exactly the same parameters.
 */
import { z } from "zod";
import { STORE_IDS } from "./catalog";
import { diffDays } from "./time";

export const RANGE_PRESETS = ["today", "yesterday", "7d", "30d"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

/** Longest custom range accepted, to bound computation. */
export const MAX_RANGE_DAYS = 92;

export const storeIdSchema = z.enum(STORE_IDS).describe("Store id");
export const storeScopeSchema = z
  .enum(["all", ...STORE_IDS])
  .describe('Store id, or "all" for the whole chain');

export const localDateSchema = z.iso.date().describe("Store-local date, YYYY-MM-DD");

export const rangeSchema = z
  .object({
    preset: z
      .enum(RANGE_PRESETS)
      .optional()
      .describe('Relative range. "7d" and "30d" include today. Ignored if from/to are set.'),
    from: localDateSchema.optional().describe("Start date (inclusive)"),
    to: localDateSchema.optional().describe("End date (inclusive)"),
  })
  .refine((r) => (r.from === undefined) === (r.to === undefined), {
    message: "Provide both from and to, or neither",
  })
  .refine((r) => !r.from || !r.to || r.from <= r.to, { message: "from must be before to" })
  .refine((r) => !r.from || !r.to || diffDays(r.from, r.to) < MAX_RANGE_DAYS, {
    message: `Range can't exceed ${MAX_RANGE_DAYS} days`,
  });

export type RangeInput = z.infer<typeof rangeSchema>;

export const scopedRangeSchema = z.object({
  store: storeScopeSchema.default("all"),
  range: rangeSchema.default({}),
});

export const VISIT_SORT_FIELDS = ["enteredAt", "totalDwellSec", "stops"] as const;
export const VISIT_SEGMENTS = ["all", "registered", "anonymous", "new", "returning", "checkout"] as const;

/** Visit ids look like `mad-granvia-20261118-00042` (store, date, sequence). */
export const VISIT_ID_PATTERN = /^([a-z]+(?:-[a-z]+)*)-(\d{4})(\d{2})(\d{2})-(\d{5})$/;
export const visitIdSchema = z
  .string()
  .regex(VISIT_ID_PATTERN)
  .describe("Visit id, e.g. mad-granvia-20261118-00042");

export const visitsQuerySchema = z.object({
  store: storeIdSchema,
  date: localDateSchema.optional().describe("Defaults to today"),
  segment: z.enum(VISIT_SEGMENTS).default("all"),
  sort: z.enum(VISIT_SORT_FIELDS).default("enteredAt"),
  dir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type VisitsQuery = z.infer<typeof visitsQuerySchema>;

export const visitStatsQuerySchema = visitsQuerySchema.pick({ store: true, date: true, segment: true });

export type VisitStatsQuery = z.infer<typeof visitStatsQuerySchema>;

/** How far back member activity is read (last visit, profile calendar). */
export const MEMBER_LOOKBACK_DAYS = 90;

export const CUSTOMER_SORT_FIELDS = ["name", "visits", "checkouts", "lastVisit", "memberSince"] as const;

/** Member segments by days since the last visit: active ≤ 14, lapsing ≤ 60, lapsed beyond (or never). */
export const CUSTOMER_SEGMENTS = ["active", "lapsing", "lapsed"] as const;
export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number];

export const SEGMENT_LABELS: Record<CustomerSegment, string> = {
  active: "Active",
  lapsing: "Lapsing",
  lapsed: "Lapsed",
};

/** Days since the last visit that still count as active, and as lapsing. */
export const SEGMENT_DAYS = { active: 14, lapsing: 60 } as const;

export const customerIdSchema = z
  .string()
  .regex(/^C\d{5}$/)
  .describe("Loyalty member id, e.g. C00042");

export const memberOverviewQuerySchema = z.object({
  store: storeScopeSchema.default("all").describe("Members of this home store, or all"),
});

export type MemberOverviewQuery = z.infer<typeof memberOverviewQuerySchema>;

export const customersQuerySchema = z.object({
  q: z.string().trim().max(80).optional().describe("Search by name or customer id"),
  store: storeScopeSchema.default("all").describe("Filter by home store"),
  tier: z.enum(["all", "bronze", "silver", "gold"]).default("all"),
  segment: z.enum(["all", ...CUSTOMER_SEGMENTS]).default("all"),
  inactiveDays: z.coerce
    .number()
    .int()
    .min(1)
    .max(MEMBER_LOOKBACK_DAYS)
    .optional()
    .describe(
      `Only members whose last visit was at least this many days ago (or none in the last ${MEMBER_LOOKBACK_DAYS} days)`,
    ),
  sort: z.enum(CUSTOMER_SORT_FIELDS).default("visits"),
  dir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CustomersQuery = z.infer<typeof customersQuerySchema>;

/** Visitor segments for flows: everyone, first-time, returning, or loyalty members. */
export const FLOW_SEGMENTS = ["all", "new", "returning", "members"] as const;
export type FlowSegment = (typeof FLOW_SEGMENTS)[number];

export const flowsQuerySchema = scopedRangeSchema.extend({
  segment: z.enum(FLOW_SEGMENTS).default("all").describe("Which visitors to include"),
});

export type FlowsQuery = z.infer<typeof flowsQuerySchema>;

// --- Ad-hoc metric queries (assistant charts and tables) ---------------------

/** What a metric query can be broken down by. */
export const QUERY_DIMENSIONS = ["store", "date", "weekday", "hour", "zone"] as const;
export type QueryDimension = (typeof QUERY_DIMENSIONS)[number];

/** Store-level metrics: one value per store-hour, summed or averaged per group. */
export const STORE_METRICS = [
  "streetPassersby",
  "visitors",
  "captureRate",
  "avgDwellSec",
  "checkouts",
  "checkoutRate",
  "browseRate",
  "registeredVisitors",
  "registeredShare",
  "returningVisitors",
  "returningShare",
] as const;

/** Zone-level metrics: need "zone" in groupBy. */
export const ZONE_METRICS = ["zoneVisitors", "zoneVisitRate", "zoneAvgDwellSec"] as const;

export const QUERY_METRICS = [...STORE_METRICS, ...ZONE_METRICS] as const;
export type QueryMetric = (typeof QUERY_METRICS)[number];

export const IN_STORE_ZONES = [
  "entrance",
  "womenswear",
  "menswear",
  "kids",
  "fitting-rooms",
  "checkout",
] as const;

/** Weekdays Monday first. */
export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Most rows a metric query returns; narrow the query or set a limit for more detail. */
export const MAX_QUERY_ROWS = 200;

const isZoneMetric = (m: QueryMetric) => (ZONE_METRICS as readonly string[]).includes(m);

/** The metric query fields, without the cross-field checks (so tools can extend it). */
export const metricsQueryFields = z.object({
  metrics: z
    .array(z.enum(QUERY_METRICS))
    .min(1)
    .max(4)
    .describe(
      "1–4 metrics. Counts: streetPassersby, visitors, checkouts, registeredVisitors, returningVisitors, zoneVisitors. " +
        "Rates (0–1): captureRate (visitors/passers-by), checkoutRate, browseRate (visited a product zone), " +
        "registeredShare (loyalty members), returningShare (device seen before), zoneVisitRate (share of visitors " +
        "who entered the zone). Durations (seconds): avgDwellSec (time in store), zoneAvgDwellSec. " +
        'zone* metrics need "zone" in groupBy and can\'t be mixed with the others.',
    ),
  groupBy: z
    .array(z.enum(QUERY_DIMENSIONS))
    .max(2)
    .default([])
    .describe(
      "0–2 dimensions. First = x axis / rows, second = one series per value. " +
        "Empty = a single total row. weekday is Monday first; hour is the local hour (10 = 10:00–10:59).",
    ),
  store: storeScopeSchema.default("all"),
  range: rangeSchema.default({}),
  weekdays: z.array(z.enum(WEEKDAYS)).min(1).optional().describe("Only these weekdays"),
  hours: z
    .object({
      from: z.int().min(0).max(23).describe("First hour, inclusive"),
      to: z.int().min(1).max(24).describe("Last hour, exclusive"),
    })
    .optional()
    .describe("Only these local hours, e.g. {from: 17, to: 22} for the evening"),
  zones: z
    .array(z.enum(IN_STORE_ZONES))
    .min(1)
    .optional()
    .describe('Only these zones (with "zone" in groupBy)'),
  average: z
    .enum(["total", "perDay"])
    .default("total")
    .describe(
      '"perDay" divides counts by the number of days with data in each group (e.g. average visitors per Monday)',
    ),
  sort: z
    .object({
      by: z.string().describe("A metric or groupBy dimension"),
      dir: z.enum(["asc", "desc"]).default("desc"),
    })
    .optional()
    .describe("Default: natural order of the first dimension (time, weekday, store, walking order)"),
  limit: z.int().min(1).max(MAX_QUERY_ROWS).optional().describe("Keep only the first N rows after sorting"),
});

/** Cross-field checks for a metric query: combinations the data can't answer. */
export function checkMetricsQuery(q: z.infer<typeof metricsQueryFields>, ctx: z.RefinementCtx) {
  if (new Set(q.groupBy).size !== q.groupBy.length) {
    ctx.addIssue({ code: "custom", path: ["groupBy"], message: "Dimensions must be different" });
  }
  const byZone = q.groupBy.includes("zone");
  const zoneMetrics = q.metrics.filter(isZoneMetric);
  if (byZone && zoneMetrics.length !== q.metrics.length) {
    ctx.addIssue({
      code: "custom",
      path: ["metrics"],
      message: "Grouped by zone, use only zone metrics (zoneVisitors, zoneVisitRate, zoneAvgDwellSec)",
    });
  }
  if (!byZone && zoneMetrics.length > 0) {
    ctx.addIssue({ code: "custom", path: ["groupBy"], message: 'Zone metrics need "zone" in groupBy' });
  }
  if (q.zones && !byZone) {
    ctx.addIssue({ code: "custom", path: ["zones"], message: 'The zones filter needs "zone" in groupBy' });
  }
  if (q.hours && q.hours.from >= q.hours.to) {
    ctx.addIssue({ code: "custom", path: ["hours"], message: "hours.from must be before hours.to" });
  }
  if (q.sort && ![...q.metrics, ...q.groupBy].includes(q.sort.by as never)) {
    ctx.addIssue({
      code: "custom",
      path: ["sort", "by"],
      message: "Sort by one of the metrics or groupBy dimensions",
    });
  }
}

export const metricsQuerySchema = metricsQueryFields.superRefine(checkMetricsQuery);

export type MetricsQuery = z.infer<typeof metricsQuerySchema>;
