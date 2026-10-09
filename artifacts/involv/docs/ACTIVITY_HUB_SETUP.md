# Activity Hub foundation

## What this chunk includes

- Real opportunity lookup, accepted participant roster (names only), announcements and sessions.
- Announcement create/edit/delete and pin/unpin; session create/edit/delete and calendar.
- Verified school participants can read only activities with an Accepted application.
- Management is limited to the approved teacher/organiser who owns the opportunity, or a school admin. Being a teacher alone does not grant access to every activity.
- Membership/role revocations take effect immediately in database permissions; the UI refreshes on focus and every 30 seconds.
- Current participants retain access to closed opportunities so activity history remains available.
- The database derives announcement authorship/session creator and timestamps; clients cannot spoof or reassign them.
- New profiles must start as students, including direct API inserts. Role changes require administrators.
- Draft/closed listings become readable by their approved owners so they can open their activity hubs.
- Attendance, hours, reflections, gallery, certificates and chat persistence are later chunks. No fake records appear in the live hub.

## Activate in the existing hosted Supabase project

The code does **not** apply hosted database migrations automatically. The browser tests use intercepted synthetic requests, not live school accounts.

1. Confirm project `aeestfejjpcxwyflrccm`, verify a backup and preferably test on a staging copy first.
2. In SQL Editor, run this read-only prerequisite check:

   ```sql
   SELECT
     to_regprocedure('public.is_admin(uuid)') IS NOT NULL AS admin_helper_ready,
     to_regprocedure('public.guard_application_identity_change()') IS NOT NULL AS identity_guard_ready,
     to_regprocedure('public.get_activity_hub(uuid)') IS NOT NULL AS activity_hub_installed;
   ```

3. If either prerequisite is false, apply the complete file
   `supabase/migrations/20260923000002_security_hardening.sql` first.
   It protects profile role updates and application/opportunity identities.
4. If `activity_hub_installed` is false, apply the **complete** file
   `supabase/migrations/20261009000001_activity_hub_foundation.sql` in a new query.
   It is one transaction: a failure rolls back its changes. Do not rerun it if already installed; report any mismatch for investigation.
5. This chunk does **not** require applying
   `20261006000001_school_access_trusted_roles.sql`, enabling the school signup hook, or resetting existing roles. Those steps remain deferred. Do not run all pending migrations blindly.
6. Once a verified school identity can sign in, open an owned opportunity's Activity Hub from the organiser dashboard or applicant-management header. Accept a participant before testing student access. Student dashboards link to the hub for accepted applications.
7. Create an announcement and a session; reload; check both from an accepted participant's account. Verify pending/rejected applicants and unrelated organisers cannot read or modify them.

The Google Workspace administrator-approval blocker remains. This migration does not bypass it. No test-login bypass is added to the real site.

## Local regression checks

```sh
pnpm --filter @workspace/involv test:activity
pnpm --filter @workspace/involv exec tsc --noEmit
```

The database suite uses disposable local PostgreSQL, actual migrations and authenticated/anonymous roles. It checks the activity features both before and after the deferred school-access migration to ensure compatibility.
