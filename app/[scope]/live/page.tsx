import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LiveView } from "@/components/live/live-view";
import { Skeleton } from "@/components/ui/skeleton";
import { STORES, getStore } from "@/lib/domain/catalog";
import { getFloorPlan } from "@/lib/domain/layout";

// Live shows one store at a time; `/all/live` is redirected in next.config.ts.
export function generateStaticParams() {
  return STORES.map((s) => ({ scope: s.id }));
}

export async function generateMetadata({ params }: PageProps<"/[scope]/live">): Promise<Metadata> {
  const { scope } = await params;
  return { title: `${getStore(scope)?.name ?? "Store"} · Live · Store Radar` };
}

export default function LivePage({ params }: PageProps<"/[scope]/live">) {
  // Await params inside Suspense so navigation can show the shell instantly.
  return (
    <Suspense fallback={<LiveViewSkeleton />}>
      <StoreLive params={params} />
    </Suspense>
  );
}

async function StoreLive({ params }: Pick<PageProps<"/[scope]/live">, "params">) {
  const { scope } = await params;
  const store = getStore(scope);
  if (!store) notFound();

  // The floor plan is static configuration: render it with the page, no API call needed.
  return <LiveView storeId={store.id} storeName={store.name} plan={getFloorPlan(store.id)} />;
}

function LiveViewSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-72" />
      <div className="grid gap-4 @4xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Skeleton className="aspect-[4/3] rounded-xl" />
        <Skeleton className="min-h-80 rounded-xl" />
      </div>
    </div>
  );
}
