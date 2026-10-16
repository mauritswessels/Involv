-- One-time content import for the three dated ISZL service opportunities.
-- Run in the Supabase SQL Editor for the verified Involv project.
-- Review the returned rows before telling students the listings are available.
--
-- Approved choices: maximum of each supplied capacity range (10, 10, 20);
-- application deadline seven calendar days before the event; admin-managed
-- listings (organizer_id NULL). Arts and Crafts is omitted because its event
-- date is not known. This script does not create user accounts or expose contact
-- email addresses. It is safe to run again: matching title/date rows are kept.

BEGIN;

DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      (
        'PA Primary School Trunk or Treat',
        'Friday, 30 October 2026',
        DATE '2026-10-30',
        DATE '2026-10-23',
        10,
        'Zug campus',
        '16:00-18:00',
        'The PA needs volunteers to face-paint and run games at the primary school Trunk or Treat event. Apply for one of the listed volunteer places.',
        'Join the ISZL Parent Association for its primary school Trunk or Treat event. Volunteers are needed for face-painting and games. The event is at the Zug campus on Friday 30 October 2026, from 16:00 to 18:00. Fundraising stands may be possible for PDW/service groups; contact the PA through the school-approved route for details.'
      ),
      (
        'ISZL Winter Market',
        'Friday, 27 November 2026',
        DATE '2026-11-27',
        DATE '2026-11-20',
        10,
        'Zug campus',
        '15:00-18:30',
        'Help with face-painting or games at the ISZL Winter Market. Volunteers may need to travel from the High School to the Middle School campus at 15:30 for setup.',
        'The ISZL Winter Market features festive stalls, games and food. Volunteers are needed for face-painting and games at the Zug campus on Friday 27 November 2026, from 15:00 to 18:30. You may need to travel from the High School to the Middle School campus at 15:30 to set up. This may require permission to miss part of period 5. Fundraising stalls require the school’s official sign-up process; ask the school administrator for the approved form.'
      ),
      (
        'ISZL Community Festival: Latin American Celebration',
        'Saturday, 14 November 2026',
        DATE '2026-11-14',
        DATE '2026-11-07',
        20,
        'Zug campus',
        '15:00-18:00',
        'Volunteer at the ISZL community festival celebrating Latin American culture.',
        'Help at the ISZL community festival: a Latin American celebration at the Zug campus on Saturday 14 November 2026, from 15:00 to 18:00. Apply through Involv so the school administrator can coordinate places.'
      )
    ) AS source(
      title, dates, start_date, application_deadline, positions_available,
      location_text, time_commitment, short_description, full_description
    )
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.opportunities AS existing
      WHERE existing.title = item.title
        AND existing.start_date = item.start_date
    ) THEN
      INSERT INTO public.opportunities (
        organizer_id,
        title,
        category,
        short_description,
        full_description,
        organizer_name,
        organizer_role,
        organizer_email,
        location_type,
        location_text,
        dates,
        time_commitment,
        duration_type,
        skill_level,
        impact_type,
        skills_required,
        min_grade_or_age,
        language_requirements,
        positions_available,
        application_deadline,
        start_date,
        skills_gained,
        impact_description,
        tags,
        featured,
        applicants_count,
        status
      ) VALUES (
        NULL,
        item.title,
        'School-Based Service',
        item.short_description,
        item.full_description,
        'ISZL',
        'School administrator',
        '',
        'On-campus',
        item.location_text,
        item.dates,
        item.time_commitment,
        'One-time',
        'Beginner',
        'Direct',
        '{}',
        'Open to all students; check event timing and school permissions.',
        '{}',
        item.positions_available,
        item.application_deadline,
        item.start_date,
        '{}',
        'Support school and community events through volunteering.',
        ARRAY['school', 'community', 'volunteering'],
        false,
        0,
        'active'
      );
    END IF;
  END LOOP;
END;
$$;

COMMIT;

-- Verify the inserted (or previously existing) rows and their public status.
SELECT id, title, organizer_id, start_date, time_commitment,
       application_deadline, positions_available, status
FROM public.opportunities
WHERE (title, start_date) IN (
  ('PA Primary School Trunk or Treat', DATE '2026-10-30'),
  ('ISZL Winter Market', DATE '2026-11-27'),
  ('ISZL Community Festival: Latin American Celebration', DATE '2026-11-14')
)
ORDER BY start_date;
