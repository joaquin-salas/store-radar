# Store Radar — guide for Claude Code

Retail analytics dashboard for a **fictional** fashion chain ("Lumen", 3 stores
in Spain). Take-home project. All data is simulated — never add real company
names, real customer data or code from elsewhere.

Read `docs/ARCHITECTURE.md` before structural changes.

## Commands

- `pnpm dev` — dev server (http://localhost:3000 → Madrid Gran Vía live view)
- `pnpm test` — Vitest (domain layer)
- `pnpm typecheck` (runs `next typegen` first) · `pnpm lint` · `pnpm build` · `pnpm format`

## Where things live

| Path                                  | What                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| `lib/domain/`                         | Pure TS: catalog, seeded generator, metrics, live snapshot, typical day, flows, floor plans |
| `lib/domain/plans/`                   | Hand-made floor plan per store (metres)                                                     |
| `lib/domain/service.ts`, `schemas.ts` | Query functions + Zod inputs shared by API and (future) AI tools                            |
| `app/api/`                            | Thin route handlers over the domain                                                         |
| `lib/queries.ts`                      | TanStack Query hooks (response types inferred from the domain)                              |
| `lib/nav.ts`                          | Views, store scopes and `/<scope>/<view>` URL helpers (header, pages, redirects)            |
| `lib/range-params.ts`                 | Date range in the page URL (`?preset=` / `?from=&to=`)                                      |
| `lib/visits-params.ts`                | Visits table state in the URL (date, segment, sort, page)                                   |
| `lib/customers-params.ts`             | Members table state in the URL (search, tier, segment, sort, page)                          |
| `app/[scope]/<view>/`                 | One folder per view, e.g. `app/[scope]/live/page.tsx`                                       |
| `components/shell/`                   | App frame: header (store picker, view tabs), resizable workspace                            |
| `components/assistant/`               | Assistant panel (docked on desktop, sheet on mobile) and its open state                     |
| `components/live/`                    | Live view: floor plan, right-now panel, pace, loyalty members                               |
| `components/flows/`                   | Flows view: journey Sankey, chord diagram (d3-chord), zone matrix, top routes               |
| `app/globals.css`                     | Theme tokens (light on `:root`, dark on `.dark`)                                            |

## Rules

- **Next.js 16 is newer than your training data.** Cache Components and Partial
  Prefetching are on. Read the bundled guide in `node_modules/next/dist/docs/`
  before writing Next.js code, and heed deprecation notices. Same for AI SDK v7
  (`node_modules/ai/docs`), TanStack Table v9
  (`node_modules/@tanstack/react-table/skills`) and Zod v4.
- **Domain stays pure.** `lib/domain/**` must not import React, Next.js or
  anything from `app/` or `components/`. Add new metrics there, with tests.
- **One source of truth.** API routes and AI tools are thin wrappers over
  `lib/domain/service.ts` and validate input with `lib/domain/schemas.ts`.
  Never compute KPIs in components or route handlers.
- **Hidden truth stays hidden.** Simulated member behaviour (`memberBehaviour`) is for the
  generator and its tests; queries and UI infer everything from visits.
- **Determinism.** Never use `Math.random()` or `Date.now()` inside the domain;
  use `createRng(seed)` and pass `now: LocalDateTime` explicitly (service
  functions default it to `localNow()`). Changing generator logic shifts all
  numbers — rerun the realism tests and update them if needed.
- **Times are store-local** (Europe/Madrid). Dates are `YYYY-MM-DD` strings.
- **Client data** goes through hooks in `lib/queries.ts` — no ad-hoc `fetch` in
  components.
- **UI** uses shadcn/ui from `components/ui` (base-nova style, Base UI
  primitives). Add components with `pnpm dlx shadcn@latest add <name>`.

## Floor plans

- Units are metres, y grows from the back wall to the shopfront. Each store has
  a plan in `lib/domain/plans/`; `layout.ts` normalises it for the UI.
- Zones plus staff areas must tile the building exactly; labels, fixtures and
  sensors must sit inside it (`layout.test.ts` checks this).
- No door sensor: entry = street node + entrance node.
- Zone capacities live in `catalog.ts`. Fitting rooms = 2 people per cubicle.
  Keep store capacity, street traffic and floor size consistent (busy-day peaks
  around 60–75% full).
- Plans render at one shared scale (`PX_PER_METRE`), so smaller stores look smaller.

## Theme and charts

- Use the tokens in `app/globals.css`; never hard-code colours in components.
- Chart series colours are validated for colour-blind separation and contrast in
  light and dark. If you change them, re-validate the whole set.
- The look is the **Pulse** design system (see `docs/ARCHITECTURE.md` › Theme):
  Graphite primary, one Ping orange (`--ping`) only for live, selected or
  focused, Archivo + JetBrains Mono (`readout` for numbers), 1px borders, small
  corners, `SegmentedControl` for filter rows.
- Status colours (good / warning / critical) mean status only and always come
  with an icon and text. Ping orange never means "bad".
- Check UI changes in **light and dark**, at **desktop and mobile** width, and
  with the assistant panel **open and closed**.
- Page layouts use **container queries** (`@3xl:grid-cols-2`), not window
  breakpoints (`lg:`), because the assistant panel narrows the page.

## Dev server gotchas (Windows)

- After editing theme tokens in `globals.css`, or after switching branches with
  the server running, Turbopack can keep serving stale CSS. Stop the server by
  port, delete `.next/dev`, restart, then confirm the served CSS has the new
  values before judging screenshots.
- A dev server killed mid-session can leave an orphan on port 3000 that answers
  every request with 500. Stop that process and start a fresh one.

## Workflow

1. **Work on `dev`.** Never edit or commit on `main` directly. Check
   `git branch --show-current` before starting.
2. **Verify before reporting done:** `pnpm format`, `pnpm typecheck`,
   `pnpm lint`, `pnpm test`, `pnpm build`, and check UI changes in the browser.
3. **Never commit or push on your own.** Leave changes uncommitted and report
   what changed. Commit only when the user says so.
4. **Commits use [Conventional Commits](https://www.conventionalcommits.org/):**
   `<type>(<scope>): <summary>` in the imperative, lower case, no trailing
   period. Types: `feat`, `fix`, `refactor`, `test`, `docs`, `style`, `chore`,
   `ci`, `perf`. Scopes: `domain`, `api`, `live`, `ui`, `ai`, `docs`, `ci`.
   Example: `feat(live): add occupancy vs. capacity alerts`. Add a body when
   the why isn't obvious. One logical change per commit.
5. **Shipping to `main`** happens only when the user asks: switch to `main`,
   fast-forward merge `dev`, push, confirm CI passes, switch back to `dev`,
   then restart the dev server with a clean `.next/dev`.
