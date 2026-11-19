"use client";

import { HourlyVisitorsChart } from "@/components/dashboard/hourly-visitors-chart";
import { KpiRow } from "@/components/dashboard/kpi-row";
import { ZoneChart } from "@/components/dashboard/zone-chart";
import { FloorPlan, LayerToggles, PlanLegend, usePlanLayers } from "@/components/live/floor-plan";
import { PaceCard } from "@/components/live/pace-card";
import { RegisteredInside } from "@/components/live/registered-inside";
import { RightNow } from "@/components/live/right-now";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FloorPlan as Plan } from "@/lib/domain/layout";
import { pad2 } from "@/lib/domain/time";
import { useLiveSnapshot, usePace } from "@/lib/queries";

export function LiveView({ storeId, storeName, plan }: { storeId: string; storeName: string; plan: Plan }) {
  const { data: live, isError } = useLiveSnapshot(storeId);
  const { data: pace } = usePace(storeId);
  const weekday = pace?.weekday ?? live?.weekday;
  const { layers, toggle } = usePlanLayers();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-wide text-[22px] leading-7 font-bold">{storeName}</h1>
        {live &&
          (live.openNow ? (
            <Badge variant="live">Live</Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5">
              <span className="bg-muted-foreground size-1.5 rounded-full" aria-hidden />
              Closed
            </Badge>
          ))}
        <span className="text-muted-foreground readout text-xs">
          {weekday ?? "Today"}
          {live ? ` · ${pad2(live.asOf.hour)}:${pad2(live.asOf.minute)}` : ""} (store time)
        </span>
      </div>

      <div className="grid gap-4 @4xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle>Floor plan</CardTitle>
              <CardDescription>
                {plan.width} × {plan.depth} m · zones coloured by how full they are right now
              </CardDescription>
            </div>
            <LayerToggles layers={layers} onToggle={toggle} />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {isError ? (
              <p className="text-destructive text-sm">Couldn&apos;t load live data.</p>
            ) : (
              <FloorPlan plan={plan} live={live} layers={layers} />
            )}
            <PlanLegend plan={plan} layers={layers} />
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

      <div className="grid gap-4 @3xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <HourlyVisitorsChart pace={pace} />
        <PaceCard pace={pace} />
      </div>

      <div className="grid gap-4 @3xl:grid-cols-2">
        <RegisteredInside live={live} />
        <ZoneChart params={{ store: storeId, preset: "today" }} />
      </div>
    </div>
  );
}
