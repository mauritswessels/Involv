-- Real in-app notifications and reminders.
-- Requires: school access, Activity Hub, participation and application lifecycle.
-- Notices are written only by database triggers/functions (never by the browser),
-- contain no student-written text, and are readable only by their recipient.
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('public.is_school_member()') IS NULL
    OR to_regprocedure('public.can_read_activity(uuid)') IS NULL
    OR to_regclass('public.activity_hours') IS NULL
    OR to_regclass('public.activity_sessions') IS NULL THEN
    RAISE EXCEPTION 'Install school access, Activity Hub and participation before notifications.';
  END IF;
END $$;

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('application_received','application_update','announcement',
    'hours_reviewed','deadline_reminder','session_reminder','report_update','privacy_request_update')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  body text NOT NULL DEFAULT '' CHECK (length(body) <= 500),
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
  link text NOT NULL DEFAULT '' CHECK (link = '' OR link ~ '^/[A-Za-z0-9/_#?=&%.-]*$'),
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX notifications_user_recent_idx ON public.notifications(user_id, created_at DESC, id DESC);
CREATE UNIQUE INDEX notifications_dedupe_idx ON public.notifications(user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.notifications TO authenticated;
CREATE POLICY "Members read their own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid() AND public.is_school_member());

-- Internal writer. Failures are swallowed so a notice can never block the
-- application, review or announcement that triggered it.
CREATE FUNCTION public.push_notification(recipient uuid, notice_kind text, notice_title text,
  notice_body text, target_opportunity_id uuid, notice_link text, notice_key text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF recipient IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications(user_id, kind, title, body, opportunity_id, link, dedupe_key)
  VALUES (recipient, notice_kind, left(btrim(notice_title), 200), left(coalesce(notice_body, ''), 500),
    target_opportunity_id, coalesce(notice_link, ''), notice_key)
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Involv notification skipped (%)', SQLSTATE;
END $$;
REVOKE ALL ON FUNCTION public.push_notification(uuid, text, text, text, uuid, text, text)
  FROM PUBLIC, anon, authenticated;

-- Verified school admins, used for admin-managed listings and safeguarding queues.
CREATE FUNCTION public.school_admin_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT p.id FROM public.profiles p JOIN auth.users u ON u.id = p.id
  WHERE p.role = 'admin' AND public.is_school_email(u.email) AND u.email_confirmed_at IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.school_admin_ids() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.notify_application_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE listing_title text; manager uuid;
BEGIN
  SELECT o.title, o.organizer_id INTO listing_title, manager
  FROM public.opportunities o WHERE o.id = NEW.opportunity_id;
  listing_title := coalesce(nullif(listing_title, ''), nullif(NEW.opportunity_title, ''), 'an activity');
  IF TG_OP = 'INSERT' THEN
    IF manager IS NOT NULL THEN
      PERFORM public.push_notification(manager, 'application_received', 'New application: ' || listing_title,
        'A student applied. Review it from your organiser dashboard.', NEW.opportunity_id,
        '/applications/' || NEW.opportunity_id);
    ELSE
      PERFORM public.push_notification(admin_id, 'application_received', 'New application: ' || listing_title,
        'A student applied to an admin-managed listing.', NEW.opportunity_id,
        '/applications/' || NEW.opportunity_id)
      FROM public.school_admin_ids() AS admin_id;
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('Under Review', 'Accepted', 'Rejected') THEN
    PERFORM public.push_notification(NEW.applicant_id, 'application_update',
      CASE NEW.status WHEN 'Accepted' THEN 'Accepted: ' WHEN 'Rejected' THEN 'Application update: '
        ELSE 'Under review: ' END || listing_title,
      CASE NEW.status
        WHEN 'Accepted' THEN 'You have a place. Open the activity hub for announcements and sessions.'
        WHEN 'Rejected' THEN 'Your application was not accepted this time.'
        ELSE 'The organiser is reviewing your application.' END,
      NEW.opportunity_id,
      CASE WHEN NEW.status = 'Accepted' THEN '/activity/' || NEW.opportunity_id ELSE '/dashboard' END);
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER application_notifications AFTER INSERT OR UPDATE OF status ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_application_change();

CREATE FUNCTION public.notify_activity_announcement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  PERFORM public.push_notification(a.applicant_id, 'announcement', 'New announcement: ' || o.title,
    NEW.title, NEW.opportunity_id, '/activity/' || NEW.opportunity_id)
  FROM public.applications a JOIN public.opportunities o ON o.id = a.opportunity_id
  WHERE a.opportunity_id = NEW.opportunity_id AND a.status = 'Accepted'
    AND a.applicant_id IS DISTINCT FROM NEW.author_id;
  RETURN NULL;
END $$;
CREATE TRIGGER activity_announcement_notifications AFTER INSERT ON public.activity_announcements
  FOR EACH ROW EXECUTE FUNCTION public.notify_activity_announcement();

CREATE FUNCTION public.notify_hours_reviewed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE listing_title text;
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    SELECT title INTO listing_title FROM public.opportunities WHERE id = NEW.opportunity_id;
    PERFORM public.push_notification(NEW.student_id, 'hours_reviewed',
      CASE NEW.status WHEN 'approved' THEN 'Hours approved: ' ELSE 'Hours not approved: ' END
        || coalesce(listing_title, 'activity'),
      trim_scale(NEW.hours)::text || ' hours on ' || to_char(NEW.service_date, 'DD Mon YYYY')
        || CASE NEW.status WHEN 'approved' THEN ' now count towards your portfolio.'
           ELSE '. Open the activity to see the reviewer''s note.' END,
      NEW.opportunity_id, '/activity/' || NEW.opportunity_id);
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER activity_hours_notifications AFTER UPDATE OF status ON public.activity_hours
  FOR EACH ROW EXECUTE FUNCTION public.notify_hours_reviewed();

REVOKE ALL ON FUNCTION public.notify_application_change(), public.notify_activity_announcement(),
  public.notify_hours_reviewed() FROM PUBLIC, anon, authenticated;

-- Called by the signed-in browser (on load/focus). Adds reminders for the caller
-- only: saved listings closing within two days (not yet applied to) and sessions
-- tomorrow for activities they belong to. Also deletes the caller's notices that
-- were read more than 90 days ago. Safe to call repeatedly.
CREATE FUNCTION public.queue_my_reminders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE today date := (clock_timestamp() AT TIME ZONE 'Europe/Zurich')::date; added integer := 0; n integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_school_member() THEN
    RAISE EXCEPTION 'A verified school account is required' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.notifications
  WHERE user_id = auth.uid() AND read_at IS NOT NULL AND read_at < clock_timestamp() - interval '90 days';

  INSERT INTO public.notifications(user_id, kind, title, body, opportunity_id, link, dedupe_key)
  SELECT auth.uid(), 'deadline_reminder', 'Deadline soon: ' || left(o.title, 170),
    CASE o.application_deadline - today WHEN 0 THEN 'Applications close today.'
      WHEN 1 THEN 'Applications close tomorrow.' ELSE 'Applications close in 2 days.' END,
    o.id, '/opportunities/' || o.id, 'deadline:' || o.id || ':' || o.application_deadline
  FROM public.saved_opportunities s JOIN public.opportunities o ON o.id = s.opportunity_id
  WHERE s.user_id = auth.uid() AND o.status = 'active'
    AND o.application_deadline BETWEEN today AND today + 2
    AND NOT EXISTS (SELECT 1 FROM public.applications a
      WHERE a.opportunity_id = o.id AND a.applicant_id = auth.uid())
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT; added := added + n;

  INSERT INTO public.notifications(user_id, kind, title, body, opportunity_id, link, dedupe_key)
  SELECT auth.uid(), 'session_reminder', 'Tomorrow: ' || left(s.title, 180),
    left(o.title || ' · ' || to_char(s.start_time, 'HH24:MI') || ' · ' || s.location, 500),
    o.id, '/activity/' || o.id, 'session:' || s.id || ':' || s.session_date
  FROM public.activity_sessions s JOIN public.opportunities o ON o.id = s.opportunity_id
  WHERE s.session_date = today + 1 AND public.can_read_activity(s.opportunity_id)
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT; added := added + n;
  RETURN added;
END $$;

CREATE FUNCTION public.mark_my_notifications_read(notification_ids uuid[] DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE changed integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_school_member() THEN
    RAISE EXCEPTION 'A verified school account is required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.notifications SET read_at = clock_timestamp()
  WHERE user_id = auth.uid() AND read_at IS NULL
    AND (notification_ids IS NULL OR id = ANY(notification_ids));
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END $$;
REVOKE ALL ON FUNCTION public.queue_my_reminders(), public.mark_my_notifications_read(uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.queue_my_reminders(), public.mark_my_notifications_read(uuid[])
  TO authenticated;

-- Live bell updates when Realtime is enabled; RLS still limits rows to the recipient.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
COMMIT;
NOTIFY pgrst, 'reload schema';
