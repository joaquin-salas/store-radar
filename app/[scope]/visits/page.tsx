import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { VisitsView } from "@/components/visits/visits-view";
import { STORES, getStore } from "@/lib/domain/catalog";
import { getFloorPlan } from "@/lib/domain/layout";

// Visits shows one store at a time; `/all/visits` is redirected in next.config.ts.
export function generateStaticParams() {
  return STORES.map((s) => ({ scope: s.id }));
}

export async function generateMetadata({ params }: PageProps<"/[scope]/visits">): Promise<Metadata> {
  const { scope } = await params;
  return { title: `${getStore(scope)?.name ?? "Store"} · Visits · Store Radar` };
}

export default function VisitsPage({ params }: PageProps<"/[scope]/visits">) {
  // Filters live in the URL (read on the client), so the whole view sits in Suspense.
  return (
    <Suspense fallback={<VisitsSkeleton />}>
      <StoreVisits params={params} />
    </Suspense>
  );
}

async function StoreVisits({ params }: Pick<PageProps<"/[scope]/visits">, "params">) {
  const { scope } = await params;
  const store = getStore(scope);
  if (!store) notFound();
  // The floor plan is static configuration: render it with the page, no API call needed.
  return <VisitsView storeId={store.id} storeName={store.name} plan={getFloorPlan(store.id)} />;
}

function VisitsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-8 w-96 max-w-full" />
      <Skeleton className="h-[480px] rounded-xl" />
    </div>
  );
}
