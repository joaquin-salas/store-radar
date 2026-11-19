import { describe, expect, it } from "vitest";
import { allCustomers, getCustomer, memberBehaviour } from "./customers";
import { SEGMENT_DAYS } from "./members";
import { getCustomerProfile, getCustomersPage, getMemberOverview, getVisit, loadSummaries } from "./service";
import { type LocalDateTime, addDays, diffDays } from "./time";
import type { CustomerTier } from "./types";

const NOW: LocalDateTime = { date: "2026-11-18", hour: 21, minute: 30, second: 0 };
const DAYS = 60;

/** Member visits over the last DAYS days, chain-wide. */
function memberVisits() {
  const range = { from: addDays(NOW.date, -(DAYS - 1)), to: NOW.date };
  const out: { customerId: string; date: string; storeId: string }[] = [];
  for (const day of loadSummaries("all", range, NOW)) {
    for (const ref of day.customerVisits)
      out.push({ customerId: ref.customerId, date: day.date, storeId: day.storeId });
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

describe("member queries", () => {
  const base = {
    store: "all",
    tier: "all",
    segment: "all",
    sort: "visits",
    dir: "desc",
    page: 0,
    pageSize: 100,
  } as const;

  it("segments members by days since their last visit", () => {
    for (const r of getCustomersPage({ ...base, segment: "active" }, NOW).rows) {
      expect(diffDays(r.lastVisit!, NOW.date)).toBeLessThanOrEqual(SEGMENT_DAYS.active);
    }
    const lapsed = getCustomersPage({ ...base, segment: "lapsed", sort: "lastVisit" }, NOW).rows;
    expect(
      lapsed.every((r) => r.lastVisit === null || diffDays(r.lastVisit, NOW.date) > SEGMENT_DAYS.lapsing),
    ).toBe(true);
    const total = (["active", "lapsing", "lapsed"] as const)
      .map((segment) => getCustomersPage({ ...base, segment }, NOW).total)
      .reduce((a, b) => a + b, 0);
    expect(total).toBe(allCustomers().length);
  });

  it("reports programme KPIs that agree with the segments and the table", () => {
    const o = getMemberOverview({ store: "vlc-colon" }, NOW);
    const members = getCustomersPage({ ...base, store: "vlc-colon" }, NOW);
    expect(o.segments.reduce((a, s) => a + s.total, 0)).toBe(members.total);
    for (const s of o.segments) expect(s.byTier.bronze + s.byTier.silver + s.byTier.gold).toBe(s.total);
    const k = o.kpis;
    expect(k.activeMembers).toBeLessThanOrEqual(k.members);
    expect(k.memberVisitShare).toBeGreaterThan(0.08);
    expect(k.memberVisitShare).toBeLessThan(0.25);
    // Members are mostly returning visitors, who reach the till more often.
    expect(k.memberCheckoutRate).toBeGreaterThan(k.otherCheckoutRate);
    expect(o.previous.memberVisits).toBeGreaterThan(0);
  });

  it("builds a profile consistent with the table row", () => {
    const row = getCustomersPage({ ...base, tier: "gold" }, NOW).rows[0];
    const p = getCustomerProfile(row.id, NOW)!;
    expect(p.visits30).toBe(row.visits);
    expect(p.lastVisit).toBe(row.lastVisit);
    expect(p.segment).toBe(row.segment);
    expect(p.calendar).toHaveLength(90);
    expect(p.calendar.reduce((a, d) => a + d.visits, 0)).toBe(p.visits90);
    expect(p.recentVisits[0].date).toBe(row.lastVisit);
    expect(p.stores.reduce((a, s) => a + s.share, 0)).toBeCloseTo(1);
    expect(p.recentVisits[0].visitId).toMatch(/^[a-z-]+-\d{8}-\d{5}$/);
    expect(getCustomerProfile("C99999", NOW)).toBeNull();
  });

  it("links profile visits to real visits", () => {
    const row = getCustomersPage({ ...base, segment: "active" }, NOW).rows[5];
    const past = getCustomerProfile(row.id, NOW)!.recentVisits.find((v) => v.date < NOW.date)!;
    const visit = getVisit(past.visitId, NOW)!;
    expect(visit.customerId).toBe(row.id);
    expect(visit.checkout).toBe(past.checkout);
  });
});
