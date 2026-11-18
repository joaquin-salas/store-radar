import { describe, expect, it } from "vitest";
import { visitsFromSearch, visitsToSearch } from "./visits-params";

const qs = (s: string) => new URLSearchParams(s);

describe("visits params", () => {
  it("defaults everything when the URL is empty", () => {
    expect(visitsFromSearch(qs(""))).toEqual({
      date: undefined,
      segment: "all",
      sort: "enteredAt",
      dir: "desc",
      page: 0,
      visit: undefined,
    });
  });

  it("reads valid values and drops invalid ones field by field", () => {
    expect(
      visitsFromSearch(
        qs("date=2026-11-17&segment=returning&sort=stops&dir=asc&page=3&visit=bcn-pdg-20261117-00042"),
      ),
    ).toEqual({
      date: "2026-11-17",
      segment: "returning",
      sort: "stops",
      dir: "asc",
      page: 3,
      visit: "bcn-pdg-20261117-00042",
    });
    expect(visitsFromSearch(qs("date=2026-13-40&segment=vip&page=-2&dir=up&visit=../x"))).toEqual({
      date: undefined,
      segment: "all",
      sort: "enteredAt",
      dir: "desc",
      page: 0,
      visit: undefined,
    });
  });

  it("round-trips and leaves defaults out of the URL", () => {
    const p = visitsFromSearch(qs("date=2026-11-17&segment=checkout&page=2"));
    expect(visitsToSearch(p)).toBe("?date=2026-11-17&segment=checkout&page=2");
    expect(visitsToSearch(visitsFromSearch(qs("")))).toBe("");
  });
});
