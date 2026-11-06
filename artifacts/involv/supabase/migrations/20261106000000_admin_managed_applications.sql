-- Fix: students could not apply to admin-managed listings (organizer_id NULL),
-- such as the imported school events, because the insert policy compared
-- organizer_id with "=" and NULL = NULL is never true. Use a NULL-safe match.
-- The application lifecycle trigger still enforces identity, status, deadline
-- and capacity for every submission.
BEGIN;
DROP POLICY IF EXISTS "Students can create applications" ON public.applications;
CREATE POLICY "Students can create applications"
  ON public.applications FOR INSERT TO authenticated
  WITH CHECK (
    applicant_id = auth.uid()
    AND organizer_id IS NOT DISTINCT FROM (
      SELECT opportunity.organizer_id FROM public.opportunities AS opportunity
      WHERE opportunity.id = opportunity_id
    )
  );
COMMIT;
NOTIFY pgrst, 'reload schema';
