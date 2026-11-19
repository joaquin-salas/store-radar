import { cn } from "cn";

/**
 * The Store Radar mark: a radar scope standing on the shop floor (two half-dome
 * rings over a floor line) and one Ping sweep that has just caught someone.
 * Rings follow the text colour; only the sweep is orange.
 */
export function Mark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={cn("size-[26px] shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path d="M4 37h40" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M15.5 37a8.5 8.5 0 0 1 17 0" stroke="currentColor" strokeWidth="3.5" />
      <path d="M8 37a16 16 0 0 1 32 0" stroke="currentColor" strokeWidth="3.5" />
      <path d="M24 37 37.5 21.5" stroke="var(--ping)" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="37.5" cy="21.5" r="4" fill="var(--ping)" />
      <circle cx="24" cy="37" r="3.5" fill="currentColor" />
    </svg>
  );
}

/** The wordmark: "storeradar" in Archivo's wide cut, "store" heavy and "radar" regular. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn("font-wide text-[17px] leading-none tracking-[-0.01em] whitespace-nowrap", className)}
    >
      <span className="font-bold">store</span>
      <span className="font-normal">radar</span>
    </span>
  );
}
