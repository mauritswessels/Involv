-- Enable Supabase real-time for the applications table so organizer
-- dashboards receive live INSERT / UPDATE / DELETE events.
-- The opportunities table is included so future real-time use (e.g. live
-- applicant counts) works without a second migration.

ALTER PUBLICATION supabase_realtime ADD TABLE applications;
ALTER PUBLICATION supabase_realtime ADD TABLE opportunities;
