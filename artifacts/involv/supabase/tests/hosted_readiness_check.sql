-- Involv hosted readiness check. READ-ONLY: paste into Supabase → SQL Editor and Run.
-- Every row should say PASS. A MISSING row names the migration file to apply
-- (from supabase/migrations, oldest first). It changes nothing in the database.
WITH checks(step, check_name, ok, fix) AS (
  VALUES
  (1,  'Profiles table',                      to_regclass('public.profiles') IS NOT NULL,                       '20240528000001_create_profiles.sql'),
  (2,  'Opportunities + applications',        to_regclass('public.applications') IS NOT NULL,                   '20240528000002_create_opportunities_applications.sql'),
  (3,  'Site stats function',                 to_regprocedure('public.get_site_stats()') IS NOT NULL,           '20240528000005_site_stats_fn.sql'),
  (4,  'Security hardening (role guard)',     EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'guard_profile_role_change'), '20260923000002_security_hardening.sql'),
  (5,  'School access + trusted roles',       to_regprocedure('public.before_school_user_created(jsonb)') IS NOT NULL, '20261006000001_school_access_trusted_roles.sql'),
  (6,  'Activity Hub',                        to_regclass('public.activity_announcements') IS NOT NULL,         '20261009000001_activity_hub_foundation.sql'),
  (7,  'Attendance + service hours',          to_regclass('public.activity_hours') IS NOT NULL,                 '20261009000002_activity_participation.sql'),
  (8,  'Service portfolio',                   to_regprocedure('public.get_my_service_portfolio()') IS NOT NULL, '20261011000001_student_service_portfolio.sql'),
  (9,  'Profile read privacy',                NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles'
                                                AND policyname = 'Authenticated users can read profiles')
                                              AND EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles'
                                                AND policyname = 'Admins can read all profiles'), '20261011000002_profile_read_privacy.sql'),
  (10, 'Group messages',                      to_regclass('public.activity_messages') IS NOT NULL,              '20261011000003_activity_group_messages.sql'),
  (11, 'Reflections',                         to_regclass('public.activity_reflections') IS NOT NULL,           '20261011000004_private_activity_reflections.sql'),
  (12, 'Hour corrections',                    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'correct_activity_hours'), '20261011000005_service_hour_corrections.sql'),
  (13, 'Message edit/remove + Realtime',      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
                                                AND table_name = 'activity_messages' AND column_name = 'deleted_at'), '20261011000006_messaging_controls_realtime.sql'),
  (14, 'Public listing privacy',              to_regprocedure('public.get_opportunity_contact(uuid)') IS NOT NULL, '20261015000001_public_opportunity_privacy.sql'),
  (15, 'Application lifecycle',               EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'application_lifecycle_guard'), '20261015000002_application_lifecycle.sql'),
  (16, 'Service programme filters',           EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
                                                AND table_name = 'opportunities' AND column_name = 'service_programs'), '20261019000001_opportunity_service_programs.sql'),
  (17, 'Calendar-date safeguards',            EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'protect_attendance_session_date'), '20261026000001_participation_calendar_dates.sql'),
  (18, 'Reflection reader access',            to_regprocedure('public.get_managed_activity_reflections(uuid,timestamptz,uuid)') IS NOT NULL, '20261026000002_activity_reflection_reader_access.sql'),
  (19, 'Apply to admin-managed listings',     EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'applications'
                                                AND policyname = 'Students can create applications' AND with_check ILIKE '%DISTINCT%'), '20261106000000_admin_managed_applications.sql'),
  (20, 'Notifications + reminders',           to_regprocedure('public.queue_my_reminders()') IS NOT NULL,       '20261106000001_notifications.sql'),
  (21, 'Message reports',                     to_regprocedure('public.report_activity_message(uuid,text,text)') IS NOT NULL, '20261106000002_message_reports.sql'),
  (22, 'Privacy requests + data export',      to_regprocedure('public.export_my_data()') IS NOT NULL,           '20261106000003_privacy_requests.sql'),
  -- Configuration and safety checks
  (30, 'A verified @iszl.ch admin exists',    EXISTS (SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id = p.id
                                                WHERE p.role = 'admin' AND u.email ~* '^[^@[:space:]]+@iszl[.]ch$' AND u.email_confirmed_at IS NOT NULL),
                                              'Sign in once with your ISZL account, then in SQL Editor: UPDATE public.profiles SET role = ''admin'' WHERE email = ''you@iszl.ch'';'),
  (31, 'Every public table has RLS on',       NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity),
                                              'Run: SELECT tablename FROM pg_tables WHERE schemaname = ''public'' AND NOT rowsecurity; and investigate'),
  (32, 'Realtime publishes messages',         EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'activity_messages'),
                                              'Database → Publications → supabase_realtime: include activity_messages'),
  (33, 'Realtime publishes notifications',    EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'),
                                              'Database → Publications → supabase_realtime: include notifications'),
  (34, 'Outside accounts blocked at sign-up', EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'before_school_user_created'),
                                              'Function exists; ALSO enable it in Authentication → Hooks → Before User Created (SQL cannot check this setting)'),
  (35, 'No sample listings still live',       NOT EXISTS (SELECT 1 FROM public.opportunities WHERE status = 'active' AND organizer_id IS NULL
                                                AND application_deadline < (now() AT TIME ZONE 'Europe/Zurich')::date),
                                              'Some active listings have past deadlines: close/archive them (see supabase/imports/archive_sample_opportunities.sql)'),
  (36, 'Internal functions not callable',     coalesce(NOT has_function_privilege('anon', to_regprocedure('public.push_notification(uuid,text,text,text,uuid,text,text)'), 'EXECUTE')
                                                AND NOT has_function_privilege('authenticated', to_regprocedure('public.push_notification(uuid,text,text,text,uuid,text,text)'), 'EXECUTE'), true),
                                              'REVOKE ALL ON FUNCTION public.push_notification(uuid,text,text,text,uuid,text,text) FROM PUBLIC, anon, authenticated;')
)
SELECT step, check_name, CASE WHEN ok THEN 'PASS' ELSE 'MISSING' END AS result,
  CASE WHEN ok THEN '' ELSE fix END AS what_to_do
FROM checks ORDER BY step;
