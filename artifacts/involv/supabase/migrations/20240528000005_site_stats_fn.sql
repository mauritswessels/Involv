-- Public aggregate stats function.
-- SECURITY DEFINER lets it bypass RLS so the anon key can fetch
-- aggregated counts from applications without exposing individual rows.

CREATE OR REPLACE FUNCTION public.get_site_stats()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'active_opportunities',    (SELECT COUNT(*)::int FROM opportunities WHERE status = 'active'),
    'students_enrolled',       (SELECT COUNT(*)::int FROM applications WHERE status = 'Accepted'),
    'applications_submitted',  (SELECT COUNT(*)::int FROM applications)
  );
$$;

-- Grant execute to the anon role so the public landing page can call it
GRANT EXECUTE ON FUNCTION public.get_site_stats() TO anon;
