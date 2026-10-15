-- Database-owned application counts, submission rules and accepted-place limits.
BEGIN;
DO $$
BEGIN
  IF to_regprocedure('public.activity_identity_verified()') IS NULL
    OR to_regprocedure('public.guard_application_identity_change()') IS NULL THEN
    RAISE EXCEPTION 'Install the security prerequisites and Activity Hub first.';
  END IF;
END;
$$;

-- Stop writes while checking existing data and installing the complete rules.
LOCK TABLE public.opportunities, public.applications IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.opportunities o
    WHERE positions_available < 1 OR positions_available <
      (SELECT count(*) FROM public.applications a
       WHERE a.opportunity_id=o.id AND a.status='Accepted')
  ) THEN
    RAISE EXCEPTION 'Some listings have invalid capacity or more accepted students than places. Review capacities before installing.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_application_lifecycle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  listing public.opportunities%ROWTYPE;
  target uuid;
  accepted bigint;
BEGIN
  IF TG_OP='DELETE' THEN target := OLD.opportunity_id;
  ELSE target := NEW.opportunity_id;
  END IF;
  -- Every application writer serializes on its parent listing, including
  -- withdrawals. Counts and final-place decisions cannot race one another.
  SELECT * INTO listing FROM public.opportunities WHERE id=target FOR UPDATE;
  IF NOT FOUND THEN
    IF TG_OP='DELETE' THEN RETURN OLD; END IF; -- parent deletion cascade
    RAISE EXCEPTION 'Listing unavailable' USING ERRCODE='23503';
  END IF;

  IF TG_OP='UPDATE' AND
    (NEW.opportunity_id IS DISTINCT FROM OLD.opportunity_id
     OR NEW.applicant_id IS DISTINCT FROM OLD.applicant_id) THEN
    RAISE EXCEPTION 'Application identity cannot be reassigned' USING ERRCODE='42501';
  END IF;
  IF TG_OP='UPDATE' AND auth.uid() IS NOT NULL
    AND NOT public.can_manage_activity(target) THEN
    RAISE EXCEPTION 'Only current approved managers may review applications' USING ERRCODE='42501';
  END IF;

  IF TG_OP='INSERT' AND auth.uid() IS NOT NULL THEN
    IF NOT public.activity_identity_verified()
      OR NEW.applicant_id IS DISTINCT FROM auth.uid()
      OR NEW.organizer_id IS DISTINCT FROM listing.organizer_id
      OR NEW.status IS DISTINCT FROM 'Pending' THEN
      RAISE EXCEPTION 'Application access denied' USING ERRCODE='42501';
    END IF;
    IF listing.status <> 'active' THEN
      RAISE EXCEPTION 'Applications are closed' USING ERRCODE='IV001';
    END IF;
    -- A deadline includes the entire calendar day in the school's timezone.
    IF listing.application_deadline < (clock_timestamp() AT TIME ZONE 'Europe/Zurich')::date THEN
      RAISE EXCEPTION 'Application deadline passed' USING ERRCODE='IV002';
    END IF;
    IF length(btrim(NEW.motivation)) < 30 OR length(NEW.motivation)>10000
      OR length(btrim(NEW.availability))=0 OR length(NEW.availability)>2000
      OR length(NEW.relevant_experience)>10000 OR length(NEW.grade)>100 THEN
      RAISE EXCEPTION 'Invalid application answers' USING ERRCODE='IV006';
    END IF;
    SELECT name INTO NEW.applicant_name FROM public.profiles WHERE id=auth.uid();
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Profile required' USING ERRCODE='42501';
    END IF;
    SELECT email INTO NEW.applicant_email FROM auth.users WHERE id=auth.uid();
    NEW.opportunity_title := listing.title;
    NEW.submitted_date := (clock_timestamp() AT TIME ZONE 'Europe/Zurich')::date;
    IF EXISTS (SELECT 1 FROM public.applications
      WHERE opportunity_id=target AND applicant_id=auth.uid()) THEN
      RAISE EXCEPTION 'Already applied' USING ERRCODE='23505';
    END IF;
  END IF;

  SELECT count(*) INTO accepted FROM public.applications
    WHERE opportunity_id=target AND status='Accepted';
  IF TG_OP='INSERT' THEN
    IF accepted >= listing.positions_available THEN
      RAISE EXCEPTION 'All places are filled' USING ERRCODE='IV003';
    END IF;
  ELSIF TG_OP='UPDATE' THEN
    -- Existing applications can be reviewed after the submission deadline.
    -- Re-saving an existing acceptance does not consume another place.
    IF NEW.status='Accepted' AND OLD.status<>'Accepted'
      AND accepted >= listing.positions_available THEN
      RAISE EXCEPTION 'Acceptance would exceed capacity' USING ERRCODE='IV004';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_opportunity_application_totals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE accepted bigint;
BEGIN
  IF NEW.positions_available < 1 THEN
    RAISE EXCEPTION 'Capacity must be positive' USING ERRCODE='IV005';
  END IF;
  SELECT count(*), count(*) FILTER (WHERE status='Accepted')
    INTO NEW.applicants_count, accepted
    FROM public.applications WHERE opportunity_id=NEW.id;
  IF accepted > NEW.positions_available THEN
    RAISE EXCEPTION 'Capacity is below the accepted student count' USING ERRCODE='IV005';
  END IF;
  -- Ignore forged/stale client counters; always derive the actual total.
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_application_totals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    UPDATE public.opportunities SET applicants_count=0 WHERE id=OLD.opportunity_id;
  ELSE
    UPDATE public.opportunities SET applicants_count=0 WHERE id=NEW.opportunity_id;
  END IF;
  -- The opportunity guard computes the total, including the current write.
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_application_lifecycle(),
  public.guard_opportunity_application_totals(), public.refresh_application_totals() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS application_lifecycle_guard ON public.applications;
CREATE TRIGGER application_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.guard_application_lifecycle();
DROP TRIGGER IF EXISTS opportunity_application_totals ON public.opportunities;
CREATE TRIGGER opportunity_application_totals BEFORE INSERT OR UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.guard_opportunity_application_totals();
DROP TRIGGER IF EXISTS application_lifecycle_counts ON public.applications;
CREATE TRIGGER application_lifecycle_counts AFTER INSERT OR UPDATE OR DELETE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.refresh_application_totals();

-- Match the existing student UI: only unreviewed applications are withdrawable.
-- Accepted/rejected records stay under staff review; no review history is erased.
DROP POLICY IF EXISTS "Students withdraw unreviewed applications" ON public.applications;
CREATE POLICY "Students withdraw unreviewed applications" ON public.applications
  FOR DELETE TO authenticated USING (
    applicant_id=auth.uid() AND status IN ('Pending','Under Review')
    AND public.activity_identity_verified()
  );

-- Correct existing counters without deleting applications or changing decisions.
UPDATE public.opportunities SET applicants_count=0;
NOTIFY pgrst, 'reload schema';
COMMIT;
