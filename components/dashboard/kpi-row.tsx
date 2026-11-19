"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Kpis } from "@/lib/domain/metrics";
import { formatChange, formatDuration, formatInt, formatPercent, relativeChange } from "@/lib/format";
import { type ScopeParams, useOverview } from "@/lib/queries";

export interface KpiDef<T = Kpis> {
  label: string;
  hint: string;
  value: (k: T) => string;
  /** Numeric value used for the comparison; omit for KPIs without a meaningful delta. */
  compare?: (k: T) => number;
}

const KPIS: KpiDef[] = [
  {
    label: "Visitors",
    hint: "People who walked in",
    value: (k) => formatInt(k.visitors),
    compare: (k) => k.visitors,
  },
  {
    label: "Capture rate",
    hint: "Visitors ÷ street passers-by",
    value: (k) => formatPercent(k.captureRate),
    compare: (k) => k.captureRate,
  },
  {
    label: "Avg dwell",
    hint: "Mean time inside per visit",
    value: (k) => formatDuration(k.avgDwellSec),
    compare: (k) => k.avgDwellSec,
  },
  {
    label: "Checkout rate",
    hint: "Visitors who reached checkout",
    value: (k) => formatPercent(k.checkoutRate),
    compare: (k) => k.checkoutRate,
  },
  {
    label: "Registered",
    hint: "Share of loyalty members",
    value: (k) => formatPercent(k.registeredShare),
    compare: (k) => k.registeredShare,
  },
  {
    label: "Returning",
    hint: "Visitors seen on an earlier day",
    value: (k) => formatPercent(k.returningShare),
    compare: (k) => k.returningShare,
  },
];

/** The store KPI cards with a comparison; pass `current`/`previous` or nothing while loading. */
export function KpiRow(props: {
  current: Kpis | undefined;
  previous: Kpis | undefined;
  comparisonLabel: string;
}) {
  return <KpiCards defs={KPIS} {...props} />;
}

/** A row of KPI cards for any set of definitions (six fit one row on wide pages). */
export function KpiCards<T>({
  defs,
  current,
  previous,
  comparisonLabel,
}: {
  defs: KpiDef<T>[];
  current: T | undefined;
  previous: T | undefined;
  comparisonLabel: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 @xl:grid-cols-3 @5xl:grid-cols-6">
      {defs.map((kpi) =>
        !current || !previous ? (
          <Skeleton key={kpi.label} className="h-[104px] rounded-xl" />
        ) : (
          <KpiCard
            key={kpi.label}
            kpi={kpi}
            current={current}
            previous={previous}
            comparisonLabel={comparisonLabel}
          />
        ),
      )}
    </div>
  );
}

/** KPI row fed by the overview endpoint (compares with the previous period). */
export function OverviewKpiRow({
  params,
  comparisonLabel,
}: {
  params: ScopeParams;
  comparisonLabel: string;
}) {
  const { data, isError } = useOverview(params);
  if (isError) return <p className="text-destructive text-sm">Couldn&apos;t load KPIs.</p>;
  return <KpiRow current={data?.kpis} previous={data?.previous} comparisonLabel={comparisonLabel} />;
}

function KpiCard<T>({
  kpi,
  current,
  previous,
  comparisonLabel,
}: {
  kpi: KpiDef<T>;
  current: T;
  previous: T;
  comparisonLabel: string;
}) {
  const ratio = kpi.compare ? relativeChange(kpi.compare(current), kpi.compare(previous)) : null;
  const change = ratio === null ? null : formatChange(ratio);
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription title={kpi.hint}>{kpi.label}</CardDescription>
        <CardTitle className="text-2xl! font-semibold tabular-nums">{kpi.value(current)}</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground text-xs tabular-nums">
        {change === null ? (
          kpi.hint
        ) : (
          <span className="flex items-center gap-1">
            {/* Direction is shown by icon + sign, not colour alone: more isn't always better. */}
            <ChangeIcon direction={change.direction} />
            <span className="text-foreground font-medium">{change.text}</span>
            <span className="truncate">{comparisonLabel}</span>
          </span>
        )}
      </CardContent>
    </Card>
  );
}

function ChangeIcon({ direction }: { direction: ReturnType<typeof formatChange>["direction"] }) {
  if (direction === "up") return <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />;
  if (direction === "down") return <ArrowDownRight className="size-3.5 shrink-0" aria-hidden />;
  return <Minus className="size-3.5 shrink-0" aria-hidden />;
}
