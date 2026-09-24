# Involv launch readiness

Use this checklist before giving a school-wide group access to Involv. Production
changes should be performed against the intended Supabase project only after the
project URL, migration history, and backup status are confirmed.

For the FlorenceHSB school review draft, see
[`FLORENCEHSB_SCHOOL_LAUNCH_REVIEW_PACK.md`](./FLORENCEHSB_SCHOOL_LAUNCH_REVIEW_PACK.md).

## 1. Database indexes

The launch migrations add performance indexes and authorization safeguards:

- `supabase/migrations/20260923000001_launch_readiness_indexes.sql`
- `supabase/migrations/20260923000002_security_hardening.sql`

Before applying it:

1. Confirm the Supabase project and environment.
2. Confirm the latest backup completed successfully.
3. Compare the remote migration history with this repository.
4. Apply to staging first.
5. Run the 50-user and 100-user read tests.
6. Inspect slow queries in Supabase before applying to production.

Do not run an index migration against an unidentified remote database.

## 2. Row Level Security

Run the staging-only role behavior suite:

Provide `SUPABASE_STAGING_PROJECT_REF` and `SUPABASE_DB_URL` through a secure
environment-variable mechanism, then run:

```sh
SUPABASE_TEST_ENV=staging pnpm --filter @workspace/involv test:security
```

The database URL is a credential: do not commit it or print it in logs. The
runner requires the staging marker and a project reference, verifies that a
direct Supabase database host or pooler user matches that reference, and refuses
other hosts. Do not set the staging reference to the production project.

The SQL suite first audits the required RLS policies and guards, then creates
temporary student, organizer, and admin fixture identities in `auth.users`.
Those fixtures have no passwords, exist only inside the test transaction, and
are removed by its final rollback. The suite impersonates authenticated JWT
subjects to test role escalation, opportunity ownership, application ownership,
organizer status updates, and forbidden application-text and identity edits.
Do not run the behavior suite against production.

Expected access model:

| Table | Expected access |
| --- | --- |
| `profiles` | Authenticated users can read profiles; users edit their own profile but cannot change roles; admins manage roles |
| `opportunities` | Public users read active listings; authenticated users create only for themselves; owners/admins update and delete |
| `applications` | Applicants create for themselves; organizer ownership must match the opportunity; organizers update status; identity fields cannot be reassigned |
| `saved_opportunities` | Users only access their own saved records |

Also verify the Google OAuth redirect URLs and ensure no service-role key is
present in frontend environment variables or browser bundles.

The automated checks cover these staging behaviors:

- a student cannot insert an admin profile or escalate their own role;
- an admin can change another user's role without a recursive-policy error;
- organizers can create and update their own opportunities, but cannot forge or
  transfer opportunity ownership;
- students can create applications only for themselves and cannot forge the
  opportunity's organizer or read another student's application;
- an organizer can change application status only for their opportunity, and
  cannot edit motivation, experience, availability, grade, or applicant identity.

## 3. Rate limits and request safety

The Express API now:

- limits API clients to 120 requests per minute by default;
- skips the health check so hosting probes are not blocked;
- rejects JSON and form bodies larger than 100 KB;
- returns structured 404, 429, and 500 responses;
- logs unhandled errors with a request ID.

Optional production settings:

```text
API_RATE_LIMIT_MAX=120
API_RATE_LIMIT_WINDOW_MS=60000
LOG_LEVEL=info
```

The built-in limiter is per running API instance. If the API later handles
business-critical writes across multiple Autoscale instances, add a shared edge
or Redis-backed limiter. Supabase authentication has separate limits configured
in `supabase/config.toml`.

## 4. Monitoring and recovery

- Confirm Replit deployment logs are available for the frontend and API.
- Confirm Supabase database, authentication, and API logs are retained for the
  required period.
- Trigger a controlled frontend error in staging and verify the fallback screen
  appears and the browser error is recorded.
- Trigger an invalid API route and verify a structured 404 is returned.
- Set an owner and response process for elevated error rates, slow queries,
  authentication failures, and unavailable dependencies.
- Never log access tokens, cookies, student application text, or profile data.

## 5. Backups

Backups are controlled by the hosted Supabase project rather than this
repository.

Before launch:

1. Verify automated backups are enabled for the production project.
2. Record the retention period and responsible owner.
3. Export a backup before schema migrations.
4. Perform a restore drill into a separate project.
5. Record the recovery-time and recovery-point objectives.
6. Re-run the RLS audit after restoration.

## 6. Load testing

The load test is read-only and reports frontend, API, and Supabase metrics
separately. Run it against staging:

```bash
TARGET_URL=https://your-staging-site.replit.dev \
API_TARGET_URL=https://your-staging-api.replit.dev \
VITE_SUPABASE_URL=https://your-project.supabase.co \
VITE_SUPABASE_ANON_KEY=your-anon-key \
ALLOW_EXTERNAL_LOAD_TEST=true \
pnpm --filter @workspace/involv load:50
```

Then repeat with `load:100`. The default thresholds are:

- error rate no greater than 1%;
- p95 response time no greater than 1.5 seconds;
- request timeout of 10 seconds.

The script refuses every non-development frontend, API, and Supabase host unless
`ALLOW_EXTERNAL_LOAD_TEST=true` is set deliberately after confirming each URL
belongs to staging. For a local frontend/API rehearsal without Supabase, set
`SKIP_SUPABASE=true`. Do not run write tests against production.

## Final launch gate

- [ ] Intended production domain and OAuth redirects confirmed
- [ ] Index migration tested in staging
- [ ] RLS audit passes
- [ ] 50-user test passes
- [ ] 100-user test passes
- [ ] Backup and restore drill completed
- [ ] Logs and incident owner confirmed
- [ ] School safeguarding and data-retention expectations documented