-- Performance indexes for the query patterns used by the Involv application.
-- Review and apply this migration to the intended Supabase project only after
-- confirming backups and the remote migration history.

CREATE INDEX IF NOT EXISTS opportunities_status_created_at_idx
  ON public.opportunities (status, created_at DESC);

CREATE INDEX IF NOT EXISTS opportunities_organizer_created_at_idx
  ON public.opportunities (organizer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS opportunities_created_at_idx
  ON public.opportunities (created_at DESC);

CREATE INDEX IF NOT EXISTS applications_applicant_submitted_date_idx
  ON public.applications (applicant_id, submitted_date DESC);

CREATE INDEX IF NOT EXISTS applications_opportunity_submitted_date_idx
  ON public.applications (opportunity_id, submitted_date DESC);

CREATE INDEX IF NOT EXISTS applications_organizer_submitted_date_idx
  ON public.applications (organizer_id, submitted_date DESC);

CREATE INDEX IF NOT EXISTS applications_status_idx
  ON public.applications (status);

CREATE INDEX IF NOT EXISTS applications_submitted_date_idx
  ON public.applications (submitted_date DESC);

CREATE INDEX IF NOT EXISTS profiles_created_at_idx
  ON public.profiles (created_at DESC);