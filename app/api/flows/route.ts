import { json, parseScopedQuery } from "@/lib/api";
import { getFlows } from "@/lib/domain/service";
import { flowsQuerySchema } from "@/lib/domain/schemas";

export async function GET(request: Request) {
  const query = parseScopedQuery(request, { segment: flowsQuerySchema.shape.segment });
  if (!query.ok) return query.response;
  return json(getFlows(query.data));
}
