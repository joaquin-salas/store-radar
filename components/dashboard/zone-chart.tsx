"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { ZoneStat } from "@/lib/domain/metrics";
import { formatDuration, formatInt, formatPercent } from "@/lib/format";
import { type ScopeParams, useZones } from "@/lib/queries";

const config = {
  visitors: { label: "Visitors", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function ZoneChart({ params }: { params: ScopeParams }) {
  const { data, isPending } = useZones(params);

  // Every visitor passes the entrance, so it would always top the ranking: leave it out.
  const rows = (data?.zones ?? [])
    .filter((z) => z.zone !== "entrance")
    .sort((a, b) => b.visitors - a.visitors);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zones today</CardTitle>
        <CardDescription>Visitors per zone · label shows share of store visitors</CardDescription>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <Skeleton className="aspect-[2/1] w-full rounded-lg" />
        ) : (
          <ChartContainer config={config} className="aspect-[2/1] w-full">
            <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 48 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="label"
                tickLine={false}
                axisLine={false}
                width={96}
                tickMargin={4}
              />
              <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={<ZoneTooltip />} />
              <Bar
                dataKey="visitors"
                fill="var(--color-visitors)"
                radius={[0, 4, 4, 0]}
                maxBarSize={22}
                label={(props: {
                  x?: unknown;
                  y?: unknown;
                  width?: unknown;
                  height?: unknown;
                  index?: number;
                }) => {
                  const row = rows[props.index ?? -1];
                  if (!row) return null;
                  const x = Number(props.x) + Number(props.width) + 6;
                  const y = Number(props.y) + Number(props.height) / 2;
                  return (
                    <text
                      x={x}
                      y={y}
                      dominantBaseline="central"
                      className="fill-muted-foreground text-xs tabular-nums"
                    >
                      {formatPercent(row.visitRate)}
                    </text>
                  );
                }}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function ZoneTooltip({ active, payload }: { active?: boolean; payload?: { payload: ZoneStat }[] }) {
  const z = payload?.[0]?.payload;
  if (!active || !z) return null;
  return (
    <div className="bg-background grid min-w-40 gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium">{z.label}</p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 tabular-nums">
        <dt className="text-muted-foreground">Visitors</dt>
        <dd className="text-right font-medium">{formatInt(z.visitors)}</dd>
        <dt className="text-muted-foreground">Share of visitors</dt>
        <dd className="text-right">{formatPercent(z.visitRate)}</dd>
        <dt className="text-muted-foreground">Avg dwell</dt>
        <dd className="text-right">{formatDuration(z.avgDwellSec)}</dd>
      </dl>
    </div>
  );
}
