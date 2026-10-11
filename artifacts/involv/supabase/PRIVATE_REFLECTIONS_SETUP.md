# Activate private student reflections

In the same Supabase project used by Involv, open SQL Editor → New query.
Run the complete contents of
`migrations/20261011000004_private_activity_reflections.sql`.
Activity Hub foundation must already be installed. This adds a private table
and author-only functions; it does not activate the deferred school signup hook
or alter existing messages, attendance or service hours.

Then run this read-only installation check:

```sql
SELECT
  to_regclass('public.activity_reflections') IS NOT NULL AS reflection_table_ready,
  to_regprocedure('public.get_my_activity_reflections(uuid,timestamp with time zone,uuid)') IS NOT NULL AS read_ready,
  to_regprocedure('public.save_my_activity_reflection(uuid,text,uuid,timestamp with time zone)') IS NOT NULL AS save_ready,
  to_regprocedure('public.delete_my_activity_reflection(uuid,timestamp with time zone)') IS NOT NULL AS delete_ready;
```

All four should be `true`; this confirms installation, not live signed-in tests.

## Behavior

- Accepted students can create notes from Activity Hub → Reflections.
- Only the author can read/edit/delete them through Involv, including private
  personal history after activity membership ends. No teacher, organiser or
  school-admin application-role override exists.
- My service portfolio → My private reflections opens the personal history.
- The existing 30-word minimum is enforced in both UI and database; the maximum
  is 10,000 characters. Names and email addresses are not duplicated in notes.
- Saving a new entry retries with the same ID so an interrupted request cannot
  create duplicate notes. Editing/deleting requires the version displayed to
  the author; stale changes fail rather than overwrite newer work.
- Delete has an explicit permanent-deletion confirmation. It does not affect
  attendance or service hours.
- Deleting an activity preserves personal notes with a saved activity-title
  snapshot. Account closure remains a separate, school-approved retention
  workflow; this migration performs no account deletion or scheduled purge.
- “Private” means author-only application/database-role access, not end-to-end
  encryption. Privileged Supabase database administrators still administer the
  database. Do not claim notes are inaccessible to the database operator.

When school login becomes available, check create, reload, edit, delete and stale
versions with two signed-in student sessions. Confirm a second student, activity
owner and school admin cannot read or change the author's notes. Revoke activity
membership and confirm group access ends while personal reflections remain
available on `/reflections`.

Local verification:
`pnpm --filter @workspace/involv run test:reflections`
uses disposable PostgreSQL fixtures before and after the school-access migration.
It does not change hosted Supabase.
