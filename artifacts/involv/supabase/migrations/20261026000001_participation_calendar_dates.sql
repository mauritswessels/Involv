-- Additive hardening for already-installed activity/participation features.
-- No signup-hook or school OAuth activation is required.
BEGIN;

ALTER TABLE public.activity_sessions
  ADD CONSTRAINT activity_sessions_calendar_date
  CHECK (isfinite(session_date)
    AND session_date BETWEEN DATE '0001-01-01' AND DATE '9999-12-31');

ALTER TABLE public.activity_hours
  ADD CONSTRAINT activity_hours_calendar_date
  CHECK (isfinite(service_date)
    AND service_date BETWEEN DATE '0001-01-01' AND DATE '9999-12-31');

COMMIT;
NOTIFY pgrst, 'reload schema';
