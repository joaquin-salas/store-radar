"use client";

import { ChartColumn, Footprints, type LucideIcon, Radar, Users, Waypoints } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { VIEWS, type ViewId } from "@/lib/nav";
import { type NavState, hrefForView as hrefFor } from "./nav-state";

export const VIEW_ICONS: Record<ViewId, LucideIcon> = {
  live: Radar,
  analytics: ChartColumn,
  visits: Footprints,
  customers: Users,
  flows: Waypoints,
};

// Tabs fill the header's height; the active one gets the 2px Ping underline on its bottom edge.
const tabClass =
  "relative flex items-center gap-1.5 px-3 text-[13px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring [&_svg]:size-4";

/** View tabs (desktop). Views not built yet are shown disabled. */
export function ViewTabs({ nav }: { nav: NavState }) {
  return (
    <nav aria-label="Views" className="flex items-stretch gap-1 self-stretch">
      {VIEWS.map((v) => {
        const Icon = VIEW_ICONS[v.id];
        const content = (
          <>
            <Icon className="hidden xl:block" aria-hidden />
            {v.label}
          </>
        );
        if (!v.ready) {
          return (
            <Tooltip key={v.id}>
              <TooltipTrigger
                render={
                  <span
                    aria-disabled="true"
                    tabIndex={0}
                    className={`${tabClass} text-muted-foreground cursor-not-allowed opacity-45`}
                  />
                }
              >
                {content}
                <span className="sr-only"> (coming soon)</span>
              </TooltipTrigger>
              <TooltipContent side="bottom">{v.label} · coming soon</TooltipContent>
            </Tooltip>
          );
        }
        const active = v.id === nav.view;
        return (
          <Link
            key={v.id}
            href={hrefFor(nav, v.id)}
            aria-current={active ? "page" : undefined}
            className={`${tabClass} ${
              active
                ? "text-foreground after:bg-ping after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}

const viewItems = VIEWS.map((v) => ({ value: v.id, label: v.label }));

/** View picker (small screens), paired with the store picker. */
export function ViewSelect({ nav, className }: { nav: NavState; className?: string }) {
  const router = useRouter();
  return (
    <Select
      items={viewItems}
      value={nav.view}
      onValueChange={(value) => {
        if (value && value !== nav.view) router.push(hrefFor(nav, value));
      }}
    >
      <SelectTrigger className={className} aria-label="View">
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="end">
        {VIEWS.map((v) => {
          const Icon = VIEW_ICONS[v.id];
          return (
            <SelectItem key={v.id} value={v.id} disabled={!v.ready}>
              <Icon className="text-muted-foreground" aria-hidden />
              {v.label}
              {!v.ready && <span className="text-muted-foreground ml-auto text-xs">Soon</span>}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
