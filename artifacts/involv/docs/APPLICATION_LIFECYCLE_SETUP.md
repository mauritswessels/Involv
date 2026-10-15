# Application reliability activation

## Rules in this chunk

- Only **Accepted** students consume the configured total places. Pending,
  Under Review and Rejected applications do not reserve places.
- No new applications once all places are filled. Existing pending applications
  remain for staff review; they are not automatically rejected.
- New applications must target an active listing, on or before its deadline.
  A deadline includes the entire day in **Europe/Zurich**, including clock changes.
  Staff may review existing applications after the submission deadline.
- The database serializes writes per listing. Two simultaneous acceptances cannot
  take the same last place; lowering capacity cannot leave too many acceptances.
- One current application per student/listing. Students can withdraw only Pending
  or Under Review applications and reapply if submissions are still open.
  Accepted and Rejected records cannot be erased through student withdrawal.
- Applicant counts mean **applications currently on record**, including reviewed
  decisions, not a lifetime submission count. Counts are maintained in the same
  transaction as the application write. Old incorrect counters are repaired.
- Verified identity, current profile name, authentication email, listing title
  and school submission date are derived in the database. The client cannot
  choose another applicant, owner or initial accepted status.
- The website checks the previously loaded status before saving a decision.
  Zero-row updates/withdrawals are not reported as success. Bulk actions report
  only confirmed decisions and identify capacity failures.

## Activate in the existing Supabase project

This uses the current user-owned database, not a new project. It requires the
security prerequisites and Activity Hub already installed. It does not activate
or bypass school Google login, change trusted roles, delete accounts, or settle
the outstanding account-closure retention policy.

1. In the correct Supabase project's **SQL Editor**, open a new query.
2. Paste the **entire** contents of:
   `supabase/migrations/20261015000002_application_lifecycle.sql`
3. Run it once, then run the read-only check below. All three results should be true.

```sql
SELECT
  (SELECT count(*)=3 FROM pg_trigger
   WHERE NOT tgisinternal AND tgenabled='O' AND
    ((tgrelid='public.applications'::regclass AND tgname IN
      ('application_lifecycle_guard','application_lifecycle_counts'))
     OR (tgrelid='public.opportunities'::regclass
       AND tgname='opportunity_application_totals'))) AS application_guards_ready,
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='applications' AND policyname='Students withdraw unreviewed applications'
    AND cmd='DELETE') AS student_withdrawal_ready,
  NOT EXISTS (
    SELECT 1 FROM public.opportunities o
    WHERE o.applicants_count <> (SELECT count(*) FROM public.applications a WHERE a.opportunity_id=o.id)
      OR o.positions_available < 1
      OR o.positions_available < (SELECT count(*) FROM public.applications a
        WHERE a.opportunity_id=o.id AND a.status='Accepted')
  ) AS application_totals_consistent;
```

4. Reload open Involv tabs so they stop using the retired client-side counter.
   Catalogue reads stay compatible with the earlier privacy migration: no
   wildcard opportunity reads or new public access to application identities.

### If installation stops on existing capacities

Nothing from the migration is committed if an error occurs. Do **not** delete
student applications or automatically reverse acceptances to make it pass.
Run this read-only diagnostic and have the responsible staff member decide
whether to increase the total places or review an incorrect acceptance:

```sql
SELECT o.id, o.title, o.positions_available AS total_places,
  count(a.id) FILTER (WHERE a.status='Accepted') AS accepted_students
FROM public.opportunities o
LEFT JOIN public.applications a ON a.opportunity_id=o.id
GROUP BY o.id
HAVING o.positions_available < 1
  OR count(a.id) FILTER (WHERE a.status='Accepted') > o.positions_available;
```

## Verification and remaining pilot check

`pnpm --filter @workspace/involv run test:applications` uses an isolated local
PostgreSQL cluster, actual migrations/RLS and simultaneous database sessions.
It also runs client deadline/DST and response-acknowledgement checks. It never
connects to or writes the hosted school database.

The installation check confirms database structure and consistent counts, not
a live school-account journey. Once school sign-in is approved, use two students
and an approved manager to confirm submit, duplicate retry, withdrawal/reapply,
last-place approval, rejected over-capacity approval, and refresh in another tab.
