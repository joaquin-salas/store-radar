import { json, parseQuery } from "@/lib/api";
import { visitStatsQuerySchema } from "@/lib/domain/schemas";
import { getVisitStats } from "@/lib/domain/service";

export async function GET(request: Request) {
  const query = parseQuery(request, visitStatsQuerySchema);
  if (!query.ok) return query.response;
  return json(getVisitStats(query.data));
}
