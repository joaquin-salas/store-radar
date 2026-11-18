import { json } from "@/lib/api";
import { getLiveSnapshot } from "@/lib/domain/live";
import { storeIdSchema } from "@/lib/domain/schemas";

export async function GET(_request: Request, ctx: RouteContext<"/api/stores/[storeId]/live">) {
  const { storeId } = await ctx.params;
  const parsed = storeIdSchema.safeParse(storeId);
  if (!parsed.success) return Response.json({ error: `Unknown store: ${storeId}` }, { status: 404 });
  return json(getLiveSnapshot(parsed.data));
}
