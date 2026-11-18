@AGENTS.md

# Store Radar — guide for Claude Code

Retail analytics dashboard for a **fictional** fashion chain ("Lumen", 3 stores
in Spain). Take-home project. All data is simulated — never add real company
names, real customer data or code from elsewhere.

Read `docs/ARCHITECTURE.md` before structural changes.

## Commands

- `pnpm dev` — dev server
- `pnpm test` — Vitest (domain layer)
- `pnpm typecheck` · `pnpm lint` · `pnpm build`
- Run `pnpm typecheck && pnpm lint && pnpm test` before declaring work done.

## Rules

- **Domain stays pure.** `lib/domain/**` must not import React, Next.js or
  anything from `app/` or `components/`. Add new metrics there, with tests.
- **One source of truth.** API routes and AI tools are thin wrappers over
  `lib/domain/service.ts` and validate input with `lib/domain/schemas.ts`.
  Never compute KPIs in components or route handlers.
- **Determinism.** Never use `Math.random()` or `Date.now()` inside the domain;
  use `createRng(seed)` and pass `now: LocalDateTime` explicitly (service
  functions default it to `localNow()`). Changing generator logic changes all
  numbers — update tests accordingly.
- **Times are store-local** (Europe/Madrid). Dates are `YYYY-MM-DD` strings.
- **Client data** goes through hooks in `lib/queries.ts` (TanStack Query) —
  no ad-hoc `fetch` in components. Infer response types from the service.
- **UI** uses shadcn/ui components from `components/ui` (base-nova style,
  Base UI primitives). Add new ones with `pnpm dlx shadcn@latest add <name>`.
- **Library versions are newer than most training data:** Next.js 16 (Cache
  Components on), AI SDK v7, TanStack Table v9, Zod v4. Check bundled docs
  (`node_modules/next/dist/docs`, `node_modules/ai/docs`,
  `node_modules/@tanstack/react-table/skills`) before using unfamiliar APIs.
- Format with Prettier (`pnpm format`).
