-- Run through `pnpm --filter @workspace/involv test:security` only.
-- The runner validates the connection host against the explicitly supplied
-- staging project reference. Fixture users and rows are created inside this
-- transaction and rolled back at the end; no login credentials are created.

\set ON_ERROR_STOP on

BEGIN;

SELECT set_config(
  'app.involv_security_test_environment',
  :'launch_security_test_environment',
  true
);
SELECT set_config(
  'app.involv_security_test_project_ref',
  :'launch_security_test_project_ref',
  true
);

DO $$
BEGIN
  IF current_setting('app.involv_security_test_environment', true)
      IS DISTINCT FROM 'staging' THEN
    RAISE EXCEPTION
      'Security behavior tests only run when the staging environment is confirmed';
  END IF;

  IF current_setting('app.involv_security_test_project_ref', true)
      !~ '^[a-z0-9]{20}$' THEN
    RAISE EXCEPTION
      'The staging project reference is missing or invalid';
  END IF;
END
$$;

DO $$
DECLARE
  missing_rls text[];
  missing_policy_tables text[];
  missing_required_policies text[];
  missing_guard_triggers text[];
BEGIN
  SELECT array_agg(expected.table_name ORDER BY expected.table_name)
  INTO missing_rls
  FROM (
    VALUES
      ('profiles'),
      ('opportunities'),
      ('applications'),
      ('saved_opportunities')
  ) AS expected(table_name)
  LEFT JOIN pg_namespace n ON n.nspname = 'public'
  LEFT JOIN pg_class c
    ON c.relname = expected.table_name
   AND c.relnamespace = n.oid
  WHERE c.oid IS NULL OR NOT c.relrowsecurity;

  IF missing_rls IS NOT NULL THEN
    RAISE EXCEPTION 'RLS is missing or disabled for: %', missing_rls;
  END IF;

  SELECT array_agg(missing.table_name ORDER BY missing.table_name)
  INTO missing_policy_tables
  FROM (
    SELECT expected.table_name
    FROM (
      VALUES
        ('profiles'),
        ('opportunities'),
        ('applications'),
        ('saved_opportunities')
    ) AS expected(table_name)
    LEFT JOIN pg_policies p
      ON p.schemaname = 'public'
     AND p.tablename = expected.table_name
    GROUP BY expected.table_name
    HAVING count(p.policyname) = 0
  ) AS missing;

  IF missing_policy_tables IS NOT NULL THEN
    RAISE EXCEPTION 'No RLS policies found for: %', missing_policy_tables;
  END IF;

  SELECT array_agg(required.policy_name ORDER BY required.policy_name)
  INTO missing_required_policies
  FROM (
    VALUES
      ('profiles', 'Users can insert own non-admin profile', 'INSERT'),
      ('profiles', 'Users can update own profile', 'UPDATE'),
      ('profiles', 'Admins can update any profile', 'UPDATE'),
      ('opportunities', 'Anyone can read active opportunities', 'SELECT'),
      ('opportunities', 'Authenticated users create own opportunities', 'INSERT'),
      ('opportunities', 'Owners can update their opportunities', 'UPDATE'),
      ('applications', 'Students can read own applications', 'SELECT'),
      ('applications', 'Students can create applications', 'INSERT'),
      ('applications', 'Organizers can update application status', 'UPDATE'),
      ('saved_opportunities', 'Users manage own saved opportunities', 'ALL')
  ) AS required(table_name, policy_name, command)
  LEFT JOIN pg_policies p
    ON p.schemaname = 'public'
   AND p.tablename = required.table_name
   AND p.policyname = required.policy_name
   AND p.cmd = required.command
  WHERE p.policyname IS NULL;

  IF missing_required_policies IS NOT NULL THEN
    RAISE EXCEPTION 'Required RLS policies are missing: %', missing_required_policies;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can insert own non-admin profile'
      AND with_check ILIKE '%role%admin%'
  ) THEN
    RAISE EXCEPTION 'Profile insert policy does not guard the admin role';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'opportunities'
      AND policyname = 'Authenticated users create own opportunities'
      AND with_check ILIKE '%organizer_id%'
      AND with_check ILIKE '%auth.uid%'
  ) THEN
    RAISE EXCEPTION 'Opportunity insert policy does not enforce ownership';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'applications'
      AND policyname = 'Students can create applications'
      AND with_check ILIKE '%applicant_id%'
      AND with_check ILIKE '%organizer_id%'
  ) THEN
    RAISE EXCEPTION 'Application insert policy does not enforce ownership';
  END IF;

  SELECT array_agg(required.trigger_name ORDER BY required.trigger_name)
  INTO missing_guard_triggers
  FROM (
    VALUES
      ('profiles', 'guard_profile_role_change'),
      ('applications', 'guard_application_identity_change')
  ) AS required(table_name, trigger_name)
  LEFT JOIN information_schema.triggers t
    ON t.event_object_schema = 'public'
   AND t.event_object_table = required.table_name
   AND t.trigger_name = required.trigger_name
  WHERE t.trigger_name IS NULL;

  IF missing_guard_triggers IS NOT NULL THEN
    RAISE EXCEPTION 'Required authorization guard triggers are missing: %',
      missing_guard_triggers;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'is_admin'
      AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'The protected is_admin authorization helper is missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname IN (
        'Admins can update any profile',
        'Admins can delete profiles'
      )
      AND coalesce(qual, '') NOT ILIKE '%is_admin%'
  ) THEN
    RAISE EXCEPTION 'Profile admin policies are not using the protected is_admin helper';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'guard_application_identity_change'
      AND pg_get_functiondef(p.oid) ILIKE '%to_jsonb(NEW)%status%updated_at%'
  ) THEN
    RAISE EXCEPTION 'Application update guard does not restrict organizers to status-only changes';
  END IF;
END
$$;

SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles',
    'opportunities',
    'applications',
    'saved_opportunities'
  )
ORDER BY tablename, cmd, policyname;

-- Generate unique, transaction-scoped identities. A sixth user has no profile
-- so the test can exercise the self-service profile-insert policy.
SELECT set_config('app.involv_security_test.student', gen_random_uuid()::text, true);
SELECT set_config('app.involv_security_test.other_student', gen_random_uuid()::text, true);
SELECT set_config('app.involv_security_test.organizer', gen_random_uuid()::text, true);
SELECT set_config('app.involv_security_test.other_organizer', gen_random_uuid()::text, true);
SELECT set_config('app.involv_security_test.admin', gen_random_uuid()::text, true);
SELECT set_config('app.involv_security_test.unprofiled_user', gen_random_uuid()::text, true);
SELECT set_config('app.involv_security_test.opportunity', gen_random_uuid()::text, true);
SELECT set_config('app.involv_security_test.other_opportunity', gen_random_uuid()::text, true);
SELECT set_config('app.involv_security_test.new_opportunity', gen_random_uuid()::text, true);
SELECT set_config('app.involv_security_test.application', gen_random_uuid()::text, true);
SELECT set_config('app.involv_security_test.other_application', gen_random_uuid()::text, true);

INSERT INTO auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
SELECT
  fixture.id,
  'authenticated',
  'authenticated',
  'security-test-' || fixture.id::text || '@example.invalid',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('name', 'Security test ' || fixture.user_role),
  now(),
  now()
FROM (
  VALUES
    (current_setting('app.involv_security_test.student')::uuid, 'student'),
    (current_setting('app.involv_security_test.other_student')::uuid, 'student'),
    (current_setting('app.involv_security_test.organizer')::uuid, 'organizer'),
    (current_setting('app.involv_security_test.other_organizer')::uuid, 'organizer'),
    (current_setting('app.involv_security_test.admin')::uuid, 'admin'),
    (current_setting('app.involv_security_test.unprofiled_user')::uuid, 'student')
) AS fixture(id, user_role);

INSERT INTO public.profiles (id, name, email, role)
SELECT
  fixture.id,
  'Security test ' || fixture.user_role,
  'security-test-' || fixture.id::text || '@example.invalid',
  fixture.user_role
FROM (
  VALUES
    (current_setting('app.involv_security_test.student')::uuid, 'student'),
    (current_setting('app.involv_security_test.other_student')::uuid, 'student'),
    (current_setting('app.involv_security_test.organizer')::uuid, 'organizer'),
    (current_setting('app.involv_security_test.other_organizer')::uuid, 'organizer'),
    (current_setting('app.involv_security_test.admin')::uuid, 'admin')
) AS fixture(id, user_role);

INSERT INTO public.opportunities (
  id, organizer_id, title, category, application_deadline, status
)
VALUES
  (
    current_setting('app.involv_security_test.opportunity')::uuid,
    current_setting('app.involv_security_test.organizer')::uuid,
    'Security test opportunity',
    'Community service',
    DATE '2099-12-31',
    'active'
  ),
  (
    current_setting('app.involv_security_test.other_opportunity')::uuid,
    current_setting('app.involv_security_test.other_organizer')::uuid,
    'Other security test opportunity',
    'Community service',
    DATE '2099-12-31',
    'active'
  );

INSERT INTO public.applications (
  id,
  opportunity_id,
  opportunity_title,
  applicant_id,
  applicant_name,
  applicant_email,
  organizer_id,
  grade,
  motivation,
  relevant_experience,
  availability,
  status
)
VALUES
  (
    current_setting('app.involv_security_test.application')::uuid,
    current_setting('app.involv_security_test.opportunity')::uuid,
    'Security test opportunity',
    current_setting('app.involv_security_test.student')::uuid,
    'Security test student',
    'security-test-student@example.invalid',
    current_setting('app.involv_security_test.organizer')::uuid,
    '10',
    'Original motivation',
    'Original experience',
    'Weekends',
    'Pending'
  ),
  (
    current_setting('app.involv_security_test.other_application')::uuid,
    current_setting('app.involv_security_test.opportunity')::uuid,
    'Security test opportunity',
    current_setting('app.involv_security_test.other_student')::uuid,
    'Other security test student',
    'security-test-other-student@example.invalid',
    current_setting('app.involv_security_test.organizer')::uuid,
    '11',
    'Other original motivation',
    'Other original experience',
    'Evenings',
    'Pending'
  );

CREATE OR REPLACE FUNCTION pg_temp.assert_security_test(
  condition boolean,
  assertion text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Security behavior test failed: %', assertion;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.expect_authorization_denial(
  statement text,
  assertion text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      RETURN;
  END;

  RAISE EXCEPTION
    'Security behavior test failed: expected an authorization denial for %',
    assertion;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.use_fixture_user(user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', user_id, 'role', 'authenticated')::text,
    true
  );
END;
$$;

SET LOCAL ROLE authenticated;

-- Students cannot escalate their own profile role, including through the
-- profile-update trigger or the profile-insert policy.
SELECT pg_temp.use_fixture_user(
  current_setting('app.involv_security_test.student')::uuid
) \gset

DO $$
BEGIN
  PERFORM pg_temp.assert_security_test(
    current_user = 'authenticated'
      AND auth.uid() = current_setting('app.involv_security_test.student')::uuid,
    'the student fixture is executing as authenticated with its own JWT subject'
  );

  PERFORM pg_temp.expect_authorization_denial(
    format(
      'UPDATE public.profiles SET role = %L WHERE id = %L::uuid',
      'admin',
      current_setting('app.involv_security_test.student')
    ),
    'a student escalating their own profile role'
  );
END
$$;

SELECT pg_temp.use_fixture_user(
  current_setting('app.involv_security_test.unprofiled_user')::uuid
) \gset

DO $$
BEGIN
  PERFORM pg_temp.expect_authorization_denial(
    format(
      'INSERT INTO public.profiles (id, name, email, role) VALUES (%L::uuid, %L, %L, %L)',
      current_setting('app.involv_security_test.unprofiled_user'),
      'Unprofiled security test user',
      'unprofiled-security-test@example.invalid',
      'admin'
    ),
    'a user inserting their own profile as admin'
  );
END
$$;

-- An admin can change another user's role without recursive RLS evaluation.
SELECT pg_temp.use_fixture_user(
  current_setting('app.involv_security_test.admin')::uuid
) \gset

UPDATE public.profiles
SET role = 'teacher'
WHERE id = current_setting('app.involv_security_test.other_student')::uuid;

DO $$
DECLARE
  target_role text;
BEGIN
  SELECT role INTO target_role
  FROM public.profiles
  WHERE id = current_setting('app.involv_security_test.other_student')::uuid;

  PERFORM pg_temp.assert_security_test(
    target_role = 'teacher',
    'an admin changing another profile role'
  );
END
$$;

UPDATE public.profiles
SET role = 'student'
WHERE id = current_setting('app.involv_security_test.other_student')::uuid;

-- Opportunity creators must own the row. Owners can update it, while other
-- organizers cannot update it or transfer its ownership.
SELECT pg_temp.use_fixture_user(
  current_setting('app.involv_security_test.organizer')::uuid
) \gset

DO $$
DECLARE
  changed_rows integer;
BEGIN
  UPDATE public.opportunities
  SET title = 'Updated by owner'
  WHERE id = current_setting('app.involv_security_test.opportunity')::uuid;
  GET DIAGNOSTICS changed_rows = ROW_COUNT;
  PERFORM pg_temp.assert_security_test(
    changed_rows = 1,
    'an organizer updating their own opportunity'
  );
END
$$;

DO $$
DECLARE
  new_opportunity_id uuid :=
    current_setting('app.involv_security_test.new_opportunity')::uuid;
BEGIN
  INSERT INTO public.opportunities (
    id, organizer_id, title, category, application_deadline, status
  )
  VALUES (
    new_opportunity_id,
    auth.uid(),
    'Organizer-owned security test opportunity',
    'Community service',
    DATE '2099-12-31',
    'active'
  );
END
$$;

DO $$
DECLARE
  changed_rows integer;
BEGIN
  UPDATE public.opportunities
  SET title = 'Unauthorized edit'
  WHERE id = current_setting('app.involv_security_test.other_opportunity')::uuid;
  GET DIAGNOSTICS changed_rows = ROW_COUNT;

  PERFORM pg_temp.assert_security_test(
    changed_rows = 0,
    'an organizer being unable to update another organizer opportunity'
  );

  PERFORM pg_temp.expect_authorization_denial(
    format(
      'UPDATE public.opportunities SET organizer_id = %L::uuid WHERE id = %L::uuid',
      current_setting('app.involv_security_test.other_organizer'),
      current_setting('app.involv_security_test.opportunity')
    ),
    'an organizer transferring opportunity ownership'
  );

  PERFORM pg_temp.expect_authorization_denial(
    format(
      'INSERT INTO public.opportunities (organizer_id, title, category, application_deadline) VALUES (%L::uuid, %L, %L, %L::date)',
      current_setting('app.involv_security_test.other_organizer'),
      'Forged security test opportunity',
      'Community service',
      '2099-12-31'
    ),
    'an organizer creating an opportunity for another user'
  );
END
$$;

-- Applicants may create and read their own applications only when the
-- organizer_id matches the opportunity owner.
SELECT pg_temp.use_fixture_user(
  current_setting('app.involv_security_test.student')::uuid
) \gset

DO $$
DECLARE
  application_count integer;
BEGIN
  PERFORM pg_temp.expect_authorization_denial(
    format(
      'INSERT INTO public.applications (opportunity_id, opportunity_title, applicant_id, applicant_name, applicant_email, organizer_id, grade, motivation, relevant_experience, availability) VALUES (%L::uuid, %L, %L::uuid, %L, %L, %L::uuid, %L, %L, %L, %L)',
      current_setting('app.involv_security_test.opportunity'),
      'Security test opportunity',
      current_setting('app.involv_security_test.other_student'),
      'Other student',
      'other@example.invalid',
      current_setting('app.involv_security_test.organizer'),
      '10',
      'Attempted application',
      '',
      ''
    ),
    'a student creating an application for another applicant'
  );

  PERFORM pg_temp.expect_authorization_denial(
    format(
      'INSERT INTO public.applications (opportunity_id, opportunity_title, applicant_id, applicant_name, applicant_email, organizer_id, grade, motivation, relevant_experience, availability) VALUES (%L::uuid, %L, %L::uuid, %L, %L, %L::uuid, %L, %L, %L, %L)',
      current_setting('app.involv_security_test.opportunity'),
      'Security test opportunity',
      current_setting('app.involv_security_test.student'),
      'Security test student',
      'student@example.invalid',
      current_setting('app.involv_security_test.other_organizer'),
      '10',
      'Attempted application',
      '',
      ''
    ),
    'a student forging the opportunity organizer on an application'
  );

  INSERT INTO public.applications (
    opportunity_id,
    opportunity_title,
    applicant_id,
    applicant_name,
    applicant_email,
    organizer_id,
    grade,
    motivation,
    relevant_experience,
    availability
  )
  VALUES (
    current_setting('app.involv_security_test.new_opportunity')::uuid,
    'Organizer-owned security test opportunity',
    auth.uid(),
    'Security test student',
    'security-test-student@example.invalid',
    current_setting('app.involv_security_test.organizer')::uuid,
    '10',
    'Valid motivation',
    'Valid experience',
    'Weekends'
  );

  SELECT count(*) INTO application_count
  FROM public.applications
  WHERE id = current_setting('app.involv_security_test.application')::uuid;

  PERFORM pg_temp.assert_security_test(
    application_count = 1,
    'a student reading their own application'
  );

  SELECT count(*) INTO application_count
  FROM public.applications
  WHERE id = current_setting('app.involv_security_test.other_application')::uuid;

  PERFORM pg_temp.assert_security_test(
    application_count = 0,
    'a student being unable to read another student application'
  );

  UPDATE public.applications
  SET motivation = 'Student attempted edit'
  WHERE id = current_setting('app.involv_security_test.application')::uuid;

  GET DIAGNOSTICS application_count = ROW_COUNT;
  PERFORM pg_temp.assert_security_test(
    application_count = 0,
    'a student being unable to edit their application text'
  );
END
$$;

-- Organizers can change status only for applications on their own
-- opportunities. Other application fields remain immutable to organizers.
SELECT pg_temp.use_fixture_user(
  current_setting('app.involv_security_test.organizer')::uuid
) \gset

DO $$
DECLARE
  changed_rows integer;
  application_status text;
BEGIN
  UPDATE public.applications
  SET status = 'Under Review'
  WHERE id = current_setting('app.involv_security_test.application')::uuid;
  GET DIAGNOSTICS changed_rows = ROW_COUNT;
  PERFORM pg_temp.assert_security_test(
    changed_rows = 1,
    'an organizer changing application status for their opportunity'
  );

  SELECT status INTO application_status
  FROM public.applications
  WHERE id = current_setting('app.involv_security_test.application')::uuid;

  PERFORM pg_temp.assert_security_test(
    application_status = 'Under Review',
    'the organizer status change being persisted'
  );

  PERFORM pg_temp.expect_authorization_denial(
    format(
      'UPDATE public.applications SET motivation = %L WHERE id = %L::uuid',
      'Tampered motivation',
      current_setting('app.involv_security_test.application')
    ),
    'an organizer editing application motivation'
  );

  PERFORM pg_temp.expect_authorization_denial(
    format(
      'UPDATE public.applications SET relevant_experience = %L WHERE id = %L::uuid',
      'Tampered experience',
      current_setting('app.involv_security_test.application')
    ),
    'an organizer editing application experience'
  );

  PERFORM pg_temp.expect_authorization_denial(
    format(
      'UPDATE public.applications SET availability = %L WHERE id = %L::uuid',
      'Tampered availability',
      current_setting('app.involv_security_test.application')
    ),
    'an organizer editing applicant availability'
  );

  PERFORM pg_temp.expect_authorization_denial(
    format(
      'UPDATE public.applications SET grade = %L WHERE id = %L::uuid',
      'Tampered grade',
      current_setting('app.involv_security_test.application')
    ),
    'an organizer editing applicant grade'
  );

  PERFORM pg_temp.expect_authorization_denial(
    format(
      'UPDATE public.applications SET applicant_id = %L::uuid WHERE id = %L::uuid',
      current_setting('app.involv_security_test.other_student'),
      current_setting('app.involv_security_test.application')
    ),
    'an organizer reassigning application ownership'
  );
END
$$;

SELECT pg_temp.use_fixture_user(
  current_setting('app.involv_security_test.other_organizer')::uuid
) \gset

DO $$
DECLARE
  changed_rows integer;
BEGIN
  UPDATE public.applications
  SET status = 'Rejected'
  WHERE id = current_setting('app.involv_security_test.application')::uuid;
  GET DIAGNOSTICS changed_rows = ROW_COUNT;

  PERFORM pg_temp.assert_security_test(
    changed_rows = 0,
    'an organizer being unable to update another organizer application status'
  );
END
$$;

ROLLBACK;