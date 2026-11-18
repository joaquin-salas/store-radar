"use client";

import { Clock, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatInt, formatPercent, relativeChange } from "@/lib/format";
import type { Pace } from "@/lib/queries";

/** Today's pace: visitors so far vs. typical, forecast for the day, usual peak. */
export function PaceCard({ pace }: { pace: Pace | undefined }) {
  if (!pace) return <Skeleton className="min-h-64 rounded-xl" />;

  if (!pace.openToday) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s pace</CardTitle>
          <CardDescription>The store is closed today.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const soFar = pace.kpis.visitors;
  const typicalSoFar = Math.round(pace.typicalKpis.visitors);
  const vsTypical = relativeChange(soFar, typicalSoFar);
  const { visitors: forecast, typicalFullDay } = pace.forecast;
  const forecastVsTypical = relativeChange(forecast, typicalFullDay);
  const progress = forecast > 0 ? Math.min(1, soFar / forecast) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&apos;s pace</CardTitle>
        <CardDescription>Compared with a typical {pace.weekday}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 text-sm">
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-xs">Visitors so far</p>
          <p className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums">{formatInt(soFar)}</span>
            <span className="text-muted-foreground text-xs tabular-nums">
              typical by now: {formatInt(typicalSoFar)}
              {vsTypical !== null && (
                <span className="text-foreground font-medium">
                  {" "}
                  ({vsTypical >= 0 ? "+" : "−"}
                  {formatPercent(Math.abs(vsTypical))})
                </span>
              )}
            </span>
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <TrendingUp className="size-3.5" aria-hidden /> Forecast for today
          </p>
          <p className="flex items-baseline gap-2">
            <span className="text-xl font-semibold tabular-nums">≈ {formatInt(forecast)}</span>
            <span className="text-muted-foreground text-xs tabular-nums">
              typical {pace.weekday}: {formatInt(typicalFullDay)}
              {forecastVsTypical !== null && (
                <>
                  {" "}
                  ({forecastVsTypical >= 0 ? "+" : "−"}
                  {formatPercent(Math.abs(forecastVsTypical))})
                </>
              )}
            </span>
          </p>
          <span
            className="bg-muted block h-2 overflow-hidden rounded-full"
            role="meter"
            aria-label="Share of today's forecast reached"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <span
              className="bg-chart-1 block h-full rounded-full transition-[width] duration-700"
              style={{ width: `${progress * 100}%` }}
            />
          </span>
          <p className="text-muted-foreground text-xs tabular-nums">
            {formatPercent(progress)} of the forecast reached
          </p>
        </div>

        {pace.usualPeak && (
          <div className="flex flex-col gap-1">
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Clock className="size-3.5" aria-hidden /> Usually busiest
            </p>
            <p className="text-xl font-semibold tabular-nums">{pace.usualPeak.label}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
