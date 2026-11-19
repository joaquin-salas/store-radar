"use client";

import { useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { localNow } from "@/lib/domain/time";
import { formatCompact, formatDateRange, formatHour, formatInt, formatPercent } from "@/lib/format";
import type { Traffic } from "@/lib/queries";

type Metric = "visitors" | "street" | "captureRate";

const METRICS: Record<
  Metric,
  { label: string; title: string; format: (v: number) => string; axis: (v: number) => string }
> = {
  visitors: { label: "Visitors", title: "Visitors", format: formatInt, axis: formatCompact },
  street: { label: "Passers-by", title: "Street passers-by", format: formatInt, axis: formatCompact },
  captureRate: {
    label: "Capture rate",
    title: "Capture rate",
    format: formatPercent,
    axis: (v) => formatPercent(v),
  },
};

const config = {
  current: { label: "This period", color: "var(--chart-1)" },
  previous: { label: "Previous period", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

const dayLabel = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" });
const fullDay = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const asDate = (d: string) => new Date(`${d}T00:00:00Z`);

interface Row {
  key: string;
  label: string;
  point: Traffic["points"][number];
  current: number | null;
  previous: number | null;
  /** Today's bar (or this hour's) is still filling up. */
  partial: boolean;
}

/** Whether a point is still under way: today for daily points, the current hour for hourly ones. */
export function isPartial(p: Traffic["points"][number], hourly: boolean): boolean {
  const now = localNow();
  return p.date === now.date && p.visitors !== null && (!hourly || p.hour === now.hour);
}

/** Note shown under the legend when the last bar is still filling up. */
export const PARTIAL_NOTE = "Lighter bar: so far";

/**
 * One measure over time (bars) against the same hours or days of the previous
 * period (dashed line). One measure at a time: visitors, passers-by and capture
 * rate have different scales, so they never share an axis.
 */
export function TrafficChart({ traffic }: { traffic: Traffic | undefined }) {
  const [metric, setMetric] = useState<Metric>("visitors");
  const m = METRICS[metric];
  const hourly = traffic?.granularity === "hour";
  const rows: Row[] = (traffic?.points ?? []).map((p) => ({
    key: hourly ? String(p.hour) : p.date,
    label: hourly ? formatHour(p.hour) : dayLabel.format(asDate(p.date)),
    point: p,
    current: p[metric],
    partial: isPartial(p, hourly),
    previous: p.previous ? p.previous[metric] : null,
  }));
  const prevLabel = traffic
    ? hourly
      ? fullDay.format(asDate(traffic.previousRange.from))
      : formatDateRange(traffic.previousRange.from, traffic.previousRange.to)
    : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.title} over time</CardTitle>
        <CardDescription>
          {hourly ? "Per hour" : "Per day"}, compared with {prevLabel || "the previous period"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {/* In the content rather than the header action, so it wraps under the title on narrow cards. */}
        <SegmentedControl
          label="Measure"
          value={metric}
          options={(Object.keys(METRICS) as Metric[]).map((k) => ({ value: k, label: METRICS[k].label }))}
          onChange={setMetric}
          className="self-start"
        />
        {!traffic ? (
          <Skeleton className="h-[280px] w-full rounded-lg" />
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground py-16 text-center text-sm">Closed for the whole range.</p>
        ) : (
          <>
            <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="bg-chart-1 size-2.5 rounded-[2px]" aria-hidden /> This period
              </span>
              <span className="flex items-center gap-1.5">
                <span className="border-muted-foreground w-4 border-t-2 border-dashed" aria-hidden />{" "}
                {prevLabel}
              </span>
              {rows.some((r) => r.partial) && <span>{PARTIAL_NOTE}</span>}
            </div>
            <ChartContainer config={config} className="aspect-auto h-[280px] w-full">
              <ComposedChart data={rows} margin={{ left: 0, right: 4, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={12}
                  fontSize={11}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={metric === "captureRate" ? 48 : 44}
                  tickFormatter={m.axis}
                  allowDecimals={metric === "captureRate"}
                />
                <ChartTooltip
                  cursor={{ fillOpacity: 0.4 }}
                  content={<TrafficTooltip metric={metric} hourly={hourly} />}
                />
                <Bar dataKey="current" fill="var(--color-current)" radius={[4, 4, 0, 0]} maxBarSize={32}>
                  {rows.map((r) => (
                    <Cell key={r.key} fillOpacity={r.partial ? 0.4 : 1} />
                  ))}
                </Bar>
                <Line
                  dataKey="previous"
                  type="monotone"
                  stroke="var(--color-previous)"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ChartContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TrafficTooltip({
  active,
  payload,
  metric,
  hourly,
}: {
  active?: boolean;
  payload?: { payload: Row }[];
  metric: Metric;
  hourly: boolean;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const m = METRICS[metric];
  const p = row.point;
  const title = hourly
    ? `${formatHour(p.hour)}–${formatHour((p.hour ?? 0) + 1)}`
    : fullDay.format(asDate(p.date));
  const prevTitle = fullDay.format(asDate(p.previousDate));
  return (
    <div className="bg-background grid min-w-44 gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium">{title}</p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 tabular-nums">
        <dt className="text-muted-foreground flex items-center gap-1.5">
          <span className="bg-chart-1 size-2 rounded-[2px]" aria-hidden /> {m.label}
        </dt>
        <dd className="text-right font-medium">
          {row.current === null ? "not yet" : m.format(row.current)}
          {row.partial ? " so far" : ""}
        </dd>
        <dt className="text-muted-foreground">{prevTitle}</dt>
        <dd className="text-right">{row.previous === null ? "closed" : m.format(row.previous)}</dd>
      </dl>
    </div>
  );
}
