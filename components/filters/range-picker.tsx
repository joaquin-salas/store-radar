"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DateField } from "./date-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { DateRange } from "@/lib/domain/range";
import { MAX_RANGE_DAYS, RANGE_PRESETS, type RangePreset, type RangeInput } from "@/lib/domain/schemas";
import { addDays, diffDays, localNow } from "@/lib/domain/time";
import { withRange } from "@/lib/range-params";

const CUSTOM = "custom" as const;
type Choice = RangePreset | typeof CUSTOM;

/** Short labels: the segments sit in one row. */
const SHORT: Record<Choice, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "7 days",
  "30d": "30 days",
  custom: "Custom",
};
const options = ([...RANGE_PRESETS, CUSTOM] as Choice[]).map((value) => ({ value, label: SHORT[value] }));

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
      <SegmentedControl<Choice>
        label="Date range"
        value={isCustom ? CUSTOM : (range.preset ?? RANGE_PRESETS[0])}
        options={options}
        onChange={(value) =>
          // Custom starts from the dates currently shown.
          go(value === CUSTOM ? { from: resolved.from, to: resolved.to } : { preset: value })
        }
      />
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
