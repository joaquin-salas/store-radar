import { json } from "@/lib/api";
import { storeIdSchema } from "@/lib/domain/schemas";
import { getPace } from "@/lib/domain/typical";

export async function GET(_request: Request, ctx: RouteContext<"/api/stores/[storeId]/pace">) {
  const { storeId } = await ctx.params;
  const parsed = storeIdSchema.safeParse(storeId);
  if (!parsed.success) return Response.json({ error: `Unknown store: ${storeId}` }, { status: 404 });
  return json(getPace(parsed.data));
}
