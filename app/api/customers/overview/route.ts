import { json, parseQuery } from "@/lib/api";
import { memberOverviewQuerySchema } from "@/lib/domain/schemas";
import { getMemberOverview } from "@/lib/domain/service";

export async function GET(request: Request) {
  const query = parseQuery(request, memberOverviewQuerySchema);
  if (!query.ok) return query.response;
  return json(getMemberOverview(query.data));
}
