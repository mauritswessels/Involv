-- Personal notes, not a manager-readable group resource.
-- Requires Activity Hub foundation; does not activate school signup hooks.
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('public.activity_identity_verified()') IS NULL THEN
    RAISE EXCEPTION 'Apply Activity Hub foundation before private reflections.';
  END IF;
END $$;

CREATE FUNCTION public.can_create_activity_reflection(target_opportunity_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT public.activity_identity_verified()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='student')
    AND EXISTS (SELECT 1 FROM public.applications
      WHERE opportunity_id=target_opportunity_id AND applicant_id=auth.uid() AND status='Accepted');
$$;
REVOKE ALL ON FUNCTION public.can_create_activity_reflection(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_create_activity_reflection(uuid) TO authenticated;

CREATE TABLE public.activity_reflections (
  id uuid PRIMARY KEY,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  activity_title text NOT NULL,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(btrim(content)) BETWEEN 1 AND 10000
    AND cardinality(array_remove(regexp_split_to_array(btrim(content), '\s+'),'')) >= 30),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX activity_reflections_own_history_idx
  ON public.activity_reflections(student_id, created_at DESC, id DESC);
ALTER TABLE public.activity_reflections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only authors read private reflections" ON public.activity_reflections
  FOR SELECT TO authenticated USING (student_id=auth.uid() AND public.activity_identity_verified());
REVOKE ALL ON public.activity_reflections FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.activity_reflections TO authenticated;

CREATE FUNCTION public.get_my_activity_reflections(
  target_opportunity_id uuid DEFAULT NULL, before_created_at timestamptz DEFAULT NULL,
  before_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.activity_identity_verified() THEN
    RAISE EXCEPTION 'Verified school identity required' USING ERRCODE='42501';
  END IF;
  IF (before_created_at IS NULL) <> (before_id IS NULL) THEN
    RAISE EXCEPTION 'Both cursor fields are required' USING ERRCODE='23514';
  END IF;
  RETURN jsonb_build_object(
    'can_create', COALESCE(public.can_create_activity_reflection(target_opportunity_id),false),
    'entries', COALESCE((SELECT jsonb_agg(to_jsonb(r) - 'student_id' ORDER BY created_at DESC,id DESC)
      FROM (SELECT * FROM public.activity_reflections
        WHERE student_id=auth.uid()
          AND (target_opportunity_id IS NULL OR opportunity_id=target_opportunity_id)
          AND (before_created_at IS NULL OR (created_at,id)<(before_created_at,before_id))
        ORDER BY created_at DESC,id DESC LIMIT 50) r), '[]'::jsonb)
  );
END $$;

CREATE FUNCTION public.save_my_activity_reflection(
  target_opportunity_id uuid, reflection_content text, target_reflection_id uuid,
  expected_updated_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE entry public.activity_reflections; title text; stamp timestamptz;
BEGIN
  IF NOT public.activity_identity_verified() THEN
    RAISE EXCEPTION 'Verified school identity required' USING ERRCODE='42501';
  END IF;
  IF target_reflection_id IS NULL OR reflection_content IS NULL
    OR length(btrim(reflection_content)) NOT BETWEEN 1 AND 10000
    OR cardinality(array_remove(regexp_split_to_array(btrim(reflection_content), '\s+'),'')) < 30 THEN
    RAISE EXCEPTION 'Write 30 or more words, up to 10000 characters' USING ERRCODE='23514';
  END IF;
  -- Serialize creation retries with the same client-generated ID.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_reflection_id::text,41));
  SELECT * INTO entry FROM public.activity_reflections WHERE id=target_reflection_id FOR UPDATE;
  IF FOUND THEN
    IF entry.student_id<>auth.uid() OR entry.opportunity_id IS DISTINCT FROM target_opportunity_id THEN
      RAISE EXCEPTION 'Only the author can change this reflection' USING ERRCODE='42501';
    END IF;
    IF expected_updated_at IS NULL THEN
      IF entry.content=btrim(reflection_content) THEN RETURN to_jsonb(entry)-'student_id'; END IF;
      RAISE EXCEPTION 'The reflection was already saved; refresh before editing' USING ERRCODE='40001';
    END IF;
    IF entry.updated_at IS DISTINCT FROM expected_updated_at THEN
      RAISE EXCEPTION 'The reflection changed; refresh before editing' USING ERRCODE='40001';
    END IF;
    UPDATE public.activity_reflections SET content=btrim(reflection_content), updated_at=clock_timestamp()
      WHERE id=target_reflection_id RETURNING * INTO entry;
  ELSE
    IF expected_updated_at IS NOT NULL THEN
      RAISE EXCEPTION 'The reflection was removed; refresh your list' USING ERRCODE='40001';
    END IF;
    IF NOT public.can_create_activity_reflection(target_opportunity_id) THEN
      RAISE EXCEPTION 'Only accepted students can start an activity reflection' USING ERRCODE='42501';
    END IF;
    SELECT o.title INTO title FROM public.opportunities o WHERE o.id=target_opportunity_id;
    stamp := clock_timestamp();
    INSERT INTO public.activity_reflections(id,opportunity_id,activity_title,student_id,content,created_at,updated_at)
      VALUES(target_reflection_id,target_opportunity_id,title,auth.uid(),btrim(reflection_content),stamp,stamp)
      RETURNING * INTO entry;
  END IF;
  RETURN to_jsonb(entry)-'student_id';
END $$;

CREATE FUNCTION public.delete_my_activity_reflection(target_reflection_id uuid, expected_updated_at timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE entry public.activity_reflections;
BEGIN
  IF NOT public.activity_identity_verified() THEN
    RAISE EXCEPTION 'Verified school identity required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO entry FROM public.activity_reflections WHERE id=target_reflection_id FOR UPDATE;
  IF NOT FOUND THEN RETURN true; END IF;
  IF entry.student_id<>auth.uid() THEN
    RAISE EXCEPTION 'Only the author can delete this reflection' USING ERRCODE='42501';
  END IF;
  IF entry.updated_at IS DISTINCT FROM expected_updated_at THEN
    RAISE EXCEPTION 'The reflection changed; refresh before deleting' USING ERRCODE='40001';
  END IF;
  DELETE FROM public.activity_reflections WHERE id=target_reflection_id;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.get_my_activity_reflections(uuid,timestamptz,uuid),
  public.save_my_activity_reflection(uuid,text,uuid,timestamptz),
  public.delete_my_activity_reflection(uuid,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_activity_reflections(uuid,timestamptz,uuid),
  public.save_my_activity_reflection(uuid,text,uuid,timestamptz),
  public.delete_my_activity_reflection(uuid,timestamptz) TO authenticated;
COMMIT;
NOTIFY pgrst, 'reload schema';
