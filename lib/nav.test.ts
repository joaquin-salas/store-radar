import { describe, expect, it } from "vitest";
import { STORES } from "./domain/catalog";
import {
  ALL_STORES,
  DEFAULT_STORE,
  VIEWS,
  VIEW_IDS,
  isScope,
  parseNavPath,
  scopeForView,
  scopeLabel,
  viewHref,
} from "./nav";

describe("nav", () => {
  it("defines every view id exactly once", () => {
    expect(VIEWS.map((v) => v.id).sort()).toEqual([...VIEW_IDS].sort());
  });

  it("accepts store ids and 'all' as scopes", () => {
    for (const s of STORES) expect(isScope(s.id)).toBe(true);
    expect(isScope(ALL_STORES)).toBe(true);
    expect(isScope("stores")).toBe(false);
  });

  it("parses scope and view from a pathname", () => {
    expect(parseNavPath("/bcn-pdg/live")).toEqual({ scope: "bcn-pdg", view: "live" });
    expect(parseNavPath("/all/analytics")).toEqual({ scope: "all", view: "analytics" });
    expect(parseNavPath("/vlc-colon")).toEqual({ scope: "vlc-colon", view: null });
    expect(parseNavPath("/")).toEqual({ scope: null, view: null });
    expect(parseNavPath("/nowhere/sideways")).toEqual({ scope: null, view: null });
  });

  it("swaps 'all' for a single store on views that need one", () => {
    expect(scopeForView("live", ALL_STORES)).toBe(DEFAULT_STORE);
    expect(scopeForView("live", ALL_STORES, "vlc-colon")).toBe("vlc-colon");
    expect(scopeForView("analytics", ALL_STORES, "vlc-colon")).toBe(ALL_STORES);
    expect(scopeForView("live", "bcn-pdg", "vlc-colon")).toBe("bcn-pdg");
  });

  it("builds hrefs and labels", () => {
    expect(viewHref("mad-granvia", "live")).toBe("/mad-granvia/live");
    expect(scopeLabel(ALL_STORES)).toBe("All stores");
    expect(scopeLabel("mad-granvia")).toBe("Madrid Gran Vía");
  });
});
