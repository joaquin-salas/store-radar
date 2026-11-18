"use client";

import { AlertTriangle, CheckCircle2, OctagonAlert } from "lucide-react";
import { OccupancySparkline } from "@/components/live/occupancy-sparkline";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatHour, formatInt, formatPercent, relativeChange, safeRatio } from "@/lib/format";
import type { LiveSnapshot } from "@/lib/queries";
import { cn } from "@/lib/utils";

const WARNING_AT = 0.85;

export function RightNow({ live }: { live: LiveSnapshot | undefined }) {
  if (!live) return <Skeleton className="h-full min-h-80 rounded-xl" />;

  const zones = [...live.zones].sort((a, b) => b.fill - a.fill);
  const online = live.sensors.filter((s) => s.status === "online").length;
  const vsTypical = relativeChange(live.peopleInside, live.typicalInsideNow);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardDescription>Right now</CardDescription>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold tabular-nums">{live.peopleInside}</span>
          <span className="text-muted-foreground text-sm">
            of {live.capacity} people · {formatPercent(live.fill)} full
          </span>
        </div>
        <CapacityBar fill={live.fill} label="Store capacity used" />
        <p className="text-muted-foreground text-xs tabular-nums">
          {!live.openNow ? (
            <>
              Store closed
              {live.hoursToday
                ? ` · open ${formatHour(live.hoursToday.open)}–${formatHour(live.hoursToday.close)}`
                : " today"}
            </>
          ) : vsTypical === null ? (
            `A typical ${live.weekday} has nobody inside at this time`
          ) : (
            <>
              <span className="text-foreground font-medium">
                {vsTypical >= 0 ? "+" : "−"}
                {formatPercent(Math.abs(vsTypical))}
              </span>{" "}
              vs. a typical {live.weekday} at this time ({live.typicalInsideNow})
            </>
          )}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <OccupancySparkline series={live.series} weekday={live.weekday} />

        <Alerts alerts={live.alerts} />

        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs">Zones · people / capacity</p>
          <ul className="flex flex-col gap-2" aria-label="People per zone">
            {zones.map((z) => (
              <li key={z.zone} className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-2 text-sm">
                <span className="text-muted-foreground truncate">{z.label}</span>
                <CapacityBar fill={z.fill} label={`${z.label} capacity used`} />
                <span className="text-right tabular-nums">
                  {z.occupancy}/{z.capacity}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <NewVsReturning inside={live.peopleInside} returning={live.returningInside} />

        <Separator />

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground text-xs">Walk-ins, last 15 min</dt>
            <dd className="text-lg font-medium tabular-nums">{formatInt(live.recent.entrants)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Capture, last 15 min</dt>
            <dd className="text-lg font-medium tabular-nums">
              {formatPercent(safeRatio(live.recent.entrants, live.recent.street))}
            </dd>
          </div>
          <div className="text-muted-foreground col-span-2 flex items-center gap-2 text-xs">
            <span className="bg-status-good size-2 rounded-full" aria-hidden />
            Sensors: {online}/{live.sensors.length} online
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

/** Split bar: of the people inside, how many are new vs. returning visitors. */
function NewVsReturning({ inside, returning }: { inside: number; returning: number }) {
  const fresh = inside - returning;
  const returningShare = inside > 0 ? returning / inside : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-muted-foreground text-xs">Inside now · new vs. returning</p>
      {inside === 0 ? (
        <p className="text-muted-foreground text-xs">Nobody inside.</p>
      ) : (
        <>
          <div
            className="flex h-2 gap-0.5 overflow-hidden rounded-full"
            role="img"
            aria-label={`${fresh} new and ${returning} returning visitors inside`}
          >
            <span
              className="bg-chart-1 h-full rounded-l-full"
              style={{ width: `${(1 - returningShare) * 100}%` }}
            />
            <span
              className="bg-chart-2 h-full rounded-r-full"
              style={{ width: `${returningShare * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs tabular-nums">
            <span className="flex items-center gap-1.5">
              <span className="bg-chart-1 size-2 rounded-[2px]" aria-hidden />
              {fresh} new
            </span>
            <span className="flex items-center gap-1.5">
              <span className="bg-chart-2 size-2 rounded-[2px]" aria-hidden />
              {returning} returning · {formatPercent(returningShare)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/** Horizontal fill bar with a tick at the warning threshold. */
function CapacityBar({ fill, label }: { fill: number; label: string }) {
  const level = fill >= 1 ? "critical" : fill >= WARNING_AT ? "warning" : "ok";
  return (
    <span
      className="bg-muted relative block h-2 overflow-hidden rounded-full"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fill * 100)}
    >
      <span
        className={cn(
          "block h-full rounded-full transition-[width] duration-700",
          level === "critical"
            ? "bg-status-critical"
            : level === "warning"
              ? "bg-status-warning"
              : "bg-chart-1",
        )}
        style={{ width: `${Math.min(1, fill) * 100}%` }}
      />
      <span
        className="bg-foreground/40 absolute inset-y-0 w-px"
        style={{ left: `${WARNING_AT * 100}%` }}
        aria-hidden
      />
    </span>
  );
}

function Alerts({ alerts }: { alerts: LiveSnapshot["alerts"] }) {
  if (alerts.length === 0) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-xs">
        <CheckCircle2 className="text-status-good size-4" aria-hidden />
        No alerts · every zone is below 85% of capacity
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1.5" aria-label="Alerts">
      {alerts.map((a) => {
        const Icon = a.level === "critical" ? OctagonAlert : AlertTriangle;
        return (
          <li
            key={a.id}
            className={cn(
              "flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs",
              a.level === "critical"
                ? "border-status-critical/40 bg-status-critical/10"
                : "border-status-warning/50 bg-status-warning/10",
            )}
          >
            <Icon
              className={cn(
                "mt-px size-4 shrink-0",
                a.level === "critical" ? "text-status-critical" : "text-status-warning",
              )}
              aria-hidden
            />
            <span>
              <span className="font-medium">{a.title}</span>
              <span className="text-muted-foreground"> · {a.detail}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
