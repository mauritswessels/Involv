-- Requires Activity Hub foundation. Does not activate school OAuth/signup hooks.
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('public.can_read_activity(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Apply Activity Hub foundation before group messaging.';
  END IF;
END $$;

CREATE TABLE public.activity_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name text NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('student','teacher','organizer','admin')),
  content text NOT NULL CHECK (length(btrim(content)) BETWEEN 1 AND 2000),
  client_nonce uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (sender_id, client_nonce)
);
CREATE INDEX activity_messages_history_idx
  ON public.activity_messages(opportunity_id, created_at, id);
ALTER TABLE public.activity_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Current activity members read messages" ON public.activity_messages
  FOR SELECT TO authenticated USING (public.can_read_activity(opportunity_id));
REVOKE ALL ON public.activity_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.activity_messages TO authenticated;

CREATE FUNCTION public.send_activity_message(target_opportunity_id uuid, message_content text, request_nonce uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE author public.profiles; existing public.activity_messages; sent public.activity_messages;
BEGIN
  IF NOT public.can_read_activity(target_opportunity_id) THEN
    RAISE EXCEPTION 'Activity membership required' USING ERRCODE = '42501';
  END IF;
  IF request_nonce IS NULL OR message_content IS NULL
    OR length(btrim(message_content)) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Message must be 1–2000 characters with a retry ID' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO author FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'School profile required' USING ERRCODE = '42501'; END IF;
  -- Serialize per sender: concurrent retries and the rate cap cannot race.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text, 37));
  IF NOT public.can_read_activity(target_opportunity_id) THEN
    RAISE EXCEPTION 'Activity membership required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO existing FROM public.activity_messages
    WHERE sender_id = auth.uid() AND client_nonce = request_nonce;
  IF FOUND THEN
    IF existing.opportunity_id <> target_opportunity_id OR existing.content <> btrim(message_content) THEN
      RAISE EXCEPTION 'Retry ID already used for a different message' USING ERRCODE = '23514';
    END IF;
    RETURN to_jsonb(existing) - 'client_nonce';
  END IF;
  IF (SELECT count(*) FROM public.activity_messages WHERE sender_id = auth.uid()
      AND created_at > clock_timestamp() - interval '1 minute') >= 20 THEN
    RAISE EXCEPTION 'Please wait before sending more messages' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.activity_messages(opportunity_id,sender_id,sender_name,sender_role,content,client_nonce)
    VALUES(target_opportunity_id,auth.uid(),author.name,author.role,btrim(message_content),request_nonce)
    RETURNING * INTO sent;
  RETURN to_jsonb(sent) - 'client_nonce';
END $$;

CREATE FUNCTION public.list_activity_messages(
  target_opportunity_id uuid, cursor_time timestamptz DEFAULT NULL,
  cursor_id uuid DEFAULT NULL, newer boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.can_read_activity(target_opportunity_id) THEN
    RAISE EXCEPTION 'Activity membership required' USING ERRCODE = '42501';
  END IF;
  IF (cursor_time IS NULL) <> (cursor_id IS NULL) OR newer IS NULL THEN
    RAISE EXCEPTION 'Both cursor fields are required' USING ERRCODE = '23514';
  END IF;
  IF newer THEN
    RETURN COALESCE((SELECT jsonb_agg(to_jsonb(m) - 'client_nonce' ORDER BY created_at,id)
      FROM (SELECT * FROM public.activity_messages
        WHERE opportunity_id = target_opportunity_id
          AND (cursor_time IS NULL OR (created_at,id) > (cursor_time,cursor_id))
        ORDER BY created_at,id LIMIT 50) m), '[]'::jsonb);
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(to_jsonb(m) - 'client_nonce' ORDER BY created_at,id)
    FROM (SELECT * FROM public.activity_messages
      WHERE opportunity_id = target_opportunity_id
        AND (cursor_time IS NULL OR (created_at,id) < (cursor_time,cursor_id))
      ORDER BY created_at DESC,id DESC LIMIT 50) m), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.send_activity_message(uuid,text,uuid),
  public.list_activity_messages(uuid,timestamptz,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_activity_message(uuid,text,uuid),
  public.list_activity_messages(uuid,timestamptz,uuid,boolean) TO authenticated;
COMMIT;
NOTIFY pgrst, 'reload schema';
