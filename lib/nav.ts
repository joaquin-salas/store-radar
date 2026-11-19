/**
 * App navigation: the store scope and the views shown in the header.
 * URLs are `/<scope>/<view>`, e.g. `/mad-granvia/live` or `/all/analytics`.
 * Pure data and helpers, shared by the header, the pages and next.config redirects.
 */
import { STORES, STORE_IDS } from "./domain/catalog";

/** Scope value meaning "the whole chain". */
export const ALL_STORES = "all";

/** A store id or `ALL_STORES`. */
export type Scope = string;

export const VIEW_IDS = ["live", "analytics", "visits", "customers", "flows"] as const;
export type ViewId = (typeof VIEW_IDS)[number];

export interface ViewDef {
  id: ViewId;
  label: string;
  /** The view can show the whole chain; otherwise it needs a single store. */
  allStores: boolean;
  /** Filtered by a date range (`?preset=` or `?from=&to=`), carried over when switching views. */
  usesRange: boolean;
  /** Built yet. Views that aren't show as disabled "Soon" tabs. */
  ready: boolean;
}

export const VIEWS: readonly ViewDef[] = [
  { id: "live", label: "Live", allStores: false, usesRange: false, ready: true },
  { id: "analytics", label: "Analytics", allStores: true, usesRange: true, ready: true },
  { id: "visits", label: "Visits", allStores: false, usesRange: false, ready: true },
  { id: "customers", label: "Customers", allStores: true, usesRange: false, ready: true },
  { id: "flows", label: "Flows", allStores: true, usesRange: true, ready: false },
];

export const DEFAULT_STORE = STORES[0].id;
export const DEFAULT_VIEW: ViewId = "live";

export const isStoreId = (value: string) => (STORE_IDS as readonly string[]).includes(value);
export const isScope = (value: string) => value === ALL_STORES || isStoreId(value);
export const isViewId = (value: string): value is ViewId => (VIEW_IDS as readonly string[]).includes(value);

export function getView(id: ViewId): ViewDef {
  return VIEWS.find((v) => v.id === id)!;
}

export const viewHref = (scope: Scope, view: ViewId) => `/${scope}/${view}`;

/** Scope and view from a pathname such as `/mad-granvia/live`; unknown parts are null. */
export function parseNavPath(pathname: string): { scope: Scope | null; view: ViewId | null } {
  const [scope = "", view = ""] = pathname.split("/").filter(Boolean);
  return {
    scope: isScope(scope) ? scope : null,
    view: isViewId(view) ? view : null,
  };
}

/** The scope to open `view` with: views that need one store swap "all" for `lastStore`. */
export function scopeForView(view: ViewId, scope: Scope, lastStore: string = DEFAULT_STORE): Scope {
  if (scope === ALL_STORES && !getView(view).allStores) return lastStore;
  return scope;
}

export function scopeLabel(scope: Scope): string {
  if (scope === ALL_STORES) return "All stores";
  return STORES.find((s) => s.id === scope)?.name ?? scope;
}
