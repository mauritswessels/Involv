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
