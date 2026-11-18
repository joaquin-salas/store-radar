"use client";

import { Check, Footprints, Timer, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { FloorPlan } from "@/lib/domain/layout";
import { formatDateRange, formatDuration } from "@/lib/format";
import { type VisitDetail, useVisit } from "@/lib/queries";
import { VisitPlan } from "./visit-plan";

const hhmm = (t: string) => t.slice(0, 5);

/** Detail of one visit: who, the route on the plan and a timeline of stops. */
export function VisitSheet({
  visitId,
  plan,
  storeName,
  onClose,
}: {
  visitId: string | undefined;
  plan: FloorPlan;
  storeName: string;
  onClose: () => void;
}) {
  const { data, isPending, isError } = useVisit(visitId);

  return (
    <Sheet open={Boolean(visitId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="gap-0 overflow-y-auto data-[side=right]:w-[min(30rem,100vw)] data-[side=right]:sm:max-w-none"
      >
        <SheetHeader className="border-b pr-12">
          <SheetTitle>{data ? `Visit at ${hhmm(data.enteredAt)}` : "Visit"}</SheetTitle>
          <SheetDescription>
            {data ? `${formatDateRange(data.date, data.date)} · ${storeName}` : storeName}
          </SheetDescription>
        </SheetHeader>

        {isError ? (
          <p className="text-destructive p-4 text-sm">Couldn&apos;t load this visit. It may not exist.</p>
        ) : isPending || !data ? (
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="aspect-[3/2] w-full rounded-lg" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <VisitBody visit={data} plan={plan} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function VisitBody({ visit, plan }: { visit: VisitDetail; plan: FloorPlan }) {
  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex flex-col gap-1.5">
        {visit.customerName ? (
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{visit.customerName}</span>
            {visit.customerTier && (
              <Badge variant="outline" className="capitalize">
                {visit.customerTier} member
              </Badge>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">
            Anonymous visitor ·{" "}
            <span className="font-mono text-xs" title="Hashed device id">
              {visit.visitorId}
            </span>
          </span>
        )}
        <span className="text-muted-foreground text-sm">
          {visit.returning ? "Returning visitor (seen on an earlier day)" : "First visit from this device"}
        </span>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-sm">
        <Fact icon={Timer} label="Time inside" value={formatDuration(visit.totalDwellSec)} />
        <Fact icon={Footprints} label="Zones" value={String(visit.timeline.length)} />
        <Fact
          icon={visit.checkout ? Check : X}
          label="Checkout"
          value={visit.checkout ? "Reached" : "Not reached"}
        />
      </dl>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Route</h3>
        <div className="bg-muted/40 rounded-lg border p-2">
          <VisitPlan plan={plan} stops={visit.timeline.map((s) => s.zone)} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Timeline</h3>
        <ol className="flex flex-col">
          {visit.timeline.map((stop, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex flex-col items-center">
                <span className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                  {i + 1}
                </span>
                <span className="bg-border w-px flex-1" aria-hidden />
              </span>
              <span className="flex flex-1 items-baseline justify-between gap-3 pb-4">
                <span className="font-medium">{stop.label}</span>
                <span className="text-muted-foreground text-sm tabular-nums">
                  {hhmm(stop.enteredAt)} · {formatDuration(stop.dwellSec)}
                </span>
              </span>
            </li>
          ))}
          <li className="flex gap-3">
            <span className="flex w-6 justify-center">
              <span className="border-muted-foreground size-2.5 rounded-full border-2" aria-hidden />
            </span>
            <span className="text-muted-foreground flex flex-1 justify-between gap-3 text-sm">
              <span>{visit.leftAt ? "Left the store" : "Still inside · updating"}</span>
              {visit.leftAt && <span className="tabular-nums">{hhmm(visit.leftAt)}</span>}
            </span>
          </li>
        </ol>
      </div>
    </div>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof Timer; label: string; value: string }) {
  return (
    <div className="bg-muted/40 flex flex-col gap-0.5 rounded-lg border px-3 py-2">
      <dt className="text-muted-foreground flex items-center gap-1 text-xs">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
