import { json } from "@/lib/api";
import { visitIdSchema } from "@/lib/domain/schemas";
import { getVisit } from "@/lib/domain/service";

export async function GET(_request: Request, ctx: RouteContext<"/api/visits/[visitId]">) {
  const { visitId } = await ctx.params;
  const parsed = visitIdSchema.safeParse(visitId);
  const visit = parsed.success ? getVisit(parsed.data) : null;
  if (!visit) return Response.json({ error: `Unknown visit: ${visitId}` }, { status: 404 });
  return json(visit);
}
