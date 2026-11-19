import { json } from "@/lib/api";
import { customerIdSchema } from "@/lib/domain/schemas";
import { getCustomerProfile } from "@/lib/domain/service";

export async function GET(_request: Request, ctx: RouteContext<"/api/customers/[customerId]">) {
  const { customerId } = await ctx.params;
  const parsed = customerIdSchema.safeParse(customerId);
  const profile = parsed.success ? getCustomerProfile(parsed.data) : null;
  if (!profile) return Response.json({ error: `Unknown customer: ${customerId}` }, { status: 404 });
  return json(profile);
}
