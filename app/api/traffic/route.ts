import { z } from "zod";
import { json, parseScopedQuery } from "@/lib/api";
import { getTraffic } from "@/lib/domain/service";

export async function GET(request: Request) {
  const query = parseScopedQuery(request, { granularity: z.enum(["hour", "day"]).optional() });
  if (!query.ok) return query.response;
  return json(getTraffic(query.data));
}
