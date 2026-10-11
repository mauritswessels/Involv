-- Keep complete profile rows private to their owner and designated school
-- administrators. Organizers receive applicant details from their own
-- applications instead of reading unrelated profile records.
BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.is_admin(uuid)') IS NULL THEN
    RAISE EXCEPTION
      'Apply the security-hardening migration before profile read privacy.';
  END IF;
END
$$;

DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

COMMIT;
