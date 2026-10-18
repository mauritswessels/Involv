-- Reversibly archive the original sample opportunities from the Involv demo
-- dataset. Run in the Supabase SQL Editor for the project used by Involv.
--
-- This matches exact title, event date, application deadline, featured flag,
-- and an unassigned organizer. It does not delete rows or applications, and
-- it does not touch the three ISZL listings imported separately.
-- The UPDATE returns only rows it actually archived.

WITH demo(title, start_date, application_deadline, featured) AS (
  VALUES
    ('Riverside Park Clean-Up Campaign', DATE '2026-06-01', DATE '2026-05-28', true),
    ('Peer Tutoring Programme — Maths & Sciences', DATE '2026-06-10', DATE '2026-06-05', true),
    ('Annual Charity Gala — Student Volunteer Team', DATE '2026-07-18', DATE '2026-06-20', true),
    ('Elderly Companion Visits — St. Margaret''s Care Home', DATE '2026-06-04', DATE '2026-05-30', false),
    ('Annual Sports Day — Event Volunteer', DATE '2026-06-05', DATE '2026-05-25', false),
    ('Social Media & Design — Mental Health Awareness Campaign', DATE '2026-06-03', DATE '2026-05-30', false),
    ('Website Redesign — Community Food Bank', DATE '2026-06-07', DATE '2026-05-31', true),
    ('Refugee Homework Support Programme', DATE '2026-06-21', DATE '2026-06-10', false),
    ('Student Leadership Forum — Organising Committee', DATE '2026-06-15', DATE '2026-06-01', false),
    ('Primary School Reading Buddies', DATE '2026-06-13', DATE '2026-06-03', false),
    ('School Urban Garden Project', DATE '2026-06-02', DATE '2026-05-26', false),
    ('Cultural Diversity Photography Exhibition', DATE '2026-06-14', DATE '2026-06-07', false)
)
UPDATE public.opportunities AS opportunity
SET status = 'archived',
    updated_at = clock_timestamp()
FROM demo
WHERE opportunity.title = demo.title
  AND opportunity.start_date = demo.start_date
  AND opportunity.application_deadline = demo.application_deadline
  AND opportunity.featured = demo.featured
  AND opportunity.organizer_id IS NULL
  AND opportunity.status = 'active'
RETURNING opportunity.title, opportunity.start_date,
          opportunity.application_deadline, opportunity.featured,
          opportunity.status;
