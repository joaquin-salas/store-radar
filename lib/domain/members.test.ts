import { describe, expect, it } from "vitest";
import { allCustomers, getCustomer, memberBehaviour } from "./customers";
import { loadSummaries } from "./service";
import { type LocalDateTime, addDays } from "./time";
import type { CustomerTier } from "./types";

const NOW: LocalDateTime = {
  date: "2026-11-18",
  hour: 21,
  minute: 30,
  second: 0,
};
const DAYS = 60;

/** Member visits over the last DAYS days, chain-wide. */
function memberVisits() {
  const range = { from: addDays(NOW.date, -(DAYS - 1)), to: NOW.date };
  const out: { customerId: string; date: string; storeId: string }[] = [];
  for (const day of loadSummaries("all", range, NOW)) {
    for (const ref of day.customerVisits)
      out.push({
        customerId: ref.customerId,
        date: day.date,
        storeId: day.storeId,
      });
  }
  return out;
}

describe("loyalty members", () => {
  const visits = memberVisits();
  const perMember = new Map<string, number>();
  for (const v of visits) perMember.set(v.customerId, (perMember.get(v.customerId) ?? 0) + 1);

  it("never visit before joining or after they stopped shopping", () => {
    for (const v of visits) {
      const c = getCustomer(v.customerId)!;
      const b = memberBehaviour(v.customerId)!;
      expect(v.date >= c.memberSince).toBe(true);
      if (b.churnedOn) expect(v.date < b.churnedOn).toBe(true);
    }
  });

  it("have a realistic spread: regulars, occasional shoppers and lapsed members", () => {
    const counts = allCustomers().map((c) => perMember.get(c.id) ?? 0);
    const none = counts.filter((n) => n === 0).length / counts.length;
    expect(none).toBeGreaterThan(0.15);
    expect(none).toBeLessThan(0.45);
    // The most active 10% of members make a large share of member visits.
    const sorted = [...counts].sort((a, b) => b - a);
    const top = sorted.slice(0, sorted.length / 10).reduce((a, b) => a + b, 0);
    expect(top / visits.length).toBeGreaterThan(0.3);
  });

  it("visit more often in better tiers", () => {
    const avg = (tier: CustomerTier) => {
      const members = allCustomers().filter((c) => c.tier === tier);
      return members.reduce((a, c) => a + (perMember.get(c.id) ?? 0), 0) / members.length;
    };
    expect(avg("gold")).toBeGreaterThan(avg("silver") * 1.2);
    expect(avg("silver")).toBeGreaterThan(avg("bronze") * 1.2);
  });

  it("include recent joiners and mostly shop at their home store", () => {
    const recent = allCustomers().filter((c) => c.memberSince > addDays(NOW.date, -30)).length;
    expect(recent).toBeGreaterThan(20);
    const home = visits.filter((v) => getCustomer(v.customerId)!.homeStoreId === v.storeId).length;
    expect(home / visits.length).toBeGreaterThan(0.8);
  });
});
