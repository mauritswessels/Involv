# Attendance and service-hour approvals

## Hosted activation

The foundation is already installed according to the user's SQL Editor checks. This new chunk needs its own migration; no code change automatically runs it remotely.

1. Back up the existing Supabase database; preferably verify in staging first.
2. Open project `aeestfejjpcxwyflrccm` → SQL Editor → New query.
3. Run the complete `supabase/migrations/20261009000002_activity_participation.sql` file once.
4. The script is atomic. On any error stop and investigate; do not rerun successful setup.
5. Verify with this read-only query (all three should be true):

   ```sql
   SELECT
     to_regprocedure('public.get_activity_participation(uuid)') IS NOT NULL AS participation_ready,
     (to_regclass('public.activity_attendance') IS NOT NULL
      AND to_regclass('public.activity_hours') IS NOT NULL) AS tables_ready,
     (SELECT count(*) = 2 AND bool_and(c.relrowsecurity)
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname IN ('activity_attendance','activity_hours')) AS row_security_enabled;
   ```

This does not activate the school signup hook, reset roles or bypass school Google approval. Announcements and sessions still work if this new script has not yet been applied; Attendance/Hours show a setup message rather than fake records.

## What is implemented

- Approved activity owner/school admin: mark accepted verified school participants Present, Absent or unmarked for today/past sessions. School dates use Europe/Zurich.
- Students: view only their own attendance, submit their own dated hours and descriptions, edit or withdraw pending submissions.
- Rejected submissions preserve the original review; Submit again creates a new claim.
- Owner/admin: approve or reject pending claims. Rejection requires a reason; decisions record the reviewer and time. No one can review their own claim, including administrators.
- Only approved entries count towards approved totals. Pending/rejected totals are separate; manager totals are labelled as activity-wide.
- Claims allow 0.01–24 hours, up to two decimals, no future dates, and descriptions up to 2,000 characters.
- Pending + approved claims cannot exceed 24 hours per student per day across **all** activities. Concurrent submissions serialize at the database, not only in the browser.
- Editing/withdrawal/review requires the exact previously loaded `updated_at`. A changed record must be refreshed; a review cannot silently approve an unseen edit.
- Reviewed claims cannot be edited or withdrawn using the student API. Corrections to reviewed decisions require a separately designed, auditable workflow; no silent overwrite.
- Direct table writes are denied even for managers. Mutation functions derive all identities and initial/review states.
- Student records are private to that student and the activity's authorised managers, not other participants or unrelated educators.
- Closing an activity preserves history. An activity with service-hour records cannot be deleted; close/archive it instead.
- Deleting a session removes its associated attendance, but cannot remove independently recorded hours. Account lifecycle/retention policy remains a separate task; student identity deletion currently cascades their records, so do not improvise account deletion around legal retention needs.
- A session date cannot be changed while attendance is marked: reset the marks explicitly or create a new session, rather than silently shifting attendance to another day.

## Verification

```sh
pnpm --filter @workspace/involv test:participation
pnpm --filter @workspace/involv exec tsc --noEmit
```

The database suite uses actual PostgreSQL migrations and role policies in a disposable local database, before and after the deferred school migration. It also runs genuinely concurrent claims and reviews.

Browser verification uses intercepted synthetic Supabase sessions; no hosted writes or Google login are used. Once school sign-in is approved, finish a live owner/accepted-student acceptance check: mark attendance, submit/edit/withdraw an entry, approve another, reject with a reason, reload both accounts and verify student privacy.
