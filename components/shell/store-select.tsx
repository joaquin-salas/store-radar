"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CHAIN, STORES } from "@/lib/domain/catalog";
import { ALL_STORES, getView } from "@/lib/nav";
import { useStores } from "@/lib/queries";
import { type NavState, hrefForScope } from "./nav-state";

const items = [
  { value: ALL_STORES, label: "All stores" },
  ...STORES.map((s) => ({ value: s.id, label: s.name })),
];

/** Store scope picker. Switching store keeps the current view. */
export function StoreSelect({ nav, className }: { nav: NavState; className?: string }) {
  const router = useRouter();
  const { data } = useStores();
  const view = getView(nav.view);
  const openNow = new Map(data?.stores.map((s) => [s.id, s.status.openNow]));

  return (
    <Select
      items={items}
      value={nav.scope}
      onValueChange={(value) => {
        if (value && value !== nav.scope) router.push(hrefForScope(nav, value));
      }}
    >
      <SelectTrigger className={className ?? "w-64 font-medium"} aria-label="Store">
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="start" className="min-w-64">
        <SelectItem value={ALL_STORES} disabled={!view.allStores}>
          <span className="flex flex-col">
            <span>All stores</span>
            <span className="text-muted-foreground text-xs">
              {view.allStores
                ? `${CHAIN.name} · ${STORES.length} stores`
                : `${view.label} shows one store at a time`}
            </span>
          </span>
        </SelectItem>
        <SelectSeparator />
        {STORES.map((s) => {
          const open = openNow.get(s.id);
          return (
            <SelectItem key={s.id} value={s.id}>
              <span className="flex flex-1 items-center justify-between gap-3">
                <span>{s.name}</span>
                {open !== undefined && (
                  <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <span
                      className={
                        open
                          ? "bg-status-good size-1.5 rounded-full"
                          : "bg-muted-foreground size-1.5 rounded-full"
                      }
                      aria-hidden
                    />
                    {open ? "Open" : "Closed"}
                  </span>
                )}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
