import { json, parseQuery } from "@/lib/api";
import { customersQuerySchema } from "@/lib/domain/schemas";
import { getCustomersPage } from "@/lib/domain/service";

export async function GET(request: Request) {
  const query = parseQuery(request, customersQuerySchema);
  if (!query.ok) return query.response;
  return json(getCustomersPage(query.data));
}
