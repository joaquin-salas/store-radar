import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CustomersView } from "@/components/customers/customers-view";
import { Skeleton } from "@/components/ui/skeleton";
import { STORE_IDS } from "@/lib/domain/catalog";
import { ALL_STORES, isScope, scopeLabel } from "@/lib/nav";

export function generateStaticParams() {
  return [ALL_STORES, ...STORE_IDS].map((scope) => ({ scope }));
}

export async function generateMetadata({ params }: PageProps<"/[scope]/customers">): Promise<Metadata> {
  const { scope } = await params;
  return { title: `${isScope(scope) ? scopeLabel(scope) : "Store"} · Customers · Store Radar` };
}

export default function CustomersPage({ params }: PageProps<"/[scope]/customers">) {
  // Filters live in the URL (read on the client), so the whole view sits in Suspense.
  return (
    <Suspense fallback={<CustomersSkeleton />}>
      <ScopedCustomers params={params} />
    </Suspense>
  );
}

async function ScopedCustomers({ params }: Pick<PageProps<"/[scope]/customers">, "params">) {
  const { scope } = await params;
  if (!isScope(scope)) notFound();
  return <CustomersView scope={scope} />;
}

function CustomersSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-5 w-96 max-w-full" />
      <div className="grid grid-cols-2 gap-3 @xl:grid-cols-3 @5xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[480px] rounded-xl" />
    </div>
  );
}
