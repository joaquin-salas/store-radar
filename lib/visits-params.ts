/**
 * Visits table state in the page URL: `?date=&segment=&sort=&dir=&page=`.
 * Same keys and values as `/api/visits`; invalid values fall back to defaults
 * one by one, so a bad `page` doesn't reset the chosen date.
 */
import { z } from "zod";
import { VISIT_ID_PATTERN, VISIT_SEGMENTS, VISIT_SORT_FIELDS, type VisitsQuery } from "./domain/schemas";
import { isLocalDate } from "./domain/time";

export const VISITS_PAGE_SIZE = 25;

export const SEGMENT_LABELS: Record<VisitsQuery["segment"], string> = {
  all: "All",
  registered: "Members",
  anonymous: "Anonymous",
  new: "New",
  returning: "Returning",
  checkout: "Reached checkout",
};

const fields = z.object({
  segment: z.enum(VISIT_SEGMENTS).catch("all"),
  sort: z.enum(VISIT_SORT_FIELDS).catch("enteredAt"),
  dir: z.enum(["asc", "desc"]).catch("desc"),
  page: z.coerce.number().int().min(0).catch(0),
});

export type VisitsParams = Omit<VisitsQuery, "store" | "pageSize"> & {
  /** Visit open in the detail drawer. */
  visit?: string;
};

type SearchLike = Pick<URLSearchParams, "get">;

export function visitsFromSearch(search: SearchLike): VisitsParams {
  const date = search.get("date");
  const parsed = fields.parse({
    segment: search.get("segment") ?? undefined,
    sort: search.get("sort") ?? undefined,
    dir: search.get("dir") ?? undefined,
    page: search.get("page") ?? undefined,
  });
  const visit = search.get("visit");
  return {
    ...parsed,
    date: date && isLocalDate(date) ? date : undefined,
    visit: visit && VISIT_ID_PATTERN.test(visit) ? visit : undefined,
  };
}

/** Query string for the table state, leaving out defaults to keep URLs short. */
export function visitsToSearch(p: VisitsParams): string {
  const s = new URLSearchParams();
  if (p.date) s.set("date", p.date);
  if (p.segment !== "all") s.set("segment", p.segment);
  if (p.sort !== "enteredAt") s.set("sort", p.sort);
  if (p.dir !== "desc") s.set("dir", p.dir);
  if (p.page > 0) s.set("page", String(p.page));
  if (p.visit) s.set("visit", p.visit);
  const out = s.toString();
  return out ? `?${out}` : "";
}
