# Design: Migrate reignova-pay-backend to Supabase via sequelize-cli

**Date:** 2026-09-21
**Status:** Approved

## Goal

Move the payment service off its local dockerized PostgreSQL onto a hosted Supabase
PostgreSQL database, and make Sequelize the single owner of configuration, models,
migrations and seeders. The `@supabase/supabase-js` client is deliberately **not**
used: the service talks to Supabase over the plain PostgreSQL wire protocol, exactly as
it talks to any other Postgres.

## Background

The service currently connects to a Postgres container defined in `docker-compose.yml`
on host port 5435. Schema changes run through **umzug**: `src/database/migrate.ts`
imports eleven TypeScript migrations by hand and registers them in an array. Database
lifecycle (`CREATE DATABASE` / `DROP DATABASE`) runs through `src/database/manage-db.ts`
using a raw `pg` client. Seeding is a bespoke `src/database/seed.ts` that calls
model-level functions rather than Sequelize seeders.

The sibling project `reignova-events-backend` already uses `sequelize-cli` with a
`.sequelizerc` pointing at a CommonJS config file, migrations in `src/migrations` and
seeders in `src/seeders`. This design brings the payment service in line with that
layout.

Two constraints shape everything below:

1. **Supabase grants no superuser.** `CREATE DATABASE` and `DROP DATABASE` are
   impossible; the `postgres` database already exists. Any workflow that recreates a
   database from scratch has to be replaced.
2. **`sequelize-cli` is CommonJS; this package is ESM.** `package.json` declares
   `"type": "module"` and TypeScript is configured for `NodeNext`. sequelize-cli loads
   its rc file with a synchronous `require()`, so file extensions have to be chosen
   deliberately.

## Decisions

| Decision | Choice |
| --- | --- |
| Migration runner | Adopt `sequelize-cli` fully; remove umzug |
| Test database | Keep local Docker Postgres for tests only |
| Supabase endpoint | Session pooler, a single `DATABASE_URL` for app and CLI |
| `db:create` / `db:drop` | Removed; `db:reset` becomes seed-undo, migrate-undo, migrate, seed |

### Why the session pooler

Supabase exposes three endpoints. Direct connections to `db.<ref>.supabase.co:5432`
are IPv6-only and fail on most networks and CI runners without the paid IPv4 add-on.
The transaction pooler on port 6543 does not hold a session, so it cannot run DDL with
prepared statements and would force a second connection string for migrations. The
session pooler (`aws-1-<region>.pooler.supabase.com:5432`, user `postgres.<project-ref>`)
is IPv4-reachable, supports prepared statements and holds a real session, so one
`DATABASE_URL` serves both the long-running Express server and sequelize-cli.

### Why `.sequelizerc` is safe in an ESM package

`sequelize-cli@6.6.5` reads its rc file with `require(path.resolve(cwd, '.sequelizerc'))`
in `lib/core/yargs.js`. Under `"type": "module"` that would normally throw
`ERR_REQUIRE_ESM` — but Node only consults the nearest `package.json` `type` field for
files whose name ends in `.js`. An **extensionless** `.sequelizerc` bypasses that check
and loads as CommonJS. This was verified empirically against Node in this environment
before the design was accepted.

The config file that `.sequelizerc` points at is loaded differently: `config-helper.js`
calls `importModule()`, a dynamic `import()`, then reads `module.default`. Importing a
`.cjs` file yields `{ default: module.exports }`, so a CommonJS config file works and can
use `require('dotenv').config()`.

Migration and seeder files are matched by
`/^(?!.*\.d\.ts$).*\.(cjs|js|cts|ts)$/` in `lib/core/migrator.js`, so the `.cjs`
extension is supported natively. Note that `.mjs` is **not** in that pattern.

## Architecture

### Connection configuration

`src/config/database.ts` keeps its existing shape — prefer `DATABASE_URL`, fall back to
discrete `DB_*` parameters — with two changes:

- SSL becomes `{ require: true, rejectUnauthorized: false }`. Supabase terminates TLS
  with its own CA, which Node does not trust by default.
- The `DB_POOL_MAX` default drops from 20 to 10, because Supabase pooler connection
  budgets are far smaller than a local Postgres allows.

`src/config/env.ts` retains every `DB_*` variable. They are still used by the local test
database and by the `test` block of the CLI config.

### sequelize-cli wiring

Two new files.

**`.sequelizerc`** — extensionless, CommonJS, at the repository root:

    const path = require('path');

    module.exports = {
      config: path.resolve('src', 'config', 'sequelize.cjs'),
      'models-path': path.resolve('src', 'models'),
      'seeders-path': path.resolve('src', 'seeders'),
      'migrations-path': path.resolve('src', 'migrations'),
    };

**`src/config/sequelize.cjs`** exports three environment blocks:

- `development` and `production` — `use_env_variable: 'DATABASE_URL'`,
  `dialect: 'postgres'`, `dialectOptions.ssl = { require: true, rejectUnauthorized: false }`,
  `migrationStorageTableName: 'SequelizeMeta'`, `seederStorageTableName: 'SequelizeData'`,
  `seederStorage: 'sequelize'`.
- `test` — the local Docker Postgres on `localhost:5435`, database `payment_service_test`,
  no SSL, logging off.

`seederStorage: 'sequelize'` must be set explicitly; sequelize-cli defaults to `none`,
which would re-run every seeder on each invocation.

`models-path` is set for completeness only. Models are hand-written TypeScript classes
and `model:generate` will not be used, since it emits CommonJS JavaScript that does not
fit the existing `src/models/*.model.ts` structure.

### Migrations

The eleven migrations move from `src/database/migrations/*.ts` to `src/migrations/*.cjs`
and are rewritten from the umzug context signature to the sequelize-cli signature:

    'use strict';

    module.exports = {
      async up(queryInterface, Sequelize) { /* ... */ },
      async down(queryInterface, Sequelize) { /* ... */ },
    };

`DataTypes.X` becomes `Sequelize.X` throughout, taken from the second argument.

Numeric prefixes are preserved (`001-create-applications.cjs` through
`011-create-admin-users.cjs`). sequelize-cli orders migrations by filename, and `001-`
sorts before any future timestamped filename such as `20261001120000-...`, so mixing the
two conventions later is safe.

`src/database/migrate.ts` is deleted and `umzug` is removed from dependencies.

#### Enum teardown (correctness fix)

`queryInterface.dropTable` does not drop the PostgreSQL enum type that `createTable`
implicitly created, so `db:migrate:undo:all` leaves the types behind.

This does **not** break `db:reset`. Sequelize 6.37's Postgres query generator emits
`CREATE TYPE` wrapped in `DO $$ … EXCEPTION WHEN duplicate_object THEN null; END $$`
(`node_modules/sequelize/lib/dialects/postgres/query-generator.js`), so re-creating an
existing enum type is a silent no-op rather than an error. The failure mode is quieter and
worse than a broken reset: the orphaned type survives with its **old** value list, and the
next time a migration changes an enum's members, a rebuilt schema silently keeps the stale
definition. Leftover types also accumulate as schema debt that nothing ever cleans up.

Every `down` that creates an enum therefore gains an explicit
`DROP TYPE IF EXISTS "<name>"` after the table or column is removed.

Eight enum types exist across the migration set. Two of them — `enum_payments_type` in
008 and `enum_checkouts_status` in 009 — are **already** dropped correctly by the existing
`down` functions, so their behaviour is preserved as-is during conversion. The remaining
six need the drop added:

| Migration | Enum type | Already handled? |
| --- | --- | --- |
| 001-create-applications | `enum_applications_status` | No — add |
| 002-create-payments | `enum_payments_status` | No — add |
| 004-create-webhook-events | `enum_webhook_events_status` | No — add |
| 005-create-notifications | `enum_notifications_status` | No — add |
| 008-add-payment-type-and-payout-columns | `enum_payments_type` | Yes |
| 009-create-checkouts | `enum_checkouts_status` | Yes |
| 011-create-admin-users | `enum_admin_users_role` | No — add |
| 011-create-admin-users | `enum_admin_users_status` | No — add |

Migration 008 adds its enum through `addColumn`, so its `down` drops the column first and
the type second.

### Seeders

`src/database/seeders/admin-user.seeder.ts` becomes a sequelize-cli seeder at
`src/seeders/<timestamp>-admin-user.cjs`. It uses `queryInterface.bulkInsert` against
`admin_users` with snake_case column names, because seeders run below the model layer and
receive no field mapping.

The seeder generates the UUID itself with `crypto.randomUUID()` rather than relying on a
model default, sets `created_at`, `updated_at` and `last_active` explicitly, and first
issues a `SELECT` on the email so that a re-run is a no-op rather than a unique-constraint
violation. Its `down` deletes the row by email.

The seeded record matches current behaviour: email `sntandu@reignovatechnologies.com`,
name `Shedrack Ntandu`, role `SUPER_ADMIN`, status `ACTIVE`, `password_hash` left null.

`src/database/seed.ts` and `src/database/seeders/index.ts` are deleted. Execution state
lives in the `SequelizeData` table.

### Scripts

`package.json` scripts become:

| Script | Command |
| --- | --- |
| `db:migrate` | `sequelize-cli db:migrate` |
| `db:migrate:undo` | `sequelize-cli db:migrate:undo` |
| `db:migrate:undo:all` | `sequelize-cli db:migrate:undo:all` |
| `db:migrate:status` | `sequelize-cli db:migrate:status` |
| `db:seed` | `sequelize-cli db:seed:all` |
| `db:seed:undo` | `sequelize-cli db:seed:undo:all` |
| `db:reset` | `node scripts/db-reset.cjs` |
| `migration:create` | `sequelize-cli migration:create --name` |
| `seed:create` | `sequelize-cli seed:create --name` |

`db:reset` is a small CommonJS wrapper rather than a shell chain, for two reasons: it must
refuse to run when `NODE_ENV=production`, and `&&` chains behave inconsistently across the
PowerShell and bash shells used on this machine. The wrapper runs `db:seed:undo:all`,
then `db:migrate:undo:all`, then `db:migrate`, then `db:seed:all`, aborting on the first
non-zero exit.

The seeder undo comes first, while the tables still exist. `db:migrate:undo:all` drops the
tables the migrations created, but the `SequelizeData` bookkeeping table is created by
sequelize-cli itself rather than by a migration, so it survives. Without that first step
the closing `db:seed:all` would find the seeder already recorded, report "No seeders
found", and leave the table empty — `db:reset` would restore the schema but not the seed
data on every run after the first. The step is safe on a never-seeded database:
sequelize-cli creates `SequelizeData` when it is missing and finds nothing to undo.

Removed: `db:create`, `db:drop`, and every `*:prod` variant. The `*:prod` scripts existed
only because `tsx` was unavailable in the production image; `sequelize-cli` runs the same
way in both environments, so the split is unnecessary.

### Dependencies

Added: `sequelize-cli` and `pg-hstore`, which Sequelize's Postgres dialect requires for
hstore and JSON handling. `sequelize-cli` goes in `dependencies` rather than
`devDependencies` so migrations can be run from the production image, matching
`reignova-events-backend`.

Removed: `umzug`, and `@supabase/supabase-js`, which is declared but imported nowhere in
`src/` or `tests/`.

### Docker and environment

`docker-compose.yml` is reduced to the `postgres` service alone, repurposed as the test
database: port 5435, database `payment_service_test`. The `payment-service` application
service is removed — it hardcoded a local `DATABASE_URL` alongside production-looking
`ADMIN_API_KEY` and `API_KEY_PEPPER` values, and the application now targets Supabase.

`Dockerfile` is unchanged and remains the deployment artifact; it receives its database
configuration through environment variables at run time.

`.env.example` documents the Supabase session-pooler URL format with placeholders and
sets `DB_SSL=true`. The real `.env` is the operator's to fill in; it is gitignored and no
credentials are committed.

### Tests

`tests/helpers/setup.ts` truncates tables rather than recreating the schema, so it needs
no change, and `vitest.config.ts` already pins `DATABASE_URL` and `DB_NAME` to the local
test database.

One change to `vitest.config.ts` is required, however. `src/config/database.ts` reads
`DB_SSL` from the process environment, and `dotenv` will load `DB_SSL=true` from the
developer's `.env` even during a test run — so the runtime Sequelize instance would
attempt TLS against the local Docker Postgres and fail. The `test.env` block in
`vitest.config.ts` therefore gains `DB_SSL: 'false'` alongside the existing overrides.
This mirrors the `test` block in `src/config/sequelize.cjs`, which likewise disables SSL.

Preparing the test database becomes `docker compose up -d postgres` followed by
`NODE_ENV=test pnpm db:migrate`.

### Documentation

The `README.md` database sections are updated to cover Supabase setup, where to find the
session-pooler connection string, the new script names, and the test-database workflow.

## Error handling

Connection failures continue to surface through `testDatabaseConnection()` in
`src/config/database.ts`, which logs and rethrows during startup. Two Supabase-specific
failure modes are documented in `README.md` because they are easy to misdiagnose:

- `SELF_SIGNED_CERT_IN_CHAIN` or `UNABLE_TO_VERIFY_LEAF_SIGNATURE` means `DB_SSL` is unset
  or the `ssl` dialect option is missing.
- `password authentication failed` most often means a password containing reserved
  characters was not percent-encoded inside `DATABASE_URL`, or that the username omits the
  `postgres.<project-ref>` form the pooler requires.

## Verification

The work is complete when all of the following hold:

1. `pnpm db:migrate` against Supabase succeeds and `pnpm db:migrate:status` reports all
   eleven migrations as `up`.
2. `pnpm db:seed` creates the admin user, and running it a second time is a no-op.
3. `pnpm db:reset` succeeds **twice in a row**.
4. After `db:migrate:undo:all`, `SELECT typname FROM pg_type WHERE typname LIKE 'enum_%'`
   returns zero rows. This — not the reset succeeding — is what proves the enum-teardown
   fix, since a leaked type does not make the reset fail.
5. `pnpm db:reset` refuses to run when `NODE_ENV=production`.
6. `pnpm build` compiles with no TypeScript errors.
7. `pnpm lint` reports no *new* errors. It does not pass outright: the repository carries
   35 pre-existing `@typescript-eslint/no-explicit-any` and `no-namespace` errors across
   `src/controllers/admin/`, `src/integrations/pawapay/`, `src/middleware/` and
   `src/services/`, all of which predate this work and are out of scope. Note that the
   `lint` script's glob is `src/**/*.ts`, so it never covers the new `.cjs` files at all.
8. `pnpm test` passes against the local Docker Postgres.
9. Searching `src`, `tests` and `package.json` for `umzug`, `supabase-js` or `manage-db`
   returns no matches.

## Assumptions

1. **No data migration.** The Supabase database starts empty and its schema is built
   entirely from migrations plus the seeder. Existing local development data is abandoned.
   Note that the old umzug `SequelizeMeta` rows recorded migration names without a file
   extension, whereas sequelize-cli records them with one — so any pre-existing database
   would re-run every migration. This is harmless only because we start empty.
2. The operator supplies the real Supabase `DATABASE_URL`. No credentials are invented or
   committed.
3. Backend-only change. The `frontend/` workspace and the `docs/` API specifications are
   untouched.

## Out of scope

- Supabase Row Level Security, Auth, Storage, Realtime and Edge Functions.
- Any use of the `@supabase/supabase-js` client.
- Connection-pooling changes beyond the `DB_POOL_MAX` default.
- Restructuring models, repositories, services or routes.
