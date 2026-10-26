-- Injected into the Activity Hub's disposable transactional fixtures.
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000103');
SELECT set_config('test.reflection_id',gen_random_uuid()::text,true);
SELECT set_config('test.reflection_content',repeat('learning ',29)||'service',true);
SELECT set_config('test.reflection_first',public.save_my_activity_reflection(
  '00000000-0000-0000-0000-000000000201',current_setting('test.reflection_content'),
  current_setting('test.reflection_id')::uuid)::text,true);
SELECT pg_temp.activity_assert((SELECT count(*)=1 AND bool_and(student_id=auth.uid()
 AND activity_title='Activity fixture') FROM public.activity_reflections),'server-owned reflection identity and activity title');
SELECT pg_temp.activity_assert(public.save_my_activity_reflection('00000000-0000-0000-0000-000000000201',
 current_setting('test.reflection_content'),current_setting('test.reflection_id')::uuid)
 =current_setting('test.reflection_first')::jsonb,'creation retry has original receipt');
SELECT pg_temp.activity_assert((SELECT count(*)=1 FROM public.activity_reflections),'creation retry cannot duplicate');
SELECT pg_temp.activity_assert(NOT (current_setting('test.reflection_first')::jsonb ? 'student_id'),'personal RPC omits student identity');
SELECT pg_temp.activity_assert(current_setting('test.reflection_first')::jsonb->>'created_at'
 =current_setting('test.reflection_first')::jsonb->>'updated_at','new reflection is not labeled as edited');
SELECT pg_temp.activity_denied($q$SELECT public.save_my_activity_reflection('00000000-0000-0000-0000-000000000201','Too short',gen_random_uuid())$q$,'23514');
SELECT pg_temp.activity_denied($q$SELECT public.save_my_activity_reflection('00000000-0000-0000-0000-000000000201',E'\n'||repeat('word ',29)||E'\n',gen_random_uuid())$q$,'23514');
SELECT pg_temp.activity_denied($q$SELECT public.save_my_activity_reflection('00000000-0000-0000-0000-000000000201',repeat('word ',2001),gen_random_uuid())$q$,'23514');
SELECT pg_temp.activity_denied($q$SELECT public.save_my_activity_reflection('00000000-0000-0000-0000-000000000202',current_setting('test.reflection_content'),gen_random_uuid())$q$,'42501');
SELECT pg_temp.activity_denied($q$UPDATE public.activity_reflections SET content='Forged'$q$,'42501');
SELECT pg_temp.activity_denied($q$DELETE FROM public.activity_reflections$q$,'42501');
SELECT pg_temp.activity_denied($q$INSERT INTO public.activity_reflections(id,opportunity_id,activity_title,student_id,content)
 VALUES(gen_random_uuid(),'00000000-0000-0000-0000-000000000201','Fake',auth.uid(),current_setting('test.reflection_content'))$q$,'42501');
SELECT set_config('test.reflection_updated',public.save_my_activity_reflection('00000000-0000-0000-0000-000000000201',
 current_setting('test.reflection_content')||' edited',current_setting('test.reflection_id')::uuid,
 (current_setting('test.reflection_first')::jsonb->>'updated_at')::timestamptz)::text,true);
SELECT pg_temp.activity_denied($q$SELECT public.save_my_activity_reflection('00000000-0000-0000-0000-000000000201',
 current_setting('test.reflection_content')||' stale',current_setting('test.reflection_id')::uuid,
 (current_setting('test.reflection_first')::jsonb->>'updated_at')::timestamptz)$q$,'40001');
SELECT pg_temp.activity_denied($q$SELECT public.delete_my_activity_reflection(current_setting('test.reflection_id')::uuid,
 (current_setting('test.reflection_first')::jsonb->>'updated_at')::timestamptz)$q$,'40001');
SELECT pg_temp.activity_assert(public.get_my_activity_reflections('00000000-0000-0000-0000-000000000201')->>'can_create'='true','accepted student can create');
SELECT pg_temp.activity_assert(public.get_my_activity_reflections('00000000-0000-0000-0000-000000000201')->'entries'->0
 =current_setting('test.reflection_updated')::jsonb,'fresh read returns saved edit without client state');

-- Educator read access is activity-scoped; personal history stays author-scoped.
DO $$ DECLARE identity text; BEGIN
  FOREACH identity IN ARRAY ARRAY[
    '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000105',
    '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000001'
  ] LOOP
    PERFORM pg_temp.activity_user(identity);
    IF identity IN ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000001') THEN
      PERFORM pg_temp.activity_assert((SELECT count(*)=1 FROM public.activity_reflections),'owner/admin table read allowed');
      PERFORM pg_temp.activity_assert(jsonb_array_length(public.get_managed_activity_reflections('00000000-0000-0000-0000-000000000201'))=1,'owner/admin scoped RPC read allowed');
      PERFORM pg_temp.activity_assert(public.get_managed_activity_reflections('00000000-0000-0000-0000-000000000201')->0->>'author_name'='Accepted participant','author name comes from server profile');
    ELSE
      PERFORM pg_temp.activity_assert((SELECT count(*)=0 FROM public.activity_reflections),'foreign table read denied');
      PERFORM pg_temp.activity_denied($q$SELECT public.get_managed_activity_reflections('00000000-0000-0000-0000-000000000201')$q$,'42501');
    END IF;
    PERFORM pg_temp.activity_assert(jsonb_array_length(public.get_my_activity_reflections()->'entries')=0,'foreign RPC read denied');
    PERFORM pg_temp.activity_denied($q$SELECT public.save_my_activity_reflection('00000000-0000-0000-0000-000000000201',
      current_setting('test.reflection_content'),current_setting('test.reflection_id')::uuid,
      (current_setting('test.reflection_updated')::jsonb->>'updated_at')::timestamptz)$q$,'42501');
    PERFORM pg_temp.activity_denied($q$SELECT public.delete_my_activity_reflection(current_setting('test.reflection_id')::uuid,
      (current_setting('test.reflection_updated')::jsonb->>'updated_at')::timestamptz)$q$,'42501');
    PERFORM pg_temp.activity_denied($q$SELECT public.save_my_activity_reflection('00000000-0000-0000-0000-000000000201',
      current_setting('test.reflection_content'),gen_random_uuid())$q$,'42501');
  END LOOP;
END $$;
-- Even accepted classmates cannot read each other's notes.
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
UPDATE public.applications SET status='Accepted' WHERE id='00000000-0000-0000-0000-000000000302';
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000104');
SELECT pg_temp.activity_assert((SELECT count(*)=0 FROM public.activity_reflections),'accepted classmate cannot read another student');
SELECT pg_temp.activity_denied($q$SELECT public.get_managed_activity_reflections('00000000-0000-0000-0000-000000000201')$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
UPDATE public.applications SET status='Pending' WHERE id='00000000-0000-0000-0000-000000000302';
-- Current approved role is required, not just ownership or JWT metadata.
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000001');
UPDATE public.profiles SET role='student' WHERE id='00000000-0000-0000-0000-000000000101';
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
SELECT set_config('request.jwt.claims','{"role":"admin","user_metadata":{"role":"admin"}}',true);
SELECT pg_temp.activity_assert((SELECT count(*)=0 FROM public.activity_reflections),'downgraded owner loses table read immediately');
SELECT pg_temp.activity_denied($q$SELECT public.get_managed_activity_reflections('00000000-0000-0000-0000-000000000201')$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000001');
UPDATE public.profiles SET role='teacher' WHERE id='00000000-0000-0000-0000-000000000101';
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
SELECT pg_temp.activity_denied($q$SELECT public.get_managed_activity_reflections('00000000-0000-0000-0000-000000000202')$q$,'42501');
SELECT pg_temp.activity_denied($q$SELECT public.get_managed_activity_reflections(NULL)$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000103');
SELECT pg_temp.activity_denied($q$SELECT public.save_my_activity_reflection('00000000-0000-0000-0000-000000000202',
 current_setting('test.reflection_content'),current_setting('test.reflection_id')::uuid,
 (current_setting('test.reflection_updated')::jsonb->>'updated_at')::timestamptz)$q$,'42501');
SELECT pg_temp.activity_denied($q$UPDATE public.activity_reflections SET student_id='00000000-0000-0000-0000-000000000104'$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000005');
SELECT pg_temp.activity_denied($q$SELECT public.get_my_activity_reflections()$q$,'42501');
SELECT pg_temp.activity_denied($q$SELECT public.get_managed_activity_reflections('00000000-0000-0000-0000-000000000201')$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000007');
SELECT pg_temp.activity_denied($q$SELECT public.get_my_activity_reflections()$q$,'42501');
SELECT pg_temp.activity_denied($q$SELECT public.get_managed_activity_reflections('00000000-0000-0000-0000-000000000201')$q$,'42501');
SET LOCAL ROLE anon;
SELECT pg_temp.activity_denied($q$SELECT public.get_managed_activity_reflections('00000000-0000-0000-0000-000000000201')$q$,'42501');
SELECT pg_temp.activity_denied($q$SELECT public.get_my_activity_reflections()$q$,'42501');
SELECT pg_temp.activity_denied($q$SELECT * FROM public.activity_reflections$q$,'42501');
SET LOCAL ROLE authenticated;

SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
UPDATE public.applications SET status='Rejected' WHERE id='00000000-0000-0000-0000-000000000301';
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000103');
SELECT pg_temp.activity_denied($q$SELECT public.get_activity_hub('00000000-0000-0000-0000-000000000201')$q$,'42501');
SELECT pg_temp.activity_assert(jsonb_array_length(public.get_my_activity_reflections()->'entries')=1,'own personal history survives loss of group access');
SELECT pg_temp.activity_assert(public.get_my_activity_reflections('00000000-0000-0000-0000-000000000201')->>'can_create'='false','revoked member cannot start new reflection');
SELECT pg_temp.activity_denied($q$SELECT public.save_my_activity_reflection('00000000-0000-0000-0000-000000000201',
 current_setting('test.reflection_content'),gen_random_uuid())$q$,'42501');
SELECT set_config('test.reflection_updated',public.save_my_activity_reflection('00000000-0000-0000-0000-000000000201',
 current_setting('test.reflection_content')||' personal history edit',current_setting('test.reflection_id')::uuid,
 (current_setting('test.reflection_updated')::jsonb->>'updated_at')::timestamptz)::text,true);
SELECT public.delete_my_activity_reflection(current_setting('test.reflection_id')::uuid,
 (current_setting('test.reflection_updated')::jsonb->>'updated_at')::timestamptz);
SELECT pg_temp.activity_assert((SELECT count(*)=0 FROM public.activity_reflections),'author can delete private history after leaving activity');

-- An activity deletion must not silently erase personal notes; account closure
-- remains a separate school-approved workflow.
RESET ROLE;
INSERT INTO public.opportunities(id,organizer_id,title,category,application_deadline)
 VALUES('00000000-0000-0000-0000-000000000204','00000000-0000-0000-0000-000000000101','Past reflection activity','School-Based Service','2030-01-01');
INSERT INTO public.activity_reflections(id,opportunity_id,activity_title,student_id,content,created_at)
 SELECT gen_random_uuid(),'00000000-0000-0000-0000-000000000204','Past reflection activity',
 '00000000-0000-0000-0000-000000000103',current_setting('test.reflection_content'),'2020-01-01' FROM generate_series(1,54);
DELETE FROM public.opportunities WHERE id='00000000-0000-0000-0000-000000000204';
SET LOCAL ROLE authenticated;
SELECT pg_temp.activity_assert((SELECT bool_and(opportunity_id IS NULL) FROM public.activity_reflections),'deleted activity preserves personal notes and title');
SELECT set_config('test.reflection_page', (public.get_my_activity_reflections()->'entries')::text,true);
SELECT pg_temp.activity_assert(jsonb_array_length(current_setting('test.reflection_page')::jsonb)=50,'reflection history page capped');
SELECT set_config('test.reflection_older',(public.get_my_activity_reflections(NULL,
 (current_setting('test.reflection_page')::jsonb->49->>'created_at')::timestamptz,
 (current_setting('test.reflection_page')::jsonb->49->>'id')::uuid)->'entries')::text,true);
SELECT pg_temp.activity_assert(jsonb_array_length(current_setting('test.reflection_older')::jsonb)=4,'history cursor handles timestamp ties');
SELECT pg_temp.activity_assert(NOT EXISTS(SELECT 1 FROM
 jsonb_array_elements(current_setting('test.reflection_page')::jsonb) a,
 jsonb_array_elements(current_setting('test.reflection_older')::jsonb) b WHERE a->>'id'=b->>'id'),'history pages do not overlap');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000001');
SELECT pg_temp.activity_assert((SELECT count(*)=0 FROM public.activity_reflections),'admin cannot read reflections with no remaining activity');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000103');
SELECT public.save_my_activity_reflection(NULL,current_setting('test.reflection_content')||' orphan edit',
 (current_setting('test.reflection_page')::jsonb->0->>'id')::uuid,
 (current_setting('test.reflection_page')::jsonb->0->>'updated_at')::timestamptz);
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
UPDATE public.applications SET status='Accepted' WHERE id='00000000-0000-0000-0000-000000000301';
