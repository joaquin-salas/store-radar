"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { type DurationBucket, OPEN_BUCKET_MIN, type ZoneDwell } from "@/lib/domain/visit-stats";
import { formatDuration, formatInt, formatPercent } from "@/lib/format";
import type { VisitStats } from "@/lib/queries";

const durationConfig = { visits: { label: "Visits", color: "var(--chart-1)" } } satisfies ChartConfig;
const zoneConfig = { medianSec: { label: "Median time", color: "var(--chart-1)" } } satisfies ChartConfig;

/** Histogram of finished visits by length. Single series: the title names it, no legend. */
export function DurationChart({ stats }: { stats: VisitStats | undefined }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How long visits last</CardTitle>
        <CardDescription className="tabular-nums">
          {!stats
            ? "Finished visits"
            : stats.finished === 0
              ? "No finished visits yet"
              : `Minutes inside, finished visits · median ${formatDuration(stats.medianSec)} · 9 in 10 under ${formatDuration(stats.p90Sec)}` +
                (stats.inside > 0 ? ` · ${formatInt(stats.inside)} still inside, not counted` : "")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!stats ? (
          <Skeleton className="aspect-[2/1] w-full rounded-lg" />
        ) : (
          <ChartContainer config={durationConfig} className="aspect-[2/1] w-full">
            <BarChart
              data={stats.histogram}
              margin={{ top: 4, right: 4, left: -6, bottom: 0 }}
              barCategoryGap={2}
            >
              <CartesianGrid vertical={false} strokeOpacity={0.5} />
              <XAxis
                dataKey="fromMin"
                tickLine={false}
                axisLine={false}
                tickMargin={6}
                interval={1}
                fontSize={11}
                tickFormatter={(min: number) => (min === OPEN_BUCKET_MIN ? `${min}+` : String(min))}
              />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={44} />
              <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={<DurationTooltip />} />
              <Bar dataKey="visits" fill="var(--color-visits)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function DurationTooltip({ active, payload }: { active?: boolean; payload?: { payload: DurationBucket }[] }) {
  const b = payload?.[0]?.payload;
  if (!active || !b) return null;
  return (
    <div className="bg-background grid min-w-36 gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium">{b.toMin === null ? `${b.fromMin} min or more` : b.label}</p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 tabular-nums">
        <dt className="text-muted-foreground">Visits</dt>
        <dd className="text-right font-medium">{formatInt(b.visits)}</dd>
        <dt className="text-muted-foreground">Share</dt>
        <dd className="text-right">{formatPercent(b.share)}</dd>
      </dl>
    </div>
  );
}

/** Median time per zone (completed stops), labelled at the bar end. */
export function ZoneDwellChart({ stats }: { stats: VisitStats | undefined }) {
  const rows = stats?.zones ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Time per zone</CardTitle>
        <CardDescription>
          Median time in each zone · hover for the middle half and share of visits
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!stats ? (
          <Skeleton className="aspect-[2/1] w-full rounded-lg" />
        ) : (
          <ChartContainer config={zoneConfig} className="aspect-[2/1] w-full">
            <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 56 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="label"
                tickLine={false}
                axisLine={false}
                width={96}
                tickMargin={4}
              />
              <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={<ZoneDwellTooltip />} />
              <Bar
                dataKey="medianSec"
                fill="var(--color-medianSec)"
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
                  return (
                    <text
                      x={Number(props.x) + Number(props.width) + 6}
                      y={Number(props.y) + Number(props.height) / 2}
                      dominantBaseline="central"
                      className="fill-muted-foreground text-xs tabular-nums"
                    >
                      {row.stops ? formatDuration(row.medianSec) : "—"}
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

function ZoneDwellTooltip({ active, payload }: { active?: boolean; payload?: { payload: ZoneDwell }[] }) {
  const z = payload?.[0]?.payload;
  if (!active || !z) return null;
  return (
    <div className="bg-background grid min-w-44 gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium">{z.label}</p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 tabular-nums">
        <dt className="text-muted-foreground">Median</dt>
        <dd className="text-right font-medium">{formatDuration(z.medianSec)}</dd>
        <dt className="text-muted-foreground">Middle half</dt>
        <dd className="text-right">
          {formatDuration(z.p25Sec)}–{formatDuration(z.p75Sec)}
        </dd>
        <dt className="text-muted-foreground">Visits stopping here</dt>
        <dd className="text-right">{formatPercent(z.visitShare)}</dd>
      </dl>
    </div>
  );
}
