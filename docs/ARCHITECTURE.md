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

| File             | Responsibility                                                        |
| ---------------- | --------------------------------------------------------------------- |
| `types.ts`       | Store, Zone, Visit, Customer, hourly/daily aggregates                 |
| `catalog.ts`     | The fictional chain: 3 stores, zones, opening hours, behaviour params |
| `customers.ts`   | 6,000 fictional loyalty members (seeded) and their hidden behaviour   |
| `members.ts`     | Member activity, segments, programme KPIs, customer profile           |
| `summaries.ts`   | Load daily summaries for a store scope and range                      |
| `random.ts`      | Seeded PRNG (cyrb53 hash + mulberry32)                                |
| `time.ts`        | Europe/Madrid local time, date arithmetic on `YYYY-MM-DD` strings     |
| `generator.ts`   | Simulates a store-day, summarises it, caches past days                |
| `visit-stats.ts` | Distributions over visits: length histogram, time per zone, quantiles |
| `metrics.ts`     | KPI definitions (capture rate, dwell, funnel, hour profile…)          |
| `range.ts`       | Resolve range presets, previous period (also used by the client)      |
| `schemas.ts`     | Zod input schemas shared by API routes and AI tools                   |
| `service.ts`     | Query functions: overview, traffic, zones, funnel, tables             |

### API (`app/api`)

| Route                     | Query params                                                       | Returns                                                                                                     |
| ------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `/api/stores`             | —                                                                  | Stores with open/closed status                                                                              |
| `/api/stores/[id]/live`   | —                                                                  | People inside per zone, capacity, alerts, members inside, last 90 min (refetched every 5 s)                 |
| `/api/stores/[id]/pace`   | —                                                                  | KPIs vs. a typical day, forecast, usual peak, hourly profile                                                |
| `/api/overview`           | `store`, `preset` \| `from`+`to`                                   | KPIs + previous-period KPIs                                                                                 |
| `/api/traffic`            | same + `granularity`                                               | Street vs. visitors series (with returning), each point next to the same hour or day of the previous period |
| `/api/zones`              | same                                                               | Visitors, visit rate, dwell per zone                                                                        |
| `/api/funnel`             | same                                                               | Street → entrance → browse → fitting → checkout                                                             |
| `/api/hours`              | same                                                               | Average visitors per hour of day                                                                            |
| `/api/weekday-hours`      | same                                                               | Average visitors per weekday × hour over the range                                                          |
| `/api/compare`            | `preset` \| `from`+`to`                                            | KPIs per store                                                                                              |
| `/api/flows`              | same + `segment` (`all`, `new`, `returning`, `members`)            | Route KPIs vs. previous period, journey (Sankey), zone-to-zone matrix, top routes, cross-store members      |
| `/api/visits`             | `store`, `date`, `segment`, `sort`, `dir`, `page`, `pageSize`      | Paginated visits                                                                                            |
| `/api/visits/stats`       | `store`, `date`, `segment`                                         | Visit-length histogram (2-min buckets, finished visits) and median time per zone (completed stops)          |
| `/api/visits/[id]`        | —                                                                  | One visit with its timeline (time each zone was reached, when they left)                                    |
| `/api/customers`          | `q`, `store`, `tier`, `segment`, `sort`, `dir`, `page`, `pageSize` | Paginated members with 30-day activity, last visit and segment                                              |
| `/api/customers/overview` | `store`                                                            | Programme KPIs (30 days vs. the 30 before) and segments by tier                                             |
| `/api/customers/[id]`     | —                                                                  | Member profile: activity, 90-day calendar, stores, zones, recent visits                                     |
| `/api/chat`               | POST (AI SDK UI messages)                                          | Streamed assistant response                                                                                 |

`store` is a store id or `all`. `preset` is `today`, `yesterday`, `7d` or `30d`
(the last two include today). Custom ranges are capped at 92 days.

## Data simulation

There is no database. All data is generated deterministically:

1. **Seeded per store-day.** `simulateDay(store, date)` uses an RNG seeded with
   `"<storeId>|<date>"`, so the same day always produces the same visitors on
   every server instance, for every user and for the AI tools.
2. **Realistic shape.** Street traffic follows an hourly curve (lunch and
   after-work peaks) × weekday factor × noise. Each passer-by walks in with the
   store's capture rate; each visitor picks product zones with zone-specific
   probabilities and walks them in a varying order (popular zones tend to come
   first, via a weighted shuffle), with zone-specific dwell times. The fitting
   rooms follow an apparel zone and strongly raise the chance of reaching
   checkout; afterwards about a third go back to the rail they came from, and
   some take a last look at an earlier zone before paying or leaving. Checkout,
   when reached, is the last stop. Some stores close on Sundays.
3. **Visits are the source of truth.** Daily summaries (hourly buckets per
   zone) are aggregated _from_ the simulated visits, so the visits table,
   the KPIs and the charts always agree.
4. **Live.** For today, data is cut off at the current Madrid time: visits
   after "now" are dropped and the current hour's street count is pro-rated.
   A visit still under way counts only what has happened so far (stops
   reached, time inside so far, checkout once reached), so today never shows
   checkouts that haven't happened yet. Routes (for Flows) count finished
   visits only.
   Each refetch therefore shows new visitors arriving. KPI comparisons for
   "today" use yesterday _up to the same time_, not a full day.
5. **New vs. returning.** Each visit is new or returning (device seen on an earlier day). Returning shares differ per store (tourist flagship vs. local store), drop at weekends, and returning visitors reach checkout slightly more often. Returning anonymous visitors reuse a stable hashed device id from a per-store pool, so the same device shows up on several days; registered members are recognised by their account. _Simplification:_ a returning device's earlier visits are drawn from realistic rates rather than verified one by one, which would require re-simulating months of history per request.
6. **Loyalty members behave like people.** Each member has a seeded, hidden activity level (long-tailed: a few regulars, many occasional shoppers; gold > silver > bronze, capped at a few visits a week), a join date and, for about a fifth, a date they stopped shopping. A member visit picks among members shopping that day, weighted by activity (cumulative weights + binary search), mostly from the store's own members. Nobody visits before joining or after stopping. The dashboard never reads this hidden behaviour: segments and profiles are inferred from visits.
7. **Caching.** Past days never change, so their summaries are memoised per
   server instance (bounded map). A cold 30-day chain query (current + previous
   period, 180 store-days) takes ~0.25 s; warm, ~5 ms.

## Navigation and layout

There is no sidebar. The header holds the brand, a **store picker** and the
**view tabs** (Live, Analytics, Visits, Customers, Flows); below it, the AI
assistant docks on the left and the page fills the rest.

- **URLs are `/<scope>/<view>`**: `/mad-granvia/live`, `/all/analytics`. The
  scope is a store id or `all`. Views and the scopes they accept are defined
  once in `lib/nav.ts`; the header, pages and redirects all read it.
- **Switching** store keeps the view; switching view keeps the store. Views
  that need one store (Live, Visits) show "All stores" disabled with a hint, and
  opening one from "All stores" uses the last single store visited.
- **Redirects** (`next.config.ts`): `/` → `/mad-granvia/live`, `/<scope>` →
  `/<scope>/live`, `/all/<single-store view>` → the flagship store, and the old
  `/stores/<id>` URLs.
- Views not built yet are disabled tabs marked "coming soon".
- **Date range in the URL** for views that use one (Analytics, Flows):
  `?preset=7d` (default) or `?from=YYYY-MM-DD&to=YYYY-MM-DD`, the same keys
  the API takes, validated with the same schema (`lib/range-params.ts`). The
  header carries the range to other range views, and remembers it across a
  detour through a view without one. Custom dates apply on blur or Enter.
- **Analytics** (`/<scope>/analytics`, range in the URL): KPIs vs. the
  previous period; one measure over time (visitors, passers-by or capture
  rate, never two scales on one axis) as bars against the same hours or days of
  the previous period, shown in full so a live day runs against all of
  yesterday, with today's bar lighter while it fills up; the funnel from
  walking in to checkout (passers-by as a headline, conversions only between
  nested steps, since checkout is reached with or without the fitting rooms);
  visitors per zone; a weekday × hour heatmap (needs 7 days or more); new vs.
  returning visitors; and the three stores side by side for the same range.
- **Customers** (`/<scope>/customers`, scope = home store): programme KPIs
  (30 days vs. the 30 before, up to the same time of day), segments by last
  visit (active ≤ 14 days, lapsing ≤ 60, lapsed beyond) that filter the member
  table, and a profile page per member (`/<scope>/customers/<id>`) with a
  90-day visit calendar, stores, zones and recent visits linking to the
  Visits drawer. Table state lives in the URL (`lib/customers-params.ts`).
- **Visits** (`/<store>/visits`) keeps its table state in the URL too:
  `?date=&segment=&sort=&dir=&page=` (`lib/visits-params.ts`; defaults are
  left out). TanStack Table v9 runs in manual mode: sorting and paging are done
  by `/api/visits`, the table only renders the page and owns no data.
  Clicking a row opens a drawer (`?visit=<id>`, so it can be linked and Back
  closes it) with the route on the floor plan and a timeline from
  `/api/visits/[id]`. A visit still in progress shows only what has happened
  so far, in the list and the drawer (`visitAsOf` in the service): real
  sensors can't know the rest of the route. Filters and sorts use the same view.
  Above the table, two charts for the same day and segment: how long visits
  last and median time per zone (`lib/domain/visit-stats.ts`).
- **Flows** (`/<scope>/flows`, range + `?segment=new|returning|members`):
  how visitors move, from the finished-visit routes stored in each daily
  summary (`DaySummary.routes`, one map per visitor kind), so a 30-day chain
  range needs no re-simulation (`lib/domain/flow-stats.ts`). Route KPIs vs.
  the previous period; a journey Sankey (Recharts) where zones are split by
  stop number (1st, 2nd, 3+ stops, then checkout or left without buying),
  which keeps the graph acyclic although people go back to zones; a
  zone-to-zone chord (d3-chord layout, drawn as React SVG) with a from × to
  heatmap matrix as its table view; the top routes with checkout rate; and,
  for All stores, members visiting other stores (chord + table). Zone colours
  are fixed per zone; checkout and outcomes stay neutral.
- **Assistant panel** (`components/assistant/`): lives in the root layout, so
  it keeps its state across navigation. On desktop (≥1024 px) it is a resizable
  panel (react-resizable-panels; open state and width remembered per browser);
  on smaller screens it opens as a sheet. Ctrl/⌘ + I toggles it. It knows the
  current store and view. Until the AI is connected it shows an empty state
  with example questions.
- **Pages size to their container, not the window.** The page area is a CSS
  container, so page grids use container queries (`@3xl:`, `@4xl:`…) and adapt
  when the assistant is open. Only the header uses window breakpoints.

## Live view

The home page is the live view of one store (`/[store]/live`), built for a store manager deciding what to do now:

- **Occupancy vs. capacity**: each store and zone has a capacity (fitting rooms = cubicles). The floor plan is coloured by % of capacity; zones at ≥85% get a warning and at ≥100% a critical alert (status colour + icon + text).
- **Typical day**: the average of the same weekday over the previous 4 weeks, at the same time of day. KPIs, people inside and the hourly chart compare against it, which is fairer than "vs. yesterday".
- **Pace**: visitors so far vs. typical, a full-day forecast (typical day scaled by today's ratio so far, weighted by how much of the day has passed) and the usual peak hour.
- **Loyalty members inside**: registered customers present now, gold and silver first, for clienteling.
- Occupancy is computed from each simulated visit's path and dwell times (`lib/domain/occupancy.ts`); full simulated days are kept in a small LRU cache so the 5-second refresh stays cheap.

### Floor plans

Each store has a floor plan in metres (`lib/domain/layout.ts`, hand-made plans in
`lib/domain/plans/`): building outline, glass shopfront and door, columns,
staff-only areas (hatched, never tracked), zone polygons with label and flow
anchors, fixtures (racks, tables, shelves, fitting cubicles, counters, tills,
plinths, display windows, queue barriers) and sensors with a detection range.
All three plans are hand-designed:

- **Madrid Gran Vía** — 60 × 40 m corner flagship with square pillars.
- **Barcelona Passeig de Gràcia** — 50 × 32 m Eixample building with a
  chamfered corner, a light well and round cast-iron columns.
- **Valencia Colón** — 30 × 20 m neighbourhood store: off-centre door with the
  till beside it, six cubicles along the back wall. Its capacity (40) and
  street traffic are scaled to the smaller floor.

Plans are drawn at one shared scale (14 px per metre), so a smaller store looks
smaller; zone labels and flow arrows scale down slightly in small plans. People
dots keep 0.5 m away from the walls.

The plan is rendered as SVG with toggleable layers (remembered per browser):

- **Occupancy** (default on): zones filled by % of capacity; amber dashed border
  at ≥85%, red at full. Fitting-room capacity is 2 people per cubicle.
- **People** (default on): one dot per person, placed inside the zone polygon
  while avoiding fixtures and columns (people can be inside cubicles);
  re-shuffled on every refresh.
- **Sensors**: nodes with their coverage circle, clipped to the building and street.
- **Flows**: zone-to-zone movements in the last hour, counted from real visit
  paths (`lib/domain/flows.ts`); arrow width scales with the count.

Zones, sensors and flows have hover/focus cards. Tests check that zones plus
staff areas tile each building exactly and that labels, fixtures and sensors
sit inside it.

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

The look is the **Pulse** design system, kept as a design-system artifact.
`app/globals.css` maps its tokens onto shadcn's names (light on
`:root`, dark on `.dark`, toggled by `next-themes`; default follows the OS).

- **Neutrals**: Field grey ground (`--background`), white or near-black
  surfaces (`--card`), Graphite ink. Primary buttons and the chosen segment are
  Graphite (`--primary`), not a brand colour.
- **Ping** (`--ping`, orange) marks only what is live, selected or focused: the
  active tab underline, the focus ring (`--ring`), the sweep in the mark, the
  dot on Ask, selected rows (`--ping-soft`). Orange text is `--ping-text`.
  It never means "bad".
- **Status** good (teal, off the red–green axis), warning (amber) and critical
  (crimson), each with a `-soft` fill, mean state only and always come with an
  icon and text.
- **Chart series** (fixed order): blue `#0081b1`, orange `#e65719`, violet
  `#6741ca`, magenta `#d84497` (dark steps separate), plus neutral
  `--chart-other`. Validated for colour-blind separation and ≥3:1 contrast in
  both modes. Zones keep one colour everywhere through `--zone-*`.
- **Heatmap**: one-hue ramp `--heat-0…5` (step 1 clears 2:1 on the card) with
  `--heat-ink-high` on 4–5; the floor plan's large fills use the lighter
  `--plan-heat-*`.
- **Shape**: 1px borders instead of shadows (only popovers get
  `shadow-popover`), 2–4px corners, `SegmentedControl` for filter rows.
- **Type**: Archivo for text (its wide cut, `font-wide`, for page heads and
  the wordmark), JetBrains Mono (`readout`) for numbers people compare.
- **Logo**: `components/brand/logo.tsx` (`Mark`, `Wordmark`); favicon
  `app/icon.svg`.

## Next.js 16 specifics

- **Cache Components** is enabled (`cacheComponents: true`). Route handlers
  that read `request.url` run at request time. `/api/stores` calls
  `connection()` explicitly because it depends on the current time.
- Components using `useSearchParams` must sit inside `<Suspense>`.
