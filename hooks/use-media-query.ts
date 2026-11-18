import { useCallback, useSyncExternalStore } from "react";

/** Whether a CSS media query matches. False during server rendering. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Desktop layout: the assistant docks beside the page instead of opening as a sheet. */
export const DESKTOP_QUERY = "(min-width: 1024px)";
