"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration, formatHour, formatInt, formatPercent, relativeChange } from "@/lib/format";
import { useOverview } from "@/lib/queries";

export function LiveKpis() {
  const { data, isPending, isError } = useOverview({ store: "all", preset: "today" });

  if (isError) return <p className="text-destructive text-sm">Couldn&apos;t load data.</p>;

  const items = data
    ? [
        {
          label: "Visitors",
          value: formatInt(data.kpis.visitors),
          cur: data.kpis.visitors,
          prev: data.previous.visitors,
        },
        {
          label: "Capture rate",
          value: formatPercent(data.kpis.captureRate),
          cur: data.kpis.captureRate,
          prev: data.previous.captureRate,
        },
        {
          label: "Avg dwell",
          value: formatDuration(data.kpis.avgDwellSec),
          cur: data.kpis.avgDwellSec,
          prev: data.previous.avgDwellSec,
        },
        {
          label: "Checkout rate",
          value: formatPercent(data.kpis.checkoutRate),
          cur: data.kpis.checkoutRate,
          prev: data.previous.checkoutRate,
        },
        { label: "Peak hour", value: formatHour(data.kpis.peakHour), cur: 0, prev: 0 },
      ]
    : [];

  return (
    <section className="flex flex-col gap-3">
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <span>Whole chain · today</span>
        {data?.live && <Badge variant="secondary">Live · refreshes every 15s</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {isPending
          ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          : items.map((item) => {
              const change = relativeChange(item.cur, item.prev);
              return (
                <Card key={item.label} size="sm">
                  <CardHeader>
                    <CardDescription>{item.label}</CardDescription>
                    <CardTitle className="text-2xl tabular-nums">{item.value}</CardTitle>
                  </CardHeader>
                  {change !== null && (
                    <CardContent className="text-muted-foreground text-xs tabular-nums">
                      {change >= 0 ? "▲" : "▼"} {formatPercent(Math.abs(change))} vs. yesterday
                    </CardContent>
                  )}
                </Card>
              );
            })}
      </div>
    </section>
  );
}
