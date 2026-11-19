"use client";

import { useChat } from "@ai-sdk/react";
import { AlertCircle, ArrowUp, RotateCcw, Square, X } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Mark } from "@/components/brand/logo";
import { useNavState } from "@/components/shell/nav-state";
import { Button } from "@/components/ui/button";
import type { PageContext } from "@/lib/ai/instructions";
import type { AssistantMessage } from "@/lib/ai/types";
import { ALL_STORES, type ViewId, getView, scopeLabel } from "@/lib/nav";
import { rangeFromSearch } from "@/lib/range-params";
import { assistantChat, chatErrorText } from "./chat";
import { Markdown } from "./markdown";
import { ToolResult } from "./tool-results";

/** Example questions per view, shown on an empty chat. */
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

const MAX_CHARS = 1500;

/** The assistant, docked beside the page (desktop) or in a sheet (small screens). */
export function AssistantPanel({ onClose }: { onClose: () => void }) {
  const nav = useNavState();
  const where = nav.scope === ALL_STORES ? "all stores" : scopeLabel(nav.scope);
  const view = getView(nav.view);
  const { messages, sendMessage, status, error, stop, setMessages, clearError } = useChat<AssistantMessage>({
    chat: assistantChat,
  });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  // Keep the newest message in view while it streams in.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const page: PageContext = {
      scope: nav.scope,
      view: nav.view,
      range: view.usesRange ? rangeFromSearch(new URLSearchParams(nav.rangeQuery)) : null,
    };
    void sendMessage({ text: question }, { body: { page } });
    setInput("");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    ask(input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      ask(input);
    }
  }

  function newChat() {
    stop();
    clearError();
    setMessages([]);
  }

  return (
    <section
      aria-labelledby="assistant-title"
      className="bg-sidebar text-sidebar-foreground flex h-full flex-col"
    >
      <div className="flex h-12 shrink-0 items-center gap-1 border-b px-3">
        <h2 id="assistant-title" className="mr-auto text-[15px] font-semibold">
          Assistant
        </h2>
        {messages.length > 0 && (
          <Button variant="ghost" size="icon-sm" onClick={newChat} aria-label="New chat" title="New chat">
            <RotateCcw aria-hidden />
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close assistant">
          <X aria-hidden />
        </Button>
      </div>

      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 ? (
          <>
            <div className="my-auto flex flex-col items-center gap-3 py-6 text-center">
              <Mark className="text-foreground size-12" />
              <h3 className="font-wide text-lg font-bold">Ask about {where}</h3>
              <p className="text-muted-foreground max-w-72 text-sm text-balance">
                Ask a question and get the answer as a chart or table, from the same data as the dashboard.
                Links in answers open the right view next to this chat.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.08em] uppercase">
                Try asking · {view.label}
              </p>
              <ul className="flex flex-col gap-1.5">
                {SUGGESTIONS[nav.view].map((q) => (
                  <li key={q}>
                    <button
                      type="button"
                      onClick={() => ask(q)}
                      className="bg-card text-foreground border-line-control hover:bg-muted focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-left text-[13px] font-medium outline-none focus-visible:ring-2"
                    >
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <ol className="flex flex-col gap-4">
            {messages.map((m) => (
              <li key={m.id}>
                <Message message={m} />
              </li>
            ))}
            {status === "submitted" && (
              <li className="text-muted-foreground text-xs" aria-label="Thinking">
                <span className="animate-pulse">Thinking…</span>
              </li>
            )}
          </ol>
        )}

        {error && (
          <div
            role="alert"
            className="border-line-control bg-card mt-4 flex items-start gap-2 rounded-md border p-3 text-sm"
          >
            <AlertCircle className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="flex-1">{chatErrorText(error)}</p>
          </div>
        )}
      </div>

      <form className="shrink-0 border-t p-3" onSubmit={onSubmit}>
        <div className="bg-card border-line-control focus-within:ring-ring flex items-end gap-2 rounded-md border p-2 focus-within:ring-2">
          <textarea
            rows={2}
            value={input}
            maxLength={MAX_CHARS}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Message"
            placeholder={`Ask about ${where}…`}
            className="placeholder:text-ink-faint min-w-0 flex-1 resize-none bg-transparent px-1 text-sm outline-none"
          />
          {busy ? (
            <Button type="button" size="icon-sm" variant="outline" onClick={() => stop()} aria-label="Stop">
              <Square aria-hidden />
            </Button>
          ) : (
            <Button type="submit" size="icon-sm" disabled={!input.trim()} aria-label="Send">
              <ArrowUp aria-hidden />
            </Button>
          )}
        </div>
        <p className="text-ink-faint mt-1.5 text-[11px]">
          AI answers can be wrong. Numbers come from the dashboard data.
        </p>
      </form>
    </section>
  );
}

function Message({ message }: { message: AssistantMessage }) {
  if (message.role === "user") {
    const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
    return (
      <p className="bg-card border-line-control ml-8 rounded-md border px-3 py-2 text-sm whitespace-pre-wrap">
        {text}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {message.parts.map((part, i) => {
        if (part.type === "text") return part.text.trim() ? <Markdown key={i} text={part.text} /> : null;
        if (part.type.startsWith("tool-"))
          return <ToolResult key={i} part={part as Parameters<typeof ToolResult>[0]["part"]} />;
        return null;
      })}
    </div>
  );
}
