"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  ALL_STORES,
  DEFAULT_STORE,
  DEFAULT_VIEW,
  type Scope,
  type ViewId,
  getView,
  parseNavPath,
  scopeForView,
  viewHref,
} from "@/lib/nav";
import { rangeQuery } from "@/lib/range-params";

export interface NavState {
  scope: Scope;
  view: ViewId;
  /** Last single store visited; used when a view that needs one store is opened from "All stores". */
  lastStore: string;
  /** Current query string ("?…" or ""), kept when switching store. */
  query: string;
  /** Date range to carry to views that use one: the current one, or the last one used. */
  rangeQuery: string;
}

/** Current scope and view from the URL (defaults on pages outside `/<scope>/<view>`). */
export function useNavState(): NavState {
  const { scope, view: parsedView } = parseNavPath(usePathname());
  const searchParams = useSearchParams();
  const current = scope ?? DEFAULT_STORE;
  const view = parsedView ?? DEFAULT_VIEW;

  // The header lives in the root layout and survives navigation, so plain state
  // remembers the last store and range. Updating it while rendering is React's
  // pattern for state derived from changing props.
  const [lastStore, setLastStore] = useState(current === ALL_STORES ? DEFAULT_STORE : current);
  if (current !== ALL_STORES && current !== lastStore) setLastStore(current);

  const currentRange = getView(view).usesRange ? rangeQuery(searchParams) : null;
  const [lastRange, setLastRange] = useState(currentRange ?? "");
  if (currentRange !== null && currentRange !== lastRange) setLastRange(currentRange);

  const search = searchParams.toString();
  return {
    scope: current,
    view,
    lastStore,
    query: search ? `?${search}` : "",
    rangeQuery: currentRange ?? lastRange,
  };
}

/** Link to `view` from the current state: right scope, and the range when the view uses one. */
export function hrefForView(nav: NavState, view: ViewId): string {
  const base = viewHref(scopeForView(view, nav.scope, nav.lastStore), view);
  return getView(view).usesRange ? base + nav.rangeQuery : base;
}

/** Link to the current view in another scope, keeping the query string. */
export const hrefForScope = (nav: NavState, scope: Scope) => viewHref(scope, nav.view) + nav.query;
