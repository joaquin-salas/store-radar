"use client";

import { Radar, Sparkles } from "lucide-react";
import Link from "next/link";
import { ASSISTANT_SHORTCUT, useAssistant } from "@/components/assistant/assistant-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CHAIN, STORES } from "@/lib/domain/catalog";
import { useNavState } from "./nav-state";
import { StoreSelect } from "./store-select";
import { ViewSelect, ViewTabs } from "./view-nav";

/**
 * App header: brand, store and view pickers, assistant toggle and theme.
 * One row on desktop; on small screens the pickers move to a second row.
 */
export function AppHeader() {
  const nav = useNavState();

  return (
    <header className="bg-background border-b">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
        <Brand />
        <div className="hidden min-w-0 items-center gap-3 lg:flex">
          <StoreSelect nav={nav} />
          <ViewTabs nav={nav} />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <AssistantToggle />
          <ThemeToggle />
        </div>
      </div>
      <div className="flex gap-2 px-3 pb-3 sm:px-4 lg:hidden">
        <StoreSelect nav={nav} className="min-w-0 flex-[3] font-medium" />
        <ViewSelect nav={nav} className="min-w-0 flex-[2]" />
      </div>
    </header>
  );
}

/** Static header shown while the URL-dependent parts load. */
export function AppHeaderFallback() {
  return (
    <header className="bg-background border-b">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
        <Brand />
      </div>
    </header>
  );
}

function Brand() {
  return (
    <Link
      href="/"
      aria-label="Store Radar home"
      className="focus-visible:ring-ring/50 flex shrink-0 items-center gap-2 rounded-lg outline-none focus-visible:ring-3"
    >
      <span className="flex size-8 items-center justify-center rounded-lg text-white [background:var(--brand-gradient)]">
        <Radar className="size-4" aria-hidden />
      </span>
      {/* The name hides between lg and xl, where the tabs need the room. */}
      <span className="grid leading-tight lg:hidden xl:grid">
        <span className="text-sm font-semibold">Store Radar</span>
        <span className="text-muted-foreground text-xs">
          {CHAIN.name} · {STORES.length} stores
        </span>
      </span>
    </Link>
  );
}

function AssistantToggle() {
  const { open, toggle } = useAssistant();
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant={open ? "secondary" : "ghost"}
            onClick={toggle}
            aria-pressed={open}
            aria-label="Assistant"
            className="gap-1.5"
          />
        }
      >
        <Sparkles className="text-primary size-4" aria-hidden />
        <span className="hidden sm:inline">Ask</span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {open ? "Close" : "Open"} assistant · {ASSISTANT_SHORTCUT.label}
      </TooltipContent>
    </Tooltip>
  );
}
