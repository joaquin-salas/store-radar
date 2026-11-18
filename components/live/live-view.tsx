"use client";

import { HourlyVisitorsChart } from "@/components/dashboard/hourly-visitors-chart";
import { KpiRow } from "@/components/dashboard/kpi-row";
import { ZoneChart } from "@/components/dashboard/zone-chart";
import { FloorPlan, HeatLegend } from "@/components/live/floor-plan";
import { PaceCard } from "@/components/live/pace-card";
import { RegisteredInside } from "@/components/live/registered-inside";
import { RightNow } from "@/components/live/right-now";
import { StoreSwitcher } from "@/components/store-switcher";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FloorPlan as Plan } from "@/lib/domain/layout";
import { pad2 } from "@/lib/domain/time";
import { useLiveSnapshot, usePace } from "@/lib/queries";

export function LiveView({ storeId, storeName, plan }: { storeId: string; storeName: string; plan: Plan }) {
  const { data: live, isError } = useLiveSnapshot(storeId);
  const { data: pace } = usePace(storeId);
  const weekday = pace?.weekday ?? live?.weekday;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <StoreSwitcher storeId={storeId} />
        <span className="text-muted-foreground text-sm tabular-nums">
          {weekday ?? "Today"}
          {live ? ` · ${pad2(live.asOf.hour)}:${pad2(live.asOf.minute)}` : ""} (store time)
        </span>
        {live && (
          <Badge variant={live.openNow ? "secondary" : "outline"} className="gap-1.5">
            <span
              className={
                live.openNow
                  ? "bg-status-good size-1.5 animate-pulse rounded-full"
                  : "bg-muted-foreground size-1.5 rounded-full"
              }
              aria-hidden
            />
            {live.openNow ? "Live" : "Closed"}
          </Badge>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader>
            <CardTitle>{storeName}</CardTitle>
            <CardDescription>Floor plan · zones coloured by how full they are right now</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {isError ? (
              <p className="text-destructive text-sm">Couldn&apos;t load live data.</p>
            ) : (
              <FloorPlan plan={plan} live={live} />
            )}
            <HeatLegend />
          </CardContent>
        </Card>
        <RightNow live={live} />
      </div>

      <section className="flex flex-col gap-2" aria-labelledby="kpis-today">
        <h2 id="kpis-today" className="text-muted-foreground text-sm font-medium">
          Today so far{" "}
          <span className="font-normal">
            · compared with a typical {weekday ?? "day"} at this time (average of the last 4)
          </span>
        </h2>
        <KpiRow current={pace?.kpis} previous={pace?.typicalKpis} comparisonLabel="vs. typical" />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <HourlyVisitorsChart pace={pace} />
        <PaceCard pace={pace} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RegisteredInside live={live} />
        <ZoneChart params={{ store: storeId, preset: "today" }} />
      </div>
    </div>
  );
}
