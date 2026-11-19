"use client";

import { useState } from "react";
import { heatStyle } from "@/components/dashboard/heat";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatHour, formatInt } from "@/lib/format";
import type { WeekdayHours } from "@/lib/queries";

const LONG: Record<string, string> = {
  Mon: "Mondays",
  Tue: "Tuesdays",
  Wed: "Wednesdays",
  Thu: "Thursdays",
  Fri: "Fridays",
  Sat: "Saturdays",
  Sun: "Sundays",
};

interface Focus {
  row: number;
  col: number;
}

/**
 * When it's busy: average visitors per weekday × hour, one blue ramp. Hovering
 * or focusing a cell reads it out below the grid; each cell also has a title.
 */
export function WeekdayHeatmap({ data }: { data: WeekdayHours | undefined }) {
  const [focus, setFocus] = useState<Focus | null>(null);
  const readout = (() => {
    if (!data) return null;
    if (!focus) return "Hover a cell for its average.";
    const row = data.rows[focus.row];
    const hour = data.hours[focus.col];
    const v = row.values[focus.col];
    const when = `${LONG[row.label]} ${formatHour(hour)}–${formatHour(hour + 1)}`;
    if (v === null) return `${when}: closed`;
    return `${when}: ${formatInt(v)} visitors on average (${row.dates} ${row.dates === 1 ? "day" : "days"})`;
  })();
  // A weekday × hour pattern needs (nearly) every weekday: 6 of 7 allows a store closed on Sundays.
  const fullWeek = data ? data.rows.filter((r) => r.dates > 0).length >= 6 : false;
  const fewWeeks = data ? Math.min(...data.rows.filter((r) => r.dates > 0).map((r) => r.dates)) < 2 : false;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Busiest times</CardTitle>
        <CardDescription>
          Average visitors per hour by weekday
          {fewWeeks ? " · pick 30 days for a steadier pattern; some weekdays have one day or none" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!data ? (
          <Skeleton className="h-[230px] w-full rounded-lg" />
        ) : !fullWeek ? (
          <p className="text-muted-foreground py-16 text-center text-sm">
            Pick a range of 7 days or more to see the weekly pattern.
          </p>
        ) : data.hours.length === 0 ? (
          <p className="text-muted-foreground py-16 text-center text-sm">Closed for the whole range.</p>
        ) : (
          <>
            <div className="overflow-x-auto" onMouseLeave={() => setFocus(null)}>
              <table className="w-full min-w-[560px] table-fixed border-separate border-spacing-0.5 text-xs tabular-nums">
                <caption className="sr-only">
                  Average visitors per hour, rows are weekdays, columns are hours
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="w-10" />
                    {data.hours.map((h, i) => (
                      <th
                        key={h}
                        scope="col"
                        className="text-muted-foreground px-0 pb-1 text-center font-normal"
                      >
                        {i % 2 === 0 ? String(h).padStart(2, "0") : ""}
                        <span className="sr-only">{i % 2 === 0 ? ":00" : formatHour(h)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r, ri) => (
                    <tr key={r.weekday}>
                      <th scope="row" className="text-muted-foreground pr-2 text-left font-medium">
                        {r.label}
                      </th>
                      {r.values.map((v, ci) => {
                        const active = focus?.row === ri && focus.col === ci;
                        return (
                          <td
                            key={ci}
                            tabIndex={0}
                            title={v === null ? "Closed" : `${formatInt(v)} visitors`}
                            onMouseEnter={() => setFocus({ row: ri, col: ci })}
                            onFocus={() => setFocus({ row: ri, col: ci })}
                            className={`h-7 rounded-[4px] outline-none ${active ? "ring-foreground ring-2" : ""} ${
                              v === null ? "bg-muted/40" : ""
                            }`}
                            style={v === null ? undefined : heatStyle(v, data.max)}
                          >
                            <span className="sr-only">{v === null ? "closed" : formatInt(v)}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <p className="text-muted-foreground tabular-nums" aria-live="polite">
                {readout}
              </p>
              <div className="text-muted-foreground flex items-center gap-1.5" aria-hidden>
                Fewer
                {[1, 2, 3, 4, 5].map((s) => (
                  <span key={s} className="size-3 rounded-[3px]" style={{ background: `var(--heat-${s})` }} />
                ))}
                More
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
