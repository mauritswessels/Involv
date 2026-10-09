-- Does not enable OAuth/signup hooks or reset existing roles.
-- Apply 20260923000002_security_hardening.sql first.
BEGIN;
DO $$
BEGIN
  IF to_regprocedure('public.is_admin(uuid)') IS NULL
    OR to_regprocedure('public.guard_application_identity_change()') IS NULL THEN
    RAISE EXCEPTION 'Apply 20260923000002_security_hardening.sql before Activity Hub setup.';
  END IF;
END;
$$;

-- The older hardening migration permits non-admin role selection on INSERT.
-- Activity management must not be obtainable by creating a teacher profile
-- directly through the API. This does not reset roles or change sign-in.
CREATE POLICY "New profiles start as students for activity safety"
  ON public.profiles AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (role = 'student');

-- Identity checks use verified Auth data, not editable profile email/metadata.
-- No dependency on the deferred school signup hook or role-reset migration.
CREATE FUNCTION public.activity_identity_verified()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL
      AND email ~* '^[^@[:space:]]+@iszl[.]ch$'
  );
$$;
CREATE FUNCTION public.can_manage_activity(target_opportunity_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT public.activity_identity_verified() AND EXISTS (
    SELECT 1 FROM public.opportunities o
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE o.id = target_opportunity_id
      AND (p.role = 'admin'
        OR (p.role IN ('teacher', 'organizer') AND o.organizer_id = auth.uid()))
  );
$$;
CREATE FUNCTION public.can_read_activity(target_opportunity_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT public.activity_identity_verified() AND (
    public.can_manage_activity(target_opportunity_id) OR EXISTS (
      SELECT 1 FROM public.applications
      WHERE opportunity_id = target_opportunity_id
        AND applicant_id = auth.uid() AND status = 'Accepted'
    )
  );
$$;
REVOKE ALL ON FUNCTION public.activity_identity_verified() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_activity(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_activity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activity_identity_verified(),
  public.can_manage_activity(uuid), public.can_read_activity(uuid) TO authenticated;

-- Managers must be able to open their own draft/closed listings from the
-- dashboard. The definer helper avoids a recursive same-table RLS lookup.
CREATE POLICY "Approved owners read their opportunities" ON public.opportunities
  FOR SELECT TO authenticated USING (public.can_manage_activity(id));

CREATE TABLE public.activity_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text NOT NULL DEFAULT '',
  author_role text NOT NULL DEFAULT '',
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 10000),
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.activity_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  session_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL CHECK (end_time > start_time),
  location text NOT NULL CHECK (length(btrim(location)) BETWEEN 1 AND 200),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_announcements_opportunity_idx
  ON public.activity_announcements(opportunity_id, pinned DESC, created_at DESC);
CREATE INDEX activity_sessions_opportunity_idx
  ON public.activity_sessions(opportunity_id, session_date, start_time);

CREATE FUNCTION public.guard_activity_record()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Permit only the FK's SET NULL when an Auth identity has been deleted.
  -- This is not a client-controlled authorship change.
  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'activity_announcements' THEN
      IF NEW.author_id IS NULL AND OLD.author_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.author_id)
        AND (to_jsonb(NEW) - 'author_id') = (to_jsonb(OLD) - 'author_id') THEN
        RETURN NEW;
      END IF;
    ELSE
      IF NEW.created_by IS NULL AND OLD.created_by IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.created_by)
        AND (to_jsonb(NEW) - 'created_by') = (to_jsonb(OLD) - 'created_by') THEN
        RETURN NEW;
      END IF;
    END IF;
  END IF;
  IF NOT public.can_manage_activity(NEW.opportunity_id) THEN
    RAISE EXCEPTION 'Only approved activity owners and school admins can manage this activity'
      USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.opportunity_id IS DISTINCT FROM OLD.opportunity_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Activity identity and creation time cannot be changed' USING ERRCODE = '42501';
    END IF;
    IF TG_TABLE_NAME = 'activity_announcements' THEN
      IF NEW.author_id IS DISTINCT FROM OLD.author_id
        OR NEW.author_name IS DISTINCT FROM OLD.author_name
        OR NEW.author_role IS DISTINCT FROM OLD.author_role THEN
        RAISE EXCEPTION 'Announcement authorship cannot be changed' USING ERRCODE = '42501';
      END IF;
    ELSIF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      RAISE EXCEPTION 'Session creator cannot be changed' USING ERRCODE = '42501';
    END IF;
  ELSE
    NEW.created_at := now();
    IF TG_TABLE_NAME = 'activity_announcements' THEN
      NEW.author_id := auth.uid();
      SELECT name, role INTO NEW.author_name, NEW.author_role
        FROM public.profiles WHERE id = auth.uid();
    ELSE
      NEW.created_by := auth.uid();
    END IF;
  END IF;
  NEW.updated_at := now();
  NEW.title := btrim(NEW.title);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_activity_record() FROM PUBLIC;
CREATE TRIGGER guard_activity_announcement BEFORE INSERT OR UPDATE
  ON public.activity_announcements FOR EACH ROW EXECUTE FUNCTION public.guard_activity_record();
CREATE TRIGGER guard_activity_session BEFORE INSERT OR UPDATE
  ON public.activity_sessions FOR EACH ROW EXECUTE FUNCTION public.guard_activity_record();

ALTER TABLE public.activity_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.activity_announcements, public.activity_sessions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_announcements, public.activity_sessions TO authenticated;
CREATE POLICY "Participants read announcements" ON public.activity_announcements FOR SELECT TO authenticated
  USING (public.can_read_activity(opportunity_id));
CREATE POLICY "Owners create announcements" ON public.activity_announcements FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_activity(opportunity_id));
CREATE POLICY "Owners update announcements" ON public.activity_announcements FOR UPDATE TO authenticated
  USING (public.can_manage_activity(opportunity_id)) WITH CHECK (public.can_manage_activity(opportunity_id));
CREATE POLICY "Owners delete announcements" ON public.activity_announcements FOR DELETE TO authenticated
  USING (public.can_manage_activity(opportunity_id));
CREATE POLICY "Participants read sessions" ON public.activity_sessions FOR SELECT TO authenticated
  USING (public.can_read_activity(opportunity_id));
CREATE POLICY "Owners create sessions" ON public.activity_sessions FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_activity(opportunity_id));
CREATE POLICY "Owners update sessions" ON public.activity_sessions FOR UPDATE TO authenticated
  USING (public.can_manage_activity(opportunity_id)) WITH CHECK (public.can_manage_activity(opportunity_id));
CREATE POLICY "Owners delete sessions" ON public.activity_sessions FOR DELETE TO authenticated
  USING (public.can_manage_activity(opportunity_id));

-- Single authorised snapshot. Participant names only; no emails, grades,
-- application motivations or unrelated profiles are exposed.
CREATE FUNCTION public.get_activity_hub(target_opportunity_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  opportunity jsonb;
BEGIN
  IF NOT public.can_read_activity(target_opportunity_id) THEN
    RAISE EXCEPTION 'This hub is available only to accepted participants and approved managers'
      USING ERRCODE = '42501';
  END IF;
  SELECT to_jsonb(o) INTO opportunity FROM public.opportunities o WHERE o.id = target_opportunity_id;
  IF opportunity IS NULL THEN
    RAISE EXCEPTION 'Activity not found' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object(
    'opportunity', opportunity,
    'can_manage', public.can_manage_activity(target_opportunity_id),
    'participants', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', a.applicant_id, 'name', COALESCE(p.name, a.applicant_name))
        ORDER BY COALESCE(p.name, a.applicant_name), a.applicant_id)
      FROM public.applications a LEFT JOIN public.profiles p ON p.id = a.applicant_id
      WHERE a.opportunity_id = target_opportunity_id AND a.status = 'Accepted'
    ), '[]'::jsonb),
    'announcements', COALESCE((
      SELECT jsonb_agg(to_jsonb(a) ORDER BY a.pinned DESC, a.created_at DESC, a.id)
      FROM public.activity_announcements a WHERE a.opportunity_id = target_opportunity_id
    ), '[]'::jsonb),
    'sessions', COALESCE((
      SELECT jsonb_agg(to_jsonb(s) ORDER BY s.session_date, s.start_time, s.id)
      FROM public.activity_sessions s WHERE s.opportunity_id = target_opportunity_id
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_activity_hub(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_activity_hub(uuid) TO authenticated;
COMMIT;
