"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompact, formatHour, formatInt, formatPercent } from "@/lib/format";
import type { Traffic } from "@/lib/queries";
import { PARTIAL_NOTE, isPartial } from "./traffic-chart";

const config = {
  newVisitors: { label: "New", color: "var(--chart-1)" },
  returning: { label: "Returning", color: "var(--chart-2)" },
} satisfies ChartConfig;

const dayLabel = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" });

interface Row {
  label: string;
  newVisitors: number | null;
  returning: number | null;
  total: number | null;
  partial: boolean;
}

/** New vs. returning visitors per hour or day, stacked (same data as the traffic chart). */
export function NewReturningChart({ traffic }: { traffic: Traffic | undefined }) {
  const hourly = traffic?.granularity === "hour";
  const rows: Row[] = (traffic?.points ?? [])
    // Keep buckets that haven't happened yet (null), so the axis matches the traffic chart.
    .map((p) => ({
      label: hourly ? formatHour(p.hour) : dayLabel.format(new Date(`${p.date}T00:00:00Z`)),
      newVisitors: p.visitors === null ? null : p.visitors - (p.returning ?? 0),
      returning: p.returning,
      total: p.visitors,
      partial: isPartial(p, hourly),
    }));
  const total = rows.reduce((s, r) => s + (r.total ?? 0), 0);
  const returning = rows.reduce((s, r) => s + (r.returning ?? 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>New and returning visitors</CardTitle>
        <CardDescription className="tabular-nums">
          {total > 0
            ? `${formatPercent(returning / total)} returning · device seen on an earlier day`
            : "Device seen on an earlier day or not"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {!traffic ? (
          <Skeleton className="aspect-[2/1] w-full rounded-lg" />
        ) : total === 0 ? (
          <p className="text-muted-foreground py-16 text-center text-sm">No visitors yet in this range.</p>
        ) : (
          <>
            <div className="text-muted-foreground flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="bg-chart-1 size-2.5 rounded-[2px]" aria-hidden /> New
              </span>
              <span className="flex items-center gap-1.5">
                <span className="bg-chart-2 size-2.5 rounded-[2px]" aria-hidden /> Returning
              </span>
              {rows.some((r) => r.partial) && <span>{PARTIAL_NOTE}</span>}
            </div>
            <ChartContainer config={config} className="aspect-[2/1] w-full">
              <BarChart data={rows} margin={{ left: 0, right: 4, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={12}
                  fontSize={11}
                />
                <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={formatCompact} />
                <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={<NewReturningTooltip />} />
                {/* 2px surface gap between the stacked segments. */}
                <Bar
                  dataKey="newVisitors"
                  stackId="v"
                  fill="var(--color-newVisitors)"
                  stroke="var(--card)"
                  strokeWidth={2}
                  maxBarSize={32}
                >
                  {rows.map((r, i) => (
                    <Cell key={i} fillOpacity={r.partial ? 0.4 : 1} />
                  ))}
                </Bar>
                <Bar
                  dataKey="returning"
                  stackId="v"
                  fill="var(--color-returning)"
                  stroke="var(--card)"
                  strokeWidth={2}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                >
                  {rows.map((r, i) => (
                    <Cell key={i} fillOpacity={r.partial ? 0.4 : 1} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function NewReturningTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  const r = payload?.[0]?.payload;
  if (!active || !r || r.total === null) return null;
  return (
    <div className="bg-background grid min-w-40 gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium">
        {r.label}
        {r.partial ? " · so far" : ""}
      </p>
      <dl className="grid grid-cols-[1fr_auto_auto] gap-x-3 tabular-nums">
        <dt className="text-muted-foreground flex items-center gap-1.5">
          <span className="bg-chart-1 size-2 rounded-[2px]" aria-hidden /> New
        </dt>
        <dd className="text-right font-medium">{formatInt(r.newVisitors ?? 0)}</dd>
        <dd className="text-muted-foreground text-right">
          {formatPercent(r.total ? (r.newVisitors ?? 0) / r.total : 0)}
        </dd>
        <dt className="text-muted-foreground flex items-center gap-1.5">
          <span className="bg-chart-2 size-2 rounded-[2px]" aria-hidden /> Returning
        </dt>
        <dd className="text-right font-medium">{formatInt(r.returning ?? 0)}</dd>
        <dd className="text-muted-foreground text-right">
          {formatPercent(r.total ? (r.returning ?? 0) / r.total : 0)}
        </dd>
      </dl>
    </div>
  );
}
