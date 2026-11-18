# Architecture

Store Radar is a single Next.js (App Router) application. Frontend and backend
live in one deployable unit on Vercel.

## Why not a monorepo?

There is one app and no second consumer of shared code. A monorepo (Turborepo /
pnpm workspaces) would add workspace config and build pipelines without any
benefit. Boundaries are enforced with folders instead. If a second consumer
appeared — a real sensor-ingestion service, a mobile app — `lib/domain` is
already framework-free and could move into a `packages/domain` workspace as is.

## Layers

```
┌──────────────────────────────────────────────────────────────┐
│ UI — React Server/Client Components, shadcn/ui, charts       │  app/, components/
├──────────────────────────────────────────────────────────────┤
│ Client data — TanStack Query hooks · AI SDK useChat          │  lib/queries.ts
├──────────────────────── HTTP ────────────────────────────────┤
│ API — Route Handlers, Zod validation, no-store JSON          │  app/api/*, lib/api.ts
├──────────────────────────────────────────────────────────────┤
│ Domain — pure TypeScript (no React, no Next)                 │  lib/domain/
│   catalog · seeded generator · metrics · query service       │
│   ▲ also called directly by the AI assistant tools           │
└──────────────────────────────────────────────────────────────┘
```

**Rule:** dependencies only point downwards. `lib/domain` imports nothing from
Next.js or React, which keeps it unit-testable and reusable by the AI tools.

### Domain (`lib/domain`)

| File           | Responsibility                                                        |
| -------------- | --------------------------------------------------------------------- |
| `types.ts`     | Store, Zone, Visit, Customer, hourly/daily aggregates                 |
| `catalog.ts`   | The fictional chain: 3 stores, zones, opening hours, behaviour params |
| `customers.ts` | 6,000 fictional loyalty members (seeded)                              |
| `random.ts`    | Seeded PRNG (cyrb53 hash + mulberry32)                                |
| `time.ts`      | Europe/Madrid local time, date arithmetic on `YYYY-MM-DD` strings     |
| `generator.ts` | Simulates a store-day, summarises it, caches past days                |
| `metrics.ts`   | KPI definitions (capture rate, dwell, funnel, hour profile…)          |
| `schemas.ts`   | Zod input schemas shared by API routes and AI tools                   |
| `service.ts`   | Query functions: overview, traffic, zones, funnel, tables             |

### API (`app/api`)

| Route                   | Query params                                                  | Returns                                                                                     |
| ----------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `/api/stores`           | —                                                             | Stores with open/closed status                                                              |
| `/api/stores/[id]/live` | —                                                             | People inside per zone, capacity, alerts, members inside, last 90 min (refetched every 5 s) |
| `/api/stores/[id]/pace` | —                                                             | KPIs vs. a typical day, forecast, usual peak, hourly profile                                |
| `/api/overview`         | `store`, `preset` \| `from`+`to`                              | KPIs + previous-period KPIs                                                                 |
| `/api/traffic`          | same + `granularity`                                          | Street vs. visitors series                                                                  |
| `/api/zones`            | same                                                          | Visitors, visit rate, dwell per zone                                                        |
| `/api/funnel`           | same                                                          | Street → entrance → browse → fitting → checkout                                             |
| `/api/hours`            | same                                                          | Average visitors per hour of day                                                            |
| `/api/compare`          | `preset` \| `from`+`to`                                       | KPIs per store                                                                              |
| `/api/visits`           | `store`, `date`, `segment`, `sort`, `dir`, `page`, `pageSize` | Paginated visits                                                                            |
| `/api/customers`        | `q`, `store`, `tier`, `sort`, `dir`, `page`, `pageSize`       | Paginated customers                                                                         |
| `/api/chat`             | POST (AI SDK UI messages)                                     | Streamed assistant response                                                                 |

`store` is a store id or `all`. `preset` is `today`, `yesterday`, `7d` or `30d`
(the last two include today). Custom ranges are capped at 92 days.

## Data simulation

There is no database. All data is generated deterministically:

1. **Seeded per store-day.** `simulateDay(store, date)` uses an RNG seeded with
   `"<storeId>|<date>"`, so the same day always produces the same visitors on
   every server instance, for every user and for the AI tools.
2. **Realistic shape.** Street traffic follows an hourly curve (lunch and
   after-work peaks) × weekday factor × noise. Each passer-by walks in with the
   store's capture rate; each visitor follows a path through zones with
   zone-specific probabilities and dwell times. Fitting rooms happen only after
   browsing apparel and strongly raise the chance of reaching checkout. Some
   stores close on Sundays.
3. **Visits are the source of truth.** Daily summaries (hourly buckets per
   zone) are aggregated _from_ the simulated visits, so the visits table,
   the KPIs and the charts always agree.
4. **Live.** For today, data is cut off at the current Madrid time: visits
   after "now" are dropped and the current hour's street count is pro-rated.
   Each refetch therefore shows new visitors arriving. KPI comparisons for
   "today" use yesterday _up to the same time_, not a full day.
5. **Caching.** Past days never change, so their summaries are memoised per
   server instance (bounded map). A cold 30-day chain query (current + previous
   period, 180 store-days) takes ~0.25 s; warm, ~5 ms.

## Live view

The home page is the live view of one store (`/stores/[id]`), built for a store manager deciding what to do now:

- **Occupancy vs. capacity**: each store and zone has a capacity (fitting rooms = cubicles). The floor plan is coloured by % of capacity; zones at ≥85% get a warning and at ≥100% a critical alert (status colour + icon + text).
- **Typical day**: the average of the same weekday over the previous 4 weeks, at the same time of day. KPIs, people inside and the hourly chart compare against it, which is fairer than "vs. yesterday".
- **Pace**: visitors so far vs. typical, a full-day forecast (typical day scaled by today's ratio so far, weighted by how much of the day has passed) and the usual peak hour.
- **Loyalty members inside**: registered customers present now, gold and silver first, for clienteling.
- Occupancy is computed from each simulated visit's path and dwell times (`lib/domain/occupancy.ts`); full simulated days are kept in a small LRU cache so the 5-second refresh stays cheap.

## Client data flow

- TanStack Query hooks in `lib/queries.ts`, with a query-key factory.
- Response types are inferred from the domain service
  (`ReturnType<typeof getOverview>`), so there is no hand-written duplicate.
- Any query whose range includes today refetches every 15 s; historical ranges
  don't refetch. `keepPreviousData` avoids layout jumps when filters change.
- Tables (TanStack Table) use server-side pagination/sorting: the client sends
  page/sort state as query params.

## AI assistant (planned)

`POST /api/chat` uses the AI SDK's `streamText` with tools that call the same
`lib/domain/service.ts` functions and reuse the Zod schemas from
`lib/domain/schemas.ts`. The client (`useChat`) renders tool results as real
chart and table components (generative UI), so numbers in the chat always
match the dashboard. Cost guards: small fast model, capped steps and message
length, graceful message when no API key is configured.

## Theme

Tokens live in `app/globals.css` (light on `:root`, dark on `.dark`, toggled by `next-themes`; default follows the OS).

- **Brand palette** `#f72585 #7209b7 #3a0ca3 #4361ee #4cc9f0`. Primary is `#4361ee` (`#5b7cfa` in dark); the full palette appears only as the brand gradient (logo, AI assistant, empty states).
- **Chart series** (fixed order): blue `#4361ee`, pink `#f72585`, cyan `#0891b2` (darkened for contrast), purple `#7209b7`; dark-mode steps are separate. Validated for colour-blind separation and ≥3:1 contrast in both modes.
- **Heatmap**: one-hue blue ramp `--heat-0…5`; labels on the strongest steps use `--heat-ink-high`.
- **Status** (good / warning / critical) is reserved for state and always paired with an icon and text. Brand pink (`--highlight`) never means "bad".
- **Cards**: white on a cool tinted background, 1px border, soft shadow (`shadow-card`), 14px radius. **Font**: Geist (tabular figures), Geist Mono for IDs.

## Next.js 16 specifics

- **Cache Components** is enabled (`cacheComponents: true`). Route handlers
  that read `request.url` run at request time. `/api/stores` calls
  `connection()` explicitly because it depends on the current time.
- Components using `useSearchParams` must sit inside `<Suspense>`.
