import { describe, expect, it } from "vitest";
import { comparisonLabel, rangeFromSearch, rangeQuery, rangeToSearch, withRange } from "./range-params";

const qs = (s: string) => new URLSearchParams(s);

describe("range params", () => {
  it("reads presets and custom ranges", () => {
    expect(rangeFromSearch(qs("preset=30d"))).toEqual({ preset: "30d" });
    expect(rangeFromSearch(qs("from=2026-11-01&to=2026-11-10"))).toEqual({
      from: "2026-11-01",
      to: "2026-11-10",
    });
  });

  it("prefers a valid custom range over a preset", () => {
    expect(rangeFromSearch(qs("preset=today&from=2026-11-01&to=2026-11-10"))).toEqual({
      from: "2026-11-01",
      to: "2026-11-10",
    });
  });

  it("falls back to the default for missing or invalid values", () => {
    expect(rangeFromSearch(qs(""))).toEqual({ preset: "7d" });
    expect(rangeFromSearch(qs("preset=90d"))).toEqual({ preset: "7d" });
    expect(rangeFromSearch(qs("preset=90d"), "30d")).toEqual({ preset: "30d" });
    // Reversed, malformed and too-long custom ranges are rejected.
    expect(rangeFromSearch(qs("from=2026-11-10&to=2026-11-01"))).toEqual({ preset: "7d" });
    expect(rangeFromSearch(qs("from=yesterday&to=2026-11-01"))).toEqual({ preset: "7d" });
    expect(rangeFromSearch(qs("from=2026-01-01&to=2026-11-01&preset=yesterday"))).toEqual({
      preset: "yesterday",
    });
  });

  it("writes ranges back, keeping other keys", () => {
    expect(rangeToSearch({ preset: "today" })).toEqual({ preset: "today" });
    expect(withRange(qs("tab=x&preset=7d"), { from: "2026-11-01", to: "2026-11-02" })).toBe(
      "?tab=x&from=2026-11-01&to=2026-11-02",
    );
    expect(withRange(qs("from=2026-11-01&to=2026-11-02"), { preset: "30d" })).toBe("?preset=30d");
  });

  it("extracts only the range keys", () => {
    expect(rangeQuery(qs("preset=30d&page=2"))).toBe("?preset=30d");
    expect(rangeQuery(qs("page=2"))).toBe("");
  });

  it("labels the comparison period", () => {
    expect(comparisonLabel({ preset: "today" }, { from: "2026-11-18", to: "2026-11-18" })).toBe(
      "vs. yesterday",
    );
    expect(comparisonLabel({ preset: "yesterday" }, { from: "2026-11-17", to: "2026-11-17" })).toBe(
      "vs. prior day",
    );
    expect(comparisonLabel({ preset: "7d" }, { from: "2026-11-12", to: "2026-11-18" })).toBe(
      "vs. prior 7 days",
    );
  });
});
