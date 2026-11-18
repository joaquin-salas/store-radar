"use client";

import { Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { LiveSnapshot } from "@/lib/queries";
import { cn } from "@/lib/utils";

const MAX_ROWS = 8;
const TIER_LABEL = { gold: "Gold", silver: "Silver", bronze: "Bronze" } as const;

/** Loyalty members currently in the store: gold and silver first (clienteling). */
export function RegisteredInside({ live }: { live: LiveSnapshot | undefined }) {
  if (!live) return <Skeleton className="min-h-64 rounded-xl" />;

  const vip = live.registered.filter((r) => r.tier !== "bronze").length;
  const rows = live.registered.slice(0, MAX_ROWS);
  const hidden = live.registered.length - rows.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Loyalty members in store</CardTitle>
        <CardDescription>
          {live.registered.length === 0
            ? "No registered customers inside right now"
            : `${live.registered.length} inside now · ${vip} gold or silver`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length > 0 && (
          <ul className="divide-border flex flex-col divide-y text-sm">
            {rows.map((r) => (
              <li key={r.customerId} className="flex items-center gap-3 py-2">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-1.5 truncate font-medium">
                    {r.tier === "gold" && (
                      <Crown className="text-status-warning size-3.5 shrink-0" aria-hidden />
                    )}
                    {r.name}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {r.zoneLabel} · {r.minutesInside < 1 ? "just arrived" : `${r.minutesInside} min in store`}
                  </span>
                </span>
                <Badge
                  variant="outline"
                  className={cn(r.tier === "gold" && "border-status-warning/60", "shrink-0")}
                >
                  {TIER_LABEL[r.tier]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        {hidden > 0 && <p className="text-muted-foreground pt-2 text-xs">+{hidden} more members inside</p>}
      </CardContent>
    </Card>
  );
}
