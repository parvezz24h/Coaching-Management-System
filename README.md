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
| 6 | Reports, tests, deployment | Not started |

## Deployment (Vercel + Railway)

1. Create a Railway PostgreSQL database and copy its connection URL.
2. In Vercel, set `DATABASE_URL`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` (your
   production URL).
3. Build command: `pnpm db:deploy && pnpm build`. `postinstall` runs `prisma generate`.
4. Run `pnpm db:seed` once against production with strong `ADMIN_*` values.
5. Turn on Railway backups and test a restore before launch.
