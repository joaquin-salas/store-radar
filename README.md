# Store Radar

Retail analytics dashboard for **Lumen**, a fictional fashion chain with three
stores across Spain. Sensors in each store count street passers-by and track
anonymous visitors through zones (entrance, womenswear, menswear, kids, fitting
rooms, checkout). Some visitors are identified as registered loyalty
customers. The dashboard shows live KPIs, charts and tables, and an AI
assistant answers questions about the data.

Take-home project for Fusuma. **Live demo: https://store-radar-ten.vercel.app**

## Features

| View          | What it shows                                                                                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Live**      | One store right now: floor plan coloured by how full each zone is, people inside vs. capacity and a typical day, alerts, today's pace and forecast, members in store  |
| **Analytics** | KPIs vs. the previous period, visitors over time, the funnel from street to checkout, zones, a weekday × hour heatmap, new vs. returning, and the stores side by side |
| **Visits**    | Every visit of a day, filterable and sortable, with how long visits last; each visit opens with its route on the floor plan and a timeline                            |
| **Customers** | Loyalty programme KPIs, members by activity segment, and a profile per member (visit calendar, stores, zones, recent visits)                                          |
| **Flows**     | How visitors move: a journey Sankey, zone-to-zone moves, the most common routes and members shopping at other stores                                                  |

Every view works for one store or, where it makes sense, the whole chain, and
keeps its filters in the URL, so any screen can be shared as a link.

**AI assistant** (Ask, or Ctrl/⌘ + I). Ask a question in plain language and
get the answer as a chart, table, KPI tiles or a list, built on the fly from the
same data as the dashboard: the model only chooses what to query and how to show
it, never the numbers. Charts open full screen and download as CSV or SVG; links
in answers open the matching view. It knows which store, view and date range
you're looking at.

## Stack

Next.js 16 (App Router) · TypeScript · shadcn/ui · Recharts · TanStack Query ·
TanStack Table · Vercel AI SDK + AI Gateway · Zod · Vitest · deployed on Vercel · built with
Claude Code.

## Getting started

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

The dashboard needs no configuration: all data is simulated in code.

**The assistant** needs access to the [Vercel AI Gateway](https://vercel.com/ai-gateway). Either:

- link the folder to a Vercel project and pull its token: `vercel link`, then
  `vercel env pull .env.local` (the token expires after about 12 hours; pull
  again to refresh it), or
- create an AI Gateway API key and put it in `.env.local` as
  `AI_GATEWAY_API_KEY` (see `.env.example`).

Without either, the dashboard works and the assistant says it isn't connected.
On Vercel nothing is needed: deployments authenticate with their own token.

| Script           | What it does              |
| ---------------- | ------------------------- |
| `pnpm dev`       | Development server        |
| `pnpm build`     | Production build          |
| `pnpm test`      | Unit tests (domain layer) |
| `pnpm typecheck` | TypeScript check          |
| `pnpm lint`      | ESLint                    |
| `pnpm format`    | Prettier                  |

## Metrics

All times are store-local (Europe/Madrid). Street counts only include opening
hours.

| KPI               | Definition                                                  |
| ----------------- | ----------------------------------------------------------- |
| Street passers-by | People detected by the street sensor during opening hours   |
| Visitors          | People who walked in (entrance sensor)                      |
| Capture rate      | Visitors ÷ street passers-by                                |
| Avg dwell time    | Mean total time inside the store per visit                  |
| Checkout rate     | Visitors who reached the checkout zone ÷ visitors           |
| Registered share  | Visitors identified as loyalty members ÷ visitors           |
| Returning share   | Visitors whose device was seen on an earlier day ÷ visitors |
| Peak hour         | Hour of day with the most visitors                          |
| Zone visit rate   | Visitors who passed through a zone ÷ store visitors         |

On the live view, KPIs are compared with a **typical day**: the average of the same weekday over the previous 4 weeks, up to the same time of day.

| Live KPI      | Definition                                                               |
| ------------- | ------------------------------------------------------------------------ |
| People inside | Visitors in the store right now (entered, not yet left)                  |
| Capacity used | People inside ÷ store capacity; per zone, people in zone ÷ zone capacity |
| vs. typical   | Relative difference with the typical day at the same time                |
| Forecast      | Expected visitors for the full day, based on the pace so far             |

## Architecture

One Next.js app with four layers: UI → TanStack Query hooks → Route Handlers →
a pure-TypeScript domain layer that both the API and the AI tools call. Data
is simulated deterministically (seeded per store and day), with "live" data
cut off at the current time.

The assistant (`POST /api/chat`) streams answers from a small model through the
AI Gateway, with a fallback model. Its tools are thin wrappers over the same
domain functions and input schemas as the API, and a flexible metric query
backs the ad-hoc charts; tests check its totals match the dashboard's.
Cost guards cap steps, history, message length and requests per visitor, and
the AI Gateway budget is the hard limit.

Details and trade-offs: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Disclaimer

All stores, customers and numbers are fictional and generated by code.
