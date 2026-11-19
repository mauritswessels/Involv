-- ============================================================================
-- INVOLV: switch on the last database features
-- 1) Change the email address on the line marked  >>> EDIT THIS <<<
-- 2) Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Each part is all-or-nothing: if anything fails, nothing in that part changes.
-- The table shown at the end should say PASS on every row except 34 (the hook,
-- which you switch on by hand afterwards).
-- ============================================================================

-- ── Part A: make your ISZL account the first Involv admin ───────────────────
BEGIN;
DO $$
DECLARE
  target_email text := 'YOUR.NAME@iszl.ch';   -- >>> EDIT THIS <<<
  account auth.users;
BEGIN
  IF target_email !~* '^[^@[:space:]]+@iszl[.]ch$' THEN
    RAISE EXCEPTION 'Put your own @iszl.ch address in target_email at the top of Part A.';
  END IF;
  SELECT * INTO account FROM auth.users WHERE lower(email) = lower(target_email);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'There is no Involv account for % yet. Create it first (see the steps), then run this again.', target_email;
  END IF;
  IF account.email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'The account % exists but is not confirmed yet.', target_email;
  END IF;
  -- The role guard only lets an existing admin change roles, and there is none yet,
  -- so it is paused for this one statement inside this transaction.
  ALTER TABLE public.profiles DISABLE TRIGGER guard_profile_role_change;
  INSERT INTO public.profiles (id, name, email, role, onboarding_complete)
  VALUES (account.id,
    coalesce(nullif(account.raw_user_meta_data->>'full_name', ''), nullif(account.raw_user_meta_data->>'name', ''), split_part(account.email, '@', 1)),
    account.email, 'admin', true)
  ON CONFLICT (id) DO UPDATE SET role = 'admin';
  ALTER TABLE public.profiles ENABLE TRIGGER guard_profile_role_change;
END $$;
COMMIT;


-- ── 20261006000001_school_access_trusted_roles.sql ──────────────────────────────────────────
-- Apply after 20260923000002_security_hardening.sql.
-- Atomic: a failed administrator preflight or any later error rolls everything back.
BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.is_admin(uuid)') IS NULL
    OR to_regprocedure('public.guard_application_identity_change()') IS NULL THEN
    RAISE EXCEPTION 'Apply 20260923000002_security_hardening.sql before school access.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id = p.id
    WHERE p.role = 'admin'
      AND u.email ~* '^[^@[:space:]]+@iszl[.]ch$'
      AND u.email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'No verified @iszl.ch administrator exists. Nothing changed; approve a school administrator first.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_school_email(email text)
RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$ SELECT COALESCE(email ~* '^[^@[:space:]]+@iszl[.]ch$', false); $$;
REVOKE ALL ON FUNCTION public.is_school_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_school_email(text) TO anon, authenticated, supabase_auth_admin;

-- Read the verified identity from auth.users, NEVER editable profile/user_metadata.
-- No profile lookup here, so this helper cannot recurse through profile RLS.
CREATE OR REPLACE FUNCTION public.is_school_member()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
      AND public.is_school_email(u.email)
      AND u.email_confirmed_at IS NOT NULL
  );
$$;
REVOKE ALL ON FUNCTION public.is_school_member() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_school_member() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id = p.id
    WHERE p.id = check_user_id AND p.role = 'admin'
      AND public.is_school_email(u.email)
      AND u.email_confirmed_at IS NOT NULL
  );
$$;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_publish_opportunities()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT public.is_school_member() AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('teacher', 'organizer', 'admin')
  );
$$;
REVOKE ALL ON FUNCTION public.can_publish_opportunities() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_publish_opportunities() TO authenticated;

-- Select this function in Supabase Authentication -> Hooks -> Before User Created.
-- Defining the function alone does NOT activate the hook.
CREATE OR REPLACE FUNCTION public.before_school_user_created(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_school_email(event -> 'user' ->> 'email') THEN
    RETURN jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Involv is only available to @iszl.ch accounts. Please use your ISZL Google account.'
    ));
  END IF;
  RETURN '{}'::jsonb;
END;
$$;
REVOKE ALL ON FUNCTION public.before_school_user_created(jsonb) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.before_school_user_created(jsonb) TO supabase_auth_admin;

CREATE TABLE public.role_change_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  changed_by uuid,
  old_role text NOT NULL,
  new_role text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL
);
ALTER TABLE public.role_change_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.role_change_audit FROM anon, authenticated;
GRANT SELECT ON public.role_change_audit TO authenticated;
CREATE POLICY "School admins read role audit"
  ON public.role_change_audit FOR SELECT TO authenticated
  USING (public.is_school_member() AND public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.audit_profile_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    INSERT INTO public.role_change_audit (target_user_id, changed_by, old_role, new_role, reason)
    VALUES (NEW.id, auth.uid(), OLD.role, NEW.role,
      CASE WHEN auth.uid() IS NULL THEN 'school_access_reapproval' ELSE 'admin_role_change' END);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.audit_profile_role_change() FROM PUBLIC;
CREATE TRIGGER audit_profile_role_change
  AFTER UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_profile_role_change();

-- The user explicitly requested fresh approval of ALL teachers/organisers.
-- Keep administrators and all records; do not delete accounts or opportunities.
-- DDL holds the table lock until COMMIT, so there is no unguarded write window.
DROP TRIGGER guard_profile_role_change ON public.profiles;
UPDATE public.profiles SET role = 'student' WHERE role IN ('teacher', 'organizer');
UPDATE public.profiles p SET email = u.email
FROM auth.users u WHERE p.id = u.id AND p.email IS DISTINCT FROM u.email;

CREATE OR REPLACE FUNCTION public.guard_profile_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  identity_email text;
BEGIN
  SELECT email INTO identity_email FROM auth.users WHERE id = NEW.id;
  IF NEW.email IS DISTINCT FROM identity_email THEN
    RAISE EXCEPTION 'Profile email must match the authenticated identity' USING ERRCODE = '42501';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Profile identity cannot be changed' USING ERRCODE = '42501';
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.is_school_member() OR NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Only ISZL administrators can approve roles' USING ERRCODE = '42501';
    END IF;
    IF OLD.id = auth.uid() THEN
      RAISE EXCEPTION 'Ask another administrator to change your role' USING ERRCODE = '42501';
    END IF;
    IF NEW.role <> 'student' AND NOT EXISTS (
      SELECT 1 FROM auth.users u WHERE u.id = NEW.id
        AND public.is_school_email(u.email) AND u.email_confirmed_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Only verified ISZL accounts can receive privileged roles' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_profile_role_change() FROM PUBLIC;
CREATE TRIGGER guard_profile_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role_change();

CREATE OR REPLACE FUNCTION public.guard_school_profile_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_school_member() OR NEW.id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only verified ISZL members can create their own profiles' USING ERRCODE = '42501';
  END IF;
  IF NEW.role <> 'student' THEN
    RAISE EXCEPTION 'New accounts must start as students; ask an administrator to approve another role'
      USING ERRCODE = '42501';
  END IF;
  SELECT email INTO NEW.email FROM auth.users WHERE id = auth.uid();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_school_profile_insert() FROM PUBLIC;
CREATE TRIGGER guard_school_profile_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_school_profile_insert();

DROP POLICY IF EXISTS "Users can insert own non-admin profile" ON public.profiles;
CREATE POLICY "School members create student profiles"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() AND role = 'student' AND public.is_school_member());

-- RESTRICTIVE policies intersect with existing ownership rules; permissive
-- policies elsewhere cannot accidentally grant access to outside accounts.
CREATE POLICY "School membership required"
  ON public.profiles AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_school_member()) WITH CHECK (public.is_school_member());
CREATE POLICY "School membership required"
  ON public.applications AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_school_member()) WITH CHECK (public.is_school_member());
CREATE POLICY "School membership required"
  ON public.saved_opportunities AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_school_member()) WITH CHECK (public.is_school_member());
CREATE POLICY "School membership required"
  ON public.opportunities AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_school_member()) WITH CHECK (public.is_school_member());

-- Public active listings remain readable without signing in, as before.
-- They do not grant access to profiles, applications or school management.
CREATE POLICY "Approved publishers create opportunities"
  ON public.opportunities AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.can_publish_opportunities() AND organizer_id = auth.uid());
CREATE POLICY "Approved publishers update opportunities"
  ON public.opportunities AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.can_publish_opportunities() AND (organizer_id = auth.uid() OR public.is_admin(auth.uid())))
  WITH CHECK (public.can_publish_opportunities() AND (organizer_id = auth.uid() OR public.is_admin(auth.uid())));
CREATE POLICY "Approved publishers delete opportunities"
  ON public.opportunities AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.can_publish_opportunities() AND (organizer_id = auth.uid() OR public.is_admin(auth.uid())));
CREATE POLICY "Approved managers read applications"
  ON public.applications AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    applicant_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR (organizer_id = auth.uid() AND public.can_publish_opportunities())
  );
CREATE POLICY "Approved managers update applications"
  ON public.applications AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.can_publish_opportunities() AND (organizer_id = auth.uid() OR public.is_admin(auth.uid())))
  WITH CHECK (public.can_publish_opportunities() AND (organizer_id = auth.uid() OR public.is_admin(auth.uid())));

-- Prevent an administrator deleting their own profile and locking themselves out.
CREATE POLICY "No self deletion"
  ON public.profiles AS RESTRICTIVE FOR DELETE TO authenticated
  USING (id <> auth.uid());

COMMIT;


-- ── 20261106000001_notifications.sql ──────────────────────────────────────────
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


-- ── 20261106000002_message_reports.sql ──────────────────────────────────────────
-- Safeguarding: any current group member can report a message to school admins.
-- Admins review reports, can remove the message, and the reporter is told the
-- report was handled. Reports keep a snapshot of the reported text so the record
-- survives later edits or removal.
-- Requires: messaging controls (activity_messages.deleted_at) and notifications.
BEGIN;
DO $$ BEGIN
  IF to_regclass('public.notifications') IS NULL
    OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
      AND table_name = 'activity_messages' AND column_name = 'deleted_at') THEN
    RAISE EXCEPTION 'Install the messaging upgrade and notifications before message reports.';
  END IF;
END $$;

CREATE TABLE public.message_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.activity_messages(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  activity_title text NOT NULL,
  reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_name text NOT NULL,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_name text NOT NULL,
  message_snapshot text NOT NULL,
  message_sent_at timestamptz NOT NULL,
  reason text NOT NULL CHECK (reason IN ('bullying','inappropriate','personal_information','spam','safety','other')),
  details text NOT NULL DEFAULT '' CHECK (length(details) <= 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','dismissed','actioned')),
  resolution_note text NOT NULL DEFAULT '' CHECK (length(resolution_note) <= 1000),
  message_removed boolean NOT NULL DEFAULT false,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolver_name text NOT NULL DEFAULT '',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((status = 'open') = (resolved_at IS NULL))
);
CREATE UNIQUE INDEX message_reports_one_per_reporter
  ON public.message_reports(message_id, reporter_id) WHERE message_id IS NOT NULL AND reporter_id IS NOT NULL;
CREATE INDEX message_reports_queue_idx ON public.message_reports(status, created_at DESC);
ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.message_reports FROM PUBLIC, anon, authenticated;
-- No table grants: all reads and writes go through the functions below.

CREATE FUNCTION public.report_activity_message(target_message_id uuid, report_reason text,
  report_details text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE entry public.activity_messages; me public.profiles; listing_title text;
  existing public.message_reports; created public.message_reports;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(coalesce(auth.uid()::text, ''), 41));
  SELECT * INTO entry FROM public.activity_messages WHERE id = target_message_id;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.can_read_activity(entry.opportunity_id) THEN
    RAISE EXCEPTION 'Only current group members can report this message' USING ERRCODE = '42501';
  END IF;
  IF entry.sender_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot report your own message; edit or remove it instead' USING ERRCODE = '23514';
  END IF;
  IF entry.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This message was already removed' USING ERRCODE = '23514';
  END IF;
  IF report_reason IS NULL OR report_reason NOT IN ('bullying','inappropriate','personal_information','spam','safety','other') THEN
    RAISE EXCEPTION 'Choose a reason for the report' USING ERRCODE = '23514';
  END IF;
  IF length(coalesce(report_details, '')) > 1000 THEN
    RAISE EXCEPTION 'Details must be 1000 characters or fewer' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO existing FROM public.message_reports
  WHERE message_id = entry.id AND reporter_id = auth.uid();
  IF FOUND THEN
    RETURN jsonb_build_object('id', existing.id, 'status', existing.status, 'already_reported', true);
  END IF;
  IF (SELECT count(*) FROM public.message_reports WHERE reporter_id = auth.uid()
      AND created_at > clock_timestamp() - interval '1 day') >= 20 THEN
    RAISE EXCEPTION 'Report limit reached for today. Speak to a teacher if this is urgent.' USING ERRCODE = '54000';
  END IF;
  SELECT * INTO me FROM public.profiles WHERE id = auth.uid();
  SELECT title INTO listing_title FROM public.opportunities WHERE id = entry.opportunity_id;
  INSERT INTO public.message_reports(message_id, opportunity_id, activity_title, reporter_id, reporter_name,
    sender_id, sender_name, message_snapshot, message_sent_at, reason, details)
  VALUES (entry.id, entry.opportunity_id, coalesce(listing_title, 'Activity'), auth.uid(),
    coalesce(nullif(me.name, ''), 'Student'), entry.sender_id, entry.sender_name, entry.content,
    entry.created_at, report_reason, btrim(coalesce(report_details, '')))
  RETURNING * INTO created;
  PERFORM public.push_notification(admin_id, 'report_update', 'Message reported',
    'A group message in ' || coalesce(listing_title, 'an activity') || ' needs review.',
    NULL, '/admin?tab=reports', 'report:' || created.id)
  FROM public.school_admin_ids() AS admin_id;
  RETURN jsonb_build_object('id', created.id, 'status', created.status, 'already_reported', false);
END $$;

CREATE FUNCTION public.get_message_reports(status_filter text DEFAULT 'open')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'School admin access required' USING ERRCODE = '42501';
  END IF;
  IF status_filter NOT IN ('open', 'closed', 'all') THEN
    RAISE EXCEPTION 'Unknown report filter' USING ERRCODE = '23514';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', r.id, 'message_id', r.message_id, 'opportunity_id', r.opportunity_id,
      'activity_title', r.activity_title, 'reporter_name', r.reporter_name, 'sender_name', r.sender_name,
      'message_snapshot', r.message_snapshot, 'message_sent_at', r.message_sent_at,
      'message_currently_removed', coalesce(m.deleted_at IS NOT NULL, true),
      'reason', r.reason, 'details', r.details, 'status', r.status,
      'resolution_note', r.resolution_note, 'message_removed', r.message_removed,
      'resolver_name', r.resolver_name, 'resolved_at', r.resolved_at, 'created_at', r.created_at)
      ORDER BY r.created_at DESC, r.id DESC)
    FROM (SELECT * FROM public.message_reports
      WHERE status_filter = 'all' OR (status_filter = 'open') = (status = 'open')
      ORDER BY created_at DESC, id DESC LIMIT 200) r
    LEFT JOIN public.activity_messages m ON m.id = r.message_id), '[]'::jsonb);
END $$;

CREATE FUNCTION public.resolve_message_report(target_report_id uuid, resolution text,
  note text DEFAULT '', remove_message boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE report public.message_reports; admin public.profiles; stamp timestamptz := clock_timestamp();
  removed boolean := false;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'School admin access required' USING ERRCODE = '42501';
  END IF;
  IF resolution NOT IN ('dismissed', 'actioned') OR remove_message IS NULL
    OR (remove_message AND resolution <> 'actioned') THEN
    RAISE EXCEPTION 'Choose dismiss, or action (optionally removing the message)' USING ERRCODE = '23514';
  END IF;
  IF length(coalesce(note, '')) > 1000 THEN
    RAISE EXCEPTION 'Notes must be 1000 characters or fewer' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO report FROM public.message_reports WHERE id = target_report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Report not found' USING ERRCODE = 'P0002'; END IF;
  IF report.status <> 'open' THEN
    RAISE EXCEPTION 'This report was already resolved' USING ERRCODE = '40001';
  END IF;
  SELECT * INTO admin FROM public.profiles WHERE id = auth.uid();
  IF remove_message AND report.message_id IS NOT NULL THEN
    UPDATE public.activity_messages
    SET content = '', deleted_at = greatest(stamp, updated_at + interval '1 microsecond'),
        updated_at = greatest(stamp, updated_at + interval '1 microsecond')
    WHERE id = report.message_id AND deleted_at IS NULL;
    removed := true;
  END IF;
  -- Resolve every open report about the same message in one decision.
  UPDATE public.message_reports SET status = resolution, resolution_note = btrim(coalesce(note, '')),
    message_removed = removed, resolved_by = auth.uid(), resolver_name = coalesce(admin.name, 'School admin'),
    resolved_at = stamp
  WHERE status = 'open' AND (id = report.id OR (report.message_id IS NOT NULL AND message_id = report.message_id));
  PERFORM public.push_notification(r.reporter_id, 'report_update', 'Your report was reviewed',
    'A school admin reviewed the message you reported in ' || r.activity_title || '. Thank you for speaking up.',
    NULL, '', 'report-reviewed:' || r.id)
  FROM public.message_reports r
  WHERE r.resolved_at = stamp AND r.resolved_by = auth.uid() AND r.reporter_id IS NOT NULL;
  RETURN jsonb_build_object('id', report.id, 'status', resolution, 'message_removed', removed);
END $$;

REVOKE ALL ON FUNCTION public.report_activity_message(uuid, text, text),
  public.get_message_reports(text), public.resolve_message_report(uuid, text, text, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_activity_message(uuid, text, text),
  public.get_message_reports(text), public.resolve_message_report(uuid, text, text, boolean)
  TO authenticated;
COMMIT;
NOTIFY pgrst, 'reload schema';


-- ── 20261106000003_privacy_requests.sql ──────────────────────────────────────────
-- Privacy self-service: students download everything Involv stores about them
-- and send access/correction/deletion requests that school admins handle.
-- Deletion is carried out by an admin under the school's retention rules (see
-- docs/DATA_REQUESTS.md); nothing here deletes accounts automatically.
-- Requires: notifications, message reports, reflections, participation, messaging.
BEGIN;
DO $$ BEGIN
  IF to_regclass('public.notifications') IS NULL OR to_regclass('public.message_reports') IS NULL
    OR to_regclass('public.activity_reflections') IS NULL OR to_regclass('public.activity_attendance') IS NULL
    OR to_regclass('public.activity_messages') IS NULL THEN
    RAISE EXCEPTION 'Install notifications, message reports, reflections, participation and messaging first.';
  END IF;
END $$;

CREATE TABLE public.privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requester_name text NOT NULL,
  requester_email text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('access','correction','deletion','question')),
  details text NOT NULL DEFAULT '' CHECK (length(details) <= 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','declined')),
  response text NOT NULL DEFAULT '' CHECK (length(response) <= 2000),
  handled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  handler_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (status NOT IN ('completed','declined') OR length(btrim(response)) > 0)
);
CREATE INDEX privacy_requests_requester_idx ON public.privacy_requests(requester_id, created_at DESC);
CREATE INDEX privacy_requests_queue_idx ON public.privacy_requests(status, created_at);
ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.privacy_requests FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.privacy_request_json(r public.privacy_requests)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$ SELECT jsonb_build_object('id', r.id, 'kind', r.kind, 'details', r.details, 'status', r.status,
  'response', r.response, 'handler_name', r.handler_name, 'created_at', r.created_at,
  'updated_at', r.updated_at, 'requester_name', r.requester_name, 'requester_email', r.requester_email) $$;
REVOKE ALL ON FUNCTION public.privacy_request_json(public.privacy_requests) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.submit_privacy_request(request_kind text, request_details text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE me public.profiles; account_email text; created public.privacy_requests;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_school_member() THEN
    RAISE EXCEPTION 'A verified school account is required' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text, 43));
  IF request_kind IS NULL OR request_kind NOT IN ('access','correction','deletion','question') THEN
    RAISE EXCEPTION 'Choose a request type' USING ERRCODE = '23514';
  END IF;
  IF length(coalesce(request_details, '')) > 2000 THEN
    RAISE EXCEPTION 'Details must be 2000 characters or fewer' USING ERRCODE = '23514';
  END IF;
  IF request_kind IN ('correction','question') AND length(btrim(coalesce(request_details, ''))) = 0 THEN
    RAISE EXCEPTION 'Describe what you would like changed or answered' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.privacy_requests WHERE requester_id = auth.uid()
      AND kind = request_kind AND status IN ('open','in_progress')) THEN
    RAISE EXCEPTION 'You already have an open request of this type' USING ERRCODE = '23505';
  END IF;
  IF (SELECT count(*) FROM public.privacy_requests WHERE requester_id = auth.uid()
      AND created_at > clock_timestamp() - interval '1 day') >= 5 THEN
    RAISE EXCEPTION 'Request limit reached for today' USING ERRCODE = '54000';
  END IF;
  SELECT * INTO me FROM public.profiles WHERE id = auth.uid();
  SELECT email INTO account_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.privacy_requests(requester_id, requester_name, requester_email, kind, details)
  VALUES (auth.uid(), coalesce(nullif(me.name, ''), 'Student'), account_email, request_kind,
    btrim(coalesce(request_details, '')))
  RETURNING * INTO created;
  PERFORM public.push_notification(admin_id, 'privacy_request_update', 'New privacy request',
    'A ' || request_kind || ' request is waiting in the admin panel.', NULL,
    '/admin?tab=privacy', 'privacy-new:' || created.id)
  FROM public.school_admin_ids() AS admin_id;
  RETURN public.privacy_request_json(created);
END $$;

CREATE FUNCTION public.get_my_privacy_requests()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_school_member() THEN
    RAISE EXCEPTION 'A verified school account is required' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(public.privacy_request_json(r) ORDER BY r.created_at DESC)
    FROM public.privacy_requests r WHERE r.requester_id = auth.uid()), '[]'::jsonb);
END $$;

CREATE FUNCTION public.get_privacy_requests(status_filter text DEFAULT 'open')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'School admin access required' USING ERRCODE = '42501';
  END IF;
  IF status_filter NOT IN ('open','closed','all') THEN
    RAISE EXCEPTION 'Unknown request filter' USING ERRCODE = '23514';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(public.privacy_request_json(r) ORDER BY r.created_at)
    FROM (SELECT * FROM public.privacy_requests
      WHERE status_filter = 'all'
        OR (status_filter = 'open' AND status IN ('open','in_progress'))
        OR (status_filter = 'closed' AND status IN ('completed','declined'))
      ORDER BY created_at LIMIT 200) r), '[]'::jsonb);
END $$;

CREATE FUNCTION public.update_privacy_request(target_request_id uuid, new_status text,
  admin_response text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE entry public.privacy_requests; admin public.profiles;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'School admin access required' USING ERRCODE = '42501';
  END IF;
  IF new_status NOT IN ('in_progress','completed','declined') THEN
    RAISE EXCEPTION 'Unknown status' USING ERRCODE = '23514';
  END IF;
  IF length(coalesce(admin_response, '')) > 2000 THEN
    RAISE EXCEPTION 'Responses must be 2000 characters or fewer' USING ERRCODE = '23514';
  END IF;
  IF new_status IN ('completed','declined') AND length(btrim(coalesce(admin_response, ''))) = 0 THEN
    RAISE EXCEPTION 'Explain the outcome to the student' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO entry FROM public.privacy_requests WHERE id = target_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0002'; END IF;
  IF entry.status IN ('completed','declined') THEN
    RAISE EXCEPTION 'This request is already closed' USING ERRCODE = '40001';
  END IF;
  SELECT * INTO admin FROM public.profiles WHERE id = auth.uid();
  UPDATE public.privacy_requests SET status = new_status, response = btrim(coalesce(admin_response, '')),
    handled_by = auth.uid(), handler_name = coalesce(admin.name, 'School admin'), updated_at = clock_timestamp()
  WHERE id = entry.id RETURNING * INTO entry;
  PERFORM public.push_notification(entry.requester_id, 'privacy_request_update',
    CASE new_status WHEN 'in_progress' THEN 'Your privacy request is being handled'
      ELSE 'Your privacy request was answered' END,
    'See Profile → Your data for details.', NULL, '/profile#your-data',
    'privacy:' || entry.id || ':' || new_status);
  RETURN public.privacy_request_json(entry);
END $$;

-- Everything Involv stores that belongs to the caller, as one JSON document.
-- Other people's private details (e.g. other applicants) are never included.
CREATE FUNCTION public.export_my_data()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT public.is_school_member() THEN
    RAISE EXCEPTION 'A verified school account is required' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'exported_at', clock_timestamp(),
    'account', (SELECT jsonb_build_object('id', u.id, 'email', u.email, 'email_confirmed_at', u.email_confirmed_at)
      FROM auth.users u WHERE u.id = uid),
    'profile', (SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = uid),
    'applications', coalesce((SELECT jsonb_agg(to_jsonb(a) - 'organizer_id' ORDER BY a.submitted_date)
      FROM public.applications a WHERE a.applicant_id = uid), '[]'::jsonb),
    'saved_opportunities', coalesce((SELECT jsonb_agg(jsonb_build_object('opportunity_id', s.opportunity_id,
      'title', o.title, 'saved_at', s.created_at) ORDER BY s.created_at)
      FROM public.saved_opportunities s LEFT JOIN public.opportunities o ON o.id = s.opportunity_id
      WHERE s.user_id = uid), '[]'::jsonb),
    'attendance', coalesce((SELECT jsonb_agg(jsonb_build_object('opportunity_id', a.opportunity_id,
      'session_id', a.session_id, 'present', a.present, 'updated_at', a.updated_at) ORDER BY a.updated_at)
      FROM public.activity_attendance a WHERE a.student_id = uid), '[]'::jsonb),
    'service_hours', coalesce((SELECT jsonb_agg(to_jsonb(h) - 'reviewed_by' ORDER BY h.service_date)
      FROM public.activity_hours h WHERE h.student_id = uid), '[]'::jsonb),
    'reflections', coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at)
      FROM public.activity_reflections r WHERE r.student_id = uid), '[]'::jsonb),
    'messages_sent', coalesce((SELECT jsonb_agg(to_jsonb(m) - 'client_nonce' ORDER BY m.created_at)
      FROM public.activity_messages m WHERE m.sender_id = uid), '[]'::jsonb),
    'reports_made', coalesce((SELECT jsonb_agg(jsonb_build_object('activity_title', r.activity_title,
      'reason', r.reason, 'details', r.details, 'status', r.status, 'created_at', r.created_at) ORDER BY r.created_at)
      FROM public.message_reports r WHERE r.reporter_id = uid), '[]'::jsonb),
    'notifications', coalesce((SELECT jsonb_agg(to_jsonb(n) - 'dedupe_key' ORDER BY n.created_at)
      FROM public.notifications n WHERE n.user_id = uid), '[]'::jsonb),
    'privacy_requests', coalesce((SELECT jsonb_agg(public.privacy_request_json(q) ORDER BY q.created_at)
      FROM public.privacy_requests q WHERE q.requester_id = uid), '[]'::jsonb)
  );
END $$;

REVOKE ALL ON FUNCTION public.submit_privacy_request(text, text), public.get_my_privacy_requests(),
  public.get_privacy_requests(text), public.update_privacy_request(uuid, text, text),
  public.export_my_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_privacy_request(text, text), public.get_my_privacy_requests(),
  public.get_privacy_requests(text), public.update_privacy_request(uuid, text, text),
  public.export_my_data() TO authenticated;
COMMIT;
NOTIFY pgrst, 'reload schema';


-- ── Check: every row should say PASS (except 34 until you switch the hook on) ──
-- Involv hosted readiness check. READ-ONLY: paste into Supabase → SQL Editor and Run.
-- Every row should say PASS. A MISSING row names the migration file to apply
-- (from supabase/migrations, oldest first). It changes nothing in the database.
WITH checks(step, check_name, ok, fix) AS (
  VALUES
  (1,  'Profiles table',                      to_regclass('public.profiles') IS NOT NULL,                       '20240528000001_create_profiles.sql'),
  (2,  'Opportunities + applications',        to_regclass('public.applications') IS NOT NULL,                   '20240528000002_create_opportunities_applications.sql'),
  (3,  'Site stats function',                 to_regprocedure('public.get_site_stats()') IS NOT NULL,           '20240528000005_site_stats_fn.sql'),
  (4,  'Security hardening (role guard)',     EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'guard_profile_role_change'), '20260923000002_security_hardening.sql'),
  (5,  'School access + trusted roles',       to_regprocedure('public.before_school_user_created(jsonb)') IS NOT NULL, '20261006000001_school_access_trusted_roles.sql'),
  (6,  'Activity Hub',                        to_regclass('public.activity_announcements') IS NOT NULL,         '20261009000001_activity_hub_foundation.sql'),
  (7,  'Attendance + service hours',          to_regclass('public.activity_hours') IS NOT NULL,                 '20261009000002_activity_participation.sql'),
  (8,  'Service portfolio',                   to_regprocedure('public.get_my_service_portfolio()') IS NOT NULL, '20261011000001_student_service_portfolio.sql'),
  (9,  'Profile read privacy',                NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles'
                                                AND policyname = 'Authenticated users can read profiles')
                                              AND EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles'
                                                AND policyname = 'Admins can read all profiles'), '20261011000002_profile_read_privacy.sql'),
  (10, 'Group messages',                      to_regclass('public.activity_messages') IS NOT NULL,              '20261011000003_activity_group_messages.sql'),
  (11, 'Reflections',                         to_regclass('public.activity_reflections') IS NOT NULL,           '20261011000004_private_activity_reflections.sql'),
  (12, 'Hour corrections',                    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'correct_activity_hours'), '20261011000005_service_hour_corrections.sql'),
  (13, 'Message edit/remove + Realtime',      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
                                                AND table_name = 'activity_messages' AND column_name = 'deleted_at'), '20261011000006_messaging_controls_realtime.sql'),
  (14, 'Public listing privacy',              to_regprocedure('public.get_opportunity_contact(uuid)') IS NOT NULL, '20261015000001_public_opportunity_privacy.sql'),
  (15, 'Application lifecycle',               EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'application_lifecycle_guard'), '20261015000002_application_lifecycle.sql'),
  (16, 'Service programme filters',           EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
                                                AND table_name = 'opportunities' AND column_name = 'service_programs'), '20261019000001_opportunity_service_programs.sql'),
  (17, 'Calendar-date safeguards',            EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'protect_attendance_session_date'), '20261026000001_participation_calendar_dates.sql'),
  (18, 'Reflection reader access',            to_regprocedure('public.get_managed_activity_reflections(uuid,timestamptz,uuid)') IS NOT NULL, '20261026000002_activity_reflection_reader_access.sql'),
  (19, 'Apply to admin-managed listings',     EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'applications'
                                                AND policyname = 'Students can create applications' AND with_check ILIKE '%DISTINCT%'), '20261106000000_admin_managed_applications.sql'),
  (20, 'Notifications + reminders',           to_regprocedure('public.queue_my_reminders()') IS NOT NULL,       '20261106000001_notifications.sql'),
  (21, 'Message reports',                     to_regprocedure('public.report_activity_message(uuid,text,text)') IS NOT NULL, '20261106000002_message_reports.sql'),
  (22, 'Privacy requests + data export',      to_regprocedure('public.export_my_data()') IS NOT NULL,           '20261106000003_privacy_requests.sql'),
  -- Configuration and safety checks
  (30, 'A verified @iszl.ch admin exists',    EXISTS (SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id = p.id
                                                WHERE p.role = 'admin' AND u.email ~* '^[^@[:space:]]+@iszl[.]ch$' AND u.email_confirmed_at IS NOT NULL),
                                              'Sign in once with your ISZL account, then in SQL Editor: UPDATE public.profiles SET role = ''admin'' WHERE email = ''you@iszl.ch'';'),
  (31, 'Every public table has RLS on',       NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity),
                                              'Run: SELECT tablename FROM pg_tables WHERE schemaname = ''public'' AND NOT rowsecurity; and investigate'),
  (32, 'Realtime publishes messages',         EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'activity_messages'),
                                              'Database → Publications → supabase_realtime: include activity_messages'),
  (33, 'Realtime publishes notifications',    EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'),
                                              'Database → Publications → supabase_realtime: include notifications'),
  (34, 'Outside accounts blocked at sign-up', EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'before_school_user_created'),
                                              'Function exists; ALSO enable it in Authentication → Hooks → Before User Created (SQL cannot check this setting)'),
  (35, 'No sample listings still live',       NOT EXISTS (SELECT 1 FROM public.opportunities WHERE status = 'active' AND organizer_id IS NULL
                                                AND application_deadline < (now() AT TIME ZONE 'Europe/Zurich')::date),
                                              'Some active listings have past deadlines: close/archive them (see supabase/imports/archive_sample_opportunities.sql)'),
  (36, 'Internal functions not callable',     coalesce(NOT has_function_privilege('anon', to_regprocedure('public.push_notification(uuid,text,text,text,uuid,text,text)'), 'EXECUTE')
                                                AND NOT has_function_privilege('authenticated', to_regprocedure('public.push_notification(uuid,text,text,text,uuid,text,text)'), 'EXECUTE'), true),
                                              'REVOKE ALL ON FUNCTION public.push_notification(uuid,text,text,text,uuid,text,text) FROM PUBLIC, anon, authenticated;')
)
SELECT step, check_name, CASE WHEN ok THEN 'PASS' ELSE 'MISSING' END AS result,
  CASE WHEN ok THEN '' ELSE fix END AS what_to_do
FROM checks ORDER BY step;
