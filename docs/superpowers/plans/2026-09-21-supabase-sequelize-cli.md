# Supabase Migration via sequelize-cli — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move reignova-pay-backend off local dockerized PostgreSQL onto Supabase, with `sequelize-cli` owning configuration, migrations and seeders, and no use of `@supabase/supabase-js`.

**Architecture:** The application keeps talking to PostgreSQL over the plain wire protocol; only the connection target and TLS settings change. `umzug` and the hand-written database-lifecycle scripts are replaced by `sequelize-cli`, configured through an extensionless CommonJS `.sequelizerc` that points at `src/config/sequelize.cjs`. Migrations and seeders become `.cjs` files under `src/migrations` and `src/seeders`. Local Docker PostgreSQL is retained solely as the test database.

**Tech Stack:** Node 20+, TypeScript (ESM, `NodeNext`), Express, Sequelize 6, sequelize-cli 6.6.x, PostgreSQL 16, Supabase session pooler, Vitest, pnpm 11.

**Spec:** [docs/superpowers/specs/2026-09-21-supabase-sequelize-cli-design.md](../specs/2026-09-21-supabase-sequelize-cli-design.md)

## Global Constraints

- **Do not install or import `@supabase/supabase-js`.** It is currently a declared dependency that is imported nowhere; it gets removed. All database access is Sequelize over the PostgreSQL protocol.
- This package is ESM (`"type": "module"` in `package.json`). sequelize-cli is CommonJS. Every sequelize-cli-loaded file must be either extensionless (`.sequelizerc`) or `.cjs`. **Never** name one of them `.js` — Node will treat it as ESM and `require()` will throw `ERR_REQUIRE_ESM`.
- sequelize-cli 6.6.5 matches migration and seeder files with `/^(?!.*\.d\.ts$).*\.(cjs|js|cts|ts)$/`. `.mjs` is **not** matched.
- Migration filenames keep their existing numeric prefixes: `001-` through `011-`.
- Supabase grants no superuser. Never write code that issues `CREATE DATABASE` or `DROP DATABASE`.
- Supabase TLS uses its own CA, so SSL options must be `{ require: true, rejectUnauthorized: false }`.
- Never commit real credentials. `.env` is gitignored; only `.env.example` gets placeholders.
- Package manager is **pnpm**. Use `pnpm exec sequelize-cli`, never `npx`.
- `NODE_ENV=test` must resolve to the docker-compose PostgreSQL on `localhost:5435`, database `payment_service_test`, **unconditionally**. The `test` block of `src/config/sequelize.cjs` must not read `DB_*` environment variables: the developer's `.env` sets `DB_PORT=5432` and `DB_NAME=payment_service`, and `dotenv` loads those, so reading them would point `NODE_ENV=test` at the dev database — which the destructive `db:migrate:undo:all` and `db:reset` commands then target. No task may require an inline `DB_PORT=…` override to make `NODE_ENV=test` safe.
- The `frontend/` workspace and the `docs/` API specifications are out of scope and must not be modified.

## File Structure

**Created:**
- `.sequelizerc` — extensionless CommonJS; tells sequelize-cli where config, migrations, seeders and models live.
- `src/config/sequelize.cjs` — the three environment blocks (`development`, `test`, `production`) sequelize-cli connects with.
- `src/migrations/001-create-applications.cjs` … `011-create-admin-users.cjs` — eleven converted migrations.
- `src/seeders/20260921000000-admin-user.cjs` — the admin user seeder.
- `scripts/db-reset.cjs` — guarded undo-all → migrate → seed wrapper.

**Modified:**
- `src/config/database.ts` — SSL options and pool ceiling.
- `src/config/env.ts` — `DB_POOL_MAX` default.
- `vitest.config.ts` — add `DB_SSL: 'false'` to the test env block.
- `package.json` — scripts and dependencies.
- `.env.example` — Supabase session-pooler placeholders.
- `docker-compose.yml` — reduced to the test-database service.
- `README.md` — database setup and script documentation.

**Deleted:**
- `src/database/migrate.ts` (Task 3); `src/database/manage-db.ts` and `src/database/seed.ts` (Task 4)
- `src/database/migrations/` (all eleven `.ts` files)
- `src/database/seeders/` (`index.ts`, `admin-user.seeder.ts`)

**Unchanged:** `src/models/*`, all of `src/services`, `src/repositories`, `src/routes`, `tests/helpers/setup.ts`, `Dockerfile`.

---

### Task 1: Runtime connection configuration

Prepares the application's own Sequelize instance for Supabase TLS before any CLI wiring exists. Nothing here depends on sequelize-cli, so it can be verified with the existing test suite.

**Files:**
- Modify: `src/config/database.ts`
- Modify: `src/config/env.ts`
- Modify: `vitest.config.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `env.DB_SSL` (boolean), `env.DB_POOL_MAX` (number, default `10`), and an exported `sequelize` instance whose SSL is `{ require: true, rejectUnauthorized: false }` when `DB_SSL` is true. Task 2's `src/config/sequelize.cjs` mirrors these SSL settings independently.

- [ ] **Step 1: Run the existing test suite to establish a green baseline**

Start the local Postgres and confirm tests pass before changing anything:

```bash
docker compose up -d postgres
pnpm test
```

Expected: PASS. If the test database does not exist yet, create and populate it first with the current umzug-based scripts, which are still present at this point:

```bash
DB_NAME=payment_service_test pnpm db:create
DATABASE_URL=postgres://postgres:postgres@localhost:5435/payment_service_test pnpm db:migrate
```

- [ ] **Step 2: Lower the `DB_POOL_MAX` default in `src/config/env.ts`**

Supabase pooler connection budgets are much smaller than a local Postgres allows. Change the single line:

```ts
  DB_POOL_MAX: z.coerce.number().default(10),
```

(It currently reads `.default(20)`. Leave `DB_POOL_MIN` at `2` and every other field untouched.)

- [ ] **Step 3: Confirm the SSL options in `src/config/database.ts` are Supabase-correct**

This step is a verification, not an edit — the existing code is already right, and the point is to not "helpfully" tighten it later. The file builds SSL options twice, once in the `DATABASE_URL` branch and once in the discrete-parameter branch. Both currently read:

```ts
      dialectOptions: env.DB_SSL
        ? {
            ssl: {
              require: true,
              rejectUnauthorized: false
            }
          }
        : {}
```

This is already correct for Supabase. Verify both occurrences match exactly and leave them as-is. Do **not** set `rejectUnauthorized: true` — Supabase terminates TLS with its own CA that Node does not trust, and doing so produces `SELF_SIGNED_CERT_IN_CHAIN`.

- [ ] **Step 4: Add `DB_SSL: 'false'` to the Vitest environment**

`src/config/database.ts` reads `DB_SSL` from the process environment, and `dotenv` loads `DB_SSL=true` from the developer's `.env` even during a test run — so the runtime Sequelize instance would attempt TLS against the local Docker Postgres and fail. In `vitest.config.ts`, the `test.env` block becomes:

```ts
    env: {
      DATABASE_URL: 'postgres://postgres:postgres@localhost:5435/payment_service_test',
      DB_NAME: 'payment_service_test',
      DB_SSL: 'false',
      NODE_ENV: 'test'
    },
```

- [ ] **Step 5: Rewrite the database block of `.env.example`**

Replace the existing `# Database Configuration` block with:

```
# Database Configuration — Supabase (session pooler)
#
# Find this string in the Supabase dashboard under:
#   Project Settings -> Database -> Connection string -> Session pooler
#
# The username MUST be in the form postgres.<project-ref>, and any reserved
# characters in the password MUST be percent-encoded (@ -> %40, # -> %23, etc).
DATABASE_URL=postgresql://postgres.your-project-ref:your-url-encoded-password@aws-1-eu-central-1.pooler.supabase.com:5432/postgres
DB_SSL=true
DB_POOL_MIN=2
DB_POOL_MAX=10

# Discrete parameters — used only by the local test database (docker compose).
# When DATABASE_URL is set it takes precedence over all of these.
DB_HOST=localhost
DB_PORT=5435
DB_NAME=payment_service_test
DB_USER=postgres
DB_PASSWORD=postgres
```

- [ ] **Step 6: Verify the build and tests still pass**

```bash
pnpm build
pnpm test
```

Expected: build emits no TypeScript errors; tests PASS. The tests connect to local Docker with `DB_SSL=false` from Step 4.

- [ ] **Step 7: Commit**

```bash
git add src/config/env.ts src/config/database.ts vitest.config.ts .env.example
git commit -m "feat(db): prepare runtime connection config for Supabase"
```

---

### Task 2: Install and wire sequelize-cli

Adds the CLI and its configuration. At the end of this task sequelize-cli can connect, but the migrations directory it points at is still empty — that is expected and is exactly what Step 6 asserts.

**Files:**
- Create: `.sequelizerc`
- Create: `src/config/sequelize.cjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `DATABASE_URL`, `DB_*` and `NODE_ENV` from the environment, as documented in Task 1.
- Produces: a working `pnpm exec sequelize-cli` invocation resolving migrations from `src/migrations`, seeders from `src/seeders`, models from `src/models`, with migration state in `SequelizeMeta` and seeder state in `SequelizeData`.

- [ ] **Step 1: Install the new dependencies**

`sequelize-cli` goes in `dependencies`, not `devDependencies`, so migrations can be run from the production image. `pg-hstore` is required by Sequelize's Postgres dialect for hstore and JSON handling.

```bash
pnpm add sequelize-cli pg-hstore
```

- [ ] **Step 2: Create `.sequelizerc`**

The filename has **no extension**. That is load-bearing: sequelize-cli reads this file with a synchronous `require()`, and Node only applies the `"type": "module"` ESM rule to files ending in `.js`. An extensionless file is always loaded as CommonJS.

```js
const path = require('path');

module.exports = {
  config: path.resolve('src', 'config', 'sequelize.cjs'),
  'models-path': path.resolve('src', 'models'),
  'seeders-path': path.resolve('src', 'seeders'),
  'migrations-path': path.resolve('src', 'migrations'),
};
```

- [ ] **Step 3: Create `src/config/sequelize.cjs`**

`seederStorage: 'sequelize'` must be set explicitly — sequelize-cli defaults it to `'none'`, which would re-run every seeder on each invocation.

```js
'use strict';

require('dotenv').config();

const env = process.env;

/**
 * Supabase terminates TLS with its own CA, which Node does not trust by
 * default, so certificate verification is disabled while TLS itself stays on.
 */
const supabaseSsl = {
  ssl: {
    require: true,
    rejectUnauthorized: false,
  },
};

const storage = {
  migrationStorageTableName: 'SequelizeMeta',
  seederStorage: 'sequelize',
  seederStorageTableName: 'SequelizeData',
};

module.exports = {
  development: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    dialectOptions: supabaseSsl,
    ...storage,
  },

  // Local Docker PostgreSQL from docker-compose.yml. No TLS: the container
  // serves plaintext only.
  //
  // These values are deliberately hardcoded rather than read from DB_* env
  // vars. The DB_* vars describe the developer's Supabase or local dev
  // database, and dotenv loads them here too — so reading them would make
  // NODE_ENV=test silently target the dev database. This block is the target
  // of destructive commands (db:migrate:undo:all, db:reset), so it must name
  // exactly one thing: the docker-compose postgres service. Keep these in
  // sync with docker-compose.yml.
  test: {
    username: 'postgres',
    password: 'postgres',
    database: 'payment_service_test',
    host: 'localhost',
    port: 5435,
    dialect: 'postgres',
    logging: false,
    ...storage,
  },

  production: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    dialectOptions: supabaseSsl,
    logging: false,
    ...storage,
  },
};
```

- [ ] **Step 4: Create the empty target directories**

sequelize-cli errors out if `migrations-path` does not exist. Git does not track empty directories, so add a `.gitkeep` to each; both are deleted again in Tasks 3 and 4 once real files land.

```bash
mkdir -p src/migrations src/seeders
touch src/migrations/.gitkeep src/seeders/.gitkeep
```

- [ ] **Step 5: Add the sequelize-cli scripts to `package.json`**

Replace the entire existing `db:*` script block (`db:create`, `db:create:prod`, `db:drop`, `db:drop:prod`, `db:reset`, `db:reset:prod`, `db:migrate`, `db:migrate:prod`, `db:migrate:undo`, `db:migrate:prod:undo`, `db:seed`, `db:seed:prod` — twelve entries in total) with:

```json
    "db:migrate": "sequelize-cli db:migrate",
    "db:migrate:undo": "sequelize-cli db:migrate:undo",
    "db:migrate:undo:all": "sequelize-cli db:migrate:undo:all",
    "db:migrate:status": "sequelize-cli db:migrate:status",
    "db:seed": "sequelize-cli db:seed:all",
    "db:seed:undo": "sequelize-cli db:seed:undo:all",
    "migration:create": "sequelize-cli migration:create --name",
    "seed:create": "sequelize-cli seed:create --name",
```

`db:reset` is deliberately absent here — it is added in Task 5, once migrations and seeders exist for it to orchestrate. The `*:prod` variants are gone because they existed only to work around `tsx` being unavailable in the production image; sequelize-cli runs identically in both environments.

- [ ] **Step 6: Verify sequelize-cli connects to the test database**

```bash
docker compose up -d postgres
NODE_ENV=test pnpm exec sequelize-cli db:migrate:status
```

Expected: the command **succeeds** and prints no migration rows (the directory is empty apart from `.gitkeep`, which the `.cjs|js|cts|ts` pattern ignores). If it instead reports `ERR_REQUIRE_ESM`, `.sequelizerc` was given a `.js` extension — remove it. If it reports `Cannot find "…/src/migrations"`, Step 4 was skipped.

- [ ] **Step 7: Commit**

```bash
git add .sequelizerc src/config/sequelize.cjs src/migrations/.gitkeep src/seeders/.gitkeep package.json pnpm-lock.yaml
git commit -m "feat(db): wire sequelize-cli with CommonJS config for ESM package"
```

---

### Task 3: Convert the eleven migrations to sequelize-cli

The conversion is mechanical, with one genuine behaviour fix: six `down` functions leak PostgreSQL enum types, which would break the repeatable `db:reset` added in Task 5. Steps 2 and 3 demonstrate that failure before fixing it.

**Files:**
- Create: `src/migrations/001-create-applications.cjs` through `src/migrations/011-create-admin-users.cjs`
- Delete: `src/database/migrations/` (all eleven `.ts` files), `src/database/migrate.ts`, `src/migrations/.gitkeep`

**Interfaces:**
- Consumes: the sequelize-cli configuration from Task 2.
- Produces: eleven migrations exporting `{ up(queryInterface, Sequelize), down(queryInterface, Sequelize) }`, creating the tables `applications`, `payments`, `payment_attempts`, `webhook_events`, `notifications`, `idempotency_keys`, `audit_logs`, `checkouts`, `admin_users`. Task 4's seeder depends on `admin_users` existing with snake_case columns.

- [ ] **Step 1: Convert each migration file, applying these exact rules**

For each file `src/database/migrations/<name>.ts`, create `src/migrations/<name>.cjs`. The transformation is purely textual:

1. Delete the `import { DataTypes, QueryInterface } from 'sequelize';` line.
2. Add `'use strict';` as the first line.
3. Wrap both functions in `module.exports = { async up(queryInterface, Sequelize) {...}, async down(queryInterface, Sequelize) {...} };`.
4. Replace every `DataTypes.` with `Sequelize.`.
5. Drop the TypeScript annotations: `({ context: queryInterface }: { context: QueryInterface }): Promise<void>` becomes `(queryInterface, Sequelize)`.
6. The body of each function is otherwise **copied verbatim** — every column, index name, `references`, `onUpdate` and `onDelete` must be preserved exactly. Index names in particular are referenced by `removeIndex` calls in later migrations.

Worked example — `src/migrations/001-create-applications.cjs` in full:

```js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('applications', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      slug: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      api_key_hash: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true
      },
      api_key_prefix: {
        type: Sequelize.STRING(16),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('ACTIVE', 'SUSPENDED', 'REVOKED'),
        allowNull: false,
        defaultValue: 'ACTIVE'
      },
      webhook_url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      webhook_secret: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.addIndex('applications', ['slug'], { unique: true });
    await queryInterface.addIndex('applications', ['api_key_hash'], { unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('applications');
  }
};
```

At this step every `down` is converted verbatim, **including the two that already drop their enum types** (008 and 009 — preserve their existing `DROP TYPE IF EXISTS` calls and `try`/`catch` blocks exactly). The remaining enum leaks are fixed in Step 4, after the failure is demonstrated.

- [ ] **Step 2: Delete the old migration directory and umzug runner**

```bash
rm -rf src/database/migrations src/database/migrate.ts src/migrations/.gitkeep
```

- [ ] **Step 3: Clear the stale umzug schema from the test database**

The old umzug runner recorded its migrations in a `SequelizeMeta` table — the same table name sequelize-cli uses — but stored the names **without** file extensions (`001-create-applications`). sequelize-cli stores them **with** extensions (`001-create-applications.cjs`). The strings never match, so sequelize-cli would treat all eleven as pending and try to create tables that already exist.

The test database therefore has to start empty:

```bash
docker compose up -d postgres
docker compose exec -T postgres psql -U postgres -d payment_service_test -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
```

Expected: `DROP SCHEMA` then `CREATE SCHEMA`. This is a one-off cut-over from umzug to sequelize-cli, not part of any routine workflow. It is safe only because the test database holds no data worth keeping — never run this against Supabase.

- [ ] **Step 4: Demonstrate the enum leak — run migrate, undo-all, migrate again**

```bash
export NODE_ENV=test
pnpm exec sequelize-cli db:migrate
pnpm exec sequelize-cli db:migrate:undo:all
pnpm exec sequelize-cli db:migrate
```

Expected: the **first** `db:migrate` succeeds with eleven migrations. `db:migrate:undo:all` succeeds. The **second** `db:migrate` FAILS on `001-create-applications.cjs` with a PostgreSQL error along the lines of `type "enum_applications_status" already exists`.

This is the bug. If the second migrate unexpectedly succeeds, the `down` functions were not copied verbatim — re-check Step 1 before continuing.

- [ ] **Step 5: Add the missing enum teardown to six `down` functions**

`queryInterface.dropTable` does not drop the enum type that `createTable` implicitly created. Add the drop after the table is removed.

`src/migrations/001-create-applications.cjs`:

```js
  async down(queryInterface) {
    await queryInterface.dropTable('applications');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_applications_status";');
  }
```

`src/migrations/002-create-payments.cjs`:

```js
  async down(queryInterface) {
    await queryInterface.dropTable('payments');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_payments_status";');
  }
```

`src/migrations/004-create-webhook-events.cjs`:

```js
  async down(queryInterface) {
    await queryInterface.dropTable('webhook_events');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_webhook_events_status";');
  }
```

`src/migrations/005-create-notifications.cjs`:

```js
  async down(queryInterface) {
    await queryInterface.dropTable('notifications');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_notifications_status";');
  }
```

`src/migrations/011-create-admin-users.cjs`:

```js
  async down(queryInterface) {
    await queryInterface.dropTable('admin_users');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_admin_users_role";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_admin_users_status";');
  }
```

Migrations 003, 006, 007 and 010 create no enums and need no change. Migrations 008 and 009 already drop theirs — leave them exactly as converted.

- [ ] **Step 6: Verify the cycle is now repeatable**

The database is currently in a broken half-migrated state from Step 3. Clean the leaked types by hand once, then prove the cycle:

```bash
export NODE_ENV=test
docker compose exec -T postgres psql -U postgres -d payment_service_test -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
pnpm exec sequelize-cli db:migrate
pnpm exec sequelize-cli db:migrate:undo:all
pnpm exec sequelize-cli db:migrate
pnpm exec sequelize-cli db:migrate:status
```

Expected: every command succeeds, and `db:migrate:status` reports all eleven migrations as `up`. The manual `DROP SCHEMA` is a one-off repair of the state Step 3 deliberately created; it is not part of any routine workflow.

- [ ] **Step 7: Verify the application test suite still passes**

```bash
pnpm test
```

Expected: PASS. The schema is identical to before the conversion, so `tests/helpers/setup.ts` truncation and every integration test behave unchanged.

- [ ] **Step 8: Commit**

```bash
git add -A src/migrations src/database
git commit -m "feat(db): convert migrations to sequelize-cli and fix enum teardown"
```

---

### Task 4: Convert the admin user seeder

**Files:**
- Create: `src/seeders/20260921000000-admin-user.cjs`
- Delete: `src/database/seed.ts`, `src/database/seeders/`, `src/seeders/.gitkeep`

**Interfaces:**
- Consumes: the `admin_users` table from Task 3's migration 011.
- Produces: one `admin_users` row with email `sntandu@reignovatechnologies.com`. Task 5's `db:reset` wrapper runs this via `db:seed:all`.

- [ ] **Step 1: Write the seeder**

Seeders run below the model layer and receive no `underscored` field mapping, so column names must be written in snake_case. The `SELECT` guard makes a re-run a no-op rather than a unique-constraint violation on `email`.

```js
'use strict';

const { randomUUID } = require('crypto');

const ADMIN_EMAIL = 'sntandu@reignovatechnologies.com';

module.exports = {
  async up(queryInterface) {
    const [existing] = await queryInterface.sequelize.query(
      'SELECT id FROM admin_users WHERE email = :email LIMIT 1;',
      { replacements: { email: ADMIN_EMAIL } }
    );

    if (existing.length > 0) {
      return;
    }

    const now = new Date();

    await queryInterface.bulkInsert('admin_users', [
      {
        id: randomUUID(),
        email: ADMIN_EMAIL,
        name: 'Shedrack Ntandu',
        password_hash: null,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        last_active: now,
        created_at: now,
        updated_at: now
      }
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('admin_users', { email: ADMIN_EMAIL });
  }
};
```

- [ ] **Step 2: Delete the old seeding code and the database lifecycle script**

```bash
rm -rf src/database/seed.ts src/database/seeders src/database/manage-db.ts src/seeders/.gitkeep
```

`src/database/` should now be empty — remove the directory too if so.

`manage-db.ts` goes here rather than in a later task for a concrete reason: it does `await import('./migrate.js')` in its `reset` branch, and Task 3 deleted `migrate.ts`. Until it is gone, `pnpm build` fails on the dangling import, so Step 5's build check cannot pass. Its `CREATE DATABASE` / `DROP DATABASE` logic is impossible on Supabase and has no valid use regardless.

- [ ] **Step 3: Verify the seeder runs, and is idempotent on a second run**

```bash
export NODE_ENV=test
pnpm exec sequelize-cli db:seed:all
docker compose exec -T postgres psql -U postgres -d payment_service_test -c "SELECT email, role, status FROM admin_users;"
pnpm exec sequelize-cli db:seed:all
docker compose exec -T postgres psql -U postgres -d payment_service_test -c "SELECT count(*) FROM admin_users;"
```

Expected: the first seed inserts the row; the `SELECT` shows `sntandu@reignovatechnologies.com | SUPER_ADMIN | ACTIVE`. The second `db:seed:all` reports no pending seeders (state is tracked in `SequelizeData`), and the count remains `1`.

- [ ] **Step 4: Verify the seeder's `down` works**

```bash
export NODE_ENV=test
pnpm exec sequelize-cli db:seed:undo:all
docker compose exec -T postgres psql -U postgres -d payment_service_test -c "SELECT count(*) FROM admin_users;"
pnpm exec sequelize-cli db:seed:all
```

Expected: count is `0` after the undo, and the re-seed succeeds.

- [ ] **Step 5: Verify the build and test suite**

```bash
pnpm build
pnpm test
```

Expected: build emits no TypeScript errors — this is the check that nothing still imports the deleted `src/database/seed.js`. Tests PASS.

- [ ] **Step 6: Commit**

```bash
git add -A src/seeders src/database
git commit -m "feat(db): convert admin user seeder to sequelize-cli"
```

---

### Task 5: Guarded `db:reset` and dependency cleanup

**Files:**
- Create: `scripts/db-reset.cjs`
- Modify: `package.json`
- Delete: nothing (Task 4 removed the last of `src/database/`)

**Interfaces:**
- Consumes: the `db:migrate:undo:all`, `db:migrate` and `db:seed:all` scripts from Task 2, plus the migrations and seeder from Tasks 3 and 4.
- Produces: `pnpm db:reset`, which exits non-zero without touching the database when `NODE_ENV=production`.

- [ ] **Step 1: Write the reset wrapper**

A wrapper rather than a shell chain, for two reasons: it must refuse to run in production, and `&&` chains behave inconsistently across the PowerShell and bash shells used on this machine.

```js
'use strict';

const { spawnSync } = require('child_process');

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run db:reset with NODE_ENV=production.');
  console.error('This command drops every table and re-seeds the database.');
  process.exit(1);
}

const steps = [
  ['db:migrate:undo:all', 'Reverting all migrations'],
  ['db:migrate', 'Applying migrations'],
  ['db:seed:all', 'Seeding'],
];

for (const [command, label] of steps) {
  console.log(`\n=> ${label} (sequelize-cli ${command})`);

  const result = spawnSync('sequelize-cli', [command], {
    stdio: 'inherit',
    shell: true,
  });

  if (result.status !== 0) {
    console.error(`\ndb:reset failed during "${command}".`);
    process.exit(result.status === null ? 1 : result.status);
  }
}

console.log('\nDatabase reset complete.');
```

- [ ] **Step 2: Add the `db:reset` script and remove the dead dependencies**

Add to the scripts block, directly after `db:seed:undo`:

```json
    "db:reset": "node scripts/db-reset.cjs",
```

Then remove the three dependencies that no longer have a consumer. `umzug` was the old migration runner, and `@supabase/supabase-js` is imported nowhere in `src/` or `tests/`:

```bash
pnpm remove umzug @supabase/supabase-js
```

`pg` stays — Sequelize's Postgres dialect requires it as its driver.

- [ ] **Step 3: Verify the production guard fires without touching the database**

```bash
NODE_ENV=production pnpm db:reset
echo "exit code: $?"
```

Expected: prints `Refusing to run db:reset with NODE_ENV=production.` and exits `1`. No sequelize-cli command runs.

- [ ] **Step 4: Verify `db:reset` succeeds twice in a row, and leaks no enum types**

```bash
export NODE_ENV=test
pnpm db:reset
pnpm db:reset
pnpm exec sequelize-cli db:migrate:status
pnpm exec sequelize-cli db:migrate:undo:all
docker exec payment_service_postgres psql -U postgres -d payment_service_test \
  -c "SELECT typname FROM pg_type WHERE typname LIKE 'enum_%';"
pnpm exec sequelize-cli db:migrate
```

Expected: both resets complete with `Database reset complete.`, `db:migrate:status` reports all eleven migrations as `up`, and the `pg_type` query returns **zero rows**.

That `pg_type` query is the real check on Task 3's enum teardown, not the reset succeeding. Sequelize 6.37's Postgres query generator emits `CREATE TYPE` wrapped in `DO $$ … EXCEPTION WHEN duplicate_object THEN null; END $$`, so re-creating an enum type that already exists is a silent no-op — a leaked type would **not** make the second reset fail. It would instead sit in the schema unnoticed and silently supply a stale value list the next time an enum's members change. Counting leftover `enum_%` rows after `undo:all` is what actually detects it.

Use `docker exec payment_service_postgres` rather than `docker compose exec`: the container was started under an earlier compose project name, so `docker compose` cannot see it until Task 6 recreates it.

- [ ] **Step 5: Verify no references to the removed code remain**

```bash
grep -rn "umzug\|supabase-js\|manage-db\|db:create\|db:drop" src tests package.json
```

Expected: no output. If `package.json` still lists a removed script or dependency, fix it now.

- [ ] **Step 6: Verify the build and test suite**

```bash
pnpm build
pnpm lint
pnpm test
```

Expected: all three succeed.

- [ ] **Step 7: Commit**

```bash
git add -A scripts package.json pnpm-lock.yaml src/database
git commit -m "feat(db): add guarded db:reset and drop umzug and supabase-js"
```

---

### Task 6: Docker Compose and documentation

**Files:**
- Modify: `docker-compose.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: the final script surface from Task 5.
- Produces: a `postgres` service on host port 5435 serving database `payment_service_test`, matching the `test` block of `src/config/sequelize.cjs` and the `DATABASE_URL` in `vitest.config.ts`.

- [ ] **Step 1: Reduce `docker-compose.yml` to the test database**

Replace the whole file. The `payment-service` application service is removed: it hardcoded a local `DATABASE_URL` alongside production-looking `ADMIN_API_KEY` and `API_KEY_PEPPER` values, and the application now targets Supabase. `Dockerfile` is unchanged and remains the deployment artifact, configured through environment variables at run time.

```yaml
# Local PostgreSQL for the automated test suite only.
#
# Development and production run against Supabase; see .env.example.
services:
  postgres:
    image: postgres:16-alpine
    container_name: payment_service_test_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: payment_service_test
    ports:
      - "${POSTGRES_PORT:-5435}:5432"
    volumes:
      - postgres_test_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d payment_service_test"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_test_data:
```

- [ ] **Step 2: Recreate the container against the renamed volume and database**

The volume name and `POSTGRES_DB` both changed, so the old container and volume must go:

```bash
docker compose down -v
docker compose up -d postgres
export NODE_ENV=test
pnpm db:reset
pnpm test
```

Expected: `db:reset` builds the schema in the fresh container and tests PASS.

- [ ] **Step 3: Update the database sections of `README.md`**

Find the sections covering database setup and the `db:*` scripts, and replace them with the following. Keep the surrounding document structure and heading levels consistent with the rest of the file.

````markdown
## Database

The service runs on **Supabase PostgreSQL** in development and production, and on a
local Docker PostgreSQL for the automated test suite. All schema and seed data are
managed by `sequelize-cli`. The `@supabase/supabase-js` client is not used — the
service connects over the plain PostgreSQL wire protocol.

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open **Project Settings → Database → Connection string** and select the
   **Session pooler** tab. Use that string, not the direct connection: direct
   connections to `db.<ref>.supabase.co` are IPv6-only and fail on most networks
   and CI runners without the paid IPv4 add-on.
3. Copy it into `DATABASE_URL` in your `.env`, and set `DB_SSL=true`.

The username must be in the form `postgres.<project-ref>`, and reserved characters
in the password must be percent-encoded (`@` → `%40`, `#` → `%23`, and so on).

```
DATABASE_URL=postgresql://postgres.abcdefgh:s3cr%40t@aws-1-eu-central-1.pooler.supabase.com:5432/postgres
DB_SSL=true
```

Then apply the schema:

```bash
pnpm db:migrate
pnpm db:seed
```

### Scripts

| Script | What it does |
| --- | --- |
| `pnpm db:migrate` | Apply all pending migrations |
| `pnpm db:migrate:undo` | Revert the most recent migration |
| `pnpm db:migrate:undo:all` | Revert every migration |
| `pnpm db:migrate:status` | Show which migrations are applied |
| `pnpm db:seed` | Run all pending seeders |
| `pnpm db:seed:undo` | Revert all seeders |
| `pnpm db:reset` | Revert everything, re-migrate, re-seed. Refuses to run with `NODE_ENV=production` |
| `pnpm migration:create <name>` | Scaffold a new migration |
| `pnpm seed:create <name>` | Scaffold a new seeder |

There is no `db:create` or `db:drop`. Supabase grants no superuser, so
`CREATE DATABASE` and `DROP DATABASE` are not available; `db:reset` rebuilds the
schema in place instead.

New migrations and seeders must be written as **CommonJS `.cjs` files**. This package
is ESM (`"type": "module"`), and sequelize-cli loads these files with `require()`, so a
`.js` file would fail with `ERR_REQUIRE_ESM`. When a migration creates an `ENUM` column,
its `down` must also `DROP TYPE IF EXISTS "enum_<table>_<column>"` — `dropTable` leaves
the type behind, which breaks `db:reset` on the second run.

### Running the tests

The test suite uses local Docker PostgreSQL, not Supabase:

```bash
docker compose up -d postgres
NODE_ENV=test pnpm db:migrate
pnpm test
```

### Troubleshooting

| Error | Cause |
| --- | --- |
| `SELF_SIGNED_CERT_IN_CHAIN`, `UNABLE_TO_VERIFY_LEAF_SIGNATURE` | `DB_SSL` is unset, or the `ssl` dialect option is missing. Supabase uses its own CA |
| `password authentication failed` | The password contains reserved characters that were not percent-encoded, or the username omits the `postgres.<project-ref>` form the pooler requires |
| `ENETUNREACH` on connect | You are using the direct connection string. Switch to the session pooler |
| `type "enum_..." already exists` | A migration's `down` is missing its `DROP TYPE IF EXISTS` |
````

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml README.md
git commit -m "docs(db): document Supabase setup and scope compose to the test database"
```

---

### Task 7: End-to-end verification against Supabase

Everything so far was verified against local Docker. This task runs the real target. It requires a Supabase project and a `DATABASE_URL` in `.env` — if those are not available yet, stop and report that rather than inventing credentials.

**Files:** none modified. This task produces a verification report.

**Interfaces:**
- Consumes: the complete implementation from Tasks 1–6.
- Produces: confirmation that every item in the spec's Verification section holds.

- [ ] **Step 1: Confirm `.env` points at Supabase**

```bash
grep -E "^(DATABASE_URL|DB_SSL)=" .env | sed -E 's/:[^:@]+@/:***@/'
```

Expected: `DATABASE_URL` uses a `pooler.supabase.com:5432` host with a `postgres.<ref>` username, and `DB_SSL=true`. If `.env` still points at localhost, stop here — the operator must supply the connection string.

- [ ] **Step 2: Apply the schema to Supabase**

```bash
pnpm db:migrate
pnpm db:migrate:status
```

Expected: eleven migrations apply, and status reports all eleven as `up`.

- [ ] **Step 3: Seed, and confirm the seed is idempotent**

```bash
pnpm db:seed
pnpm db:seed
```

Expected: the first run inserts the admin user; the second reports nothing pending.

- [ ] **Step 4: Confirm `db:reset` is repeatable against Supabase**

```bash
pnpm db:reset
pnpm db:reset
pnpm db:migrate:status
```

Expected: both runs complete, and all eleven migrations report `up`.

- [ ] **Step 5: Start the server against Supabase**

```bash
pnpm build
pnpm start
```

Expected: the log line `Database connection established successfully` appears and the server listens on `PORT`. Stop it with Ctrl-C.

- [ ] **Step 6: Run the full local verification suite**

```bash
docker compose up -d postgres
pnpm build
pnpm lint
NODE_ENV=test pnpm db:reset
pnpm test
```

Expected: all commands succeed.

- [ ] **Step 7: Confirm the removed code is gone**

```bash
grep -rn "umzug\|supabase-js\|manage-db" src tests package.json
ls src/database 2>/dev/null
```

Expected: no output from either command.

- [ ] **Step 8: Commit any incidental fixes**

If Steps 1–7 surfaced problems, fix them, re-run the affected verification, and commit:

```bash
git add -A
git commit -m "fix(db): address issues found during Supabase verification"
```

If nothing needed fixing, skip this step and report that verification passed clean.
