"use client";

import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { formatHour, formatInt } from "@/lib/format";
import type { Pace } from "@/lib/queries";

const config = {
  visitors: { label: "Today", color: "var(--chart-1)" },
  typical: { label: "Typical", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

type Row = Pace["hourly"][number] & { label: string };

/** Visitors per hour today (bars) against a typical day for this weekday (dashed line). */
export function HourlyVisitorsChart({ pace }: { pace: Pace | undefined }) {
  const rows: Row[] = (pace?.hourly ?? []).map((h) => ({ ...h, label: formatHour(h.hour) }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Visitors by hour</CardTitle>
        <CardDescription>
          Walk-ins per hour today vs. a typical {pace?.weekday ?? "day"} (average of the last 4)
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {!pace ? (
          <Skeleton className="aspect-[2/1] w-full rounded-lg" />
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground py-16 text-center text-sm">The store is closed today.</p>
        ) : (
          <>
            <div className="text-muted-foreground flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="bg-chart-1 size-2.5 rounded-[2px]" aria-hidden /> Today
              </span>
              <span className="flex items-center gap-1.5">
                <span className="border-muted-foreground w-4 border-t-2 border-dashed" aria-hidden /> Typical{" "}
                {pace.weekday}
              </span>
            </div>
            <ChartContainer config={config} className="aspect-[2/1] w-full">
              <ComposedChart data={rows} margin={{ left: -8, right: 4, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                <ChartTooltip
                  cursor={{ fillOpacity: 0.4 }}
                  content={<HourTooltip weekday={pace.weekday} />}
                />
                <Bar dataKey="visitors" fill="var(--color-visitors)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Line
                  dataKey="typical"
                  type="monotone"
                  stroke="var(--color-typical)"
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

function HourTooltip({
  active,
  payload,
  weekday,
}: {
  active?: boolean;
  payload?: { payload: Row }[];
  weekday: string;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="bg-background grid min-w-40 gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium">
        {row.label}–{formatHour(row.hour + 1)}
      </p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 tabular-nums">
        <dt className="text-muted-foreground flex items-center gap-1.5">
          <span className="bg-chart-1 size-2 rounded-[2px]" aria-hidden /> Today
        </dt>
        <dd className="text-right font-medium">
          {row.visitors === null ? "not yet" : formatInt(row.visitors)}
        </dd>
        <dt className="text-muted-foreground">Typical {weekday}</dt>
        <dd className="text-right">{formatInt(row.typical)}</dd>
      </dl>
    </div>
  );
}
