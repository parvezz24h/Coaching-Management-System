# Coaching Management System

Single-role (Admin) management system for a coaching center: students, teachers,
classes, subjects, batches, attendance, fees, exams and reports.

**Stack:** Next.js 16 (App Router, Cache Components) · React 19 · TypeScript ·
Tailwind CSS 4 + shadcn/ui (Base UI) · PostgreSQL · Prisma 7 · Better Auth ·
Zod 4 + React Hook Form.

## Getting started

```bash
pnpm install
cp .env.example .env           # then set BETTER_AUTH_SECRET and the ADMIN_* values
pnpm db:up                     # local Postgres 17 in Docker on port 5434
pnpm db:migrate                # apply migrations
pnpm db:seed                   # admin account, center settings, classes, subjects, academic year
pnpm dev                       # http://localhost:3000
```

Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`. Change the password
before going live. There is no public sign-up: Better Auth's sign-up endpoint is
disabled, and admin accounts come from the seed script.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm typecheck` | Generate route types and run `tsc` |
| `pnpm lint` | ESLint |
| `pnpm db:migrate` | Create/apply a migration in development |
| `pnpm db:deploy` | Apply migrations in production |
| `pnpm db:seed` | Seed reference data and the admin account (safe to re-run) |
| `pnpm db:seed:demo` | Optional sample teachers, batches, students, timetable and attendance (only on an empty database) |
| `pnpm db:studio` | Prisma Studio |
| `pnpm test` | Unit tests (pure logic: money, grading, dates, CSV, validation) |
| `pnpm test:integration` | Integration tests: server actions against a `*_test` database |
| `pnpm test:all` | Both |
| `pnpm db:backup` | `pg_dump` to `backups/` (custom format) |
| `pnpm db:verify-backup <file>` | Restore a backup into a throwaway database and compare row counts |

## Project layout

```
prisma/schema.prisma        All 18 models from the spec (+ Better Auth tables, Counter, PaymentAllocation)
prisma/seed.ts              Admin + reference data
src/proxy.ts                Redirects requests without a session cookie to /login
src/lib/auth.ts             Better Auth config (email/password, sign-up disabled)
src/lib/session.ts          requireAdmin(): full session check for pages and actions
src/lib/validations/        Zod schemas shared by forms and server actions
src/lib/codes.ts            Student IDs, teacher IDs, receipt numbers (atomic counters)
src/lib/audit.ts            AuditLog writer
src/lib/money.ts            Paisa arithmetic, fee status rules, amount in words
src/lib/grading.ts          GPA/grade/rank calculation (pure, unit-testable)
src/lib/exams.ts            Exam candidates and computed results
src/lib/reports.ts          Report queries shared by /reports and the CSV export
tests/integration/          Server-action tests (payments, attendance, exams, admins)
scripts/                    backup.sh, restore.sh, verify-backup.sh
src/app/(admin)/…           One folder per route, each with page.tsx + actions.ts
```

## Conventions

- Every page and server action calls `requireAdmin()`. The proxy only does a
  fast cookie check.
- Server actions re-validate input with the same Zod schema the form uses, and
  return `ActionResult` with field errors.
- Writes run inside `db.$transaction` and record an `AuditLog` entry.
- Money uses `Decimal(12,2)`. `@db.Date` columns are stored as UTC midnight and
  formatted in UTC. "Today" and month boundaries use `Asia/Dhaka`.
- Payments are never deleted. Corrections are `REVERSAL` rows with a negative
  amount that point at the original (`reversalOfId`, unique).
- One payment (one receipt) can cover several fees through `PaymentAllocation`.
  A fee's `paidAmount` always equals the sum of its allocations; payments and
  reversals lock the fee rows (`SELECT … FOR UPDATE`) inside the transaction.
- Monthly tuition is generated from each batch's monthly fee minus the
  enrollment discount. Re-running is safe: `(enrollmentId, period)` is unique.
- Postgres CHECK constraints (in the `payment_allocations` migration) reject
  negative amounts, discounts above the fee, and fees paid beyond what's owed.
- Attendance can only be marked for students enrolled in the batch on that date
  (`getBatchRoster` in `src/lib/attendance.ts`), and never for future dates.
- Timetable slots are rejected if they overlap another slot for the same batch,
  teacher or room on the same day.
- Results are computed on read from marks and the grading scale in Settings
  (never stored), so editing the scale updates every marksheet. A failed or
  absent subject makes the overall GPA 0; GPA is truncated to 2 decimals.
  Students with a missing mark are "incomplete" and are not ranked.
- Publishing an exam locks its marks and subjects until it is unpublished.
- Cache Components is on: anything that reads the session or database renders
  inside a `<Suspense>` boundary (see `src/app/(admin)/layout.tsx`).

## Status

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Setup, database, admin login, dashboard | Done |
| 2 | Students, teachers, classes, subjects, batches | Done |
| 3 | Timetable, attendance | Done |
| 4 | Fees, cash collection, dues, receipts | Done |
| 5 | Exams, marks, results | Done |
| 6 | Reports, tests, deployment readiness | Done |

## Testing

```bash
pnpm test              # 51 unit tests, no database needed
pnpm test:integration  # 18 tests; creates/migrates coaching_cms_test automatically
```

Integration tests call the real server actions (with the session and cache
APIs mocked) against a database whose name must end in `_test`; every test
starts from a truncated database with a small fixture set. They cover tuition
idempotency, partial/multi-fee payments, overpayment, five concurrent payments
on one balance (exactly one wins), reversals, CHECK constraints, attendance
rules, timetable clashes, exam results and the publish lock, and admin
removal rules. CI (`.github/workflows/ci.yml`) runs lint, typecheck, all tests
and a production build against Postgres 17.

## Security notes

- No public sign-up (the endpoint is disabled); admins are added in Settings.
- Login and password changes are rate-limited to 5 per minute per IP, stored in
  the database so the limit holds across serverless instances (production only).
- Requests from origins other than `BETTER_AUTH_URL` are rejected.
- Every page, server action and the CSV export re-checks the session on the
  server; the proxy only redirects requests without a session cookie.
- Security headers (no framing, nosniff, HSTS, referrer policy) are set in
  `next.config.ts`. `/api/health` is the only public route besides login.

## Deployment (Vercel + Railway)

1. **Database (Railway):** create a project → *Add PostgreSQL*. Copy the
   public connection URL from *Connect*. Choose the Singapore region if
   offered — the app is pinned to Vercel's `sin1` region (`vercel.json`), the
   closest to Bangladesh.
2. **App (Vercel):** push this repo to GitHub, then *Add New → Project* and
   import it. `vercel.json` sets the build command to
   `pnpm db:deploy && pnpm build`, so migrations run on every deploy.
3. **Environment variables** (Vercel → Settings → Environment Variables):
   - `DATABASE_URL` — the Railway URL
   - `BETTER_AUTH_SECRET` — a new value from `openssl rand -base64 32`
   - `BETTER_AUTH_URL` — the production URL, e.g. `https://cms.example.com`
   - `DB_POOL_MAX` — `5` (optional)
4. **First admin:** from your machine, run once against production:
   ```bash
   DATABASE_URL="<railway url>" ADMIN_EMAIL="you@example.com" \
     ADMIN_PASSWORD="<long random password>" ADMIN_NAME="Your Name" pnpm db:seed
   ```
   This also creates the classes, subjects, academic year and settings. Do
   **not** run `db:seed:demo` in production.
5. **Uptime:** point a monitor (e.g. UptimeRobot) at `https://<domain>/api/health`.

### Before launch

- [ ] Sign in, change the admin password, fill in center details in Settings
- [ ] Railway → Postgres → *Backups*: enable scheduled backups
- [ ] Take a manual backup and prove it restores (needs `pg_dump`/`pg_restore`
      at least as new as the server's Postgres version):
      ```bash
      pnpm db:backup "<railway url>"
      pnpm db:verify-backup backups/<file>.dump "<railway url>"
      ```
      The check restores into a throwaway database on the same server, compares
      every table's row count with the source, then drops it.
- [ ] Keep a copy of the backup off Railway (e.g. a private cloud drive)
- [ ] Remove any test admins; check Settings → Admin accounts
