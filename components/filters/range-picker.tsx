"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DateField } from "./date-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DateRange } from "@/lib/domain/range";
import { MAX_RANGE_DAYS, RANGE_PRESETS, type RangeInput } from "@/lib/domain/schemas";
import { addDays, diffDays, localNow } from "@/lib/domain/time";
import { PRESET_LABELS, withRange } from "@/lib/range-params";

const CUSTOM = "custom";
const items = [
  ...RANGE_PRESETS.map((p) => ({ value: p, label: PRESET_LABELS[p] })),
  { value: CUSTOM, label: "Custom range" },
];

/**
 * Date range filter, stored in the URL. A preset, or a custom range picked with
 * two date fields (up to today, at most MAX_RANGE_DAYS long).
 */
export function RangePicker({ range, resolved }: { range: RangeInput; resolved: DateRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const today = localNow().date;
  const isCustom = Boolean(range.from && range.to);

  const go = (next: RangeInput) =>
    router.replace(`${pathname}${withRange(new URLSearchParams(searchParams), next)}`, { scroll: false });

  // Keep the range valid when one end changes: move the other end if needed.
  const setFrom = (from: string) => {
    let to = resolved.to < from ? from : resolved.to;
    if (diffDays(from, to) >= MAX_RANGE_DAYS) to = addDays(from, MAX_RANGE_DAYS - 1);
    go({ from, to: to > today ? today : to });
  };
  const setTo = (to: string) => {
    let from = resolved.from > to ? to : resolved.from;
    if (diffDays(from, to) >= MAX_RANGE_DAYS) from = addDays(to, -(MAX_RANGE_DAYS - 1));
    go({ from, to });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        items={items}
        value={isCustom ? CUSTOM : (range.preset ?? RANGE_PRESETS[0])}
        onValueChange={(value) => {
          if (!value) return;
          // Custom starts from the dates currently shown.
          go(
            value === CUSTOM
              ? { from: resolved.from, to: resolved.to }
              : { preset: value as RangeInput["preset"] },
          );
        }}
      >
        <SelectTrigger className="w-40" aria-label="Date range">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} align="start">
          {RANGE_PRESETS.map((p) => (
            <SelectItem key={p} value={p}>
              {PRESET_LABELS[p]}
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value={CUSTOM}>Custom range</SelectItem>
        </SelectContent>
      </Select>
      {isCustom && (
        <div className="flex items-center gap-1.5">
          <DateField label="From" value={resolved.from} max={today} onCommit={setFrom} />
          <span className="text-muted-foreground text-sm" aria-hidden>
            –
          </span>
          <DateField label="To" value={resolved.to} max={today} onCommit={setTo} />
        </div>
      )}
    </div>
  );
}
