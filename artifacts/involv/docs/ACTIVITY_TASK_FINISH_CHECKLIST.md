# Activity-feature finishing checklist

## Attendance and service hours

- Real sessions/accepted participants, persisted attendance and hour claims.
- Students submit, edit or withdraw pending claims and see their own records.
- Current approved owner/admin reviews others' exact displayed versions.
- Approved-only totals, independent review, cross-activity daily cap and recovery.
- Existing participation setup guide; portfolio and corrections have separate
  migrations, not an implicit activation through installation of participation.

## Activity messaging

- Persistent send/read, stable retry IDs, paging and safe drafts.
- The subsequent messaging upgrade adds current-author edit/removal, displayed
  edit marks, version checks and irreversible text removal with a marker.
- RLS-protected Postgres Changes triggers a fresh permission-checked read.
- Poll/focus/online recovery, older-page update refresh, role/user/route cleanup.
- No public broadcasts, invented presence, attachments or school-wide channels.
- Apply `supabase/MESSAGING_UPGRADE_SETUP.md` after the original messaging script.

## Private reflections

- Accepted students create private notes, then read/edit/delete their own history.
- Persistence, errors, pagination, retry IDs and stale-version protection.
- Personal history is independent of group membership and does not reopen groups.
- **Privacy scope correction:** the original queue description's proposed
  manager/admin reading does not match author-only personal notes. Do not enable
  that access or treat reflections as teacher-reviewed submissions. This matches
  the private-reflection scope communicated during implementation.

## Verification boundary

Local real-PostgreSQL tests cover roles/RLS, CRUD, constraints, retries and
revocation, before and after the school-access migration. Participation also
has concurrent submission/review checks. Local publication checks do not prove
hosted Realtime WebSocket delivery. Render/type checks are not browser interaction.

After institutional school-account sign-in is approved, verify these flows with
real accepted students, an approved owner/admin and an unrelated account:

1. Mark attendance, submit/edit/withdraw pending hours and approve/reject others'
   hours. Reload and compare the student/manager records and totals.
2. Two members send/edit/remove messages and inspect history after reload and
   loading older pages; disconnect/reconnect, then revoke group access.
3. Save/edit/remove a reflection; ensure other students, managers and school admins
   cannot read its text, and the author can access personal history after leaving.

Do not add a test-login bypass or lower school identity requirements for testing.
Account-closure and its still-unresolved retention policy remain a separate task.
