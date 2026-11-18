"use client";

import { useSearchParams } from "next/navigation";
import { OverviewKpiRow } from "@/components/dashboard/kpi-row";
import { RangePicker } from "@/components/filters/range-picker";
import { Badge } from "@/components/ui/badge";
import { isLiveRange, previousRange, resolveRange } from "@/lib/domain/range";
import { localNow } from "@/lib/domain/time";
import { formatDateRange } from "@/lib/format";
import { scopeLabel } from "@/lib/nav";
import type { ScopeParams } from "@/lib/queries";
import { comparisonLabel, rangeFromSearch } from "@/lib/range-params";

/** Analytics for one store or the whole chain over a date range taken from the URL. */
export function AnalyticsView({ scope }: { scope: string }) {
  const searchParams = useSearchParams();
  const range = rangeFromSearch(searchParams);
  const now = localNow();
  const resolved = resolveRange(range, now);
  const previous = previousRange(resolved);
  const live = isLiveRange(resolved, now);
  const params: ScopeParams = { store: scope, ...range };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <RangePicker range={range} resolved={resolved} />
        <span className="text-muted-foreground text-sm tabular-nums">
          {formatDateRange(resolved.from, resolved.to)} · {scopeLabel(scope)}
        </span>
        {live && (
          <Badge variant="secondary" className="gap-1.5">
            <span className="bg-status-good size-1.5 animate-pulse rounded-full" aria-hidden />
            Live
          </Badge>
        )}
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
    </div>
  );
}
