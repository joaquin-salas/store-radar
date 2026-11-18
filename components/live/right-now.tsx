"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatHour, formatInt, formatPercent, safeRatio } from "@/lib/format";
import type { LiveSnapshot } from "@/lib/queries";

export function RightNow({ live }: { live: LiveSnapshot | undefined }) {
  if (!live) return <Skeleton className="h-full min-h-80 rounded-xl" />;

  const zones = [...live.zones].sort((a, b) => b.occupancy - a.occupancy);
  const max = Math.max(1, ...zones.map((z) => z.occupancy));
  const online = live.sensors.filter((s) => s.status === "online").length;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardDescription>Right now</CardDescription>
        <CardTitle className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold tabular-nums">{live.peopleInside}</span>
          <span className="text-muted-foreground text-sm font-normal">people inside</span>
        </CardTitle>
        {!live.openNow && (
          <p className="text-muted-foreground text-xs">
            Store closed
            {live.hoursToday
              ? ` · opens ${formatHour(live.hoursToday.open)}–${formatHour(live.hoursToday.close)}`
              : " today"}
          </p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2" aria-label="People per zone">
          {zones.map((z) => (
            <li key={z.zone} className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-2 text-sm">
              <span className="text-muted-foreground truncate">{z.label}</span>
              <span className="bg-muted h-2 overflow-hidden rounded-full">
                <span
                  className="bg-chart-1 block h-full rounded-full transition-[width] duration-700"
                  style={{ width: `${(z.occupancy / max) * 100}%` }}
                />
              </span>
              <span className="text-right tabular-nums">{z.occupancy}</span>
            </li>
          ))}
        </ul>

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
