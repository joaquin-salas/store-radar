import { json, parseQuery } from "@/lib/api";
import { visitsQuerySchema } from "@/lib/domain/schemas";
import { getVisitsPage } from "@/lib/domain/service";

export async function GET(request: Request) {
  const query = parseQuery(request, visitsQuerySchema);
  if (!query.ok) return query.response;
  return json(getVisitsPage(query.data));
}
