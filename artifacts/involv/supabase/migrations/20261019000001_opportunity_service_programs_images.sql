-- Service classifications, programme tags and public opportunity images.
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
  ADD COLUMN IF NOT EXISTS service_programs text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS image_path text;

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
COMMENT ON COLUMN public.opportunities.image_path IS
  'Path to the public opportunity image in the opportunity-images Storage bucket.';

-- Preserve the opportunity privacy allowlist: only these two new public fields
-- are added; organizer_email remains private.
GRANT SELECT (service_programs, image_path)
  ON public.opportunities TO anon, authenticated;
GRANT INSERT (service_programs, image_path)
  ON public.opportunities TO authenticated;
GRANT UPDATE (service_programs, image_path)
  ON public.opportunities TO authenticated;

-- Listing images are public because published opportunity pages are public.
-- Only verified, approved publishers can upload, under their own UUID folder.
-- The bucket refuses SVG and limits objects to five megabytes.
INSERT INTO storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) VALUES (
  'opportunity-images',
  'opportunity-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can view Involv opportunity images" ON storage.objects;
CREATE POLICY "Public can view Involv opportunity images"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'opportunity-images');

DROP POLICY IF EXISTS "Approved publishers upload Involv opportunity images" ON storage.objects;
CREATE POLICY "Approved publishers upload Involv opportunity images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'opportunity-images'
    AND public.can_publish_opportunities()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Publishers remove managed Involv opportunity images" ON storage.objects;
CREATE POLICY "Publishers remove managed Involv opportunity images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'opportunity-images'
    AND public.can_publish_opportunities()
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin(auth.uid())
    )
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
