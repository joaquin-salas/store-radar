"use client";

/**
 * TanStack Query hooks for the dashboard. Response types are inferred from the
 * domain service, so the client stays in sync with the API without codegen.
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { RangePreset } from "@/lib/domain/schemas";
import type { CustomersQuery, VisitStatsQuery, VisitsQuery } from "@/lib/domain/schemas";
import type {
  DateRange,
  compareStores,
  getCustomersPage,
  getFunnel,
  getHourProfile,
  getOverview,
  getTraffic,
  getVisit,
  getVisitStats,
  getVisitsPage,
  getZones,
  listStores,
} from "@/lib/domain/service";
import { localNow } from "@/lib/domain/time";

/** How often live views (ranges that include today) refetch. */
export const LIVE_REFRESH_MS = 15_000;

export interface ScopeParams {
  store: string;
  preset?: RangePreset;
  from?: string;
  to?: string;
}

export type Overview = ReturnType<typeof getOverview>;
export type Traffic = ReturnType<typeof getTraffic>;
export type Zones = ReturnType<typeof getZones>;
export type Funnel = ReturnType<typeof getFunnel>;
export type HourProfile = ReturnType<typeof getHourProfile>;
export type StoreComparison = ReturnType<typeof compareStores>;
export type VisitsPage = ReturnType<typeof getVisitsPage>;
export type VisitDetail = NonNullable<ReturnType<typeof getVisit>>;
export type VisitStats = ReturnType<typeof getVisitStats>;
export type CustomersPage = ReturnType<typeof getCustomersPage>;
export type StoreList = { stores: ReturnType<typeof listStores> };

type Params = Record<string, string | number | undefined>;

async function fetchJson<T>(path: string, params: Params = {}): Promise<T> {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") search.set(k, String(v));
  const res = await fetch(`${path}?${search}`);
  if (!res.ok) throw new Error(`${path} failed with ${res.status}`);
  return res.json() as Promise<T>;
}

export const queryKeys = {
  all: ["radar"] as const,
  stores: () => [...queryKeys.all, "stores"] as const,
  overview: (p: ScopeParams) => [...queryKeys.all, "overview", p] as const,
  traffic: (p: ScopeParams) => [...queryKeys.all, "traffic", p] as const,
  zones: (p: ScopeParams) => [...queryKeys.all, "zones", p] as const,
  funnel: (p: ScopeParams) => [...queryKeys.all, "funnel", p] as const,
  hours: (p: ScopeParams) => [...queryKeys.all, "hours", p] as const,
  compare: (p: ScopeParams) => [...queryKeys.all, "compare", p] as const,
  visits: (p: Partial<VisitsQuery>) => [...queryKeys.all, "visits", p] as const,
  visitStats: (p: Partial<VisitStatsQuery>) => [...queryKeys.all, "visit-stats", p] as const,
  visit: (id: string) => [...queryKeys.all, "visit", id] as const,
  customers: (p: Partial<CustomersQuery>) => [...queryKeys.all, "customers", p] as const,
};

/** A range is live while it includes today (store-local). */
export function isLiveRange(range: DateRange | undefined): boolean {
  if (!range) return false;
  const today = localNow().date;
  return range.from <= today && range.to >= today;
}

const liveRefetch = (query: { state: { data?: { range?: DateRange } } }) =>
  isLiveRange(query.state.data?.range) ? LIVE_REFRESH_MS : false;

function useScoped<T extends { range: DateRange }>(
  key: readonly unknown[],
  path: string,
  params: ScopeParams,
) {
  return useQuery({
    queryKey: key,
    queryFn: () => fetchJson<T>(path, { ...params }),
    refetchInterval: liveRefetch,
    placeholderData: keepPreviousData,
  });
}

export const useOverview = (p: ScopeParams) => useScoped<Overview>(queryKeys.overview(p), "/api/overview", p);
export const useTraffic = (p: ScopeParams) => useScoped<Traffic>(queryKeys.traffic(p), "/api/traffic", p);
export const useZones = (p: ScopeParams) => useScoped<Zones>(queryKeys.zones(p), "/api/zones", p);
export const useFunnel = (p: ScopeParams) => useScoped<Funnel>(queryKeys.funnel(p), "/api/funnel", p);
export const useHourProfile = (p: ScopeParams) => useScoped<HourProfile>(queryKeys.hours(p), "/api/hours", p);
export const useStoreComparison = (p: ScopeParams) =>
  useScoped<StoreComparison>(queryKeys.compare(p), "/api/compare", p);

export function useStores() {
  return useQuery({
    queryKey: queryKeys.stores(),
    queryFn: () => fetchJson<StoreList>("/api/stores"),
    staleTime: 60_000,
  });
}

export function useVisits(p: Partial<VisitsQuery> & { store: string }) {
  return useQuery({
    queryKey: queryKeys.visits(p),
    queryFn: () => fetchJson<VisitsPage>("/api/visits", { ...p }),
    placeholderData: keepPreviousData,
    refetchInterval: (q) => (q.state.data && q.state.data.date === localNow().date ? LIVE_REFRESH_MS : false),
  });
}

/** Visit-length histogram and time per zone for one store-day and segment. */
export function useVisitStats(p: VisitStatsQuery) {
  return useQuery({
    queryKey: queryKeys.visitStats(p),
    queryFn: () => fetchJson<VisitStats>("/api/visits/stats", { ...p }),
    placeholderData: keepPreviousData,
    refetchInterval: (q) => (q.state.data && q.state.data.date === localNow().date ? LIVE_REFRESH_MS : false),
  });
}

/** One visit with its timeline. Today's visits refresh while the visitor may still be inside. */
export function useVisit(visitId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.visit(visitId ?? ""),
    queryFn: () => fetchJson<VisitDetail>(`/api/visits/${visitId}`),
    enabled: Boolean(visitId),
    refetchInterval: (q) => (q.state.data?.inside ? LIVE_REFRESH_MS : false),
  });
}

export function useCustomers(p: Partial<CustomersQuery>) {
  return useQuery({
    queryKey: queryKeys.customers(p),
    queryFn: () => fetchJson<CustomersPage>("/api/customers", { ...p }),
    placeholderData: keepPreviousData,
  });
}

/** How often the live floor plan refreshes. */
export const LIVE_SNAPSHOT_MS = 5_000;

export type LiveSnapshot = import("@/lib/domain/live").LiveSnapshot;

export function useLiveSnapshot(storeId: string) {
  return useQuery({
    queryKey: [...queryKeys.all, "live", storeId] as const,
    queryFn: () => fetchJson<LiveSnapshot>(`/api/stores/${storeId}/live`),
    refetchInterval: LIVE_SNAPSHOT_MS,
    // No placeholderData: another store's floor plan data must never show here.
  });
}

export type Pace = import("@/lib/domain/typical").Pace;

/** Today's pace vs. a typical day (KPIs, forecast, hourly profile). */
export function usePace(storeId: string) {
  return useQuery({
    queryKey: [...queryKeys.all, "pace", storeId] as const,
    queryFn: () => fetchJson<Pace>(`/api/stores/${storeId}/pace`),
    refetchInterval: LIVE_REFRESH_MS,
  });
}
