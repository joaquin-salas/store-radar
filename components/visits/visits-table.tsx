"use client";

import {
  type PaginationState,
  type SortingState,
  type Updater,
  createColumnHelper,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ZONE_LABELS } from "@/lib/domain/catalog";
import type { VisitsQuery } from "@/lib/domain/schemas";
import { formatDuration, formatInt } from "@/lib/format";
import type { VisitsPage } from "@/lib/queries";
import { VISITS_PAGE_SIZE, type VisitsParams } from "@/lib/visits-params";

type VisitRow = VisitsPage["rows"][number];

const features = tableFeatures({ rowSortingFeature, rowPaginationFeature });
const helper = createColumnHelper<typeof features, VisitRow>();
const emptyRows: VisitRow[] = [];

const columns = helper.columns([
  helper.accessor("enteredAt", {
    header: "Entered",
    cell: (info) => <span className="tabular-nums">{info.getValue().slice(0, 5)}</span>,
  }),
  helper.display({
    id: "visitor",
    header: "Visitor",
    cell: ({ row }) => <Visitor visit={row.original} />,
  }),
  helper.accessor("returning", {
    header: "Seen before",
    enableSorting: false,
    cell: (info) => (info.getValue() ? "Returning" : "New"),
  }),
  helper.accessor((v) => v.path.length, {
    id: "stops",
    header: "Path",
    sortDescFirst: true,
    cell: ({ row }) => <Path visit={row.original} />,
  }),
  helper.accessor("totalDwellSec", {
    header: "Time inside",
    sortDescFirst: true,
    cell: ({ row, getValue }) =>
      row.original.inside ? (
        <span className="flex flex-col">
          <span className="tabular-nums">{formatDuration(getValue())} so far</span>
          <span className="text-muted-foreground text-xs">Still inside</span>
        </span>
      ) : (
        <span className="tabular-nums">{formatDuration(getValue())}</span>
      ),
  }),
  helper.accessor("checkout", {
    header: "Checkout",
    enableSorting: false,
    cell: (info) =>
      info.getValue() ? (
        <span className="flex items-center gap-1">
          <Check className="size-3.5" aria-hidden /> Reached
        </span>
      ) : (
        <span className="text-muted-foreground">No</span>
      ),
  }),
]);

const resolve = <T,>(updater: Updater<T>, current: T): T =>
  typeof updater === "function" ? (updater as (old: T) => T)(current) : updater;

/** Visits of one store-day. Sorting and paging happen on the server; state comes from the URL. */
export function VisitsTable({
  page,
  loading,
  params,
  onSortChange,
  onPageChange,
  onOpenVisit,
}: {
  page: VisitsPage | undefined;
  loading: boolean;
  params: VisitsParams;
  onSortChange: (sort: VisitsQuery["sort"], dir: VisitsQuery["dir"]) => void;
  onPageChange: (page: number) => void;
  onOpenVisit: (visitId: string) => void;
}) {
  const sorting: SortingState = [{ id: params.sort, desc: params.dir === "desc" }];
  const pagination: PaginationState = { pageIndex: params.page, pageSize: VISITS_PAGE_SIZE };

  const table = useTable({
    features,
    columns,
    data: page?.rows ?? emptyRows,
    getRowId: (row) => row.id,
    rowCount: page?.total ?? 0,
    manualSorting: true,
    manualPagination: true,
    enableSortingRemoval: false,
    state: { sorting, pagination },
    onSortingChange: (updater) => {
      const [next] = resolve(updater, sorting);
      if (next) onSortChange(next.id as VisitsQuery["sort"], next.desc ? "desc" : "asc");
    },
    onPaginationChange: (updater) => onPageChange(resolve(updater, pagination).pageIndex),
  });

  const total = page?.total ?? 0;
  const first = total === 0 ? 0 : params.page * VISITS_PAGE_SIZE + 1;
  const last = Math.min(total, (params.page + 1) * VISITS_PAGE_SIZE);

  return (
    <Card className="gap-0 py-0">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                    className="px-3"
                  >
                    {header.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="hover:text-foreground focus-visible:outline-ring -mx-1 flex items-center gap-1 rounded px-1 outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
                      >
                        <table.FlexRender header={header} />
                        {sorted === "asc" ? (
                          <ArrowUp className="size-3.5" aria-hidden />
                        ) : sorted === "desc" ? (
                          <ArrowDown className="size-3.5" aria-hidden />
                        ) : (
                          <ArrowUpDown className="text-muted-foreground/60 size-3.5" aria-hidden />
                        )}
                      </button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading && !page ? (
            Array.from({ length: 8 }, (_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={columns.length} className="px-3">
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            ))
          ) : total === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-muted-foreground px-3 py-10 text-center">
                No visits match. The store may have been closed that day.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              // The whole row opens the visit for pointer users; the entry time is
              // the keyboard and screen-reader control.
              <TableRow key={row.id} onClick={() => onOpenVisit(row.original.id)} className="cursor-pointer">
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id} className="px-3 align-top whitespace-normal">
                    {cell.column.id === "enteredAt" ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenVisit(row.original.id);
                        }}
                        aria-label={`Open visit at ${row.original.enteredAt.slice(0, 5)}`}
                        className="text-primary focus-visible:outline-ring rounded font-medium underline-offset-2 outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                      >
                        <table.FlexRender cell={cell} />
                      </button>
                    ) : (
                      <table.FlexRender cell={cell} />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between gap-3 border-t px-3 py-2">
        <span className="text-muted-foreground text-sm tabular-nums">
          {total === 0 ? "0 visits" : `${formatInt(first)}–${formatInt(last)} of ${formatInt(total)}`}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft aria-hidden /> Previous
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Visitor({ visit }: { visit: VisitRow }) {
  if (visit.customerName) {
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="font-medium">{visit.customerName}</span>
        {visit.customerTier && (
          <Badge variant="outline" className="capitalize">
            {visit.customerTier}
          </Badge>
        )}
      </span>
    );
  }
  return (
    <span className="flex flex-col">
      <span className="text-muted-foreground">Anonymous</span>
      <span className="text-muted-foreground font-mono text-xs" title="Hashed device id">
        {visit.visitorId}
      </span>
    </span>
  );
}

/**
 * Zones after the entrance (every visit starts there), e.g. "Womenswear → Fitting rooms".
 * A visit still in progress ends in "→ …": the rest of its route isn't known yet.
 */
function Path({ visit }: { visit: VisitRow }) {
  const stops = visit.path.slice(1);
  if (stops.length === 0)
    return <span className="text-muted-foreground">{visit.inside ? "Entrance …" : "Entrance only"}</span>;
  return (
    <span className="block min-w-48 text-sm">
      {stops.map((s, i) => (
        <span key={i}>
          {i > 0 && (
            <span className="text-muted-foreground" aria-label="then">
              {" → "}
            </span>
          )}
          {ZONE_LABELS[s.zone]}
        </span>
      ))}
      {visit.inside && (
        <span className="text-muted-foreground" aria-label="and still going">
          {" → …"}
        </span>
      )}
    </span>
  );
}
