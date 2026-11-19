/**
 * Members table state in the page URL: `?q=&tier=&segment=&sort=&dir=&page=`.
 * Same keys and values as `/api/customers`; invalid values fall back to defaults
 * one by one. The home store comes from the page scope, not the query string.
 */
import { z } from "zod";
import { CUSTOMER_SEGMENTS, CUSTOMER_SORT_FIELDS, type CustomersQuery } from "./domain/schemas";

export const CUSTOMERS_PAGE_SIZE = 25;

export type CustomersParams = Omit<CustomersQuery, "store" | "pageSize">;

const fields = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  tier: z.enum(["all", "bronze", "silver", "gold"]).catch("all"),
  segment: z.enum(["all", ...CUSTOMER_SEGMENTS]).catch("all"),
  sort: z.enum(CUSTOMER_SORT_FIELDS).catch("visits"),
  dir: z.enum(["asc", "desc"]).catch("desc"),
  page: z.coerce.number().int().min(0).catch(0),
});

type SearchLike = Pick<URLSearchParams, "get">;

export function customersFromSearch(search: SearchLike): CustomersParams {
  const get = (k: string) => search.get(k) ?? undefined;
  const parsed = fields.parse({
    q: get("q"),
    tier: get("tier"),
    segment: get("segment"),
    sort: get("sort"),
    dir: get("dir"),
    page: get("page"),
  });
  return { ...parsed, q: parsed.q || undefined };
}

/** Query string for the table state, leaving out defaults. */
export function customersToSearch(p: CustomersParams): string {
  const s = new URLSearchParams();
  if (p.q) s.set("q", p.q);
  if (p.tier !== "all") s.set("tier", p.tier);
  if (p.segment !== "all") s.set("segment", p.segment);
  if (p.sort !== "visits") s.set("sort", p.sort);
  if (p.dir !== "desc") s.set("dir", p.dir);
  if (p.page > 0) s.set("page", String(p.page));
  const out = s.toString();
  return out ? `?${out}` : "";
}
