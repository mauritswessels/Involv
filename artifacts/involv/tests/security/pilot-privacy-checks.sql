SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
UPDATE public.applications SET status='Under Review' WHERE id='00000000-0000-0000-0000-000000000301' RETURNING id,status;
UPDATE public.applications SET status='Accepted' WHERE id='00000000-0000-0000-0000-000000000301' RETURNING id,status;
UPDATE public.opportunities SET organizer_email='private-club@invalid.example'
 WHERE id='00000000-0000-0000-0000-000000000201';
SELECT pg_temp.activity_assert(public.get_opportunity_contact('00000000-0000-0000-0000-000000000201')='private-club@invalid.example','owner reads private contact');
SELECT pg_temp.activity_denied($q$SELECT organizer_email FROM public.opportunities$q$,'42501');
SELECT pg_temp.activity_denied($q$SELECT * FROM public.opportunities$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000001');
SELECT pg_temp.activity_assert(public.get_opportunity_contact('00000000-0000-0000-0000-000000000201')='private-club@invalid.example','school admin reads management contact');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000102');
SELECT pg_temp.activity_denied($q$SELECT public.get_opportunity_contact('00000000-0000-0000-0000-000000000201')$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000103');
SELECT pg_temp.activity_denied($q$SELECT public.get_opportunity_contact('00000000-0000-0000-0000-000000000201')$q$,'42501');
SELECT pg_temp.activity_denied($q$SELECT id FROM public.opportunities WHERE organizer_email='private-club@invalid.example'$q$,'42501');
SELECT pg_temp.activity_denied($q$SELECT public.get_activity_hub_private_snapshot('00000000-0000-0000-0000-000000000201')$q$,'42501');
SELECT pg_temp.activity_assert(NOT ((public.get_activity_hub('00000000-0000-0000-0000-000000000201')->'opportunity') ? 'organizer_email'),'authorised group snapshot does not disclose private contact');
SET LOCAL ROLE anon;
SELECT pg_temp.activity_assert(EXISTS(SELECT id,title FROM public.opportunities WHERE id='00000000-0000-0000-0000-000000000201'),'public safe listing remains readable');
SELECT pg_temp.activity_denied($q$SELECT * FROM public.opportunities$q$,'42501');
SELECT pg_temp.activity_denied($q$SELECT organizer_email FROM public.opportunities$q$,'42501');
SELECT pg_temp.activity_denied($q$SELECT public.get_opportunity_contact('00000000-0000-0000-0000-000000000201')$q$,'42501');
SET LOCAL ROLE authenticated;
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000007');
SELECT pg_temp.activity_denied($q$SELECT public.get_opportunity_contact('00000000-0000-0000-0000-000000000201')$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000005');
SELECT pg_temp.activity_denied($q$SELECT public.get_opportunity_contact('00000000-0000-0000-0000-000000000201')$q$,'42501');

SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
INSERT INTO public.opportunities(id,organizer_id,title,category,application_deadline,organizer_email)
 VALUES('00000000-0000-0000-0000-000000000281',auth.uid(),'Private-contact fixture','School-Based Service','2030-01-01','original@invalid.example')
 RETURNING id,title;
UPDATE public.opportunities SET organizer_email='updated@invalid.example'
 WHERE id='00000000-0000-0000-0000-000000000281' RETURNING id;
SELECT pg_temp.activity_assert(public.get_opportunity_contact('00000000-0000-0000-0000-000000000281')='updated@invalid.example','private editing preserves read/write workflow');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000103');
INSERT INTO public.saved_opportunities(user_id,opportunity_id) VALUES(auth.uid(),'00000000-0000-0000-0000-000000000281')
 ON CONFLICT(user_id,opportunity_id) DO NOTHING;
INSERT INTO public.saved_opportunities(user_id,opportunity_id) VALUES(auth.uid(),'00000000-0000-0000-0000-000000000281')
 ON CONFLICT(user_id,opportunity_id) DO NOTHING;
SELECT pg_temp.activity_assert((SELECT count(*)=1 FROM public.saved_opportunities WHERE opportunity_id='00000000-0000-0000-0000-000000000281'),'repeated save is idempotent');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000104');
SELECT pg_temp.activity_assert((SELECT count(*)=0 FROM public.saved_opportunities WHERE opportunity_id='00000000-0000-0000-0000-000000000281'),'other student cannot read saved row');
SELECT pg_temp.activity_denied($q$INSERT INTO public.saved_opportunities(user_id,opportunity_id)
 VALUES('00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000281') ON CONFLICT(user_id,opportunity_id) DO NOTHING$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
DELETE FROM public.opportunities WHERE id='00000000-0000-0000-0000-000000000281';
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000103');
SELECT pg_temp.activity_assert((SELECT count(*)=0 FROM public.saved_opportunities WHERE opportunity_id='00000000-0000-0000-0000-000000000281'),'deleted listing removes saved row');
SELECT pg_temp.activity_assert(NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime'
 AND schemaname='public' AND tablename='opportunities'),'private opportunity data has no unused realtime stream');
SELECT pg_temp.activity_assert(EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime'
 AND schemaname='public' AND tablename='applications'),'application stream preserved');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000001');
UPDATE public.profiles SET role='student' WHERE id='00000000-0000-0000-0000-000000000101';
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
SELECT pg_temp.activity_denied($q$SELECT public.get_opportunity_contact('00000000-0000-0000-0000-000000000201')$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000001');
UPDATE public.profiles SET role='teacher' WHERE id='00000000-0000-0000-0000-000000000101';
