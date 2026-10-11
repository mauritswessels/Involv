-- Injected into the Activity Hub transactional fixtures.
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000103');
SELECT set_config('test.chat_nonce',gen_random_uuid()::text,true);
SELECT set_config('test.chat_first',public.send_activity_message(
  '00000000-0000-0000-0000-000000000201','  Hello group  ',current_setting('test.chat_nonce')::uuid)::text,true);
SELECT pg_temp.activity_assert(current_setting('test.chat_first')::jsonb->>'sender_id'=auth.uid()::text
  AND current_setting('test.chat_first')::jsonb->>'sender_name'='Accepted participant'
  AND current_setting('test.chat_first')::jsonb->>'sender_role'='student'
  AND current_setting('test.chat_first')::jsonb->>'content'='Hello group'
  AND NOT (current_setting('test.chat_first')::jsonb ? 'client_nonce'),'server-owned sender and trimmed message');
SELECT pg_temp.activity_assert(public.send_activity_message(
  '00000000-0000-0000-0000-000000000201','Hello group',current_setting('test.chat_nonce')::uuid)
  =current_setting('test.chat_first')::jsonb,'retry returns original receipt');
SELECT pg_temp.activity_assert((SELECT count(*)=1 FROM public.activity_messages),'retry does not duplicate');
SELECT pg_temp.activity_denied($q$SELECT public.send_activity_message('00000000-0000-0000-0000-000000000201','Changed',current_setting('test.chat_nonce')::uuid)$q$,'23514');
SELECT pg_temp.activity_denied($q$SELECT public.send_activity_message('00000000-0000-0000-0000-000000000201',' ',gen_random_uuid())$q$,'23514');
SELECT pg_temp.activity_denied($q$SELECT public.send_activity_message('00000000-0000-0000-0000-000000000201',repeat('x',2001),gen_random_uuid())$q$,'23514');
SELECT pg_temp.activity_denied($q$UPDATE public.activity_messages SET sender_name='Forged'$q$,'42501');
SELECT pg_temp.activity_denied($q$DELETE FROM public.activity_messages$q$,'42501');
SELECT pg_temp.activity_denied($q$INSERT INTO public.activity_messages(opportunity_id,sender_id,sender_name,sender_role,content,client_nonce)
 VALUES('00000000-0000-0000-0000-000000000201',auth.uid(),'Forged','admin','Fake',gen_random_uuid())$q$,'42501');
SELECT pg_temp.activity_denied($q$SELECT public.list_activity_messages('00000000-0000-0000-0000-000000000202')$q$,'42501');

SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
SELECT public.send_activity_message('00000000-0000-0000-0000-000000000201','Owner message',gen_random_uuid());
SELECT pg_temp.activity_assert(jsonb_array_length(public.list_activity_messages('00000000-0000-0000-0000-000000000201'))=2,'owner receives persisted participant and owner messages');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000001');
SELECT public.send_activity_message('00000000-0000-0000-0000-000000000201','Admin message',gen_random_uuid());
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000102');
SELECT pg_temp.activity_denied($q$SELECT public.list_activity_messages('00000000-0000-0000-0000-000000000201')$q$,'42501');
SELECT pg_temp.activity_denied($q$SELECT public.send_activity_message('00000000-0000-0000-0000-000000000201','Unrelated manager',gen_random_uuid())$q$,'42501');
SELECT pg_temp.activity_assert((SELECT count(*)=0 FROM public.activity_messages),'unrelated manager cannot read table');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000104');
SELECT pg_temp.activity_denied($q$SELECT public.list_activity_messages('00000000-0000-0000-0000-000000000201')$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000105');
SELECT pg_temp.activity_denied($q$SELECT public.send_activity_message('00000000-0000-0000-0000-000000000201','Rejected participant',gen_random_uuid())$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000005');
SELECT pg_temp.activity_denied($q$SELECT public.list_activity_messages('00000000-0000-0000-0000-000000000201')$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000007');
SELECT pg_temp.activity_denied($q$SELECT public.list_activity_messages('00000000-0000-0000-0000-000000000201')$q$,'42501');
SET LOCAL ROLE anon;
SELECT pg_temp.activity_denied($q$SELECT public.list_activity_messages('00000000-0000-0000-0000-000000000201')$q$,'42501');
SELECT pg_temp.activity_denied($q$SELECT * FROM public.activity_messages$q$,'42501');
SET LOCAL ROLE authenticated;

SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000103');
DO $$ BEGIN
  FOR i IN 1..19 LOOP
    PERFORM public.send_activity_message('00000000-0000-0000-0000-000000000201','Rate fixture '||i,gen_random_uuid());
  END LOOP;
END $$;
SELECT pg_temp.activity_denied($q$SELECT public.send_activity_message('00000000-0000-0000-0000-000000000201','Too fast',gen_random_uuid())$q$,'P0001');
SELECT pg_temp.activity_assert(public.send_activity_message('00000000-0000-0000-0000-000000000201','Hello group',current_setting('test.chat_nonce')::uuid)=current_setting('test.chat_first')::jsonb,'retry succeeds even at rate cap');

-- Historical fixtures share a timestamp to test the ID tie-breaker.
RESET ROLE;
INSERT INTO public.activity_messages(opportunity_id,sender_id,sender_name,sender_role,content,client_nonce,created_at)
 SELECT '00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000103',
   'Accepted participant','student','History '||i,gen_random_uuid(),'2020-01-01' FROM generate_series(1,65) i;
SET LOCAL ROLE authenticated;
SELECT set_config('test.chat_page',public.list_activity_messages('00000000-0000-0000-0000-000000000201')::text,true);
SELECT pg_temp.activity_assert(jsonb_array_length(current_setting('test.chat_page')::jsonb)=50,'latest history capped to 50');
SELECT set_config('test.chat_older',public.list_activity_messages('00000000-0000-0000-0000-000000000201',
 (current_setting('test.chat_page')::jsonb->0->>'created_at')::timestamptz,
 (current_setting('test.chat_page')::jsonb->0->>'id')::uuid)::text,true);
SELECT pg_temp.activity_assert(jsonb_array_length(current_setting('test.chat_older')::jsonb)=37,'earlier page has no skipped timestamp ties');
SELECT pg_temp.activity_assert(NOT EXISTS(
 SELECT 1 FROM jsonb_array_elements(current_setting('test.chat_page')::jsonb) a,
 jsonb_array_elements(current_setting('test.chat_older')::jsonb) b WHERE a->>'id'=b->>'id'),'history pages do not overlap');
SELECT pg_temp.activity_assert(jsonb_array_length(public.list_activity_messages('00000000-0000-0000-0000-000000000201',
 (current_setting('test.chat_first')::jsonb->>'created_at')::timestamptz,
 (current_setting('test.chat_first')::jsonb->>'id')::uuid,true))=21,'forward updates include every subsequent message');

SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
UPDATE public.opportunities SET status='closed' WHERE id='00000000-0000-0000-0000-000000000201';
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000103');
SELECT pg_temp.activity_assert(jsonb_array_length(public.list_activity_messages('00000000-0000-0000-0000-000000000201'))=50,'current member retains closed chat history');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
UPDATE public.applications SET status='Rejected' WHERE id='00000000-0000-0000-0000-000000000301';
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000103');
SELECT pg_temp.activity_denied($q$SELECT public.list_activity_messages('00000000-0000-0000-0000-000000000201')$q$,'42501');
SELECT pg_temp.activity_denied($q$SELECT public.send_activity_message('00000000-0000-0000-0000-000000000201','Hello group',current_setting('test.chat_nonce')::uuid)$q$,'42501');
SELECT pg_temp.activity_assert((SELECT count(*)=0 FROM public.activity_messages),'revocation blocks table history too');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
UPDATE public.applications SET status='Accepted' WHERE id='00000000-0000-0000-0000-000000000301';
