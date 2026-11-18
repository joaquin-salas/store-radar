"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { OpeningHours } from "@/lib/domain/types";
import { formatHour, formatInt, formatPercent } from "@/lib/format";
import { type ScopeParams, useTraffic } from "@/lib/queries";

const config = {
  visitors: { label: "Visitors", color: "var(--chart-1)" },
} satisfies ChartConfig;

interface Row {
  hour: number;
  label: string;
  visitors: number | null;
  street: number | null;
  captureRate: number | null;
}

export function HourlyVisitorsChart({
  params,
  hours,
}: {
  params: ScopeParams;
  /** Opening hours, so the axis covers the whole day even before hours have happened. */
  hours: OpeningHours | null | undefined;
}) {
  const { data, isPending } = useTraffic(params);

  const rows: Row[] = [];
  if (data && hours) {
    const byHour = new Map(data.points.map((p) => [p.hour, p]));
    for (let h = hours.open; h < hours.close; h++) {
      const p = byHour.get(h);
      rows.push({
        hour: h,
        label: formatHour(h),
        visitors: p?.visitors ?? null,
        street: p?.street ?? null,
        captureRate: p?.captureRate ?? null,
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Visitors by hour</CardTitle>
        <CardDescription>Walk-ins per hour today · hover for street traffic and capture rate</CardDescription>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <Skeleton className="aspect-[2/1] w-full rounded-lg" />
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground py-16 text-center text-sm">The store is closed today.</p>
        ) : (
          <ChartContainer config={config} className="aspect-[2/1] w-full">
            <BarChart data={rows} margin={{ left: -8, right: 4, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval="preserveStartEnd"
              />
              <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />
              <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={<HourTooltip />} />
              <Bar dataKey="visitors" fill="var(--color-visitors)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function HourTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="bg-background grid min-w-40 gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium">
        {row.label}–{formatHour(row.hour + 1)}
      </p>
      {row.visitors === null ? (
        <p className="text-muted-foreground">Not reached yet</p>
      ) : (
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 tabular-nums">
          <dt className="text-muted-foreground flex items-center gap-1.5">
            <span className="bg-chart-1 size-2 rounded-[2px]" aria-hidden /> Visitors
          </dt>
          <dd className="text-right font-medium">{formatInt(row.visitors)}</dd>
          <dt className="text-muted-foreground">Street passers-by</dt>
          <dd className="text-right">{formatInt(row.street ?? 0)}</dd>
          <dt className="text-muted-foreground">Capture rate</dt>
          <dd className="text-right">{formatPercent(row.captureRate ?? 0)}</dd>
        </dl>
      )}
    </div>
  );
}
