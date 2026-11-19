import { json, parseScopedQuery } from "@/lib/api";
import { getWeekdayHours } from "@/lib/domain/service";

export async function GET(request: Request) {
  const query = parseScopedQuery(request);
  if (!query.ok) return query.response;
  return json(getWeekdayHours(query.data));
}
