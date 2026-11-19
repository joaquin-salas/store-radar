"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { type KpiDef, KpiCards } from "@/components/dashboard/kpi-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CUSTOMER_SEGMENTS, type CustomerSegment, SEGMENT_DAYS, SEGMENT_LABELS } from "@/lib/domain/schemas";
import {
  CUSTOMERS_PAGE_SIZE,
  type CustomersParams,
  customersFromSearch,
  customersToSearch,
} from "@/lib/customers-params";
import { formatDateRange, formatInt, formatPercent } from "@/lib/format";
import { scopeLabel } from "@/lib/nav";
import { type MemberOverview, useCustomers, useMemberOverview } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { CustomersTable } from "./customers-table";

type MemberKpis = MemberOverview["kpis"];

const KPIS: KpiDef<MemberKpis>[] = [
  {
    label: "Active members",
    hint: "Visited at least once in the window",
    value: (k) => formatInt(k.activeMembers),
    compare: (k) => k.activeMembers,
  },
  {
    label: "Member visits",
    hint: "Visits by these members, any store",
    value: (k) => formatInt(k.memberVisits),
    compare: (k) => k.memberVisits,
  },
  {
    label: "Visits per active member",
    hint: "Member visits ÷ active members",
    value: (k) => k.visitsPerActive.toFixed(1),
    compare: (k) => k.visitsPerActive,
  },
  {
    label: "Member checkout rate",
    hint: "Members' visits that reached checkout",
    value: (k) => formatPercent(k.memberCheckoutRate),
    compare: (k) => k.memberCheckoutRate,
  },
  {
    label: "Members' share of visits",
    hint: "Visits identified as members at these stores",
    value: (k) => formatPercent(k.memberVisitShare),
    compare: (k) => k.memberVisitShare,
  },
  {
    label: "New members",
    hint: "Joined in the window",
    value: (k) => formatInt(k.newMembers),
    compare: (k) => k.newMembers,
  },
];

const TIER_ITEMS = [
  { value: "all", label: "All tiers" },
  { value: "gold", label: "Gold" },
  { value: "silver", label: "Silver" },
  { value: "bronze", label: "Bronze" },
];

const SEGMENT_HINTS: Record<CustomerSegment, string> = {
  active: `Last visit within ${SEGMENT_DAYS.active} days`,
  lapsing: `Last visit ${SEGMENT_DAYS.active + 1}–${SEGMENT_DAYS.lapsing} days ago`,
  lapsed: `No visit in ${SEGMENT_DAYS.lapsing} days`,
};

/** Loyalty programme for one home store or the whole chain: KPIs, segments and members. */
export function CustomersView({ scope }: { scope: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = customersFromSearch(useSearchParams());
  const { data: overview, isError: overviewError } = useMemberOverview(scope);
  const { data, isPending, isError } = useCustomers({
    store: scope,
    ...params,
    pageSize: CUSTOMERS_PAGE_SIZE,
  });

  const update = (next: Partial<CustomersParams>, resetPage = true) => {
    const merged = { ...params, ...next, ...(resetPage ? { page: 0 } : {}) };
    router.replace(`${pathname}${customersToSearch(merged)}`, { scroll: false });
  };

  // Search applies as you type, after a short pause.
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onSearch = (value: string) => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => update({ q: value.trim() || undefined }), 300);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm tabular-nums">
        Loyalty members of {scope === "all" ? "all stores" : scopeLabel(scope)}
        {overview
          ? ` · ${formatInt(overview.kpis.members)} members · last 30 days, ${formatDateRange(overview.window.from, overview.window.to)}`
          : ""}
      </p>

      <section className="flex flex-col gap-2" aria-labelledby="member-kpis">
        <h2 id="member-kpis" className="text-muted-foreground text-sm font-medium">
          Programme{" "}
          {overview && (
            <span className="font-normal">
              · compared with {formatDateRange(overview.previousWindow.from, overview.previousWindow.to)} up
              to the same time of day · other visitors reach checkout{" "}
              {formatPercent(overview.kpis.otherCheckoutRate)} of the time
            </span>
          )}
        </h2>
        {overviewError ? (
          <p className="text-destructive text-sm">Couldn&apos;t load programme KPIs.</p>
        ) : (
          <KpiCards
            defs={KPIS}
            current={overview?.kpis}
            previous={overview?.previous}
            comparisonLabel="vs. prior 30 days"
          />
        )}
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="member-segments">
        <h2 id="member-segments" className="text-muted-foreground text-sm font-medium">
          Segments{" "}
          <span className="font-normal">· by last visit · select one to filter the members below</span>
        </h2>
        <div className="grid gap-3 @xl:grid-cols-3">
          {CUSTOMER_SEGMENTS.map((segment) => {
            const s = overview?.segments.find((x) => x.segment === segment);
            const selected = params.segment === segment;
            const share =
              s && overview
                ? s.total /
                  Math.max(
                    1,
                    overview.segments.reduce((a, x) => a + x.total, 0),
                  )
                : 0;
            return (
              <button
                key={segment}
                type="button"
                aria-pressed={selected}
                onClick={() => update({ segment: selected ? "all" : segment })}
                className={cn(
                  "bg-card shadow-card focus-visible:outline-ring flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2",
                  // Selected: the ping tint, like a selected row.
                  selected ? "border-ping bg-ping-soft" : "hover:bg-muted",
                )}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{SEGMENT_LABELS[segment]}</span>
                  <span className="text-muted-foreground text-xs">{SEGMENT_HINTS[segment]}</span>
                </span>
                <span className="flex items-baseline gap-2">
                  <span className="text-2xl font-semibold tabular-nums">{s ? formatInt(s.total) : "—"}</span>
                  {s && (
                    <span className="text-muted-foreground text-sm tabular-nums">{formatPercent(share)}</span>
                  )}
                </span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {s
                    ? `Gold ${formatInt(s.byTier.gold)} · Silver ${formatInt(s.byTier.silver)} · Bronze ${formatInt(s.byTier.bronze)}`
                    : " "}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-72">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            key={params.q ?? ""}
            type="search"
            aria-label="Search members by name or id"
            placeholder="Search name or id"
            defaultValue={params.q ?? ""}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select
          items={TIER_ITEMS}
          value={params.tier}
          onValueChange={(value) => value && update({ tier: value as CustomersParams["tier"] })}
        >
          <SelectTrigger className="w-36" aria-label="Tier">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} align="start">
            {TIER_ITEMS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(params.q || params.tier !== "all" || params.segment !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => update({ q: undefined, tier: "all", segment: "all" })}
          >
            <X aria-hidden /> Clear filters
          </Button>
        )}
      </div>

      {isError ? (
        <p className="text-destructive text-sm">Couldn&apos;t load members.</p>
      ) : (
        <CustomersTable
          page={data}
          loading={isPending}
          params={params}
          onSortChange={(sort, dir) => update({ sort, dir })}
          onPageChange={(page) => update({ page }, false)}
        />
      )}
    </div>
  );
}
