-- Requires participation and the personal service portfolio. Does not activate OAuth hooks.
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('public.get_my_service_portfolio()') IS NULL
    OR to_regclass('public.activity_hours') IS NULL THEN
    RAISE EXCEPTION 'Install participation and student service portfolio first.';
  END IF;
END; $$;

CREATE TABLE public.activity_hour_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.activity_hours(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('baseline','review','correction')),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text NOT NULL,
  reason text NOT NULL CHECK (length(reason) <= 1000),
  before_state jsonb,
  after_state jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX activity_hour_reviews_entry_idx ON public.activity_hour_reviews(entry_id, recorded_at, id);
ALTER TABLE public.activity_hour_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.activity_hour_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.activity_hour_reviews TO authenticated;
CREATE POLICY "Private hour review history" ON public.activity_hour_reviews FOR SELECT TO authenticated
USING (public.activity_identity_verified() AND EXISTS (
  SELECT 1 FROM public.activity_hours h WHERE h.id=entry_id
    AND (h.student_id=auth.uid() OR public.can_manage_activity(h.opportunity_id))
));

-- Explicit projection: no duplicate student identifiers in audit snapshots.
CREATE FUNCTION public.activity_hour_snapshot(entry public.activity_hours)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_build_object(
   'hours',entry.hours,'status',entry.status,'service_date',entry.service_date,
   'description',entry.description,'submitted_at',entry.submitted_at,
   'reviewer_name',entry.reviewer_name,'review_note',entry.review_note,
   'reviewed_at',entry.reviewed_at,'updated_at',entry.updated_at);
$$;
REVOKE ALL ON FUNCTION public.activity_hour_snapshot(public.activity_hours) FROM PUBLIC, anon, authenticated;

-- Existing decisions have a baseline, not a fabricated original review history.
INSERT INTO public.activity_hour_reviews(entry_id,kind,actor_id,actor_name,reason,after_state)
SELECT id,'baseline',reviewed_by,reviewer_name,review_note,public.activity_hour_snapshot(h)
FROM public.activity_hours h WHERE status IN ('approved','rejected');

CREATE FUNCTION public.record_activity_hour_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF OLD.status='pending' AND NEW.status IN ('approved','rejected') THEN
    INSERT INTO public.activity_hour_reviews(entry_id,kind,actor_id,actor_name,reason,before_state,after_state)
    VALUES(NEW.id,'review',NEW.reviewed_by,NEW.reviewer_name,NEW.review_note,
      public.activity_hour_snapshot(OLD),public.activity_hour_snapshot(NEW));
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.record_activity_hour_review() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER capture_activity_hour_review AFTER UPDATE ON public.activity_hours
FOR EACH ROW EXECUTE FUNCTION public.record_activity_hour_review();

CREATE FUNCTION public.correct_activity_hours(
  target_entry_id uuid, corrected_hours numeric, corrected_status text,
  correction_reason text, expected_updated_at timestamptz, correction_id uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE entry public.activity_hours; prior public.activity_hour_reviews;
  before_record jsonb; actor text; stamp timestamptz; daily_total numeric;
BEGIN
  SELECT * INTO entry FROM public.activity_hours WHERE id=target_entry_id;
  IF NOT FOUND OR NOT public.can_manage_activity(entry.opportunity_id)
    OR entry.student_id=auth.uid() THEN
    RAISE EXCEPTION 'Only an authorised manager may correct another student''s reviewed hours' USING ERRCODE='42501';
  END IF;
  -- Same lock order as save_activity_hours; coordinates daily totals across activities.
  PERFORM 1 FROM auth.users WHERE id=entry.student_id FOR UPDATE;
  SELECT * INTO entry FROM public.activity_hours WHERE id=target_entry_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_manage_activity(entry.opportunity_id)
    OR entry.student_id=auth.uid() THEN
    RAISE EXCEPTION 'Your correction access has changed' USING ERRCODE='42501';
  END IF;
  IF correction_id IS NULL OR corrected_status IS NULL OR corrected_status NOT IN ('approved','rejected')
    OR corrected_hours IS NULL OR corrected_hours <= 0 OR corrected_hours > 24
    OR round(corrected_hours,2) <> corrected_hours
    OR correction_reason IS NULL OR length(btrim(correction_reason)) NOT BETWEEN 1 AND 1000
    OR length(regexp_replace(correction_reason,'\s','','g'))=0 THEN
    RAISE EXCEPTION 'Use 0.01–24 hours, approved or rejected, and a correction reason up to 1000 characters'
      USING ERRCODE='23514';
  END IF;
  SELECT * INTO prior FROM public.activity_hour_reviews WHERE id=correction_id;
  IF FOUND THEN
    IF prior.entry_id=target_entry_id AND prior.kind='correction' AND prior.actor_id=auth.uid()
      AND (prior.before_state->>'updated_at')::timestamptz=expected_updated_at
      AND (prior.after_state->>'hours')::numeric=corrected_hours
      AND prior.after_state->>'status'=corrected_status AND prior.reason=btrim(correction_reason) THEN
      RETURN true; -- The same uncertain-send retry, not a second correction.
    END IF;
    RAISE EXCEPTION 'Correction request does not match its saved version' USING ERRCODE='23514';
  END IF;
  IF entry.status NOT IN ('approved','rejected') OR entry.updated_at IS DISTINCT FROM expected_updated_at THEN
    RAISE EXCEPTION 'The reviewed entry changed; refresh before correcting' USING ERRCODE='40001';
  END IF;
  IF entry.hours=corrected_hours AND entry.status=corrected_status THEN
    RAISE EXCEPTION 'Change the hours or decision to make a correction' USING ERRCODE='23514';
  END IF;
  IF corrected_status='approved' THEN
    SELECT COALESCE(sum(hours),0) INTO daily_total FROM public.activity_hours
      WHERE student_id=entry.student_id AND service_date=entry.service_date
        AND status IN ('pending','approved') AND id<>entry.id;
    IF daily_total+corrected_hours>24 THEN
      RAISE EXCEPTION 'Pending and approved hours cannot exceed 24 hours in a day across activities' USING ERRCODE='23514';
    END IF;
  END IF;
  before_record := public.activity_hour_snapshot(entry);
  SELECT COALESCE(name,'Activity manager') INTO actor FROM public.profiles WHERE id=auth.uid();
  stamp := greatest(clock_timestamp(),entry.updated_at+interval '1 microsecond');
  UPDATE public.activity_hours SET hours=corrected_hours,status=corrected_status,
    reviewed_by=auth.uid(),reviewer_name=actor,review_note=btrim(correction_reason),
    reviewed_at=stamp,updated_at=stamp WHERE id=target_entry_id RETURNING * INTO entry;
  INSERT INTO public.activity_hour_reviews(id,entry_id,kind,actor_id,actor_name,reason,before_state,after_state,recorded_at)
  VALUES(correction_id,target_entry_id,'correction',auth.uid(),actor,btrim(correction_reason),
    before_record,public.activity_hour_snapshot(entry),stamp);
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.correct_activity_hours(uuid,numeric,text,text,timestamptz,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.correct_activity_hours(uuid,numeric,text,text,timestamptz,uuid) TO authenticated;

-- History is embedded only in already-authorised activity/own-ledger responses.
CREATE OR REPLACE FUNCTION public.get_activity_participation(target_opportunity_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE manages boolean;
BEGIN
  IF NOT public.can_read_activity(target_opportunity_id) THEN
    RAISE EXCEPTION 'This activity is available only to accepted participants and approved managers' USING ERRCODE='42501';
  END IF;
  manages := public.can_manage_activity(target_opportunity_id);
  RETURN jsonb_build_object(
    'can_manage',manages,'can_submit',public.can_submit_activity_hours(target_opportunity_id),
    'attendance',COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.session_id,a.student_name,a.id)
      FROM public.activity_attendance a WHERE a.opportunity_id=target_opportunity_id
        AND (manages OR a.student_id=auth.uid())),'[]'::jsonb),
    'hours',COALESCE((SELECT jsonb_agg(
      to_jsonb(h)||jsonb_build_object('review_history',COALESCE((
        SELECT jsonb_agg(to_jsonb(r)-'actor_id'-'entry_id' ORDER BY r.recorded_at,r.id)
        FROM public.activity_hour_reviews r WHERE r.entry_id=h.id),'[]'::jsonb))
      ORDER BY h.submitted_at DESC,h.id)
      FROM public.activity_hours h WHERE h.opportunity_id=target_opportunity_id
        AND (manages OR h.student_id=auth.uid())),'[]'::jsonb));
END; $$;

CREATE OR REPLACE FUNCTION public.get_my_service_portfolio()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE own_id uuid;
BEGIN
  IF NOT public.activity_identity_verified() THEN
    RAISE EXCEPTION 'A verified school account is required to view your service portfolio' USING ERRCODE='42501';
  END IF;
  own_id := auth.uid();
  RETURN jsonb_build_object(
    'approved_hours',(SELECT COALESCE(sum(hours),0) FROM public.activity_hours WHERE student_id=own_id AND status='approved'),
    'pending_hours',(SELECT COALESCE(sum(hours),0) FROM public.activity_hours WHERE student_id=own_id AND status='pending'),
    'rejected_hours',(SELECT COALESCE(sum(hours),0) FROM public.activity_hours WHERE student_id=own_id AND status='rejected'),
    'approved_activities',(SELECT count(DISTINCT opportunity_id) FROM public.activity_hours WHERE student_id=own_id AND status='approved'),
    'entries',COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id',h.id,'opportunity_id',h.opportunity_id,'activity_title',o.title,'activity_category',o.category,'activity_status',o.status,
      'service_date',h.service_date,'hours',h.hours,'description',h.description,'status',h.status,
      'submitted_at',h.submitted_at,'updated_at',h.updated_at,'reviewer_name',h.reviewer_name,
      'review_note',h.review_note,'reviewed_at',h.reviewed_at,
      'review_history',COALESCE((SELECT jsonb_agg(to_jsonb(r)-'actor_id'-'entry_id' ORDER BY r.recorded_at,r.id)
        FROM public.activity_hour_reviews r WHERE r.entry_id=h.id),'[]'::jsonb))
      ORDER BY h.service_date DESC,h.submitted_at DESC,h.id)
      FROM public.activity_hours h JOIN public.opportunities o ON o.id=h.opportunity_id
      WHERE h.student_id=own_id),'[]'::jsonb));
END; $$;
COMMIT;
NOTIFY pgrst,'reload schema';
