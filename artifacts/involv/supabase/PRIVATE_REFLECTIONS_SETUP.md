# Activate private student reflections

In the same Supabase project used by Involv, open SQL Editor → New query.
Run the complete contents of
`migrations/20261011000004_private_activity_reflections.sql`, then
`migrations/20261026000002_activity_reflection_reader_access.sql`.
If the first migration is already installed, apply only the second; it preserves
existing reflections and grants approved owners/admins read access to them.
Activity Hub foundation (`20261009000001_activity_hub_foundation.sql`) and its
security-hardening prerequisite must already be installed. These add a protected table
and scoped functions; they do not activate the deferred school signup hook
or alter existing messages, attendance or service hours.

Then run this read-only installation check:

```sql
SELECT
  to_regclass('public.activity_reflections') IS NOT NULL AS reflection_table_ready,
  to_regprocedure('public.get_my_activity_reflections(uuid,timestamp with time zone,uuid)') IS NOT NULL AS read_ready,
  to_regprocedure('public.save_my_activity_reflection(uuid,text,uuid,timestamp with time zone)') IS NOT NULL AS save_ready,
  to_regprocedure('public.delete_my_activity_reflection(uuid,timestamp with time zone)') IS NOT NULL AS delete_ready,
  to_regprocedure('public.get_managed_activity_reflections(uuid,timestamp with time zone,uuid)') IS NOT NULL AS educator_read_ready;
```

All five should be `true`; this confirms installation, not live signed-in tests.

## Behavior

- Accepted students can create notes from Activity Hub → Reflections.
- Authors can read/edit/delete their own entries, including personal history after
  activity membership ends. Only currently accepted students can create new entries.
- The current approved opportunity owner (teacher/organizer role) and verified school
  admins can read reflections in that activity's Reflections tab. They cannot edit or
  delete another student's entries. No classmates, pending/rejected applicants or
  unrelated educators can read them. Verified Auth and current database roles and
  ownership determine access, never client metadata. Downgrading an owner removes
  their educator access immediately on the server; the UI refreshes every 30 seconds
  and on focus. A previously read entry cannot be withdrawn from human memory.
- My service portfolio → My reflections opens the personal history.
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
- Reflections are activity-level notes; no session reference, attachments, grades,
  teacher feedback or certificates are introduced.
- “Private” means limited application/database-role access, not end-to-end
  encryption. Privileged Supabase database administrators still administer the
  database. Do not claim notes are inaccessible to the database operator.

When school login becomes available, check create, reload, edit, delete and stale
versions with two signed-in student sessions. Confirm a second accepted student and
unrelated educator cannot read the author's notes. Confirm the approved owner and
school admin can read relevant notes but cannot edit/delete them or reassign authors.
Check that the owner cannot read another owner's activity and loses access on role
downgrade. Verify personal-history and educator lists after reload. Revoke activity
membership and confirm group access ends while personal reflections remain
available on `/reflections`.

Local verification:
`pnpm --filter @workspace/involv run test:reflections`
uses disposable PostgreSQL fixtures before and after the school-access migration.
It does not change hosted Supabase. No database reset, school OAuth activation,
signup-hook installation, fake app data or login bypass is required.
