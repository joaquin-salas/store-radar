import { describe, expect, it } from "vitest";
import { formatChange, formatDateRange } from "./format";

describe("formatDateRange", () => {
  it("shortens ranges within a month or a year", () => {
    expect(formatDateRange("2026-11-18", "2026-11-18")).toBe("18 Nov 2026");
    expect(formatDateRange("2026-11-12", "2026-11-18")).toBe("12–18 Nov 2026");
    expect(formatDateRange("2026-10-20", "2026-11-18")).toBe("20 Oct – 18 Nov 2026");
    expect(formatDateRange("2025-12-20", "2026-01-18")).toBe("20 Dec 2025 – 18 Jan 2026");
  });
});

describe("formatChange", () => {
  it("signs changes and treats ones that round to zero as flat", () => {
    expect(formatChange(0.012)).toEqual({ text: "+1.2%", direction: "up" });
    expect(formatChange(-0.008)).toEqual({ text: "−0.8%", direction: "down" });
    expect(formatChange(-0.0002)).toEqual({ text: "0%", direction: "flat" });
    expect(formatChange(0)).toEqual({ text: "0%", direction: "flat" });
  });
});
