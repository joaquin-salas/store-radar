import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CustomerProfileView } from "@/components/customers/customer-profile";
import { Skeleton } from "@/components/ui/skeleton";
import { getCustomer } from "@/lib/domain/customers";
import { customerIdSchema } from "@/lib/domain/schemas";
import { isScope } from "@/lib/nav";

type Props = PageProps<"/[scope]/customers/[customerId]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { customerId } = await params;
  return { title: `${getCustomer(customerId)?.name ?? "Member"} · Customers · Store Radar` };
}

export default function CustomerPage({ params }: Props) {
  // 6,000 members: rendered on request, so params are awaited inside Suspense.
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      }
    >
      <Customer params={params} />
    </Suspense>
  );
}

async function Customer({ params }: Pick<Props, "params">) {
  const { scope, customerId } = await params;
  if (!isScope(scope) || !customerIdSchema.safeParse(customerId).success || !getCustomer(customerId))
    notFound();
  return <CustomerProfileView customerId={customerId} scope={scope} />;
}
