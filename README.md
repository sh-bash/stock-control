# stock_control — Inventory Management System

Nuxt 3 + Drizzle ORM + PostgreSQL. Full spec: [`docs/PRD.md`](docs/PRD.md).

## 1. Prerequisites

- Node.js 18+
- PostgreSQL 14+ (native `RANGE` partitioning on `stock_ledger` requires a real Postgres instance, not SQLite/etc.)

## 2. Setup from zero

### 2.1 Install dependencies

```bash
npm install
```

### 2.2 Create the database

```bash
psql -U postgres -c "CREATE DATABASE stock_control;"
```

### 2.3 Environment variables

Create `.env` in the project root:

```env
DATABASE_URL=postgres://postgres:<your-password>@localhost:5432/stock_control

JWT_ACCESS_SECRET=<random-long-string>
JWT_REFRESH_SECRET=<random-long-string>
JWT_ACCESS_EXPIRES_IN=30m
JWT_REFRESH_EXPIRES_IN=14d
```

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string used by both the app (`server/db/client.ts`) and all scripts (migrate/seed/tests) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Signing secrets for access/refresh tokens — use different, non-trivial values in any shared environment |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | Token lifetimes (accepts values like `30m`, `14d`) |

### 2.4 Run migrations

```bash
npm run db:migrate
```

This runs `server/db/migrate.ts`, which applies everything under `server/db/migrations/` — including the hand-written `stock_ledger` partitioning statements (native Postgres `PARTITION BY RANGE (transaction_date)`, monthly partitions) that `drizzle-kit generate` cannot express on its own.

If the schema (`server/db/schema.ts`) changes, regenerate the migration first:

```bash
npm run db:generate
npm run db:migrate
```

### 2.5 Seed initial data

```bash
npm run db:seed
```

Creates the initial admin user plus baseline master data used across the app (check `server/db/seed.ts` for exact contents/credentials).

### 2.6 Run the dev server

```bash
npm run dev
```

App runs at `http://localhost:3000`. Login page is the entry point; after auth it redirects to `/dashboard`.

### 2.7 Scheduled jobs / scheduler

Background jobs (movement classification, aging check, stock valuation snapshot, stock reconciliation — §6.5/§7 Fase 7) are registered as Nitro Scheduled Tasks in `nuxt.config.ts` (`nitro.scheduledTasks`) and only fire on their cron schedule while the Nuxt server process (dev or built) is running — there is no separate scheduler process to start.

To run any job on demand (for testing, or to backfill), use its API endpoint instead of waiting for the cron:

```bash
curl -X POST http://localhost:3000/api/v1/jobs/movement-classification/run -H "Authorization: Bearer <access_token>"
curl -X POST http://localhost:3000/api/v1/jobs/aging-check/run -H "Authorization: Bearer <access_token>"
curl -X POST http://localhost:3000/api/v1/jobs/stock-valuation-snapshot/run -H "Authorization: Bearer <access_token>"
curl -X POST http://localhost:3000/api/v1/jobs/stock-reconciliation/run -H "Authorization: Bearer <access_token>"
```

Every run (scheduled or manual) is recorded in `job_execution_logs`, viewable at `/jobs/dashboard` in the app or via `GET /api/v1/jobs/logs`.

## 3. Testing

### 3.1 Unit / integration tests

```bash
npm run test        # single run
npm run test:watch  # watch mode
```

Tests run against the **real database** pointed to by `DATABASE_URL` (same pattern as this project's manual QA throughout development) — each test file creates its own product/warehouse/PO/etc. fixtures with a random suffix and tears them down in `afterAll`, so it's safe to run against a shared dev database. Do not point `DATABASE_URL` at a production database when running tests.

Covers the two most critical functions per §6:
- `consumeStock` (§6.1, FIFO core) — exact depletion, insufficient-stock rollback, multi-layer weighted-average cost
- `allocateShippingCost` (§6.3) — `per_qty` / `per_value` / `per_weight`, and rejection of an unknown allocation method

### 3.2 FIFO concurrency load test

```bash
npm run load-test:fifo
```

Fires 20 concurrent `consumeStock` calls against the same product+warehouse with exactly enough stock for 10 of them to succeed, then asserts: no negative `qty_on_hand`, exactly the expected number of successes/failures, and ledger entry count matches successful consumptions exactly (proves the `FOR UPDATE` row-locking in `consumeLayersFifo` / `decrementStockSummaryGuarded` serializes correctly under contention).

## 4. API Documentation (OpenAPI / Swagger)

```bash
npm run docs:openapi   # regenerates public/openapi.json from the server/api/v1 file tree
```

Then open **`/docs/api`** in the running app (works without login) for the interactive Swagger UI, or fetch the raw spec at **`/openapi.json`**.

The spec is generated from the file-based route tree itself (`scripts/generate-openapi.ts`), so it never drifts from the actual endpoints — every file under `server/api/v1/**/*.<method>.ts` becomes one operation, tagged by its top-level resource folder. Where a route validates its body with zod (`const schema = z.object({...})`), the literal schema is embedded in that operation's description. Run `npm run docs:openapi` again after adding/removing endpoints or changing a validation schema — it is not regenerated automatically on `npm run dev`/`build`.

## 5. Project structure

```
server/
  api/v1/          # Nitro file-based routes — one file per endpoint
  services/        # business logic (consumeStock, allocateShippingCost, approval engine, etc.)
  repositories/     # DB queries (Drizzle)
  jobs/            # scheduled job implementations, wrapped by runJobWithLogging()
  tasks/           # Nitro task entrypoints (cron-triggered)
  db/              # schema.ts, migrations, migrate/seed/rebuild scripts
pages/             # Nuxt pages (one per screen)
components/        # shared Vue components (MasterCrud, NotificationBell, ToastStack)
stores/            # Pinia stores (auth, notifications)
scripts/           # one-off/dev scripts (openapi generation, swagger-ui asset copy, load test)
tests/             # vitest integration tests
docs/PRD.md        # full product/technical spec, source of truth for all 10 build phases
```

## 6. Before production

- **Secrets**: replace the placeholder JWT secrets with strong random values per environment; never commit `.env`.
- **DB credentials**: the local dev `.env` uses a trivial Postgres password — use a real credential + connection pooling (e.g. PgBouncer) in production.
- **CORS / HTTPS**: not configured here (single-origin dev setup) — add explicit origin/HTTPS handling if the API is consumed by a separate mobile/web client host.
- **Rate limiting**: none of the auth or mutation endpoints are rate-limited; add this before exposing the API publicly.
- **Job scheduling under multiple instances**: Nitro's scheduled tasks run per-process — if this app is ever horizontally scaled, either run jobs from a single dedicated instance or add a distributed lock (`job_execution_logs` currently only records history, it does not itself prevent concurrent runs across processes).
- **Swagger UI exposure**: `/docs/api` is intentionally excluded from the login gate (see `middleware/auth.global.ts`) so it can double as onboarding material for a mobile client team — restrict or remove that exception if the API documentation itself should be private.
- **Load test scope**: `npm run load-test:fifo` covers `consumeStock` concurrency only; the same FOR UPDATE-based locking pattern is reused by the approval engine and SO/DO confirm/approve paths (see the Fase 6/7 concurrency fixes), but those are only covered by the manual curl-based verification recorded in the project history, not by an automated load test.
