import { describe, expect, it } from "vitest";
import { STORES, getStore } from "./catalog";
import { generateDay } from "./generator";
import { getLiveSnapshot } from "./live";
import { getOverview, getVisitsPage } from "./service";
import { addDays, type LocalDateTime } from "./time";

const NOW: LocalDateTime = { date: "2026-11-18", hour: 18, minute: 0, second: 0 };
const granVia = getStore("mad-granvia")!;
const valencia = getStore("vlc-colon")!;

describe("new vs. returning visitors", () => {
  it("has realistic returning shares, higher in local stores than tourist ones", () => {
    const share = (storeId: string) =>
      getOverview({ store: storeId, range: { preset: "30d" } }, NOW).kpis.returningShare;
    for (const s of STORES) {
      expect(share(s.id)).toBeGreaterThan(0.2);
      expect(share(s.id)).toBeLessThan(0.6);
    }
    expect(share("vlc-colon")).toBeGreaterThan(share("mad-granvia"));
  });

  it("has fewer returning visitors at weekends", () => {
    const share = (from: string, to: string) =>
      getOverview({ store: "all", range: { from, to } }, NOW).kpis.returningShare;
    // Four Saturdays vs. the four Wednesdays before them.
    const saturdays = [0, 7, 14, 21].map((d) => addDays("2026-11-14", -d));
    const weekdayShare = saturdays.reduce((s, sat) => s + share(addDays(sat, -3), addDays(sat, -3)), 0) / 4;
    const weekendShare = saturdays.reduce((s, sat) => s + share(sat, sat), 0) / 4;
    expect(weekendShare).toBeLessThan(weekdayShare);
  });

  it("almost always marks registered members as returning", () => {
    const visits = generateDay(granVia, "2026-11-10").visits.filter((v) => v.customerId);
    const returning = visits.filter((v) => v.returning).length / visits.length;
    expect(returning).toBeGreaterThan(0.8);
  });

  it("reuses device ids across days for returning anonymous visitors only", () => {
    const seen = new Map<string, Set<string>>();
    for (let d = 0; d < 21; d++) {
      const date = addDays("2026-11-17", -d);
      for (const v of generateDay(valencia, date).visits) {
        if (v.customerId) continue;
        const key = `${v.returning ? "R" : "N"}|${v.visitorId}`;
        (seen.get(key) ?? seen.set(key, new Set()).get(key)!).add(date);
      }
    }
    const multiDay = (prefix: string) =>
      [...seen].filter(([k, dates]) => k.startsWith(prefix) && dates.size > 1).length;
    expect(multiDay("R|")).toBeGreaterThan(50); // known devices come back on other days
    expect(multiDay("N|")).toBe(0); // a new device is never seen on another day
  });

  it("filters the visits table by segment and reports returning people inside", () => {
    const base = {
      store: "mad-granvia",
      segment: "all",
      sort: "enteredAt",
      dir: "desc",
      page: 0,
      pageSize: 50,
    } as const;
    const all = getVisitsPage({ ...base, date: "2026-11-17" }, NOW).total;
    const fresh = getVisitsPage({ ...base, date: "2026-11-17", segment: "new" }, NOW);
    const back = getVisitsPage({ ...base, date: "2026-11-17", segment: "returning" }, NOW);
    expect(fresh.total + back.total).toBe(all);
    expect(fresh.rows.every((r) => !r.returning)).toBe(true);
    expect(back.rows.every((r) => r.returning)).toBe(true);

    const snap = getLiveSnapshot("mad-granvia", NOW);
    expect(snap.returningInside).toBeGreaterThan(0);
    expect(snap.returningInside).toBeLessThan(snap.peopleInside);
  });
});
