"use client";

import { ArrowLeft, Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SEGMENT_LABELS } from "@/lib/domain/schemas";
import { dayOfWeek, localNow } from "@/lib/domain/time";
import { formatDateRange, formatDaysAgo, formatInt, formatPercent } from "@/lib/format";
import { scopeLabel } from "@/lib/nav";
import { type CustomerProfile, useCustomerProfile } from "@/lib/queries";

/** One loyalty member: activity, visit calendar, favourite stores and zones, recent visits. */
export function CustomerProfileView({ customerId, scope }: { customerId: string; scope: string }) {
  const { data, isError } = useCustomerProfile(customerId);
  const back = `/${scope}/customers`;

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={back}
        className="text-muted-foreground hover:text-foreground focus-visible:outline-ring flex w-fit items-center gap-1.5 rounded text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Members of {scope === "all" ? "all stores" : scopeLabel(scope)}
      </Link>
      {isError ? (
        <p className="text-destructive text-sm">Couldn&apos;t load this member.</p>
      ) : !data ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <Profile p={data} />
      )}
    </div>
  );
}

function Profile({ p }: { p: CustomerProfile }) {
  const today = localNow().date;
  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold">
                {p.name}
                <Badge variant="outline" className="capitalize">
                  {p.tier}
                </Badge>
              </h1>
              <p className="text-muted-foreground text-sm">
                <span className="font-mono">{p.id}</span> · home store {p.homeStoreName} · member since{" "}
                {formatDateRange(p.memberSince, p.memberSince)}
              </p>
            </div>
            <div className="text-sm @xl:text-right">
              <p className="font-medium">{SEGMENT_LABELS[p.segment]}</p>
              <p className="text-muted-foreground">
                {p.lastVisit
                  ? `Last visit ${formatDaysAgo(p.lastVisit, today).toLowerCase()}`
                  : "No visit in 90 days"}
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-2 @xl:grid-cols-4">
            <Fact label="Visits · 30 days" value={formatInt(p.visits30)} />
            <Fact label="Visits · 90 days" value={formatInt(p.visits90)} />
            <Fact label="Reached checkout" value={p.visits90 ? formatPercent(p.checkoutRate) : "—"} />
            <Fact label="Stores visited" value={String(p.stores.length)} />
          </dl>
        </CardContent>
      </Card>

      <VisitCalendar calendar={p.calendar} />

      <div className="grid gap-4 @3xl:grid-cols-2">
        <ShareCard
          title="Stores"
          description="Share of visits in the last 90 days"
          rows={p.stores.map((s) => ({
            key: s.storeId,
            label: s.home ? `${s.name} (home)` : s.name,
            share: s.share,
          }))}
          empty="No visits in the last 90 days."
        />
        <ShareCard
          title="Zones"
          description="Share of visits that went through each zone"
          rows={p.zones.map((z) => ({ key: z.zone, label: z.label, share: z.share }))}
          empty="No visits in the last 90 days."
          hide={p.visits90 === 0}
        />
      </div>

      <RecentVisits visits={p.recentVisits} />
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 flex flex-col gap-0.5 rounded-lg border px-3 py-2">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

const WEEKDAYS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];
const heat = (visits: number) =>
  visits === 0 ? "var(--heat-0)" : visits === 1 ? "var(--heat-3)" : "var(--heat-5)";

/** 90 days as a week-by-week grid (Monday first); darker = more visits that day. */
function VisitCalendar({ calendar }: { calendar: CustomerProfile["calendar"] }) {
  // Pad the start so the first column begins on a Monday.
  const pad = (dayOfWeek(calendar[0].date) + 6) % 7;
  const cells: ({ date: string; visits: number } | null)[] = [...Array(pad).fill(null), ...calendar];
  const weeks = Math.ceil(cells.length / 7);
  const visitDays = calendar.filter((d) => d.visits > 0).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Visit calendar</CardTitle>
        <CardDescription>
          Last 90 days · {visitDays} {visitDays === 1 ? "day" : "days"} with a visit
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <div
            className="text-muted-foreground grid shrink-0 grid-rows-7 gap-1 text-[10px] leading-none"
            aria-hidden
          >
            {WEEKDAYS.map((d, i) => (
              <span key={i} className="flex h-3.5 items-center">
                {d}
              </span>
            ))}
          </div>
          <div
            role="img"
            aria-label={`Visits per day over the last 90 days: ${visitDays} days with at least one visit`}
            className="grid grid-flow-col grid-rows-7 gap-1"
            style={{ gridTemplateColumns: `repeat(${weeks}, 0.875rem)` }}
          >
            {cells.map((c, i) =>
              c ? (
                <span
                  key={c.date}
                  title={`${formatDateRange(c.date, c.date)}: ${c.visits} ${c.visits === 1 ? "visit" : "visits"}`}
                  className="size-3.5 rounded-[3px] ring-1 ring-black/5 ring-inset dark:ring-white/5"
                  style={{ background: heat(c.visits) }}
                />
              ) : (
                <span key={`pad-${i}`} className="size-3.5" />
              ),
            )}
          </div>
        </div>
        <div className="text-muted-foreground flex items-center gap-3 text-xs">
          {[0, 1, 2].map((n) => (
            <span key={n} className="flex items-center gap-1.5">
              <span className="size-3 rounded-[3px]" style={{ background: heat(n) }} aria-hidden />
              {n === 0 ? "No visit" : n === 1 ? "1 visit" : "2 or more"}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ShareCard({
  title,
  description,
  rows,
  empty,
  hide = false,
}: {
  title: string;
  description: string;
  rows: { key: string; label: string; share: number }[];
  empty: string;
  hide?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 || hide ? (
          <p className="text-muted-foreground text-sm">{empty}</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {rows.map((r) => (
              <li
                key={r.key}
                className="grid grid-cols-[minmax(0,12rem)_1fr_3rem] items-center gap-3 text-sm"
              >
                <span className="truncate">{r.label}</span>
                <span className="bg-muted h-2 overflow-hidden rounded-full">
                  <span
                    className="bg-chart-1 block h-full rounded-full"
                    style={{ width: `${r.share * 100}%` }}
                  />
                </span>
                <span className="text-right tabular-nums">{formatPercent(r.share)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const ZONE_SHORT: Record<string, string> = {
  womenswear: "Women",
  menswear: "Men",
  kids: "Kids",
  "fitting-rooms": "Fitting",
  checkout: "Checkout",
};

function RecentVisits({ visits }: { visits: CustomerProfile["recentVisits"] }) {
  const today = localNow().date;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent visits</CardTitle>
        <CardDescription>Last 90 days, newest first · open one to see its route</CardDescription>
      </CardHeader>
      <CardContent>
        {visits.length === 0 ? (
          <p className="text-muted-foreground text-sm">No visits in the last 90 days.</p>
        ) : (
          <ul className="divide-y">
            {visits.slice(0, 30).map((v) => (
              <li
                key={v.visitId}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-sm"
              >
                <span className="flex min-w-48 flex-col">
                  <span className="font-medium tabular-nums">
                    {formatDaysAgo(v.date, today)} · {v.enteredAt.slice(0, 5)}
                  </span>
                  <span className="text-muted-foreground">{v.storeName}</span>
                </span>
                <span className="text-muted-foreground flex-1">
                  {v.inProgress
                    ? "In the store now"
                    : v.zones.map((z) => ZONE_SHORT[z]).join(" · ") || "Entrance only"}
                </span>
                <span className="flex items-center gap-4">
                  {v.checkout && (
                    <span className="flex items-center gap-1">
                      <Check className="size-3.5" aria-hidden /> Checkout
                    </span>
                  )}
                  <Link
                    href={`/${v.storeId}/visits?date=${v.date}&visit=${v.visitId}`}
                    className="text-primary focus-visible:outline-ring flex items-center gap-1 rounded underline-offset-2 outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    Open visit <ExternalLink className="size-3.5" aria-hidden />
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
        {visits.length > 30 && (
          <p className="text-muted-foreground mt-2 text-xs">
            Showing the latest 30 of {visits.length} visits.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
