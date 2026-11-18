import { LiveKpis } from "@/components/dashboard/live-kpis";
import { CHAIN } from "@/lib/domain/catalog";

// Scaffold page: proves the domain → API → TanStack Query pipeline end to end.
// The real overview (charts, tables, filters) replaces this next.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Store Radar</h1>
        <p className="text-muted-foreground text-sm">
          {CHAIN.name} · {CHAIN.description}
        </p>
      </header>
      <LiveKpis />
    </main>
  );
}
