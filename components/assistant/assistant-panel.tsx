"use client";

import { ArrowUp, Sparkles, X } from "lucide-react";
import { useNavState } from "@/components/shell/nav-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type ViewId, getView, scopeLabel } from "@/lib/nav";

/** Example questions per view, shown until the assistant is connected. */
const SUGGESTIONS: Record<ViewId, string[]> = {
  live: [
    "Which zone is busiest right now?",
    "Are we on pace for a typical day?",
    "Which gold members are in the store?",
  ],
  analytics: [
    "How did capture rate change this month?",
    "Which hour has the most visitors?",
    "Compare checkout rate across stores",
  ],
  visits: ["Show the longest visits today", "How long do returning visitors stay?"],
  customers: ["Which gold members haven't visited in a month?", "Who shops at more than one store?"],
  flows: ["Where do people go after womenswear?", "How many leave without reaching checkout?"],
};

/**
 * The assistant, docked beside the page (desktop) or in a sheet (small screens).
 * For now a shell: it shows what it will do and knows the current store and view.
 */
export function AssistantPanel({ onClose }: { onClose: () => void }) {
  const nav = useNavState();
  const where = scopeLabel(nav.scope);
  const view = getView(nav.view);

  return (
    <section
      aria-labelledby="assistant-title"
      className="bg-sidebar text-sidebar-foreground flex h-full flex-col"
    >
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <span className="flex size-6 items-center justify-center rounded-md text-white [background:var(--brand-gradient)]">
          <Sparkles className="size-3.5" aria-hidden />
        </span>
        <h2 id="assistant-title" className="text-sm font-semibold">
          Assistant
        </h2>
        <Badge variant="outline">Coming soon</Badge>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          onClick={onClose}
          aria-label="Close assistant"
        >
          <X aria-hidden />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        <div className="my-auto flex flex-col items-center gap-3 py-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl text-white [background:var(--brand-gradient)]">
            <Sparkles className="size-6" aria-hidden />
          </span>
          <h3 className="text-base font-semibold">Ask about {where}</h3>
          <p className="text-muted-foreground max-w-72 text-sm text-balance">
            Ask a question and get the answer as a chart or table, from the same data as the dashboard. Links
            in answers will open the right view next to this chat.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs font-medium">Try asking · {view.label}</p>
          <ul className="flex flex-col gap-1.5">
            {SUGGESTIONS[nav.view].map((q) => (
              <li key={q} className="bg-card text-muted-foreground rounded-lg border px-3 py-2 text-sm">
                {q}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <form className="shrink-0 border-t p-3" onSubmit={(e) => e.preventDefault()}>
        <div className="bg-card flex items-end gap-2 rounded-xl border p-2">
          <textarea
            disabled
            rows={2}
            aria-label="Message"
            placeholder={`Ask about ${where}…`}
            className="placeholder:text-muted-foreground min-w-0 flex-1 resize-none bg-transparent px-1 text-sm outline-none disabled:cursor-not-allowed"
          />
          <Button type="submit" size="icon-sm" disabled aria-label="Send">
            <ArrowUp aria-hidden />
          </Button>
        </div>
      </form>
    </section>
  );
}
