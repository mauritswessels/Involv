-- Prevent privilege escalation and ownership spoofing in client-supplied rows.

CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = check_user_id
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_profile_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  requester_is_admin boolean;
BEGIN
  requester_is_admin := public.is_admin(auth.uid());

  IF NEW.role IS DISTINCT FROM OLD.role AND NOT requester_is_admin THEN
    RAISE EXCEPTION 'Only administrators can change user roles'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_role_change ON public.profiles;
CREATE TRIGGER guard_profile_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role_change();

CREATE OR REPLACE FUNCTION public.guard_application_identity_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  requester_is_admin boolean;
BEGIN
  requester_is_admin := public.is_admin(auth.uid());

  IF NOT requester_is_admin
    AND (
      to_jsonb(NEW) - ARRAY['status', 'updated_at']
      IS DISTINCT FROM
      to_jsonb(OLD) - ARRAY['status', 'updated_at']
    )
  THEN
    RAISE EXCEPTION 'Organizers can only change application status'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_application_identity_change ON public.applications;
CREATE TRIGGER guard_application_identity_change
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.guard_application_identity_change();

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own non-admin profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND role <> 'admin'
  );

DROP POLICY IF EXISTS "Authenticated users can create opportunities"
  ON public.opportunities;
CREATE POLICY "Authenticated users create own opportunities"
  ON public.opportunities FOR INSERT
  TO authenticated
  WITH CHECK (organizer_id = auth.uid());

DROP POLICY IF EXISTS "Owners can update their opportunities"
  ON public.opportunities;
CREATE POLICY "Owners can update their opportunities"
  ON public.opportunities FOR UPDATE
  TO authenticated
  USING (
    organizer_id = auth.uid()
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    organizer_id = auth.uid()
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Students can create applications"
  ON public.applications;
CREATE POLICY "Students can create applications"
  ON public.applications FOR INSERT
  TO authenticated
  WITH CHECK (
    applicant_id = auth.uid()
    AND organizer_id = (
      SELECT opportunity.organizer_id
      FROM public.opportunities AS opportunity
      WHERE opportunity.id = opportunity_id
    )
  );

DROP POLICY IF EXISTS "Organizers can update application status"
  ON public.applications;
CREATE POLICY "Organizers can update application status"
  ON public.applications FOR UPDATE
  TO authenticated
  USING (
    organizer_id = auth.uid()
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    organizer_id = auth.uid()
    OR public.is_admin(auth.uid())
  );