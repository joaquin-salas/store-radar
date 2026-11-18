"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { ALL_STORES, DEFAULT_STORE, DEFAULT_VIEW, type Scope, type ViewId, parseNavPath } from "@/lib/nav";

export interface NavState {
  scope: Scope;
  view: ViewId;
  /** Last single store visited; used when a view that needs one store is opened from "All stores". */
  lastStore: string;
}

/** Current scope and view from the URL (defaults on pages outside `/<scope>/<view>`). */
export function useNavState(): NavState {
  const { scope, view } = parseNavPath(usePathname());
  const current = scope ?? DEFAULT_STORE;

  // The header lives in the root layout and survives navigation, so plain state
  // remembers the last single store. Updating it while rendering is React's
  // pattern for state derived from changing props.
  const [lastStore, setLastStore] = useState(current === ALL_STORES ? DEFAULT_STORE : current);
  if (current !== ALL_STORES && current !== lastStore) setLastStore(current);

  return { scope: current, view: view ?? DEFAULT_VIEW, lastStore };
}
