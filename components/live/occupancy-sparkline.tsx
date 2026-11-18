"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import type { LiveSnapshot } from "@/lib/queries";

const config = {
  inside: { label: "Today", color: "var(--chart-1)" },
  typical: { label: "Typical", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

type Point = LiveSnapshot["series"][number];

/** People inside over the last 90 minutes, today vs. a typical day. */
export function OccupancySparkline({ series, weekday }: { series: Point[]; weekday: string }) {
  if (series.length < 2) {
    return <p className="text-muted-foreground py-6 text-center text-xs">No data yet today.</p>;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        <span>Last 90 min</span>
        <span className="ml-auto flex items-center gap-1">
          <span className="bg-chart-1 h-0.5 w-3 rounded-full" aria-hidden /> Today
        </span>
        <span className="flex items-center gap-1">
          <span className="border-muted-foreground w-3 border-t border-dashed" aria-hidden /> Typical{" "}
          {weekday}
        </span>
      </div>
      <ChartContainer config={config} className="aspect-auto h-24 w-full">
        <LineChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="time" hide />
          <YAxis hide domain={[0, "dataMax + 5"]} />
          <ChartTooltip cursor={{ strokeDasharray: "3 3" }} content={<SparkTooltip weekday={weekday} />} />
          <Line
            dataKey="typical"
            stroke="var(--color-typical)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="inside"
            stroke="var(--color-inside)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}

function SparkTooltip({
  active,
  payload,
  weekday,
}: {
  active?: boolean;
  payload?: { payload: Point }[];
  weekday: string;
}) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="bg-background grid min-w-36 gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium">{p.time}</p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 tabular-nums">
        <dt className="text-muted-foreground">Inside</dt>
        <dd className="text-right font-medium">{p.inside}</dd>
        <dt className="text-muted-foreground">Typical {weekday}</dt>
        <dd className="text-right">{Math.round(p.typical)}</dd>
      </dl>
    </div>
  );
}
