# Involv: first student-pilot checklist

**Prepared:** 16 October 2026  
**Scope:** Proposed small, supervised pilot of 5–10 students, not a school-wide launch.  
**Current decision:** Not yet cleared for real-student invitations.

Use this as the pilot sign-off record. An unchecked box means evidence or approval
is still needed, not necessarily that the feature is missing. Record dates, owners
and results here, but never passwords, tokens, student names or private student text.

## 1. Where we are now

| Area | Evidence available | Still needed |
| --- | --- | --- |
| Applications and capacity | Implementation and local database checks; user reports hosted installation check all true | Real student/manager flow on the intended hosted environment |
| Announcements, sessions, attendance and hours | Implemented; installation checks reported successful | Hosted role-based walkthrough, including corrections and totals |
| Group messages and private reflections | Implemented; installation checks reported successful | Two-user hosted delivery/reconnect checks and privacy-denial checks |
| Public contact privacy, saved listings and safe errors | Code safeguards and local checks | Confirm actual hosted permissions, persistence and public responses |
| School access and trusted roles | Safeguards prepared; institutional Google approval unresolved | School IT approval, verified school administrator and role checks |
| Public pages | Prototype testimonials and unsupported feature promises removed; desktop/mobile checked | Real current listings and final school-approved information |
| Account closure | School reported three-year retention of approved hours; exact rule remains unclear | Confirm retention start, deletion timing, scope and implementation |

Reported SQL readiness booleans establish structure only. They do not prove that
the right deployed app uses that database, or that real authenticated roles behave
correctly. Local PostgreSQL checks do not prove hosted Realtime delivery.

## 2. School decisions — before inviting students

**Owner: school sponsor, IT and privacy/safeguarding contacts**

- [ ] Name an adult pilot sponsor, technical contact, privacy contact and safeguarding contact.
- [ ] Approve the pilot size, eligible year groups, dates and supervision.
- [ ] Approve Google OAuth access to Involv for school accounts.
      Do not substitute personal accounts, weaken `@iszl.ch` verification or manually
      mark accounts verified to get around institutional restrictions.
- [ ] Confirm the legal operator, provider arrangements, data locations/transfers,
      and the student/parent information or permission process appropriate to the group.
- [ ] Approve accurate privacy information covering applications, group messages,
      attendance, hours and author-only reflections. The existing review pack is a
      draft, not a final published notice.
- [ ] Resolve retention: which records are retained, when the three-year period for
      approved hours starts, what is anonymized, and when other records are deleted.
- [ ] Approve an interim, school-managed privacy/deletion-request process if automated
      account closure will not ship for the pilot. Name its owner and deadlines;
      do not promise working self-service closure.
- [ ] Approve who verifies activities and how students report unsafe content or conduct.

If privacy, retention or deletion arrangements are unresolved, keep testing to
school-approved non-student test data; do not invite real students.

## 3. Prepare the actual pilot environment

**Owner: technical lead, with school IT**

- [ ] Identify the exact pilot site URL and Supabase project in a private operations
      record; confirm the deployed build points to the intended project.
- [ ] Verify migration/readiness checks on that project, including profile privacy,
      school access, applications, participation, portfolio, corrections and messaging.
      Do not rerun unfamiliar migrations blindly.
- [ ] Confirm HTTPS and Google/Supabase redirect allowlists return to the pilot site,
      not `localhost` or an unrelated preview.
- [ ] Verify at least one school-approved administrator can sign in. New accounts
      start as students; teachers/organisers need fresh administrator approval.
- [ ] Confirm backup availability, retention and owner; demonstrate recovery into a
      separate environment without overwriting the pilot database.
- [ ] Confirm who can inspect provider logs and respond to failures. Check that
      diagnostics do not expose tokens, student text or private profile data.
- [ ] Confirm ongoing hosting/database ownership and a school-approved operating
      budget, with someone responsible for usage limits and service continuity.

Do not place credentials in this checklist. Run destructive or concurrent fixture
tests only in a separately verified test environment, never against student records.

## 4. Prepare genuine activities

**Owner: pilot sponsor and approved activity managers**

Organisers will join and post their own activities. The supplied school opportunity
list is reference material, not an instruction to pre-populate the live catalogue.
Complete this section as organisers onboard, before students apply.

An admin-requested import of three dated events is prepared separately at
[`supabase/imports/2026_26_27_school_opportunities.sql`](../supabase/imports/2026_26_27_school_opportunities.sql).
It requires a school admin to run and verify it in the correct Supabase project.
The undated Arts and Crafts item is intentionally excluded.
If the original demo listings are still published, the optional reversible
cleanup is [`supabase/imports/archive_sample_opportunities.sql`](../supabase/imports/archive_sample_opportunities.sql);
it matches only the sample titles, dates, featured flags and unassigned rows.

- [ ] Confirm an approved organiser can create and manage their own listing.
- [ ] Have at least one organiser-posted, school-approved activity ready for student applications; ideally two.
- [ ] Check title, description, location, eligibility, manager, capacity, application
      deadline and session dates with the responsible person.
- [ ] Replace or archive outdated/example listings only with the owner's approval.
      Existing catalogue deadlines were in the past at the last review; do not
      simply advance dates to make those activities appear available.
- [ ] Check public listing responses do not expose organiser management email fields
      or private student information.
- [ ] Confirm student instructions explain that applying does not reserve a place;
      only an accepted application consumes capacity.

## 5. One hosted rehearsal — before invitations

**Owner: technical lead with school-approved test participants**

Use two verified school student accounts, an approved activity manager and a school
administrator. Include an unrelated school account with no group membership.
Keep evidence to pass/fail notes, not copies of private content.

| Check | Pass condition |
| --- | --- |
| Sign-in and roles | School accounts sign in through the real pilot URL; personal/unverified accounts cannot enter protected features; students cannot grant themselves privileges |
| Browse and save | Current activities load on phone and laptop; saving/unsaving survives reload without duplicate cards |
| Apply and review | Student submits once; duplicate retry creates no second application; correct manager sees it; decision survives reload |
| Capacity | Pending applications do not consume places; the last place cannot be accepted twice; full activities reject new submissions |
| Withdrawal | Own pending/under-review application can be withdrawn; another student's cannot; reviewed outcomes are not silently deleted |
| Activity access | Accepted member sees the correct group; unrelated and removed members cannot read or write group content |
| Announcements and sessions | Approved manager creates/updates real records; authorised members see persisted changes after reload |
| Attendance and hours | Manager records attendance; student submits hours; independent authorised reviewer approves/rejects; student totals include approved hours only |
| Corrections | Reviewer supplies a reason; corrected total persists and prior review history remains available |
| Messages | Two members exchange, edit and remove messages; reload and reconnect recover correctly without duplicated sends |
| Reflections | Author can save/edit/delete and reload; other students, managers and school admins cannot read the text |
| Profile privacy | Unrelated school accounts cannot read another student's private profile fields through direct database requests, not just the UI |
| Failure recovery | Network failure shows an honest error; retry does not duplicate a write; sign-out clears the previous user's private view |

- [ ] Record result, date and tester for each row.
- [ ] Fix every access/privacy failure, data-loss bug and blocking journey failure.
- [ ] Recheck the affected flow after a fix. Do not call the pilot verified based
      only on screenshots, SQL installation booleans or a successful build.

## 6. Launch and support

**Owner: school pilot sponsor**

- [ ] Choose a supervised first session and provide a short guide: sign in, apply,
      wait for acceptance, open the group, submit hours and report problems.
- [ ] Give students a named support/reporting route, with instructions not to send
      passwords or private reflection/application text in bug reports.
- [ ] State pilot limitations: no digital certificates or gallery; automated account
      closure is not ready. Private reflections are not teacher-reviewed submissions.
- [ ] Assign a person to check sign-in failures, failed writes and feedback during
      the first session and daily during the pilot.
- [ ] Agree pause conditions: unexpected private-data exposure, wrong-role access,
      repeated lost/duplicate records, or inability to support the group.
- [ ] Agree an incident response: stop invitations, tell the responsible school
      contact immediately, and use an authorised access restriction if needed.
      Removing a link alone does not stop direct database access.
- [ ] Set a review date before expanding to more students.

## 7. Go / no-go record

Invite students only when all six sections above are complete or any permitted
deferral has explicit school approval and a safe, named manual process.
Do not defer school identity, access isolation, critical data integrity or required
privacy approval. Certificates and galleries are not required for this pilot.

| Sign-off | Responsible person / role | Date / evidence |
| --- | --- | --- |
| School pilot approval | To be confirmed | Pending |
| IT access and environment | To be confirmed | Pending |
| Privacy, retention and safeguarding | To be confirmed | Pending |
| Hosted rehearsal passes | To be confirmed | Pending |
| Support and recovery arrangements | To be confirmed | Pending |
| Final decision and pilot date | School pilot sponsor | Not yet cleared |

## Working order

1. **Now, while waiting for IT:** prepare organiser onboarding, finalise the school
   decisions and support plan, and check environment/recovery readiness. Do not
   publish activities on organisers' behalf.
2. **Once school access is approved:** run the single hosted rehearsal and fix
   any blockers it finds.
3. **Then:** obtain sign-off and invite only the agreed small group.

Use [LAUNCH_READINESS.md](./LAUNCH_READINESS.md) for broader technical and
school-wide preparation, and
[ACTIVITY_TASK_FINISH_CHECKLIST.md](./ACTIVITY_TASK_FINISH_CHECKLIST.md) for feature
verification boundaries. The
[school review pack](./FLORENCEHSB_SCHOOL_LAUNCH_REVIEW_PACK.md) is background draft
material and must be updated to current features and reviewed before publication.
