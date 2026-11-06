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
