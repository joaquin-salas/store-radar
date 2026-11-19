"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type KpiDef, KpiCards } from "@/components/dashboard/kpi-row";
import { RangePicker } from "@/components/filters/range-picker";
import { Badge } from "@/components/ui/badge";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { FlowKpis } from "@/lib/domain/flow-stats";
import { isLiveRange, previousRange, resolveRange } from "@/lib/domain/range";
import { FLOW_SEGMENTS, type FlowSegment } from "@/lib/domain/schemas";
import { localNow } from "@/lib/domain/time";
import { formatDateRange, formatInt, formatPercent } from "@/lib/format";
import { scopeLabel } from "@/lib/nav";
import { type FlowParams, useFlows } from "@/lib/queries";
import { comparisonLabel, rangeFromSearch } from "@/lib/range-params";
import { CrossStore } from "./cross-store";
import { JourneyChart } from "./journey-chart";
import { TopRoutes } from "./top-routes";
import { ZoneMoves } from "./zone-moves";

const SEGMENT_LABELS: Record<FlowSegment, string> = {
  all: "All visitors",
  new: "New",
  returning: "Returning",
  members: "Loyalty members",
};

const segmentFromSearch = (value: string | null): FlowSegment =>
  (FLOW_SEGMENTS as readonly string[]).includes(value ?? "") ? (value as FlowSegment) : "all";

const KPIS: KpiDef<FlowKpis>[] = [
  {
    label: "Finished visits",
    hint: "Visits that have ended",
    value: (k) => formatInt(k.visits),
    compare: (k) => k.visits,
  },
  {
    label: "Browsed",
    hint: "Visited at least one product zone",
    value: (k) => formatPercent(k.browsedShare),
    compare: (k) => k.browsedShare,
  },
  {
    label: "Zones per visit",
    hint: "Zones visited after the entrance, returns included",
    value: (k) => k.avgStops.toFixed(1),
    compare: (k) => k.avgStops,
  },
  {
    label: "Went back",
    hint: "Returned to a zone already seen",
    value: (k) => formatPercent(k.wentBackShare),
    compare: (k) => k.wentBackShare,
  },
  {
    label: "Tried on, then paid",
    hint: "Of fitting-room users, share who reached checkout",
    value: (k) => formatPercent(k.triedThenBoughtRate),
    compare: (k) => k.triedThenBoughtRate,
  },
  {
    label: "Left without buying",
    hint: "Never reached checkout",
    value: (k) => formatPercent(k.leftWithoutBuyingShare),
    compare: (k) => k.leftWithoutBuyingShare,
  },
];

/** How visitors move through one store or the whole chain over a date range from the URL. */
export function FlowsView({ scope }: { scope: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const range = rangeFromSearch(searchParams);
  const segment = segmentFromSearch(searchParams.get("segment"));
  const now = localNow();
  const resolved = resolveRange(range, now);
  const previous = previousRange(resolved);
  const live = isLiveRange(resolved, now);
  const params: FlowParams = { store: scope, ...range, segment };
  const { data, isError } = useFlows(params);

  const setSegment = (s: FlowSegment) => {
    const next = new URLSearchParams(searchParams);
    if (s === "all") next.delete("segment");
    else next.set("segment", s);
    const q = next.toString();
    router.replace(`${pathname}${q ? `?${q}` : ""}`, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <RangePicker range={range} resolved={resolved} />
        <span className="text-muted-foreground text-sm tabular-nums">
          {formatDateRange(resolved.from, resolved.to)} · {scopeLabel(scope)}
        </span>
        {live && <Badge variant="live">Live</Badge>}
      </div>

      <SegmentedControl
        label="Visitors"
        value={segment}
        options={FLOW_SEGMENTS.map((s) => ({ value: s, label: SEGMENT_LABELS[s] }))}
        onChange={setSegment}
        className="self-start"
      />

      {isError && <p className="text-destructive text-sm">Couldn&apos;t load flows.</p>}

      <section className="flex flex-col gap-2" aria-labelledby="flows-kpis">
        <h2 id="flows-kpis" className="text-muted-foreground text-sm font-medium">
          How people move{" "}
          <span className="font-normal">
            · finished visits, compared with {formatDateRange(previous.from, previous.to)}
            {live ? " up to the same time of day" : ""}
          </span>
        </h2>
        <KpiCards
          defs={KPIS}
          current={data?.kpis}
          previous={data?.previous}
          comparisonLabel={comparisonLabel(range, resolved)}
        />
      </section>

      <JourneyChart flows={data} />

      <div className="grid gap-4 @4xl:grid-cols-2">
        <ZoneMoves flows={data} />
        <TopRoutes flows={data} />
      </div>

      {data?.crossStore && <CrossStore data={data.crossStore} />}
    </div>
  );
}
