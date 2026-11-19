import { describe, expect, it } from "vitest";
import { customersFromSearch, customersToSearch } from "./customers-params";

const qs = (s: string) => new URLSearchParams(s);

describe("customers params", () => {
  it("defaults everything and leaves defaults out of the URL", () => {
    const p = customersFromSearch(qs(""));
    expect(p).toEqual({ q: undefined, tier: "all", segment: "all", sort: "visits", dir: "desc", page: 0 });
    expect(customersToSearch(p)).toBe("");
  });

  it("reads valid values, drops invalid ones field by field and round-trips", () => {
    const p = customersFromSearch(
      qs("q=garc%C3%ADa&tier=gold&segment=lapsing&sort=lastVisit&dir=asc&page=2"),
    );
    expect(p).toEqual({
      q: "garcía",
      tier: "gold",
      segment: "lapsing",
      sort: "lastVisit",
      dir: "asc",
      page: 2,
    });
    expect(customersFromSearch(qs(customersToSearch(p).slice(1)))).toEqual(p);
    expect(customersFromSearch(qs("tier=platinum&segment=x&page=-1&q=%20%20"))).toEqual({
      q: undefined,
      tier: "all",
      segment: "all",
      sort: "visits",
      dir: "desc",
      page: 0,
    });
  });
});
