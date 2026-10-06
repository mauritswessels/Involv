# ISZL access and administrator-approved roles

## Access rules

- Only a verified email with the exact domain `iszl.ch` can use signed-in features.
- Google’s school-domain hint is not a security control. Database policies check
  the actual verified email in `auth.users`, not an editable profile or metadata.
- New accounts always start as students. Users cannot choose teacher, organiser
  or admin roles during signup or grant themselves a role through an API call.
- An existing verified ISZL administrator approves roles in **Admin → Users**.
- Only approved teachers, organisers and admins can publish/manage opportunities.
- Role revocations take effect in database permissions immediately; the UI
  refreshes the profile on focus and every minute.
- The administrator cannot change their own role or delete their own profile.
- Role changes have an administrator-only, client-read-only database audit trail.
- Public active opportunity browsing is retained. This does not permit reading
  student profiles/applications or using platform management.

## Activate in the hosted Supabase project

Repository migrations do not apply themselves to hosted Supabase. Frontend
checks alone are not sufficient for security.

1. Confirm the intended Supabase project and take/verify a backup. Test in staging
   first. Compare its migration history with this repository.
2. Confirm a verified `@iszl.ch` member already has `admin` in `public.profiles`.
   Sign in with that account before rollout. Do not use a personal account.
3. Ensure the prerequisite migration
   `supabase/migrations/20260923000002_security_hardening.sql` is applied.
4. Apply `supabase/migrations/20261006000001_school_access_trusted_roles.sql`
   using the deployment migration flow or paste the complete file into Supabase’s
   SQL Editor. It is one transaction. It refuses to run without a verified school
   administrator and refuses to run without the prerequisite.
5. The script preserves administrators, accounts, opportunities and applications.
   **All existing teachers and organisers become students and need fresh admin
   approval.** Their data is not deleted. Outside accounts lose platform access.
6. In **Authentication → Hooks**, enable **Before User Created**, select the
   Postgres function `public.before_school_user_created`, and save.
   Creating the function in SQL does not activate this setting.
7. Keep Google as the intended sign-in provider. Disable unused signup providers
   and anonymous sign-in in Supabase if enabled. Do not remove the Google callback
   URL or the website’s allowed `/login` return URL.
8. Sign out/in with the school admin, then reapprove trusted people in
   **Admin → Users**. New teachers must first sign in and create their student
   profile so the administrator can find them.
9. Publish the frontend changes when ready. Confirm the real published `/login`
   address remains in Supabase's redirect allowlist.

The hook prevents new outside Auth accounts. Database restrictions and UI checks
also block existing outside accounts; enabling the hook does not delete them.
Account deletion and student-to-student profile privacy are separate work.

## Verify after activation

- Personal Google account: clear school-only error, no usable platform access.
- New verified ISZL account: student setup, no privileged role selector.
- Student: can apply/save; cannot publish or self-promote, including direct API calls.
- Admin: can approve a teacher or organiser; can see persisted success/failure.
- Approved publisher: can create/manage only their own opportunities.
- Revoked publisher: immediately loses database publishing/applicant-management access.
- Admin’s own role/delete protection holds.

Run the isolated database regression tests without remote credentials:

```sh
pnpm --filter @workspace/involv test:school-access
pnpm --filter @workspace/involv exec tsc --noEmit
```

The local tests run actual migrations and PostgreSQL RLS with a small Auth schema
fixture. They do not activate the hosted Auth Hook or prove the hosted rollout.
