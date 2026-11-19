"use client";

import { AlertCircle, Check, LoaderCircle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { KpiRow } from "@/components/dashboard/kpi-row";
import type { AssistantTools } from "@/lib/ai/tools";
import { localNow } from "@/lib/domain/time";
import { formatDateRange, formatDaysAgo, formatInt } from "@/lib/format";
import { scopeLabel } from "@/lib/nav";
import { MetricsResult } from "./metrics-result";

type ToolName = keyof AssistantTools;
type Output<T extends ToolName> = AssistantTools[T]["output"];

/** What each tool is doing, for the progress line. */
const ACTIVITY: Record<ToolName, string> = {
  queryMetrics: "Building a chart",
  getKpis: "Getting KPIs",
  getLiveStatus: "Checking the store right now",
  getFunnel: "Getting the funnel",
  getFlows: "Looking at visitor flows",
  findVisits: "Finding visits",
  getVisitStats: "Measuring visit times",
  findMembers: "Searching members",
  getMemberProfile: "Opening the member profile",
  getMemberProgramme: "Getting loyalty KPIs",
};

export interface ToolPartLike {
  type: string;
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
}

/** One tool call in an answer: progress while it runs, then its result (a chart, tiles, a table or a short line). */
export function ToolResult({ part }: { part: ToolPartLike }) {
  const name = part.type.slice("tool-".length) as ToolName;
  if (!(name in ACTIVITY)) return null;

  if (part.state === "output-error") {
    return (
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <AlertCircle className="size-3.5" aria-hidden />
        {ACTIVITY[name]} didn&apos;t work, trying another way…
      </p>
    );
  }
  if (part.state !== "output-available") {
    return (
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
        {ACTIVITY[name]}…
      </p>
    );
  }

  switch (name) {
    case "queryMetrics":
      return <MetricsResult result={part.output as Output<"queryMetrics">} />;
    case "getKpis":
      return <KpiResult result={part.output as Output<"getKpis">} />;
    case "findVisits":
      return <VisitsResult result={part.output as Output<"findVisits">} />;
    case "findMembers":
      return <MembersResult result={part.output as Output<"findMembers">} />;
    default:
      return (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Check className="size-3.5" aria-hidden />
          {ACTIVITY[name]}
        </p>
      );
  }
}

function KpiResult({ result }: { result: Output<"getKpis"> }) {
  const where = result.store === "all" ? "All stores" : scopeLabel(result.store);
  return (
    <div className="@container flex flex-col gap-2">
      <p className="text-[13px] font-semibold">
        {where} · {formatDateRange(result.range.from, result.range.to)}
      </p>
      <KpiRow
        current={result.kpis}
        previous={result.previous}
        comparisonLabel={`vs. ${formatDateRange(result.previousRange.from, result.previousRange.to)}`}
      />
    </div>
  );
}

function VisitsResult({ result }: { result: Output<"findVisits"> }) {
  return (
    <ResultList
      title={`${scopeLabel(result.store)} · ${formatDateRange(result.date, result.date)} · ${formatInt(result.total)} visits`}
    >
      {result.rows.map((v) => (
        <li key={v.id} className="flex items-baseline gap-3 px-3 py-2">
          <Link
            href={`/${result.store}/visits?date=${result.date}&visit=${v.id}`}
            className={`readout ${LINK}`}
          >
            {v.enteredAt.slice(0, 5)}
          </Link>
          <div className="min-w-0 flex-1 text-xs">
            <p>{v.zones.filter((z) => z !== "Entrance").join(" → ") || "Entrance only"}</p>
            {(v.member || v.inside) && (
              <p className="text-muted-foreground">
                {v.member}
                {v.member && v.inside && " · "}
                {v.inside && "Still inside"}
              </p>
            )}
          </div>
          <span className="readout text-muted-foreground shrink-0 text-xs">{v.minutesInside} min</span>
        </li>
      ))}
    </ResultList>
  );
}

function MembersResult({ result }: { result: Output<"findMembers"> }) {
  const today = localNow().date;
  const count = `${formatInt(result.total)} ${result.total === 1 ? "member" : "members"}`;
  return (
    <ResultList title={result.total > result.rows.length ? `${count} · first ${result.rows.length}` : count}>
      {result.rows.map((m) => (
        <li key={m.id} className="flex items-baseline gap-3 px-3 py-2">
          <div className="min-w-0 flex-1">
            <Link href={`/all/customers?q=${m.id}`} className={`text-sm ${LINK}`}>
              {m.name}
            </Link>
            <p className="text-muted-foreground text-xs">
              <span className="capitalize">{m.tier}</span> · {m.homeStore}
            </p>
          </div>
          <div className="shrink-0 text-right text-xs">
            <p className="readout">{m.visits30d} visits</p>
            <p className="text-muted-foreground">
              {m.lastVisit ? formatDaysAgo(m.lastVisit, today) : "No visit in 90 days"}
            </p>
          </div>
        </li>
      ))}
    </ResultList>
  );
}

const LINK = "decoration-line-control hover:decoration-foreground font-medium underline underline-offset-2";

/** A titled, scrollable list for row results; rows stay readable at panel width, unlike a table. */
function ResultList({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-card flex flex-col rounded-md border">
      <p className="border-b px-3 py-2 text-[13px] font-semibold">{title}</p>
      <ol className="max-h-80 divide-y overflow-y-auto">{children}</ol>
    </div>
  );
}
