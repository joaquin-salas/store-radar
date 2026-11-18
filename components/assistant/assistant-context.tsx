"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/use-media-query";

/**
 * Whether the assistant panel is open. On desktop it docks beside the page and
 * the choice is remembered in this browser; on smaller screens it opens as a
 * sheet over the page and always starts closed.
 */
export interface AssistantState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  /** Docked beside the page (desktop) rather than a sheet. */
  docked: boolean;
}

/** Only the sheet state is shared through context; see `useAssistant` for why. */
const SheetContext = createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null);

// --- Remembered desktop state (per-browser convenience; falls back to memory) ---

const STORAGE_KEY = "store-radar:assistant-open";
const listeners = new Set<() => void>();
let memoryOpen = false;

function readDocked(): boolean {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === null ? memoryOpen : value === "1";
  } catch {
    return memoryOpen;
  }
}

function writeDocked(open: boolean) {
  memoryOpen = open;
  try {
    localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
  } catch {
    // Storage blocked (private mode, previews): keep it in memory only.
  }
  for (const l of listeners) l();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Keyboard shortcut that toggles the panel, shown in tooltips. */
export const ASSISTANT_SHORTCUT = { key: "i", label: "Ctrl I" } as const;

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const sheet = useMemo(() => ({ open, setOpen }), [open]);
  return (
    <SheetContext value={sheet}>
      <AssistantShortcut />
      {children}
    </SheetContext>
  );
}

function AssistantShortcut() {
  const { toggle } = useAssistant();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        !e.shiftKey &&
        e.key.toLowerCase() === ASSISTANT_SHORTCUT.key
      ) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);
  return null;
}

/**
 * Assistant open state. Each caller subscribes to the stored value itself rather
 * than reading it from context: parts of the page that hydrate later (inside
 * Suspense) then start from the server value too, so hydration always matches.
 */
export function useAssistant(): AssistantState {
  const sheet = use(SheetContext);
  if (!sheet) throw new Error("useAssistant must be used inside <AssistantProvider>");
  const docked = useMediaQuery(DESKTOP_QUERY);
  const dockedOpen = useSyncExternalStore(subscribe, readDocked, () => false);

  const open = docked ? dockedOpen : sheet.open;
  const { setOpen: setSheetOpen } = sheet;
  const setOpen = useCallback(
    (next: boolean) => (docked ? writeDocked(next) : setSheetOpen(next)),
    [docked, setSheetOpen],
  );
  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);
  return { open, setOpen, toggle, docked };
}
