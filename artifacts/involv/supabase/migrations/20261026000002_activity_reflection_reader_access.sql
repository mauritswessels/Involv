-- Add the task's limited educator read access without resetting roles or auth.
-- Requires the Activity Hub and private-reflections migrations only.
BEGIN;
DO $$ BEGIN
  IF to_regclass('public.activity_reflections') IS NULL
    OR to_regprocedure('public.can_manage_activity(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Install Activity Hub and private reflections first.';
  END IF;
END $$;

CREATE INDEX activity_reflections_activity_history_idx
  ON public.activity_reflections(opportunity_id, created_at DESC, id DESC);
CREATE POLICY "Approved owners and school admins read activity reflections"
  ON public.activity_reflections FOR SELECT TO authenticated
  USING (public.can_manage_activity(opportunity_id));

CREATE FUNCTION public.get_managed_activity_reflections(
  target_opportunity_id uuid, before_created_at timestamptz DEFAULT NULL,
  before_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.can_manage_activity(target_opportunity_id) THEN
    RAISE EXCEPTION 'Only the approved owner or school admin can read activity reflections'
      USING ERRCODE='42501';
  END IF;
  IF (before_created_at IS NULL) <> (before_id IS NULL) THEN
    RAISE EXCEPTION 'Both cursor fields are required' USING ERRCODE='23514';
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY created_at DESC,id DESC)
    FROM (SELECT r.id,r.opportunity_id,r.activity_title,r.content,r.created_at,r.updated_at,
      COALESCE(p.name,'Student') AS author_name
      FROM public.activity_reflections r LEFT JOIN public.profiles p ON p.id=r.student_id
      WHERE r.opportunity_id=target_opportunity_id
        AND (before_created_at IS NULL OR (r.created_at,r.id)<(before_created_at,before_id))
      ORDER BY r.created_at DESC,r.id DESC LIMIT 50) r), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.get_managed_activity_reflections(uuid,timestamptz,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_managed_activity_reflections(uuid,timestamptz,uuid) TO authenticated;
-- No new mutation grants. Existing author-only RPCs remain the only write path.
COMMIT;
NOTIFY pgrst, 'reload schema';
