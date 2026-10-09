-- Apply the Activity Hub foundation first. No school signup-hook dependency.
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('public.can_read_activity(uuid)') IS NULL
    OR to_regclass('public.activity_sessions') IS NULL THEN
    RAISE EXCEPTION 'Install the Activity Hub foundation before participation.';
  END IF;
END; $$;

CREATE FUNCTION public.can_submit_activity_hours(target_opportunity_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT public.activity_identity_verified() AND EXISTS (
    SELECT 1 FROM public.applications a
    JOIN public.profiles p ON p.id = a.applicant_id
    WHERE a.opportunity_id = target_opportunity_id
      AND a.applicant_id = auth.uid() AND a.status = 'Accepted'
  );
$$;
REVOKE ALL ON FUNCTION public.can_submit_activity_hours(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_submit_activity_hours(uuid) TO authenticated;

ALTER TABLE public.activity_sessions
  ADD CONSTRAINT activity_sessions_identity_key UNIQUE (id, opportunity_id);
CREATE TABLE public.activity_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  present boolean,
  marked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  marked_by_name text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (session_id, opportunity_id)
    REFERENCES public.activity_sessions(id, opportunity_id) ON DELETE CASCADE,
  UNIQUE (session_id, student_id)
);
CREATE INDEX activity_attendance_opportunity_idx ON public.activity_attendance(opportunity_id, student_id);
CREATE TABLE public.activity_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  service_date date NOT NULL,
  hours numeric(5,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 2000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_name text NOT NULL DEFAULT '',
  review_note text NOT NULL DEFAULT '' CHECK (length(review_note) <= 1000),
  reviewed_at timestamptz,
  CHECK ((status = 'pending' AND reviewed_at IS NULL AND reviewed_by IS NULL
          AND review_note = '' AND reviewer_name = '')
    OR (status IN ('approved','rejected') AND reviewed_at IS NOT NULL)),
  CHECK (reviewed_by IS NULL OR reviewed_by <> student_id),
  CHECK (status <> 'rejected' OR length(btrim(review_note)) > 0)
);
CREATE INDEX activity_hours_opportunity_idx ON public.activity_hours(opportunity_id, submitted_at DESC);
CREATE INDEX activity_hours_daily_idx ON public.activity_hours(student_id, service_date)
  WHERE status IN ('pending','approved');

ALTER TABLE public.activity_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_hours ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.activity_attendance, public.activity_hours FROM PUBLIC, anon, authenticated;
-- Writes go only through identity-derived, concurrency-safe RPC functions.
GRANT SELECT ON public.activity_attendance, public.activity_hours TO authenticated;
CREATE POLICY "Private attendance reads" ON public.activity_attendance
  FOR SELECT TO authenticated USING (
    public.can_read_activity(opportunity_id)
    AND (student_id = auth.uid() OR public.can_manage_activity(opportunity_id))
  );
CREATE POLICY "Private hours reads" ON public.activity_hours
  FOR SELECT TO authenticated USING (
    public.can_read_activity(opportunity_id)
    AND (student_id = auth.uid() OR public.can_manage_activity(opportunity_id))
  );

CREATE FUNCTION public.mark_activity_attendance(
  target_session_id uuid, target_student_id uuid, marked_present boolean
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE session public.activity_sessions; result uuid; participant_name text; manager_name text;
BEGIN
  SELECT * INTO session FROM public.activity_sessions WHERE id = target_session_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.can_manage_activity(session.opportunity_id) THEN
    RAISE EXCEPTION 'Only this activity''s approved owner or a school admin can mark attendance'
      USING ERRCODE = '42501';
  END IF;
  IF session.session_date > (now() AT TIME ZONE 'Europe/Zurich')::date THEN
    RAISE EXCEPTION 'Attendance cannot be recorded for a future session' USING ERRCODE = '23514';
  END IF;
  PERFORM 1 FROM public.applications a JOIN auth.users u ON u.id = a.applicant_id
    WHERE a.opportunity_id = session.opportunity_id AND a.applicant_id = target_student_id AND a.status = 'Accepted'
      AND u.email_confirmed_at IS NOT NULL AND u.email ~* '^[^@[:space:]]+@iszl[.]ch$'
    FOR SHARE OF a, u;
  IF NOT FOUND THEN RAISE EXCEPTION 'Attendance is only for currently accepted participants' USING ERRCODE = '42501'; END IF;
  SELECT COALESCE(name, 'Participant') INTO participant_name FROM public.profiles WHERE id = target_student_id;
  SELECT COALESCE(name, 'Activity manager') INTO manager_name FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.activity_attendance(opportunity_id,session_id,student_id,student_name,present,marked_by,marked_by_name)
    VALUES(session.opportunity_id,target_session_id,target_student_id,participant_name,marked_present,auth.uid(),manager_name)
    ON CONFLICT (session_id,student_id) DO UPDATE
      SET present = EXCLUDED.present, marked_by = EXCLUDED.marked_by,
          marked_by_name = EXCLUDED.marked_by_name, student_name = EXCLUDED.student_name,
          updated_at = clock_timestamp()
    RETURNING id INTO result;
  RETURN result;
END; $$;

CREATE FUNCTION public.save_activity_hours(
  target_opportunity_id uuid, service_day date, claimed_hours numeric,
  entry_description text, existing_entry_id uuid DEFAULT NULL,
  expected_updated_at timestamptz DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE entry public.activity_hours; result uuid; name text; daily_total numeric;
BEGIN
  -- Serialize all submissions by this user, including across activities.
  PERFORM 1 FROM auth.users WHERE id = auth.uid() FOR UPDATE;
  IF NOT public.can_submit_activity_hours(target_opportunity_id) THEN
    RAISE EXCEPTION 'Only currently accepted participants can submit their own hours' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.applications
    WHERE opportunity_id = target_opportunity_id AND applicant_id = auth.uid() AND status = 'Accepted'
    FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Your participation access has changed' USING ERRCODE = '42501'; END IF;
  IF service_day IS NULL OR service_day > (now() AT TIME ZONE 'Europe/Zurich')::date
    OR claimed_hours IS NULL OR claimed_hours <= 0 OR claimed_hours > 24
    OR round(claimed_hours,2) <> claimed_hours
    OR entry_description IS NULL OR length(btrim(entry_description)) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Use a past or current date, 0.01 to 24 hours (up to two decimals), and a description up to 2000 characters'
      USING ERRCODE = '23514';
  END IF;
  IF existing_entry_id IS NOT NULL THEN
    SELECT * INTO entry FROM public.activity_hours WHERE id = existing_entry_id FOR UPDATE;
    IF NOT FOUND OR entry.student_id <> auth.uid() OR entry.opportunity_id <> target_opportunity_id OR entry.status <> 'pending' THEN
      RAISE EXCEPTION 'Only your own unreviewed submissions can be edited' USING ERRCODE = '42501';
    END IF;
    IF entry.updated_at IS DISTINCT FROM expected_updated_at THEN
      RAISE EXCEPTION 'Submission changed; refresh before editing' USING ERRCODE = '40001';
    END IF;
  END IF;
  SELECT COALESCE(sum(hours),0) INTO daily_total FROM public.activity_hours
    WHERE student_id = auth.uid() AND service_date = service_day AND status IN ('pending','approved')
      AND id IS DISTINCT FROM existing_entry_id;
  IF daily_total + claimed_hours > 24 THEN
    RAISE EXCEPTION 'Your pending and approved submissions cannot exceed 24 hours in one day across all activities'
      USING ERRCODE = '23514';
  END IF;
  SELECT COALESCE(p.name,'Participant') INTO name FROM public.profiles p WHERE p.id = auth.uid();
  IF existing_entry_id IS NULL THEN
    INSERT INTO public.activity_hours(opportunity_id,student_id,student_name,service_date,hours,description)
      VALUES(target_opportunity_id,auth.uid(),name,service_day,claimed_hours,btrim(entry_description))
      RETURNING id INTO result;
  ELSE
    UPDATE public.activity_hours SET service_date = service_day, hours = claimed_hours,
      description = btrim(entry_description), student_name = name, updated_at = clock_timestamp()
      WHERE id = existing_entry_id RETURNING id INTO result;
  END IF;
  RETURN result;
END; $$;

CREATE FUNCTION public.withdraw_activity_hours(target_entry_id uuid, expected_updated_at timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE entry public.activity_hours;
BEGIN
  SELECT * INTO entry FROM public.activity_hours WHERE id = target_entry_id FOR UPDATE;
  IF NOT FOUND OR entry.student_id <> auth.uid() OR entry.status <> 'pending'
    OR NOT public.can_submit_activity_hours(entry.opportunity_id) THEN
    RAISE EXCEPTION 'Only your own unreviewed submissions can be withdrawn' USING ERRCODE = '42501';
  END IF;
  IF entry.updated_at IS DISTINCT FROM expected_updated_at THEN
    RAISE EXCEPTION 'Submission changed; refresh before withdrawing' USING ERRCODE = '40001';
  END IF;
  DELETE FROM public.activity_hours WHERE id = target_entry_id;
  RETURN true;
END; $$;

CREATE FUNCTION public.review_activity_hours(
  target_entry_id uuid, decision text, reviewer_note text, expected_updated_at timestamptz
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE entry public.activity_hours; name text;
BEGIN
  SELECT * INTO entry FROM public.activity_hours WHERE id = target_entry_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_manage_activity(entry.opportunity_id) THEN
    RAISE EXCEPTION 'Only this activity''s approved owner or a school admin can review hours' USING ERRCODE = '42501';
  END IF;
  IF entry.student_id = auth.uid() THEN RAISE EXCEPTION 'You cannot review your own service hours' USING ERRCODE = '42501'; END IF;
  IF entry.updated_at IS DISTINCT FROM expected_updated_at OR entry.status <> 'pending' THEN
    RAISE EXCEPTION 'Submission changed or was already reviewed; refresh before reviewing' USING ERRCODE = '40001';
  END IF;
  IF decision IS NULL OR decision NOT IN ('approved','rejected') OR reviewer_note IS NULL
    OR length(btrim(reviewer_note)) > 1000 OR (decision = 'rejected' AND length(btrim(reviewer_note)) = 0) THEN
    RAISE EXCEPTION 'Choose approve or reject; rejection requires a reason (up to 1000 characters)' USING ERRCODE = '23514';
  END IF;
  SELECT COALESCE(p.name,'Activity manager') INTO name FROM public.profiles p WHERE p.id = auth.uid();
  UPDATE public.activity_hours SET status = decision, reviewed_by = auth.uid(), reviewer_name = name,
    reviewed_at = clock_timestamp(), review_note = btrim(reviewer_note), updated_at = clock_timestamp()
    WHERE id = target_entry_id;
  RETURN true;
END; $$;

CREATE FUNCTION public.get_activity_participation(target_opportunity_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE manages boolean;
BEGIN
  IF NOT public.can_read_activity(target_opportunity_id) THEN
    RAISE EXCEPTION 'This activity is available only to accepted participants and approved managers' USING ERRCODE = '42501';
  END IF;
  manages := public.can_manage_activity(target_opportunity_id);
  RETURN jsonb_build_object(
    'can_manage', manages, 'can_submit', public.can_submit_activity_hours(target_opportunity_id),
    'attendance', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.session_id,a.student_name,a.id)
      FROM public.activity_attendance a WHERE a.opportunity_id = target_opportunity_id
        AND (manages OR a.student_id = auth.uid())), '[]'::jsonb),
    'hours', COALESCE((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.submitted_at DESC,h.id)
      FROM public.activity_hours h WHERE h.opportunity_id = target_opportunity_id
        AND (manages OR h.student_id = auth.uid())), '[]'::jsonb)
  );
END; $$;

CREATE FUNCTION public.protect_activity_hour_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.activity_hours WHERE opportunity_id = OLD.id) THEN
    RAISE EXCEPTION 'This activity has service-hour records. Close or archive it instead of deleting it.'
      USING ERRCODE = '23503';
  END IF;
  RETURN OLD;
END; $$;
REVOKE ALL ON FUNCTION public.protect_activity_hour_history() FROM PUBLIC;
CREATE TRIGGER protect_activity_hour_history BEFORE DELETE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.protect_activity_hour_history();

-- A schedule edit must not silently move already marked attendance to a
-- different day. Managers can reset marks explicitly or create a new session.
CREATE FUNCTION public.protect_attendance_session_date()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$ BEGIN
  IF NEW.session_date IS DISTINCT FROM OLD.session_date
    AND EXISTS (SELECT 1 FROM public.activity_attendance WHERE session_id = OLD.id AND present IS NOT NULL) THEN
    RAISE EXCEPTION 'Attendance has already been marked. Reset the attendance marks before changing this session''s date, or create a new session.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.protect_attendance_session_date() FROM PUBLIC;
CREATE TRIGGER protect_attendance_session_date BEFORE UPDATE OF session_date ON public.activity_sessions
  FOR EACH ROW EXECUTE FUNCTION public.protect_attendance_session_date();

REVOKE ALL ON FUNCTION public.mark_activity_attendance(uuid,uuid,boolean),
  public.save_activity_hours(uuid,date,numeric,text,uuid,timestamptz),
  public.withdraw_activity_hours(uuid,timestamptz),
  public.review_activity_hours(uuid,text,text,timestamptz),
  public.get_activity_participation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_activity_attendance(uuid,uuid,boolean),
  public.save_activity_hours(uuid,date,numeric,text,uuid,timestamptz),
  public.withdraw_activity_hours(uuid,timestamptz),
  public.review_activity_hours(uuid,text,text,timestamptz),
  public.get_activity_participation(uuid) TO authenticated;
COMMIT;
NOTIFY pgrst, 'reload schema';
