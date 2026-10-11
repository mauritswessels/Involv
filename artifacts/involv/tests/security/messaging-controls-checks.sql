-- Base messaging tests have left the first sender accepted in a closed activity.
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000103');
SELECT set_config('test.mutable_id',current_setting('test.chat_first')::jsonb->>'id',true);
SELECT set_config('test.mutable_version',(SELECT updated_at::text FROM public.activity_messages
 WHERE id=current_setting('test.mutable_id')::uuid),true);
SELECT pg_temp.activity_denied($q$SELECT public.change_my_activity_message(current_setting('test.mutable_id')::uuid,' ',current_setting('test.mutable_version')::timestamptz,false)$q$,'23514');
SELECT pg_temp.activity_denied($q$SELECT public.change_my_activity_message(current_setting('test.mutable_id')::uuid,'Changed',NULL,false)$q$,'23514');
SELECT pg_temp.activity_denied($q$UPDATE public.activity_messages SET content='Direct write'$q$,'42501');
SELECT set_config('test.mutable_edited',public.change_my_activity_message(current_setting('test.mutable_id')::uuid,'Edited own text',
 current_setting('test.mutable_version')::timestamptz,false)::text,true);
SELECT pg_temp.activity_assert(current_setting('test.mutable_edited')::jsonb->>'content'='Edited own text'
 AND current_setting('test.mutable_edited')::jsonb->>'edited_at' IS NOT NULL,'author edits and server records edit timestamp');
SELECT pg_temp.activity_assert(public.change_my_activity_message(current_setting('test.mutable_id')::uuid,'Edited own text',
 current_setting('test.mutable_version')::timestamptz,false)=current_setting('test.mutable_edited')::jsonb,'uncertain edit retry is stable');
SELECT pg_temp.activity_denied($q$SELECT public.change_my_activity_message(current_setting('test.mutable_id')::uuid,'Another edit',current_setting('test.mutable_version')::timestamptz,false)$q$,'40001');
SELECT pg_temp.activity_denied($q$SELECT public.change_my_activity_message(current_setting('test.mutable_id')::uuid,NULL,current_setting('test.mutable_version')::timestamptz,true)$q$,'40001');
SELECT pg_temp.activity_assert(public.get_activity_message_updates('00000000-0000-0000-0000-000000000201',
 ARRAY[current_setting('test.mutable_id')::uuid])->0->>'content'='Edited own text','loaded-message refresh returns edits outside cursor movement');
SELECT pg_temp.activity_assert(public.get_activity_message_updates('00000000-0000-0000-0000-000000000201',
 ARRAY[current_setting('test.mutable_id')::uuid])->0 ? 'client_nonce'=false,'updates omit sender retry ID');
SELECT pg_temp.activity_denied($q$SELECT public.get_activity_message_updates('00000000-0000-0000-0000-000000000201',NULL)$q$,'23514');

-- Even managers and admins cannot edit/delete someone else's messages.
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
SELECT pg_temp.activity_denied($q$SELECT public.change_my_activity_message(current_setting('test.mutable_id')::uuid,'Owner override',
 (current_setting('test.mutable_edited')::jsonb->>'updated_at')::timestamptz,false)$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000001');
SELECT pg_temp.activity_denied($q$SELECT public.change_my_activity_message(current_setting('test.mutable_id')::uuid,NULL,
 (current_setting('test.mutable_edited')::jsonb->>'updated_at')::timestamptz,true)$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000102');
SELECT pg_temp.activity_denied($q$SELECT public.get_activity_message_updates('00000000-0000-0000-0000-000000000201',
 ARRAY[current_setting('test.mutable_id')::uuid])$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000005');
SELECT pg_temp.activity_assert((SELECT count(*)=0 FROM public.activity_messages),'outside admin cannot receive table events under RLS');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000007');
SELECT pg_temp.activity_assert((SELECT count(*)=0 FROM public.activity_messages),'unverified account cannot receive table events under RLS');

SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000103');
SELECT set_config('test.mutable_deleted',public.change_my_activity_message(current_setting('test.mutable_id')::uuid,NULL,
 (current_setting('test.mutable_edited')::jsonb->>'updated_at')::timestamptz,true)::text,true);
SELECT pg_temp.activity_assert(current_setting('test.mutable_deleted')::jsonb->>'content'=''
 AND current_setting('test.mutable_deleted')::jsonb->>'deleted_at' IS NOT NULL,'delete removes body and leaves marker');
SELECT pg_temp.activity_assert(public.change_my_activity_message(current_setting('test.mutable_id')::uuid,NULL,
 (current_setting('test.mutable_edited')::jsonb->>'updated_at')::timestamptz,true)=current_setting('test.mutable_deleted')::jsonb,'delete retry is stable');
SELECT pg_temp.activity_denied($q$SELECT public.change_my_activity_message(current_setting('test.mutable_id')::uuid,'Restore deleted text',
 (current_setting('test.mutable_deleted')::jsonb->>'updated_at')::timestamptz,false)$q$,'40001');
SELECT pg_temp.activity_assert(public.get_activity_message_updates('00000000-0000-0000-0000-000000000201',
 ARRAY[current_setting('test.mutable_id')::uuid])->0->>'content'='','other members fetch tombstones, not removed text');

SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
UPDATE public.applications SET status='Rejected' WHERE id='00000000-0000-0000-0000-000000000301';
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000103');
SELECT pg_temp.activity_denied($q$SELECT public.change_my_activity_message(current_setting('test.mutable_id')::uuid,NULL,
 (current_setting('test.mutable_deleted')::jsonb->>'updated_at')::timestamptz,true)$q$,'42501');
SELECT pg_temp.activity_denied($q$SELECT public.get_activity_message_updates('00000000-0000-0000-0000-000000000201',
 ARRAY[current_setting('test.mutable_id')::uuid])$q$,'42501');
SELECT pg_temp.activity_assert((SELECT count(*)=0 FROM public.activity_messages),'revoked user has no event-readable rows');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
UPDATE public.applications SET status='Accepted' WHERE id='00000000-0000-0000-0000-000000000301';
SELECT pg_temp.activity_assert(EXISTS(SELECT 1 FROM pg_publication_tables
 WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='activity_messages'),'message table published');
SET LOCAL ROLE anon;
SELECT pg_temp.activity_denied($q$SELECT public.get_activity_message_updates('00000000-0000-0000-0000-000000000201',ARRAY[]::uuid[])$q$,'42501');
SET LOCAL ROLE authenticated;
