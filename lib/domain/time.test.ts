import { describe, expect, it } from "vitest";
import { addDays, dayOfWeek, diffDays, eachDay, isLocalDate, localNow } from "./time";

describe("time", () => {
  it("converts UTC instants to Madrid local time (CET and CEST)", () => {
    expect(localNow(new Date("2026-11-18T10:30:15Z"))).toEqual({
      date: "2026-11-18",
      hour: 11,
      minute: 30,
      second: 15,
    });
    expect(localNow(new Date("2026-07-01T22:30:00Z"))).toMatchObject({ date: "2026-07-02", hour: 0 });
  });

  it("does date arithmetic across month, year and DST boundaries", () => {
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(diffDays("2026-11-01", "2026-11-18")).toBe(17);
    expect(eachDay("2026-11-16", "2026-11-18")).toEqual(["2026-11-16", "2026-11-17", "2026-11-18"]);
  });

  it("knows weekdays and validates dates", () => {
    expect(dayOfWeek("2026-11-18")).toBe(3); // Wednesday
    expect(dayOfWeek("2026-11-22")).toBe(0); // Sunday
    expect(isLocalDate("2026-02-29")).toBe(false);
    expect(isLocalDate("2028-02-29")).toBe(true);
  });
});
