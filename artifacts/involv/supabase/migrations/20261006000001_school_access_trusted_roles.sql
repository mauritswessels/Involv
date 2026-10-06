-- Apply after 20260923000002_security_hardening.sql.
-- Atomic: a failed administrator preflight or any later error rolls everything back.
BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.is_admin(uuid)') IS NULL
    OR to_regprocedure('public.guard_application_identity_change()') IS NULL THEN
    RAISE EXCEPTION 'Apply 20260923000002_security_hardening.sql before school access.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id = p.id
    WHERE p.role = 'admin'
      AND u.email ~* '^[^@[:space:]]+@iszl[.]ch$'
      AND u.email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'No verified @iszl.ch administrator exists. Nothing changed; approve a school administrator first.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_school_email(email text)
RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$ SELECT COALESCE(email ~* '^[^@[:space:]]+@iszl[.]ch$', false); $$;
REVOKE ALL ON FUNCTION public.is_school_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_school_email(text) TO anon, authenticated, supabase_auth_admin;

-- Read the verified identity from auth.users, NEVER editable profile/user_metadata.
-- No profile lookup here, so this helper cannot recurse through profile RLS.
CREATE OR REPLACE FUNCTION public.is_school_member()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
      AND public.is_school_email(u.email)
      AND u.email_confirmed_at IS NOT NULL
  );
$$;
REVOKE ALL ON FUNCTION public.is_school_member() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_school_member() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id = p.id
    WHERE p.id = check_user_id AND p.role = 'admin'
      AND public.is_school_email(u.email)
      AND u.email_confirmed_at IS NOT NULL
  );
$$;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_publish_opportunities()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT public.is_school_member() AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('teacher', 'organizer', 'admin')
  );
$$;
REVOKE ALL ON FUNCTION public.can_publish_opportunities() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_publish_opportunities() TO authenticated;

-- Select this function in Supabase Authentication -> Hooks -> Before User Created.
-- Defining the function alone does NOT activate the hook.
CREATE OR REPLACE FUNCTION public.before_school_user_created(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_school_email(event -> 'user' ->> 'email') THEN
    RETURN jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Involv is only available to @iszl.ch accounts. Please use your ISZL Google account.'
    ));
  END IF;
  RETURN '{}'::jsonb;
END;
$$;
REVOKE ALL ON FUNCTION public.before_school_user_created(jsonb) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.before_school_user_created(jsonb) TO supabase_auth_admin;

CREATE TABLE public.role_change_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  changed_by uuid,
  old_role text NOT NULL,
  new_role text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL
);
ALTER TABLE public.role_change_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.role_change_audit FROM anon, authenticated;
GRANT SELECT ON public.role_change_audit TO authenticated;
CREATE POLICY "School admins read role audit"
  ON public.role_change_audit FOR SELECT TO authenticated
  USING (public.is_school_member() AND public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.audit_profile_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    INSERT INTO public.role_change_audit (target_user_id, changed_by, old_role, new_role, reason)
    VALUES (NEW.id, auth.uid(), OLD.role, NEW.role,
      CASE WHEN auth.uid() IS NULL THEN 'school_access_reapproval' ELSE 'admin_role_change' END);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.audit_profile_role_change() FROM PUBLIC;
CREATE TRIGGER audit_profile_role_change
  AFTER UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_profile_role_change();

-- The user explicitly requested fresh approval of ALL teachers/organisers.
-- Keep administrators and all records; do not delete accounts or opportunities.
-- DDL holds the table lock until COMMIT, so there is no unguarded write window.
DROP TRIGGER guard_profile_role_change ON public.profiles;
UPDATE public.profiles SET role = 'student' WHERE role IN ('teacher', 'organizer');
UPDATE public.profiles p SET email = u.email
FROM auth.users u WHERE p.id = u.id AND p.email IS DISTINCT FROM u.email;

CREATE OR REPLACE FUNCTION public.guard_profile_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  identity_email text;
BEGIN
  SELECT email INTO identity_email FROM auth.users WHERE id = NEW.id;
  IF NEW.email IS DISTINCT FROM identity_email THEN
    RAISE EXCEPTION 'Profile email must match the authenticated identity' USING ERRCODE = '42501';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Profile identity cannot be changed' USING ERRCODE = '42501';
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.is_school_member() OR NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Only ISZL administrators can approve roles' USING ERRCODE = '42501';
    END IF;
    IF OLD.id = auth.uid() THEN
      RAISE EXCEPTION 'Ask another administrator to change your role' USING ERRCODE = '42501';
    END IF;
    IF NEW.role <> 'student' AND NOT EXISTS (
      SELECT 1 FROM auth.users u WHERE u.id = NEW.id
        AND public.is_school_email(u.email) AND u.email_confirmed_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Only verified ISZL accounts can receive privileged roles' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_profile_role_change() FROM PUBLIC;
CREATE TRIGGER guard_profile_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role_change();

CREATE OR REPLACE FUNCTION public.guard_school_profile_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_school_member() OR NEW.id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only verified ISZL members can create their own profiles' USING ERRCODE = '42501';
  END IF;
  IF NEW.role <> 'student' THEN
    RAISE EXCEPTION 'New accounts must start as students; ask an administrator to approve another role'
      USING ERRCODE = '42501';
  END IF;
  SELECT email INTO NEW.email FROM auth.users WHERE id = auth.uid();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_school_profile_insert() FROM PUBLIC;
CREATE TRIGGER guard_school_profile_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_school_profile_insert();

DROP POLICY IF EXISTS "Users can insert own non-admin profile" ON public.profiles;
CREATE POLICY "School members create student profiles"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() AND role = 'student' AND public.is_school_member());

-- RESTRICTIVE policies intersect with existing ownership rules; permissive
-- policies elsewhere cannot accidentally grant access to outside accounts.
CREATE POLICY "School membership required"
  ON public.profiles AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_school_member()) WITH CHECK (public.is_school_member());
CREATE POLICY "School membership required"
  ON public.applications AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_school_member()) WITH CHECK (public.is_school_member());
CREATE POLICY "School membership required"
  ON public.saved_opportunities AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_school_member()) WITH CHECK (public.is_school_member());
CREATE POLICY "School membership required"
  ON public.opportunities AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_school_member()) WITH CHECK (public.is_school_member());

-- Public active listings remain readable without signing in, as before.
-- They do not grant access to profiles, applications or school management.
CREATE POLICY "Approved publishers create opportunities"
  ON public.opportunities AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.can_publish_opportunities() AND organizer_id = auth.uid());
CREATE POLICY "Approved publishers update opportunities"
  ON public.opportunities AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.can_publish_opportunities() AND (organizer_id = auth.uid() OR public.is_admin(auth.uid())))
  WITH CHECK (public.can_publish_opportunities() AND (organizer_id = auth.uid() OR public.is_admin(auth.uid())));
CREATE POLICY "Approved publishers delete opportunities"
  ON public.opportunities AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.can_publish_opportunities() AND (organizer_id = auth.uid() OR public.is_admin(auth.uid())));
CREATE POLICY "Approved managers read applications"
  ON public.applications AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    applicant_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR (organizer_id = auth.uid() AND public.can_publish_opportunities())
  );
CREATE POLICY "Approved managers update applications"
  ON public.applications AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.can_publish_opportunities() AND (organizer_id = auth.uid() OR public.is_admin(auth.uid())))
  WITH CHECK (public.can_publish_opportunities() AND (organizer_id = auth.uid() OR public.is_admin(auth.uid())));

-- Prevent an administrator deleting their own profile and locking themselves out.
CREATE POLICY "No self deletion"
  ON public.profiles AS RESTRICTIVE FOR DELETE TO authenticated
  USING (id <> auth.uid());

COMMIT;
