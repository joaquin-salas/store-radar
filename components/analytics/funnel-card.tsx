"use client";

import { ArrowDown } from "lucide-react";
import { Fragment } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatInt, formatPercent } from "@/lib/format";
import type { Funnel } from "@/lib/queries";

/**
 * The funnel from walking in to checkout. Passers-by are a headline rather
 * than a bar (they are ~10× the visitors and would flatten everything else);
 * bars are relative to visitors, with the conversion between nested steps.
 */
export function FunnelCard({ funnel }: { funnel: Funnel | undefined }) {
  const steps = funnel?.steps ?? [];
  const street = steps.find((s) => s.step === "street");
  const inside = steps.filter((s) => s.step !== "street");
  const base = inside[0]?.count ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>From street to checkout</CardTitle>
        <CardDescription className="tabular-nums">
          {street && base > 0
            ? `${formatInt(street.count)} passed by · ${formatPercent(base / street.count)} walked in`
            : "How many visitors reach each step"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!funnel ? (
          <Skeleton className="h-[260px] w-full rounded-lg" />
        ) : base === 0 ? (
          <p className="text-muted-foreground py-16 text-center text-sm">No visitors in this range.</p>
        ) : (
          <ol className="flex flex-col">
            {inside.map((s, i) => (
              <Fragment key={s.step}>
                {i > 0 && (
                  <li
                    aria-hidden
                    className="text-muted-foreground flex items-center gap-1 py-1 pl-1 text-xs tabular-nums"
                  >
                    {s.nested ? (
                      <>
                        <ArrowDown className="size-3" />
                        {formatPercent(s.fromPrevious)} continue
                      </>
                    ) : (
                      "Any route, with or without the fitting rooms"
                    )}
                  </li>
                )}
                <li>
                  <Tooltip>
                    <TooltipTrigger
                      render={<div className="grid gap-1 rounded-md outline-none" tabIndex={0} />}
                    >
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span>{s.label}</span>
                        <span className="tabular-nums">
                          <span className="font-medium">{formatInt(s.count)}</span>
                          <span className="text-muted-foreground ml-1.5 text-xs">
                            {formatPercent(s.count / base)}
                          </span>
                        </span>
                      </div>
                      <div className="bg-muted h-2.5 overflow-hidden rounded-[4px]">
                        <div
                          className="bg-chart-1 h-full rounded-[4px]"
                          style={{ width: `${Math.max((s.count / base) * 100, 0.5)}%` }}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="tabular-nums">
                      {s.label}: {formatInt(s.count)} · {formatPercent(s.count / base)} of visitors
                      {i > 0 && s.nested ? ` · ${formatPercent(s.fromPrevious)} of the step before` : ""}
                    </TooltipContent>
                  </Tooltip>
                </li>
              </Fragment>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
