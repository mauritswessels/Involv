-- Service classifications and programme tags.
-- Apply after 20261006000001_school_access_trusted_roles.sql and
-- 20261015000001_public_opportunity_privacy.sql.
BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.can_publish_opportunities()') IS NULL
    OR to_regprocedure('public.is_admin(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Install school access and trusted-role safeguards first.';
  END IF;
END;
$$;

-- impact_type is retained as a compatibility column, but now stores the
-- single service classification: Direct, Indirect, Advocacy, or Research.
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS service_programs text[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.opportunities'::regclass
      AND conname = 'opportunities_service_programs_allowed_check'
  ) THEN
    ALTER TABLE public.opportunities
      ADD CONSTRAINT opportunities_service_programs_allowed_check
      CHECK (
        cardinality(service_programs) <= 2
        AND service_programs <@ ARRAY['IB DP', 'HSP']::text[]
      );
  END IF;
END;
$$;

COMMENT ON COLUMN public.opportunities.impact_type IS
  'Single service type: Direct, Indirect, Advocacy, or Research.';
COMMENT ON COLUMN public.opportunities.service_programs IS
  'School-confirmed programme tags: IB DP and/or HSP.';

-- Preserve the opportunity privacy allowlist: organizer_email remains private.
GRANT SELECT (service_programs)
  ON public.opportunities TO anon, authenticated;
GRANT INSERT (service_programs)
  ON public.opportunities TO authenticated;
GRANT UPDATE (service_programs)
  ON public.opportunities TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
