-- Adds author-only edit/delete and RLS-protected Postgres Changes, not a public broadcast.
BEGIN;
DO $$ BEGIN
  IF to_regclass('public.activity_messages') IS NULL THEN
    RAISE EXCEPTION 'Install group messaging first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    RAISE EXCEPTION 'Supabase Realtime publication is missing. Enable Realtime before this upgrade.';
  END IF;
END; $$;
ALTER TABLE public.activity_messages ADD COLUMN updated_at timestamptz,
  ADD COLUMN edited_at timestamptz, ADD COLUMN deleted_at timestamptz;
UPDATE public.activity_messages SET updated_at=created_at;
ALTER TABLE public.activity_messages ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT clock_timestamp();
ALTER TABLE public.activity_messages DROP CONSTRAINT activity_messages_content_check;
ALTER TABLE public.activity_messages ADD CONSTRAINT activity_messages_content_check
 CHECK ((deleted_at IS NULL AND length(btrim(content)) BETWEEN 1 AND 2000)
   OR (deleted_at IS NOT NULL AND content=''));

CREATE FUNCTION public.change_my_activity_message(
  target_message_id uuid, replacement_content text, expected_updated_at timestamptz,
  remove_message boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE entry public.activity_messages; stamp timestamptz;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,37));
  SELECT * INTO entry FROM public.activity_messages WHERE id=target_message_id FOR UPDATE;
  IF NOT FOUND OR entry.sender_id<>auth.uid() OR NOT public.can_read_activity(entry.opportunity_id) THEN
    RAISE EXCEPTION 'Only a current member may change their own message' USING ERRCODE='42501';
  END IF;
  IF remove_message IS NULL OR expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'A displayed message version and edit/delete action are required' USING ERRCODE='23514';
  END IF;
  IF remove_message AND entry.deleted_at IS NOT NULL THEN RETURN to_jsonb(entry)-'client_nonce'; END IF;
  IF entry.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This message was removed' USING ERRCODE='40001';
  END IF;
  IF NOT remove_message AND (replacement_content IS NULL
    OR length(btrim(replacement_content)) NOT BETWEEN 1 AND 2000
    OR length(regexp_replace(replacement_content,'\s','','g'))=0) THEN
    RAISE EXCEPTION 'Messages must contain 1–2000 characters' USING ERRCODE='23514';
  END IF;
  -- A retry with the same content does not create another edit.
  IF NOT remove_message AND entry.content=btrim(replacement_content) THEN RETURN to_jsonb(entry)-'client_nonce'; END IF;
  IF entry.updated_at IS DISTINCT FROM expected_updated_at THEN
    RAISE EXCEPTION 'Message changed; reopen it before editing or deleting' USING ERRCODE='40001';
  END IF;
  stamp := greatest(clock_timestamp(),entry.updated_at+interval '1 microsecond');
  UPDATE public.activity_messages SET
    content=CASE WHEN remove_message THEN '' ELSE btrim(replacement_content) END,
    edited_at=CASE WHEN remove_message THEN edited_at ELSE stamp END,
    deleted_at=CASE WHEN remove_message THEN stamp ELSE NULL END,
    updated_at=stamp WHERE id=entry.id RETURNING * INTO entry;
  RETURN to_jsonb(entry)-'client_nonce';
END; $$;

CREATE FUNCTION public.get_activity_message_updates(target_opportunity_id uuid, message_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT public.can_read_activity(target_opportunity_id) THEN
    RAISE EXCEPTION 'Activity membership required' USING ERRCODE='42501';
  END IF;
  IF message_ids IS NULL OR cardinality(message_ids)>100 OR array_position(message_ids,NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Request at most 100 message IDs' USING ERRCODE='23514';
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(to_jsonb(m)-'client_nonce' ORDER BY created_at,id)
    FROM public.activity_messages m WHERE opportunity_id=target_opportunity_id AND id=ANY(message_ids)),'[]'::jsonb);
END; $$;
REVOKE ALL ON FUNCTION public.change_my_activity_message(uuid,text,timestamptz,boolean),
  public.get_activity_message_updates(uuid,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.change_my_activity_message(uuid,text,timestamptz,boolean),
  public.get_activity_message_updates(uuid,uuid[]) TO authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='activity_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_messages;
  END IF;
END; $$;
COMMIT;
NOTIFY pgrst,'reload schema';
