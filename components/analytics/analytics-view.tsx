"use client";

import { useSearchParams } from "next/navigation";
import { OverviewKpiRow } from "@/components/dashboard/kpi-row";
import { ZoneChart } from "@/components/dashboard/zone-chart";
import { RangePicker } from "@/components/filters/range-picker";
import { Badge } from "@/components/ui/badge";
import { isLiveRange, previousRange, resolveRange } from "@/lib/domain/range";
import { localNow } from "@/lib/domain/time";
import { formatDateRange } from "@/lib/format";
import { scopeLabel } from "@/lib/nav";
import { type ScopeParams, useFunnel, useStoreComparison, useTraffic, useWeekdayHours } from "@/lib/queries";
import { comparisonLabel, rangeFromSearch } from "@/lib/range-params";
import { FunnelCard } from "./funnel-card";
import { NewReturningChart } from "./new-returning-chart";
import { StoreComparison } from "./store-comparison";
import { TrafficChart } from "./traffic-chart";
import { WeekdayHeatmap } from "./weekday-heatmap";

/** Analytics for one store or the whole chain over a date range taken from the URL. */
export function AnalyticsView({ scope }: { scope: string }) {
  const searchParams = useSearchParams();
  const range = rangeFromSearch(searchParams);
  const now = localNow();
  const resolved = resolveRange(range, now);
  const previous = previousRange(resolved);
  const live = isLiveRange(resolved, now);
  const params: ScopeParams = { store: scope, ...range };
  const { data: traffic } = useTraffic(params);
  const { data: funnel } = useFunnel(params);
  const { data: weekdayHours } = useWeekdayHours(params);
  const { data: stores } = useStoreComparison(params);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <RangePicker range={range} resolved={resolved} />
        <span className="text-muted-foreground text-sm tabular-nums">
          {formatDateRange(resolved.from, resolved.to)} · {scopeLabel(scope)}
        </span>
        {live && <Badge variant="live">Live</Badge>}
      </div>

      <section className="flex flex-col gap-2" aria-labelledby="analytics-kpis">
        <h2 id="analytics-kpis" className="text-muted-foreground text-sm font-medium">
          Key figures{" "}
          <span className="font-normal">
            · compared with {formatDateRange(previous.from, previous.to)}
            {live ? " up to the same time of day" : ""}
          </span>
        </h2>
        <OverviewKpiRow params={params} comparisonLabel={comparisonLabel(range, resolved)} />
      </section>

      <TrafficChart traffic={traffic} />

      <div className="grid gap-4 @4xl:grid-cols-2">
        <FunnelCard funnel={funnel} />
        <ZoneChart params={params} title="Zones" />
      </div>

      <WeekdayHeatmap data={weekdayHours} />

      <div className="grid gap-4 @4xl:grid-cols-2">
        <NewReturningChart traffic={traffic} />
        <StoreComparison data={stores} scope={scope} />
      </div>
    </div>
  );
}
