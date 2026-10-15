-- Keep contact data stored and editable by managers, but not publicly readable.
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('public.can_manage_activity(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Install Activity Hub security helpers first.';
  END IF;
END; $$;

REVOKE SELECT ON public.opportunities FROM PUBLIC,anon,authenticated;
REVOKE SELECT (organizer_email) ON public.opportunities FROM PUBLIC,anon,authenticated;
GRANT SELECT (
  id,organizer_id,title,category,short_description,full_description,organizer_name,
  organizer_role,location_type,location_text,dates,time_commitment,duration_type,
  skill_level,impact_type,skills_required,min_grade_or_age,language_requirements,
  positions_available,application_deadline,start_date,skills_gained,
  impact_description,tags,featured,applicants_count,status,created_at
) ON public.opportunities TO anon,authenticated;

CREATE FUNCTION public.get_opportunity_contact(target_opportunity_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT public.can_manage_activity(target_opportunity_id) THEN
    RAISE EXCEPTION 'Only the current approved owner or school administrator may read this contact'
      USING ERRCODE='42501';
  END IF;
  RETURN (SELECT organizer_email FROM public.opportunities WHERE id=target_opportunity_id);
END; $$;
REVOKE ALL ON FUNCTION public.get_opportunity_contact(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_opportunity_contact(uuid) TO authenticated;

-- The existing hub snapshot used a whole-row definer read. Keep its authorised
-- behavior, but do not let this secondary API bypass column privacy.
ALTER FUNCTION public.get_activity_hub(uuid) RENAME TO get_activity_hub_private_snapshot;
REVOKE ALL ON FUNCTION public.get_activity_hub_private_snapshot(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.get_activity_hub(target_opportunity_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT public.get_activity_hub_private_snapshot(target_opportunity_id) #- '{opportunity,organizer_email}';
$$;
REVOKE ALL ON FUNCTION public.get_activity_hub(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_activity_hub(uuid) TO authenticated;

-- Column grants alone must not leave private data in change payloads. The app
-- does not subscribe to opportunity changes; remove this unused stream rather
-- than rely on the Realtime decoder respecting publication column filters.
-- Chat and application publications stay unchanged.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime'
    AND schemaname='public' AND tablename='opportunities') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.opportunities;
  END IF;
END; $$;
COMMIT;
NOTIFY pgrst,'reload schema';
