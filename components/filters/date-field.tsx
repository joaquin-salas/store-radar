"use client";

import { enGB } from "date-fns/locale";
import { CalendarDays, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateRange } from "@/lib/format";

/** Earliest date the picker offers. */
export const MIN_DATE = "2020-01-01";

// Local calendar dates as plain Dates at local midnight (no time-zone shifts).
const toDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Date picker in the app's theme: a trigger styled like the other selectors and
 * a calendar popover (English, weeks from Monday). Picking a day applies it at
 * once; days after `max` (today) or before MIN_DATE can't be picked.
 */
export function DateField({
  label,
  value,
  max,
  onCommit,
}: {
  label: string;
  value: string;
  max: string;
  onCommit: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const commit = (next: string) => {
    setOpen(false);
    if (next !== value && next >= MIN_DATE && next <= max) onCommit(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            aria-label={`${label}: ${formatDateRange(value, value)}`}
            className="font-medium"
          />
        }
      >
        <CalendarDays className="text-muted-foreground" aria-hidden />
        <span className="readout">{formatDateRange(value, value)}</span>
        <ChevronDown className="text-muted-foreground" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto gap-2 p-2">
        <Calendar
          mode="single"
          locale={enGB}
          weekStartsOn={1}
          selected={toDate(value)}
          defaultMonth={toDate(value)}
          startMonth={toDate(MIN_DATE)}
          endMonth={toDate(max)}
          disabled={[{ after: toDate(max) }, { before: toDate(MIN_DATE) }]}
          onSelect={(d) => d && commit(toIso(d))}
          autoFocus
        />
        <div className="flex justify-end border-t pt-2">
          <Button variant="ghost" size="sm" onClick={() => commit(max)} disabled={value === max}>
            Today
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
