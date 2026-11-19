"use client";

import Link from "next/link";
import { ASSISTANT_SHORTCUT, useAssistant } from "@/components/assistant/assistant-context";
import { Mark, Wordmark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
    <header className="bg-card border-b">
      <div className="flex h-[52px] items-center gap-4 px-3 sm:px-4">
        <Brand />
        <div className="hidden min-w-0 items-center gap-4 self-stretch lg:flex">
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
    <header className="bg-card border-b">
      <div className="flex h-[52px] items-center gap-4 px-3 sm:px-4">
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
      className="text-foreground focus-visible:outline-ring flex shrink-0 items-center gap-2 rounded-md outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <Mark />
      {/* The wordmark hides between lg and xl, where the tabs need the room. */}
      <Wordmark className="lg:hidden xl:inline" />
    </Link>
  );
}

function AssistantToggle() {
  const { open, toggle } = useAssistant();
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="outline" onClick={toggle} aria-pressed={open} aria-label="Assistant" />}
      >
        {/* The one ping dot in the app: Ask starts something live. */}
        <span className="bg-ping size-1.5 rounded-full" aria-hidden />
        <span>Ask</span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {open ? "Close" : "Open"} assistant · {ASSISTANT_SHORTCUT.label}
      </TooltipContent>
    </Tooltip>
  );
}
