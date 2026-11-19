import type { Metadata } from "next";
import Link from "next/link";
import { Mark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { DEFAULT_STORE, DEFAULT_VIEW, viewHref } from "@/lib/nav";

export const metadata: Metadata = { title: "Page not found · Store Radar" };

/** Unknown stores, views, members or paths; shown inside the app frame. */
export default function NotFound() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-center">
      <Mark className="text-foreground size-12" />
      <p className="readout text-muted-foreground text-sm">404</p>
      <h1 className="font-wide text-2xl font-bold">Page not found</h1>
      <p className="text-muted-foreground max-w-sm text-sm text-balance">
        That store, view or member doesn&apos;t exist. Pick a store and a view in the header, or start from
        the flagship store.
      </p>
      <Link href={viewHref(DEFAULT_STORE, DEFAULT_VIEW)} className={buttonVariants()}>
        Go to Madrid Gran Vía
      </Link>
    </div>
  );
}
