"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Kpis } from "@/lib/domain/metrics";
import { formatDuration, formatInt, formatPercent } from "@/lib/format";
import { viewHref } from "@/lib/nav";
import type { StoreComparison as StoreComparisonData } from "@/lib/queries";
import { rangeQuery } from "@/lib/range-params";

const COLUMNS: { label: string; value: (k: Kpis) => string; wide?: boolean }[] = [
  { label: "Capture", value: (k) => formatPercent(k.captureRate) },
  { label: "Avg dwell", value: (k) => formatDuration(k.avgDwellSec), wide: true },
  { label: "Checkout", value: (k) => formatPercent(k.checkoutRate) },
  { label: "Returning", value: (k) => formatPercent(k.returningShare), wide: true },
];

/**
 * The three stores side by side for the same range. The selected store is
 * marked; each name opens that store's analytics with the same range.
 */
export function StoreComparison({ data, scope }: { data: StoreComparisonData | undefined; scope: string }) {
  const search = useSearchParams();
  const max = Math.max(1, ...(data?.stores.map((s) => s.kpis.visitors) ?? []));

  return (
    <Card className="@container/stores">
      <CardHeader>
        <CardTitle>Stores compared</CardTitle>
        <CardDescription>Same range for every store · bar shows visitors</CardDescription>
      </CardHeader>
      <CardContent>
        {!data ? (
          <Skeleton className="h-[200px] w-full rounded-lg" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Store</TableHead>
                <TableHead className="text-right">Visitors</TableHead>
                {COLUMNS.map((c) => (
                  <TableHead
                    key={c.label}
                    className={`text-right ${c.wide ? "hidden @lg/stores:table-cell" : ""}`}
                  >
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.stores.map((s) => {
                const current = s.storeId === scope;
                return (
                  <TableRow key={s.storeId} data-state={current ? "selected" : undefined}>
                    <TableCell className="whitespace-normal">
                      <Link
                        href={`${viewHref(s.storeId, "analytics")}${rangeQuery(search)}`}
                        className="font-medium hover:underline"
                        aria-current={current ? "page" : undefined}
                      >
                        {s.name}
                      </Link>
                      <span className="text-muted-foreground block text-xs">{s.city}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="font-medium">{formatInt(s.kpis.visitors)}</span>
                      <span className="bg-muted mt-1 ml-auto block h-1.5 w-20 overflow-hidden rounded-full">
                        <span
                          className="bg-chart-1 block h-full rounded-full"
                          style={{ width: `${(s.kpis.visitors / max) * 100}%` }}
                        />
                      </span>
                    </TableCell>
                    {COLUMNS.map((c) => (
                      <TableCell
                        key={c.label}
                        className={`text-right tabular-nums ${c.wide ? "hidden @lg/stores:table-cell" : ""}`}
                      >
                        {c.value(s.kpis)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
