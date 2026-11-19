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
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type CustomersQuery, SEGMENT_LABELS } from "@/lib/domain/schemas";
import { localNow } from "@/lib/domain/time";
import { CUSTOMERS_PAGE_SIZE, type CustomersParams } from "@/lib/customers-params";
import { formatDateRange, formatDaysAgo, formatInt } from "@/lib/format";
import type { CustomersPage } from "@/lib/queries";

type CustomerRow = CustomersPage["rows"][number];

const features = tableFeatures({ rowSortingFeature, rowPaginationFeature });
const helper = createColumnHelper<typeof features, CustomerRow>();
const emptyRows: CustomerRow[] = [];

const columns = helper.columns([
  helper.accessor("name", {
    header: "Member",
    cell: ({ row }) => <MemberCell member={row.original} />,
  }),
  helper.accessor("tier", {
    header: "Tier",
    enableSorting: false,
    cell: (info) => (
      <Badge variant="outline" className="capitalize">
        {info.getValue()}
      </Badge>
    ),
  }),
  helper.accessor("homeStoreName", { header: "Home store", enableSorting: false }),
  helper.accessor("visits", {
    header: "Visits · 30 d",
    sortDescFirst: true,
    cell: (info) => <span className="tabular-nums">{formatInt(info.getValue())}</span>,
  }),
  helper.accessor("checkouts", {
    header: "Checkouts · 30 d",
    sortDescFirst: true,
    cell: (info) => <span className="tabular-nums">{formatInt(info.getValue())}</span>,
  }),
  helper.accessor("lastVisit", {
    header: "Last visit",
    sortDescFirst: true,
    cell: ({ row }) => <LastVisit member={row.original} />,
  }),
  helper.accessor("storesVisited", {
    header: "Stores · 90 d",
    enableSorting: false,
    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
  }),
  helper.accessor("memberSince", {
    header: "Member since",
    cell: (info) => <span className="tabular-nums">{formatDateRange(info.getValue(), info.getValue())}</span>,
  }),
]);

const resolve = <T,>(updater: Updater<T>, current: T): T =>
  typeof updater === "function" ? (updater as (old: T) => T)(current) : updater;

/** Loyalty members; sorting and paging happen on the server, state comes from the URL. */
export function CustomersTable({
  page,
  loading,
  params,
  onSortChange,
  onPageChange,
}: {
  page: CustomersPage | undefined;
  loading: boolean;
  params: CustomersParams;
  onSortChange: (sort: CustomersQuery["sort"], dir: CustomersQuery["dir"]) => void;
  onPageChange: (page: number) => void;
}) {
  const sorting: SortingState = [{ id: params.sort, desc: params.dir === "desc" }];
  const pagination: PaginationState = { pageIndex: params.page, pageSize: CUSTOMERS_PAGE_SIZE };

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
      if (next) onSortChange(next.id as CustomersQuery["sort"], next.desc ? "desc" : "asc");
    },
    onPaginationChange: (updater) => onPageChange(resolve(updater, pagination).pageIndex),
  });

  const total = page?.total ?? 0;
  const first = total === 0 ? 0 : params.page * CUSTOMERS_PAGE_SIZE + 1;
  const last = Math.min(total, (params.page + 1) * CUSTOMERS_PAGE_SIZE);

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
                No members match these filters.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id} className="px-3 align-top whitespace-normal">
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between gap-3 border-t px-3 py-2">
        <span className="text-muted-foreground text-sm tabular-nums">
          {total === 0 ? "0 members" : `${formatInt(first)}–${formatInt(last)} of ${formatInt(total)}`}
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

/** Name links to the profile; the profile keeps the page's store scope. */
function MemberCell({ member }: { member: CustomerRow }) {
  const pathname = usePathname();
  return (
    <span className="flex flex-col">
      <Link
        href={`${pathname}/${member.id}`}
        className="text-primary focus-visible:outline-ring rounded font-medium underline-offset-2 outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {member.name}
      </Link>
      <span className="text-muted-foreground font-mono text-xs">{member.id}</span>
    </span>
  );
}

function LastVisit({ member }: { member: CustomerRow }) {
  if (!member.lastVisit) return <span className="text-muted-foreground">Over 90 days ago</span>;
  return (
    <span className="flex flex-col">
      <span className="tabular-nums">{formatDaysAgo(member.lastVisit, localNow().date)}</span>
      <span className="text-muted-foreground text-xs">{SEGMENT_LABELS[member.segment]}</span>
    </span>
  );
}
