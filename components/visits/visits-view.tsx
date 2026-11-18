"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DateField } from "@/components/filters/date-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FloorPlan } from "@/lib/domain/layout";
import { VISIT_SEGMENTS } from "@/lib/domain/schemas";
import { localNow } from "@/lib/domain/time";
import { formatDateRange } from "@/lib/format";
import { useVisits } from "@/lib/queries";
import {
  SEGMENT_LABELS,
  VISITS_PAGE_SIZE,
  type VisitsParams,
  visitsFromSearch,
  visitsToSearch,
} from "@/lib/visits-params";
import { VisitSheet } from "./visit-sheet";
import { VisitsTable } from "./visits-table";

/** Every visit of one store-day, filterable and sortable; state lives in the URL. */
export function VisitsView({
  storeId,
  storeName,
  plan,
}: {
  storeId: string;
  storeName: string;
  plan: FloorPlan;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = visitsFromSearch(useSearchParams());
  const today = localNow().date;
  const date = params.date ?? today;
  const isToday = date === today;

  // The open visit isn't part of the list query, so opening one doesn't refetch the table.
  const { visit: openVisit, ...listParams } = params;
  const { data, isPending, isError } = useVisits({
    store: storeId,
    ...listParams,
    date,
    pageSize: VISITS_PAGE_SIZE,
  });

  // Filters reset to the first page; sorting and paging keep the rest.
  // Opening a visit adds a history entry, so Back closes the drawer.
  const update = (next: Partial<VisitsParams>, resetPage = true, push = false) => {
    const merged = { ...params, ...next, ...(resetPage ? { page: 0 } : {}) };
    // Today is the default, so keep it out of the URL.
    if (merged.date === today) merged.date = undefined;
    const href = `${pathname}${visitsToSearch(merged)}`;
    if (push) router.push(href, { scroll: false });
    else router.replace(href, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <DateField label="Date" value={date} max={today} onCommit={(d) => update({ date: d })} />
          {!isToday && (
            <Button variant="outline" onClick={() => update({ date: today })}>
              Today
            </Button>
          )}
        </div>
        <span className="text-muted-foreground text-sm tabular-nums">
          {formatDateRange(date, date)}
          {data ? ` · ${data.total.toLocaleString("en-GB")} visits` : ""}
        </span>
        {isToday && (
          <Badge variant="secondary" className="gap-1.5">
            <span className="bg-status-good size-1.5 animate-pulse rounded-full" aria-hidden />
            Live
          </Badge>
        )}
      </div>

      <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
        {VISIT_SEGMENTS.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={params.segment === s ? "secondary" : "ghost"}
            aria-pressed={params.segment === s}
            onClick={() => update({ segment: s })}
          >
            {SEGMENT_LABELS[s]}
          </Button>
        ))}
      </div>

      {isError ? (
        <p className="text-destructive text-sm">Couldn&apos;t load visits.</p>
      ) : (
        <VisitsTable
          page={data}
          loading={isPending}
          params={params}
          onSortChange={(sort, dir) => update({ sort, dir })}
          onPageChange={(page) => update({ page }, false)}
          onOpenVisit={(id) => update({ visit: id }, false, true)}
        />
      )}

      <VisitSheet
        visitId={openVisit}
        plan={plan}
        storeName={storeName}
        onClose={() => update({ visit: undefined }, false)}
      />
    </div>
  );
}
