"use client";

import { cn } from "cn";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Picks one of two to five options that filter what the page shows (range
 * presets, visitor segments, Chord/Matrix). The chosen option fills with
 * `primary`. More options or long names: use Select.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
  stretch = false,
}: {
  /** Accessible name of the group, e.g. "Visitors". */
  label: string;
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  /** Fill the container's width with equal segments (phones). */
  stretch?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "border-line-control bg-card inline-flex max-w-full gap-0.5 overflow-x-auto rounded-md border p-0.5",
        stretch && "grid w-full auto-cols-fr grid-flow-col",
        className,
      )}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "focus-visible:outline-ring h-[22px] rounded-xs px-2 text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 max-sm:h-8",
              on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
