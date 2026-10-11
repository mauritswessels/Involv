# Activate service-hour corrections

Use the same Supabase project as Involv. Install participation and the student
service portfolio first. This does not activate the deferred school OAuth hook.

1. Open `supabase/migrations/20261011000005_service_hour_corrections.sql`.
2. Copy the entire file into a new, blank Supabase SQL Editor query and run it.
3. Run this read-only check separately; all three results should be true:

```sql
SELECT
  to_regclass('public.activity_hour_reviews') IS NOT NULL AS history_ready,
  to_regprocedure('public.correct_activity_hours(uuid,numeric,text,text,timestamp with time zone,uuid)')
    IS NOT NULL AS corrections_ready,
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.activity_hours'::regclass
    AND tgname='capture_activity_hour_review' AND NOT tgisinternal AND tgenabled='O')
    AS original_review_capture_ready;
```

## Behavior

- Current approved activity owners or school admins can correct **other**
  students' reviewed entries. Neither students nor admins can self-correct.
- A correction can change recorded hours, revoke approval (rejected = zero
  credit), or reinstate a rejected entry. A reason is always required.
- Date, activity, student, and original description cannot be changed through
  corrections. Pending entries keep the normal edit/review process.
- Original review and each before/after correction remain visible in Activity
  Hub → Hours and the student's personal service portfolio.
- Existing reviewed entries get an explicitly labelled baseline. Older changes
  cannot be reconstructed and are not presented as a complete original audit.
- All totals and CSV records use the current decision and amount. Review history
  remains in the site; the existing portfolio CSV is not a full audit export.
- Daily caps cover all of a student's pending and approved claims across
  activities. Version checks prevent stale corrections, and stable request IDs
  prevent an uncertain-send retry from producing a second correction.
- Application users cannot insert, rewrite, or delete history directly.
  Privileged database operators retain database administration powers.
- This does not resolve or implement student-account closure or its retention
  policy. Existing account and parent-record lifecycle rules are unchanged.

## Verification

Run `pnpm --filter @workspace/involv run test:corrections` for isolated local
database checks; this makes no hosted changes. After sign-in is approved,
check manager correction, student total/history after reload, stale-version
protection, and unrelated-user access denial in the real project.
