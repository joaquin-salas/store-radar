import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LiveView } from "@/components/live/live-view";
import { Skeleton } from "@/components/ui/skeleton";
import { STORES, getStore } from "@/lib/domain/catalog";
import { getFloorPlan } from "@/lib/domain/layout";

export function generateStaticParams() {
  return STORES.map((s) => ({ storeId: s.id }));
}

export async function generateMetadata({ params }: PageProps<"/stores/[storeId]">): Promise<Metadata> {
  const { storeId } = await params;
  return { title: `${getStore(storeId)?.name ?? "Store"} · Store Radar` };
}

export default function StorePage({ params }: PageProps<"/stores/[storeId]">) {
  // Await params inside Suspense so navigation can show the shell instantly.
  return (
    <Suspense fallback={<LiveViewSkeleton />}>
      <StoreLive params={params} />
    </Suspense>
  );
}

async function StoreLive({ params }: Pick<PageProps<"/stores/[storeId]">, "params">) {
  const { storeId } = await params;
  const store = getStore(storeId);
  if (!store) notFound();

  // The floor plan is static configuration: render it with the page, no API call needed.
  return <LiveView storeId={store.id} storeName={store.name} plan={getFloorPlan(store.id)} />;
}

function LiveViewSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-72" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="aspect-[4/3] rounded-xl" />
        <Skeleton className="min-h-80 rounded-xl" />
      </div>
    </div>
  );
}
