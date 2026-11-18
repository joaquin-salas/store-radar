"use client";

import { Input } from "@/components/ui/input";
import { isLocalDate } from "@/lib/domain/time";

/** Earliest date the picker offers. */
export const MIN_DATE = "2020-01-01";

/**
 * Date field that applies its value on blur or Enter. Typing a date fires a
 * change per finished segment (day, month, year), so applying on change would
 * navigate mid-typing. Remounts (via `key`) when the range changes elsewhere.
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
  const commit = (next: string) => {
    if (next !== value && isLocalDate(next) && next >= MIN_DATE && next <= max) onCommit(next);
  };
  return (
    <Input
      key={value}
      type="date"
      aria-label={label}
      defaultValue={value}
      min={MIN_DATE}
      max={max}
      onBlur={(e) => commit(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit(e.currentTarget.value);
      }}
      className="w-36 tabular-nums"
    />
  );
}
