-- Notifications, message reports and privacy requests. Runs after every migration
-- (see run-full-stack.mjs). Everything happens in one transaction and is rolled back.
BEGIN;
CREATE FUNCTION pg_temp.ok(cond boolean, label text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN IF cond IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF; END; $$;
CREATE FUNCTION pg_temp.denied(statement text, expected text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = expected THEN RETURN; END IF;
    RAISE EXCEPTION 'Expected %, got %: % (%)', expected, SQLSTATE, SQLERRM, statement;
  END;
  RAISE EXCEPTION 'Unexpected success: %', statement;
END $$;
CREATE FUNCTION pg_temp.as_user(id text) RETURNS void LANGUAGE sql
AS $$ SELECT set_config('request.jwt.claim.sub', id, true)::void; $$;
CREATE FUNCTION pg_temp.notes(uid text, notice_kind text) RETURNS bigint LANGUAGE sql
AS $$ SELECT count(*) FROM public.notifications WHERE user_id = uid::uuid AND kind = notice_kind $$;

-- 501 teacher, 502/503 students who will be accepted, 504 unrelated student,
-- 505 pending applicant, 506 outside (non-school) account.
INSERT INTO auth.users(id, email, email_confirmed_at) VALUES
 ('00000000-0000-0000-0000-000000000501', 'lf-teacher@iszl.ch', now()),
 ('00000000-0000-0000-0000-000000000502', 'lf-alice@iszl.ch', now()),
 ('00000000-0000-0000-0000-000000000503', 'lf-bob@iszl.ch', now()),
 ('00000000-0000-0000-0000-000000000504', 'lf-carol@iszl.ch', now()),
 ('00000000-0000-0000-0000-000000000505', 'lf-dan@iszl.ch', now()),
 ('00000000-0000-0000-0000-000000000506', 'lf-outside@gmail.com', now());
DO $$
DECLARE u record;
BEGIN
  FOR u IN SELECT * FROM auth.users WHERE email LIKE 'lf-%@iszl.ch' LOOP
    PERFORM set_config('request.jwt.claim.sub', u.id::text, true);
    INSERT INTO public.profiles(id, name, email) VALUES (u.id, initcap(split_part(split_part(u.email, '@', 1), '-', 2)), u.email);
  END LOOP;
END $$;
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000001');
UPDATE public.profiles SET role = 'teacher' WHERE id = '00000000-0000-0000-0000-000000000501';
INSERT INTO public.opportunities(id, organizer_id, title, category, positions_available, application_deadline) VALUES
 ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000501', 'Winter Market', 'School-Based Service', 10, '2035-01-01'),
 ('00000000-0000-0000-0000-000000000602', NULL, 'Admin-run festival', 'School-Based Service', 10, '2035-01-01'),
 ('00000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000501', 'Closing soon', 'School-Based Service', 10,
   (clock_timestamp() AT TIME ZONE 'Europe/Zurich')::date + 1);

SET LOCAL ROLE authenticated;
CREATE FUNCTION pg_temp.apply(opp text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.applications(opportunity_id, applicant_id, organizer_id, motivation, availability)
  VALUES (opp::uuid, auth.uid(), (SELECT organizer_id FROM public.opportunities WHERE id = opp::uuid), 'I would like to contribute to this activity and help others.', 'After school');
$$;

-- ── Notifications ──────────────────────────────────────────────────────────
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000502'); SELECT pg_temp.apply('00000000-0000-0000-0000-000000000601');
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000503'); SELECT pg_temp.apply('00000000-0000-0000-0000-000000000601');
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000505'); SELECT pg_temp.apply('00000000-0000-0000-0000-000000000601');
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000504'); SELECT pg_temp.apply('00000000-0000-0000-0000-000000000602');
RESET ROLE;
SELECT pg_temp.ok(pg_temp.notes('00000000-0000-0000-0000-000000000501', 'application_received') = 3, 'owner told about each new application');
SELECT pg_temp.ok(pg_temp.notes('00000000-0000-0000-0000-000000000001', 'application_received') = 1, 'school admins told about admin-managed listings');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.notifications WHERE body ILIKE '%contribute to this activity%'),
  'notices never copy student-written text');
SET LOCAL ROLE authenticated;

SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000501');
UPDATE public.applications SET status = 'Accepted' WHERE opportunity_id = '00000000-0000-0000-0000-000000000601'
  AND applicant_id IN ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000503');
INSERT INTO public.activity_sessions(opportunity_id, title, session_date, start_time, end_time, location)
VALUES ('00000000-0000-0000-0000-000000000601', 'Setup', (clock_timestamp() AT TIME ZONE 'Europe/Zurich')::date + 1, '15:00', '18:30', 'Gym');
INSERT INTO public.activity_announcements(opportunity_id, title, body) VALUES
 ('00000000-0000-0000-0000-000000000601', 'Meet at the gym', 'Bring a water bottle.');

SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000502');
SELECT pg_temp.ok((SELECT count(*) FROM public.notifications) = 2, 'student sees decision + announcement only');
SELECT pg_temp.ok((SELECT link FROM public.notifications WHERE kind = 'application_update') = '/activity/00000000-0000-0000-0000-000000000601',
  'acceptance links to the activity hub');
SELECT pg_temp.ok((SELECT body FROM public.notifications WHERE kind = 'announcement') = 'Meet at the gym', 'announcement notice uses its title');
SELECT pg_temp.denied($q$INSERT INTO public.notifications(user_id, kind, title) VALUES (auth.uid(), 'announcement', 'Forged')$q$, '42501');
SELECT pg_temp.denied($q$UPDATE public.notifications SET title = 'Edited'$q$, '42501');
SELECT pg_temp.denied($q$DELETE FROM public.notifications$q$, '42501');
SELECT pg_temp.denied($q$SELECT public.push_notification(auth.uid(), 'announcement', 'x', 'y', NULL, '')$q$, '42501');

SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000504');
SELECT pg_temp.ok((SELECT count(*) FROM public.notifications) = 0, 'unrelated student cannot read others'' notices');
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000505');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.notifications WHERE kind = 'announcement'), 'pending applicants get no group announcements');

-- Reminders: accepted member gets tomorrow's session once; saved listing closing tomorrow once.
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000502');
INSERT INTO public.saved_opportunities(user_id, opportunity_id) VALUES (auth.uid(), '00000000-0000-0000-0000-000000000603');
SELECT pg_temp.ok(public.queue_my_reminders() = 2, 'session + deadline reminders queued');
SELECT pg_temp.ok(public.queue_my_reminders() = 0, 'reminders are not duplicated');
SELECT pg_temp.ok((SELECT body FROM public.notifications WHERE kind = 'deadline_reminder') = 'Applications close tomorrow.', 'deadline wording');
SELECT pg_temp.apply('00000000-0000-0000-0000-000000000603');
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000505');
SELECT pg_temp.ok(public.queue_my_reminders() = 0, 'non-members get no session reminders');
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000503');
INSERT INTO public.saved_opportunities(user_id, opportunity_id) VALUES (auth.uid(), '00000000-0000-0000-0000-000000000603');
SELECT pg_temp.apply('00000000-0000-0000-0000-000000000603');
SELECT pg_temp.ok(public.queue_my_reminders() = 1, 'no deadline reminder once already applied');

-- Mark read: only own rows.
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000502');
SELECT pg_temp.ok(public.mark_my_notifications_read(ARRAY[(SELECT id FROM public.notifications WHERE kind = 'announcement')]) = 1, 'mark one read');
SELECT pg_temp.ok((SELECT count(*) FROM public.notifications WHERE read_at IS NULL) = 3, 'others stay unread');
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000501');
SELECT pg_temp.ok(public.mark_my_notifications_read() = 5, 'mark all of own notices read (3 + 2 applications to the closing-soon listing)');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.notifications WHERE read_at IS NULL), 'none left unread');
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM public.notifications WHERE user_id = '00000000-0000-0000-0000-000000000502' AND read_at IS NULL) = 3,
  'one user cannot mark another user''s notices read');
UPDATE public.notifications SET read_at = now() - interval '91 days' WHERE user_id = '00000000-0000-0000-0000-000000000502' AND kind = 'announcement';
SET LOCAL ROLE authenticated;
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000502');
SELECT public.queue_my_reminders();
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.notifications WHERE kind = 'announcement'), 'read notices older than 90 days are deleted');

-- Hours reviewed → student told; outside accounts cannot use the functions at all.
SELECT set_config('lf.hours', public.save_activity_hours('00000000-0000-0000-0000-000000000601',
  (clock_timestamp() AT TIME ZONE 'Europe/Zurich')::date, 2.5, 'Face painting')::text, true);
RESET ROLE;
SELECT set_config('lf.hours_version', (SELECT updated_at::text FROM public.activity_hours WHERE id = current_setting('lf.hours')::uuid), true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000501');
SELECT public.review_activity_hours(current_setting('lf.hours')::uuid, 'approved', '', current_setting('lf.hours_version')::timestamptz);
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000502');
SELECT pg_temp.ok((SELECT title FROM public.notifications WHERE kind = 'hours_reviewed') = 'Hours approved: Winter Market', 'hours review notice');
SELECT pg_temp.ok((SELECT body FROM public.notifications WHERE kind = 'hours_reviewed') LIKE '2.5 hours on %', 'hours shown without trailing zeros');
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000506');
SELECT pg_temp.denied('SELECT public.queue_my_reminders()', '42501');
SELECT pg_temp.denied('SELECT public.mark_my_notifications_read()', '42501');

-- ── Message reports ────────────────────────────────────────────────────────
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000503');
SELECT set_config('lf.msg', (public.send_activity_message('00000000-0000-0000-0000-000000000601',
  'This is an unkind message', gen_random_uuid())->>'id'), true);
SELECT pg_temp.denied($q$SELECT public.report_activity_message(current_setting('lf.msg')::uuid, 'bullying')$q$, '23514');
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000504');
SELECT pg_temp.denied($q$SELECT public.report_activity_message(current_setting('lf.msg')::uuid, 'bullying')$q$, '42501');
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000505');
SELECT pg_temp.denied($q$SELECT public.report_activity_message(current_setting('lf.msg')::uuid, 'bullying')$q$, '42501');
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000502');
SELECT pg_temp.denied($q$SELECT public.report_activity_message(current_setting('lf.msg')::uuid, 'made-up')$q$, '23514');
SELECT pg_temp.ok((public.report_activity_message(current_setting('lf.msg')::uuid, 'bullying', 'Aimed at me'))->>'already_reported' = 'false', 'member can report');
SELECT pg_temp.ok((public.report_activity_message(current_setting('lf.msg')::uuid, 'bullying'))->>'already_reported' = 'true', 'duplicate report is idempotent');
SELECT pg_temp.denied($q$SELECT * FROM public.message_reports$q$, '42501');
SELECT pg_temp.denied($q$SELECT public.get_message_reports()$q$, '42501');
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000501');
SELECT pg_temp.ok(public.report_activity_message(current_setting('lf.msg')::uuid, 'inappropriate') IS NOT NULL, 'organiser can also report');
SELECT pg_temp.denied($q$SELECT public.get_message_reports()$q$, '42501');
SELECT pg_temp.denied($q$SELECT public.resolve_message_report(gen_random_uuid(), 'dismissed')$q$, '42501');

SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000001');
SELECT pg_temp.ok(pg_temp.notes('00000000-0000-0000-0000-000000000001', 'report_update') = 2, 'admin alerted for each report');
SELECT pg_temp.ok(jsonb_array_length(public.get_message_reports('open')) = 2, 'admin sees open reports');
SELECT pg_temp.ok((public.get_message_reports('open')->0->>'message_snapshot') = 'This is an unkind message', 'snapshot kept');
SELECT pg_temp.denied($q$SELECT public.resolve_message_report((public.get_message_reports('open')->0->>'id')::uuid, 'dismissed', '', true)$q$, '23514');
SELECT public.resolve_message_report((public.get_message_reports('open')->0->>'id')::uuid, 'actioned', 'Spoke to the student', true);
SELECT pg_temp.ok(jsonb_array_length(public.get_message_reports('open')) = 0, 'one decision closes all reports on the message');
SELECT pg_temp.ok((public.get_message_reports('closed')->0->>'message_currently_removed')::boolean, 'message shows as removed');
SELECT pg_temp.denied($q$SELECT public.resolve_message_report((public.get_message_reports('closed')->0->>'id')::uuid, 'dismissed')$q$, '40001');
RESET ROLE;
SELECT pg_temp.ok((SELECT content = '' AND deleted_at IS NOT NULL FROM public.activity_messages WHERE id = current_setting('lf.msg')::uuid),
  'moderator removal clears the text');
SELECT pg_temp.ok((SELECT message_snapshot FROM public.message_reports LIMIT 1) = 'This is an unkind message', 'report survives removal');
SELECT pg_temp.ok(pg_temp.notes('00000000-0000-0000-0000-000000000502', 'report_update') = 1
  AND pg_temp.notes('00000000-0000-0000-0000-000000000501', 'report_update') = 1, 'each reporter told it was reviewed');
SELECT pg_temp.ok(pg_temp.notes('00000000-0000-0000-0000-000000000503', 'report_update') = 0, 'sender is not told who reported');
SET LOCAL ROLE authenticated;
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000502');
SELECT pg_temp.denied($q$SELECT public.report_activity_message(current_setting('lf.msg')::uuid, 'spam')$q$, '23514');

-- ── Privacy requests and data export ───────────────────────────────────────
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000502');
SELECT pg_temp.ok((public.export_my_data()->'profile'->>'email') = 'lf-alice@iszl.ch', 'export has own profile');
SELECT pg_temp.ok(jsonb_array_length(public.export_my_data()->'applications') = 2, 'export has own applications only');
SELECT pg_temp.ok(jsonb_array_length(public.export_my_data()->'service_hours') = 1, 'export has own hours');
SELECT pg_temp.ok(jsonb_array_length(public.export_my_data()->'reports_made') = 1, 'export has own reports');
SELECT pg_temp.ok(public.export_my_data()::text NOT LIKE '%lf-bob%' AND public.export_my_data()::text NOT LIKE '%lf-dan%',
  'export never includes other students');
SELECT pg_temp.ok(public.export_my_data()->'reports_made'->0->'message_snapshot' IS NULL, 'export omits reported text from others');
SELECT pg_temp.denied($q$SELECT public.submit_privacy_request('correction', '')$q$, '23514');
SELECT pg_temp.denied($q$SELECT public.submit_privacy_request('erase-everything')$q$, '23514');
SELECT pg_temp.ok((public.submit_privacy_request('deletion', 'I am leaving ISZL'))->>'status' = 'open', 'deletion request created');
SELECT pg_temp.denied($q$SELECT public.submit_privacy_request('deletion')$q$, '23505');
SELECT public.submit_privacy_request('access');
SELECT public.submit_privacy_request('question', 'Who can see my hours?');
SELECT public.submit_privacy_request('correction', 'My grade is wrong');
SELECT pg_temp.denied($q$SELECT public.submit_privacy_request('correction', 'Again')$q$, '23505');
SELECT pg_temp.ok(jsonb_array_length(public.get_my_privacy_requests()) = 4, 'student sees own requests');
SELECT pg_temp.denied($q$SELECT public.get_privacy_requests()$q$, '42501');
SELECT pg_temp.denied($q$SELECT * FROM public.privacy_requests$q$, '42501');
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000504');
SELECT pg_temp.ok(jsonb_array_length(public.get_my_privacy_requests()) = 0, 'other students cannot see requests');
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000501');
SELECT pg_temp.denied($q$SELECT public.get_privacy_requests()$q$, '42501');
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000506');
SELECT pg_temp.denied($q$SELECT public.export_my_data()$q$, '42501');
SELECT pg_temp.denied($q$SELECT public.submit_privacy_request('access')$q$, '42501');

SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000001');
SELECT pg_temp.ok(jsonb_array_length(public.get_privacy_requests('open')) = 4, 'admin queue');
SELECT set_config('lf.req', (SELECT r->>'id' FROM jsonb_array_elements(public.get_privacy_requests('open')) r
  WHERE r->>'kind' = 'deletion'), true);
SELECT pg_temp.denied($q$SELECT public.update_privacy_request(current_setting('lf.req')::uuid, 'completed', '')$q$, '23514');
SELECT public.update_privacy_request(current_setting('lf.req')::uuid, 'in_progress');
SELECT public.update_privacy_request(current_setting('lf.req')::uuid, 'completed', 'Your account will be deleted on your last day.');
SELECT pg_temp.denied($q$SELECT public.update_privacy_request(current_setting('lf.req')::uuid, 'declined', 'No')$q$, '40001');
SELECT pg_temp.ok(jsonb_array_length(public.get_privacy_requests('open')) = 3 AND jsonb_array_length(public.get_privacy_requests('closed')) = 1, 'queue filters');
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000502');
SELECT pg_temp.ok(pg_temp.notes('00000000-0000-0000-0000-000000000502', 'privacy_request_update') = 2, 'student told at each step');
SELECT pg_temp.ok((SELECT r->>'response' FROM jsonb_array_elements(public.get_my_privacy_requests()) r WHERE r->>'kind' = 'deletion')
  = 'Your account will be deleted on your last day.', 'student sees the answer');
SELECT pg_temp.ok((public.submit_privacy_request('deletion', 'Changed my mind again'))->>'status' = 'open', 'new request allowed once closed');
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000001');
SELECT public.update_privacy_request((SELECT (r->>'id')::uuid FROM jsonb_array_elements(public.get_privacy_requests('open')) r
  WHERE r->>'kind' = 'question'), 'completed', 'Only you, the organiser and school admins.');
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000502');
SELECT pg_temp.denied($q$SELECT public.submit_privacy_request('question', 'Over the daily limit')$q$, '54000');
ROLLBACK;
