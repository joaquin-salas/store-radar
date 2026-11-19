"use client";

import { Fragment } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ZONE_LABELS } from "@/lib/domain/catalog";
import { formatDuration, formatInt, formatPercent } from "@/lib/format";
import type { Flows } from "@/lib/queries";
import { zoneColor } from "./flow-colors";

/** The most common routes, with how often each ends at checkout. */
export function TopRoutes({ flows }: { flows: Flows | undefined }) {
  return (
    <Card className="@container/routes">
      <CardHeader>
        <CardTitle>Most common routes</CardTitle>
        <CardDescription className="tabular-nums">
          Zones between the entrance and checkout or leaving
          {flows && flows.top.routes.length > 0
            ? ` · these ${flows.top.routes.length} cover ${formatPercent(flows.top.coveredShare)} of visits`
            : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!flows ? (
          <Skeleton className="h-[360px] w-full rounded-lg" />
        ) : flows.top.routes.length === 0 ? (
          <p className="text-muted-foreground py-16 text-center text-sm">No finished visits in this range.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route</TableHead>
                <TableHead className="text-right">Visits</TableHead>
                <TableHead className="text-right">Checkout</TableHead>
                <TableHead className="hidden text-right @lg/routes:table-cell">Avg time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flows.top.routes.map((r) => (
                <TableRow key={r.key}>
                  <TableCell className="whitespace-normal">
                    <RouteSteps zones={r.zones} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="font-medium">{formatPercent(r.share)}</span>
                    <span className="text-muted-foreground block text-xs">{formatInt(r.visits)}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercent(r.checkoutRate)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums @lg/routes:table-cell">
                    {formatDuration(r.avgDwellSec)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function RouteSteps({ zones }: { zones: Flows["top"]["routes"][number]["zones"] }) {
  if (zones.length === 0) return <span className="text-muted-foreground">Left from the entrance</span>;
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
      {zones.map((z, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <span className="text-muted-foreground" aria-label="then">
              →
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: zoneColor(z) }} aria-hidden />
            {ZONE_LABELS[z]}
          </span>
        </Fragment>
      ))}
    </span>
  );
}
