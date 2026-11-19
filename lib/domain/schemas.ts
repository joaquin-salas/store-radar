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
