# Private student service portfolio

The `/portfolio` page is linked from the student dashboard on desktop and mobile.
It uses real service-hour claims, not mock totals. Only approved claims count as
credit or approved activities. Pending and rejected records are clearly separate.
Every contribution includes its service date, activity title/category, amount,
description and review metadata where reviewed. Review timestamps use Swiss time;
service dates stay calendar dates even when the browser uses a different timezone.

## Hosted activation

Code changes do not automatically install SQL in the connected Supabase project.
The Activity Hub foundation was previously confirmed installed. Installation of
participation/attendance is still awaiting the user's result; do not assume it
is installed remotely simply because it passed local tests.

1. Back up any real school database before changing its schema.
2. In project `aeestfejjpcxwyflrccm`, open SQL Editor → New query.
3. If participation has not succeeded yet, first follow `PARTICIPATION_SETUP.md`
   and confirm its three checks are true. Do not rerun successful migrations.
4. Copy the entire `supabase/migrations/20261011000001_student_service_portfolio.sql`
   into a separate new query and run once. No emails or IDs need replacing.
5. On any error, stop and investigate. The script uses a transaction.
6. Run this read-only installation check:

```sql
SELECT
  to_regprocedure('public.get_my_service_portfolio()') IS NOT NULL
    AS portfolio_ready,
  has_function_privilege('authenticated', 'public.get_my_service_portfolio()', 'EXECUTE')
    AS signed_in_access_ready,
  NOT has_function_privilege('anon', 'public.get_my_service_portfolio()', 'EXECUTE')
    AS anonymous_access_blocked;
```

All three should be true. Run this query only after installation succeeds.
Then reload Involv, open the student dashboard → My service portfolio.
An empty ledger honestly displays zero approved credit and no contributions.

This does not enable the school Google OAuth app, activate the deferred signup
hook, reset trusted roles, verify invited users manually, or bypass authentication.
Once school sign-in is approved, use real student/manager accounts to confirm a
submitted claim appears as pending, an approved claim becomes credited after
refresh, and another student cannot see it.

## Privacy and history boundaries

- The read-only `get_my_service_portfolio()` RPC accepts **no user ID**. Identity
  comes from `auth.uid()` and fresh verified exact-school Auth data.
- It returns only that identity's own claims, with a narrow projection of activity
  metadata and reviewer names, notes and dates. No emails, roster, other students'
  claims, author identities or new management privileges are exposed.
- Historical own claims remain readable after membership ends or the activity
  closes. This RPC does not change table RLS or permit that old private hub,
  participation feed, attendance, roster or chat to be read.
- Existing approval immutability, daily caps and own-review restrictions remain
  unchanged. It is a personal record, **not** a generated certificate or award.
- Account deletion/retention and corrections to reviewed claims are separate
  workflows, not implemented through the portfolio.

## CSV

Export is generated locally from the currently loaded own ledger. It includes all
review statuses; its approved-credit column is zero for pending/rejected records.
All cells are quoted, embedded quotes escaped, and formula/control-prefix text
neutralised with a leading apostrophe. That may be visible in some CSV viewers.
UTF-8 BOM supports non-English names. No student email/identifier is exported.
Export is disabled while fetching, on error, and when empty. Failed refresh clears
the ledger, and keyed state/request guards avoid retaining another user's data.
Downloaded files contain personal records; share them only with intended recipients.

## Verification

```sh
pnpm --filter @workspace/involv test:portfolio
pnpm --filter @workspace/involv exec tsc --noEmit
```

The suite applies actual migrations to disposable PostgreSQL, exercising RLS and
the RPC before and after the deferred school migration, plus prior participation
and concurrency checks. CSV tests execute the actual serializer rather than a
test-only copy. Browser fixtures must intercept Supabase requests; do not create
live student accounts or write real school data to test this UI.
