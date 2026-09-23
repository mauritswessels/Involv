-- Run in the Supabase SQL editor or with psql against the intended staging
-- project. This script is read-only except for raising an exception when a
-- required launch safeguard is missing.

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