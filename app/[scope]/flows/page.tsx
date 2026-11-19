import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FlowsView } from "@/components/flows/flows-view";
import { Skeleton } from "@/components/ui/skeleton";
import { STORE_IDS } from "@/lib/domain/catalog";
import { ALL_STORES, isScope, scopeLabel } from "@/lib/nav";

export function generateStaticParams() {
  return [ALL_STORES, ...STORE_IDS].map((scope) => ({ scope }));
}

export async function generateMetadata({ params }: PageProps<"/[scope]/flows">): Promise<Metadata> {
  const { scope } = await params;
  return { title: `${isScope(scope) ? scopeLabel(scope) : "Store"} · Flows · Store Radar` };
}

export default function FlowsPage({ params }: PageProps<"/[scope]/flows">) {
  // The range lives in the URL (read on the client), so the whole view sits in Suspense.
  return (
    <Suspense fallback={<FlowsSkeleton />}>
      <ScopedFlows params={params} />
    </Suspense>
  );
}

async function ScopedFlows({ params }: Pick<PageProps<"/[scope]/flows">, "params">) {
  const { scope } = await params;
  if (!isScope(scope)) notFound();
  return <FlowsView scope={scope} />;
}

function FlowsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-72" />
      <div className="grid grid-cols-2 gap-3 @xl:grid-cols-3 @5xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
