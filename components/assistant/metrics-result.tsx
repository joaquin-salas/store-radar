"use client";

import { cn } from "cn";
import { Download, FileImage, FileSpreadsheet, Maximize2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, XAxis, YAxis } from "recharts";
import { STORE_COLORS, zoneColor } from "@/components/flows/flow-colors";
import { Button } from "@/components/ui/button";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type SeriesColor, planChart, toCsv } from "@/lib/ai/chart-plan";
import type { AssistantTools } from "@/lib/ai/tools";
import type { ValueFormat } from "@/lib/domain/query";
import {
  formatCompact,
  formatDateRange,
  formatDuration,
  formatHour,
  formatInt,
  formatPercent,
} from "@/lib/format";
import { chartToSvg, downloadFile, fileSlug } from "./chart-export";

type MetricsOutput = AssistantTools["queryMetrics"]["output"];

const SLOT_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

function cssColor(c: SeriesColor): string {
  if (c.by === "store") return STORE_COLORS[c.index] ?? "var(--chart-other)";
  if (c.by === "zone") return zoneColor(c.zone);
  return SLOT_COLORS[c.index] ?? "var(--chart-other)";
}

const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** A value as text, by its column format. */
export function formatValue(value: string | number | undefined, format: ValueFormat): string {
  if (value === undefined || value === "") return "—";
  switch (format) {
    case "count":
      return Number.isInteger(value) ? formatInt(Number(value)) : Number(value).toFixed(1);
    case "percent":
      return formatPercent(Number(value));
    case "duration":
      return formatDuration(Number(value));
    case "hour":
      return formatHour(Number(value));
    case "date":
      return shortDate.format(new Date(`${value}T00:00:00Z`));
    default:
      return String(value);
  }
}

function axisValue(value: number, format: ValueFormat): string {
  if (format === "percent") return formatPercent(value);
  if (format === "duration") return `${Math.round(value / 60)}m`;
  return formatCompact(value);
}

/** A chart or table the assistant built from a metric query; it can open full screen. */
export function MetricsResult({ result }: { result: MetricsOutput }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <MetricsFigure result={result} onExpand={() => setExpanded(true)} />
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-5xl">
          <DialogTitle className="sr-only">{result.display.title}</DialogTitle>
          <MetricsFigure result={result} expanded />
        </DialogContent>
      </Dialog>
    </>
  );
}

function MetricsFigure({
  result,
  expanded = false,
  onExpand,
}: {
  result: MetricsOutput;
  /** Shown in the full-screen dialog: bigger chart, no frame. */
  expanded?: boolean;
  onExpand?: () => void;
}) {
  const plan = useMemo(() => planChart(result), [result]);
  const chartable = plan.kind === "bar" || plan.kind === "line";
  const [view, setView] = useState<"chart" | "table">(chartable ? "chart" : "table");
  const figureRef = useRef<HTMLElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const subtitle = [
    formatDateRange(result.range.from, result.range.to),
    result.average === "perDay" ? "average per day" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const name = fileSlug(result.display.title);
  const showsChart = chartable && view === "chart";

  function downloadCsv() {
    downloadFile(toCsv(result), "text/csv;charset=utf-8", `${name}.csv`);
  }

  function downloadSvg() {
    if (!chartable || !chartRef.current || !figureRef.current) return;
    const svg = chartToSvg({
      chart: chartRef.current,
      surface: figureRef.current,
      title: result.display.title,
      subtitle,
      legend:
        plan.series.length > 1 ? plan.series.map((s) => ({ label: s.label, color: cssColor(s.color) })) : [],
    });
    if (svg) downloadFile(svg, "image/svg+xml;charset=utf-8", `${name}.svg`);
  }

  return (
    <figure
      ref={figureRef}
      className={cn(
        "flex flex-col gap-3",
        expanded ? "bg-popover text-popover-foreground" : "bg-card rounded-md border p-3",
      )}
    >
      <figcaption className={cn("flex flex-wrap items-start gap-2", expanded && "pr-8")}>
        <div className="min-w-0 flex-1">
          <p className={cn("leading-snug font-semibold", expanded ? "text-base" : "text-[13px]")}>
            {result.display.title}
          </p>
          <p className="text-muted-foreground text-xs">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1">
          {chartable && (
            <SegmentedControl
              label="Show as"
              value={view}
              onChange={setView}
              options={[
                { value: "chart", label: "Chart" },
                { value: "table", label: "Table" },
              ]}
            />
          )}
          {plan.kind !== "number" && plan.kind !== "empty" && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon-sm" aria-label="Download" title="Download" />}
              >
                <Download aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={downloadCsv}>
                  <FileSpreadsheet aria-hidden />
                  Data (CSV)
                </DropdownMenuItem>
                {showsChart && (
                  <DropdownMenuItem onClick={downloadSvg}>
                    <FileImage aria-hidden />
                    Chart (SVG)
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {onExpand && plan.kind !== "empty" && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onExpand}
              aria-label="Full screen"
              title="Full screen"
            >
              <Maximize2 aria-hidden />
            </Button>
          )}
        </div>
      </figcaption>

      {plan.kind === "empty" && <p className="text-muted-foreground text-sm">No data for this query.</p>}

      {plan.kind === "number" && (
        <dl className="grid grid-cols-2 gap-3">
          {plan.values.map((v) => (
            <div key={v.label}>
              <dt className="text-muted-foreground text-xs">{v.label}</dt>
              <dd className={cn("readout font-semibold", expanded ? "text-4xl" : "text-2xl")}>
                {formatValue(v.value, v.format)}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {showsChart && (
        <div ref={chartRef}>
          <ChartView plan={plan} expanded={expanded} />
        </div>
      )}
      {(plan.kind === "table" || (chartable && view === "table")) && (
        <ResultTable result={result} expanded={expanded} />
      )}

      {"note" in plan && plan.note && <p className="text-muted-foreground text-xs">{plan.note}</p>}
      {result.truncated && (
        <p className="text-muted-foreground text-xs">
          Showing the first {result.rows.length} of {result.totalRows} rows.
        </p>
      )}
    </figure>
  );
}

type Planned = Extract<ReturnType<typeof planChart>, { kind: "bar" | "line" }>;

function ChartView({ plan, expanded }: { plan: Planned; expanded: boolean }) {
  // Inline the chart keeps a 4:3 box; full screen it fills most of the window.
  const box = expanded ? "h-[min(65dvh,560px)] w-full aspect-auto" : "aspect-[4/3] w-full";
  const config = Object.fromEntries(
    plan.series.map((s) => [s.key, { label: s.label, color: cssColor(s.color) }]),
  ) satisfies ChartConfig;
  const xFormat = (v: string | number) => formatValue(v, plan.x.format);
  const yFormat = (v: number) => axisValue(v, plan.format);
  const tooltip = (
    <ChartTooltip
      content={
        <ChartTooltipContent
          labelFormatter={(_, payload) => xFormat(payload?.[0]?.payload?.x)}
          formatter={(value, name) => (
            <div className="flex w-full justify-between gap-3">
              <span className="text-muted-foreground">{config[name as string]?.label ?? name}</span>
              <span className="readout font-medium">{formatValue(Number(value), plan.format)}</span>
            </div>
          )}
        />
      }
    />
  );
  const legend = plan.series.length > 1 ? <ChartLegend content={<ChartLegendContent />} /> : null;

  if (plan.kind === "line") {
    return (
      <ChartContainer config={config} className={box}>
        <LineChart data={plan.data} margin={{ left: 0, right: 8, top: 4 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="x" tickLine={false} axisLine={false} tickFormatter={xFormat} minTickGap={16} />
          <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={yFormat} />
          {tooltip}
          {legend}
          {plan.series.map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              type="monotone"
              stroke={`var(--color-${s.key})`}
              strokeWidth={2}
              dot={plan.data.length <= 12 ? { r: 3 } : false}
            />
          ))}
        </LineChart>
      </ChartContainer>
    );
  }

  if (plan.horizontal) {
    return (
      <ChartContainer
        config={config}
        className="w-full"
        style={{
          height: Math.max(
            expanded ? 240 : 120,
            plan.data.length * (plan.series.length * (expanded ? 28 : 18) + 14),
          ),
        }}
      >
        <BarChart data={plan.data} layout="vertical" margin={{ left: 0, right: 12 }}>
          <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={yFormat} />
          <YAxis
            type="category"
            dataKey="x"
            tickLine={false}
            axisLine={false}
            width={104}
            tickFormatter={xFormat}
          />
          {tooltip}
          {legend}
          {plan.series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              fill={`var(--color-${s.key})`}
              radius={[0, 4, 4, 0]}
              maxBarSize={18}
            >
              {plan.colorBars?.map((c, i) => (
                <Cell key={i} fill={cssColor(c)} />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer config={config} className={box}>
      <BarChart data={plan.data} margin={{ left: 0, right: 8, top: 4 }} barGap={2}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="x"
          tickLine={false}
          axisLine={false}
          tickFormatter={xFormat}
          interval={plan.data.length <= 12 ? 0 : "preserveStartEnd"}
          minTickGap={4}
        />
        <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={yFormat} />
        {tooltip}
        {legend}
        {plan.series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            fill={`var(--color-${s.key})`}
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          >
            {plan.colorBars?.map((c, i) => (
              <Cell key={i} fill={cssColor(c)} />
            ))}
          </Bar>
        ))}
      </BarChart>
    </ChartContainer>
  );
}

function ResultTable({ result, expanded }: { result: MetricsOutput; expanded: boolean }) {
  return (
    <div className={cn("overflow-auto rounded-sm border", expanded ? "max-h-[65dvh]" : "max-h-80")}>
      <Table>
        <TableHeader>
          <TableRow>
            {result.columns.map((c) => (
              <TableHead key={c.key} className={c.kind === "metric" ? "text-right" : undefined}>
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.rows.map((row, i) => (
            <TableRow key={i}>
              {result.columns.map((c) => (
                <TableCell key={c.key} className={c.kind === "metric" ? "readout text-right" : undefined}>
                  {formatValue(row[c.key], c.format)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
