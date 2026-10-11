-- Requires the Activity Hub foundation and participation migrations.
-- Read-only own ledger access: never widens Activity Hub membership or table RLS.
BEGIN;
DO $$ BEGIN
  IF to_regclass('public.activity_hours') IS NULL
    OR to_regprocedure('public.activity_identity_verified()') IS NULL THEN
    RAISE EXCEPTION 'Install the Activity Hub foundation and participation migrations first.';
  END IF;
END; $$;

CREATE FUNCTION public.get_my_service_portfolio()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE own_id uuid;
BEGIN
  IF NOT public.activity_identity_verified() THEN
    RAISE EXCEPTION 'A verified school account is required to view your service portfolio.'
      USING ERRCODE = '42501';
  END IF;
  own_id := auth.uid();
  RETURN jsonb_build_object(
    'approved_hours', (SELECT COALESCE(sum(hours), 0) FROM public.activity_hours
      WHERE student_id = own_id AND status = 'approved'),
    'pending_hours', (SELECT COALESCE(sum(hours), 0) FROM public.activity_hours
      WHERE student_id = own_id AND status = 'pending'),
    'rejected_hours', (SELECT COALESCE(sum(hours), 0) FROM public.activity_hours
      WHERE student_id = own_id AND status = 'rejected'),
    'approved_activities', (SELECT count(DISTINCT opportunity_id) FROM public.activity_hours
      WHERE student_id = own_id AND status = 'approved'),
    'entries', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', h.id, 'opportunity_id', h.opportunity_id,
        'activity_title', o.title, 'activity_category', o.category,
        'activity_status', o.status,
        'service_date', h.service_date, 'hours', h.hours,
        'description', h.description, 'status', h.status,
        'submitted_at', h.submitted_at, 'updated_at', h.updated_at,
        'reviewer_name', h.reviewer_name, 'review_note', h.review_note,
        'reviewed_at', h.reviewed_at
      ) ORDER BY h.service_date DESC, h.submitted_at DESC, h.id)
      FROM public.activity_hours h
      JOIN public.opportunities o ON o.id = h.opportunity_id
      WHERE h.student_id = own_id
    ), '[]'::jsonb)
  );
END; $$;
REVOKE ALL ON FUNCTION public.get_my_service_portfolio() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_service_portfolio() TO authenticated;
COMMIT;
NOTIFY pgrst, 'reload schema';
