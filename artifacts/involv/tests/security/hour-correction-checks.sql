-- Runs inside the activity suite's transactional fixtures, after participation/portfolio checks.
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000103');
SELECT set_config('test.correction_total',public.get_my_service_portfolio()->>'approved_hours',true);
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
SELECT pg_temp.activity_assert((SELECT count(*)=1 FROM public.activity_hour_reviews
 WHERE entry_id=current_setting('test.hours_id')::uuid AND kind='review'),'initial approval captured exactly once');
SELECT set_config('test.correction_version',(SELECT updated_at::text FROM public.activity_hours
 WHERE id=current_setting('test.hours_id')::uuid),true);
SELECT set_config('test.correction_original',(SELECT after_state::text FROM public.activity_hour_reviews
 WHERE entry_id=current_setting('test.hours_id')::uuid AND kind='review'),true);

-- Blank reasons, zero/over-limit/precision/no-change/pending decisions are rejected.
SELECT pg_temp.activity_denied($q$SELECT public.correct_activity_hours(current_setting('test.hours_id')::uuid,2,'approved',' ',current_setting('test.correction_version')::timestamptz,gen_random_uuid())$q$,'23514');
SELECT pg_temp.activity_denied($q$SELECT public.correct_activity_hours(current_setting('test.hours_id')::uuid,2,'approved',E'\t\n',current_setting('test.correction_version')::timestamptz,gen_random_uuid())$q$,'23514');
SELECT pg_temp.activity_denied($q$SELECT public.correct_activity_hours(current_setting('test.hours_id')::uuid,0,'approved','Invalid',current_setting('test.correction_version')::timestamptz,gen_random_uuid())$q$,'23514');
SELECT pg_temp.activity_denied($q$SELECT public.correct_activity_hours(current_setting('test.hours_id')::uuid,25,'approved','Invalid',current_setting('test.correction_version')::timestamptz,gen_random_uuid())$q$,'23514');
SELECT pg_temp.activity_denied($q$SELECT public.correct_activity_hours(current_setting('test.hours_id')::uuid,2.001,'approved','Invalid',current_setting('test.correction_version')::timestamptz,gen_random_uuid())$q$,'23514');
SELECT pg_temp.activity_denied($q$SELECT public.correct_activity_hours(current_setting('test.hours_id')::uuid,2,'pending','Invalid',current_setting('test.correction_version')::timestamptz,gen_random_uuid())$q$,'23514');
SELECT pg_temp.activity_denied($q$SELECT public.correct_activity_hours(current_setting('test.hours_id')::uuid,3.25,'approved','No change',current_setting('test.correction_version')::timestamptz,gen_random_uuid())$q$,'23514');
-- Existing pending 20.75h plus reviewed 3.25h fills the daily cap.
SELECT pg_temp.activity_denied($q$SELECT public.correct_activity_hours(current_setting('test.hours_id')::uuid,4,'approved','Excess across the day',current_setting('test.correction_version')::timestamptz,gen_random_uuid())$q$,'23514');
SELECT pg_temp.activity_denied($q$UPDATE public.activity_hour_reviews SET reason='Rewrite'$q$,'42501');
SELECT pg_temp.activity_denied($q$DELETE FROM public.activity_hour_reviews$q$,'42501');
SELECT pg_temp.activity_denied($q$INSERT INTO public.activity_hour_reviews(entry_id,kind,actor_name,reason,after_state)
 VALUES(current_setting('test.hours_id')::uuid,'correction','Forged','Forged','{}')$q$,'42501');

SELECT public.correct_activity_hours(current_setting('test.hours_id')::uuid,2,'approved','Actual duration was two hours',
 current_setting('test.correction_version')::timestamptz,'00000000-0000-0000-0000-000000000901');
SELECT public.correct_activity_hours(current_setting('test.hours_id')::uuid,2,'approved','Actual duration was two hours',
 current_setting('test.correction_version')::timestamptz,'00000000-0000-0000-0000-000000000901');
SELECT pg_temp.activity_assert((SELECT count(*)=2 FROM public.activity_hour_reviews
 WHERE entry_id=current_setting('test.hours_id')::uuid),'retry does not duplicate correction history');
SELECT pg_temp.activity_assert((SELECT before_state=current_setting('test.correction_original')::jsonb
 AND after_state->>'hours'='2.00' AND actor_id=auth.uid() FROM public.activity_hour_reviews
 WHERE id='00000000-0000-0000-0000-000000000901'),'full before/after and server actor preserved');
SELECT pg_temp.activity_assert((SELECT hours=2 AND status='approved' FROM public.activity_hours
 WHERE id=current_setting('test.hours_id')::uuid),'current record is corrected');
SELECT pg_temp.activity_denied($q$SELECT public.correct_activity_hours(current_setting('test.hours_id')::uuid,1,'approved','Another stale correction',
 current_setting('test.correction_version')::timestamptz,gen_random_uuid())$q$,'40001');
SELECT pg_temp.activity_denied($q$SELECT public.correct_activity_hours(current_setting('test.hours_id')::uuid,1,'approved','Reused ID different payload',
 current_setting('test.correction_version')::timestamptz,'00000000-0000-0000-0000-000000000901')$q$,'23514');

-- Other students / unrelated managers / unverified and outside accounts cannot mutate or inspect.
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000104');
SELECT pg_temp.activity_assert((SELECT count(*)=0 FROM public.activity_hour_reviews),'peer cannot see another student history');
SELECT pg_temp.activity_denied($q$SELECT public.correct_activity_hours(current_setting('test.hours_id')::uuid,1,'approved','Peer',
 current_setting('test.correction_version')::timestamptz,gen_random_uuid())$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000102');
SELECT pg_temp.activity_assert((SELECT count(*)=0 FROM public.activity_hour_reviews),'unrelated manager cannot see history');
SELECT pg_temp.activity_denied($q$SELECT public.correct_activity_hours(current_setting('test.hours_id')::uuid,1,'approved','Unrelated',
 current_setting('test.correction_version')::timestamptz,gen_random_uuid())$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000005');
SELECT pg_temp.activity_denied($q$SELECT public.correct_activity_hours(current_setting('test.hours_id')::uuid,1,'approved','Outside',
 current_setting('test.correction_version')::timestamptz,gen_random_uuid())$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000007');
SELECT pg_temp.activity_denied($q$SELECT public.correct_activity_hours(current_setting('test.hours_id')::uuid,1,'approved','Unverified',
 current_setting('test.correction_version')::timestamptz,gen_random_uuid())$q$,'42501');

SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000103');
SELECT pg_temp.activity_assert((public.get_my_service_portfolio()->>'approved_hours')::numeric
 =current_setting('test.correction_total')::numeric-1.25,'own portfolio total reflects correction');
SELECT pg_temp.activity_assert((SELECT jsonb_array_length(e->'review_history')=2
 FROM jsonb_array_elements(public.get_my_service_portfolio()->'entries') e
 WHERE e->>'id'=current_setting('test.hours_id')),'student sees original approval and correction');
SELECT pg_temp.activity_denied($q$SELECT public.correct_activity_hours(current_setting('test.hours_id')::uuid,1,'approved','Own entry',
 current_setting('test.correction_version')::timestamptz,gen_random_uuid())$q$,'42501');

-- School admin can revoke and reinstate, with independent history each time.
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000001');
SELECT set_config('test.correction_version',(SELECT updated_at::text FROM public.activity_hours WHERE id=current_setting('test.hours_id')::uuid),true);
SELECT public.correct_activity_hours(current_setting('test.hours_id')::uuid,2,'rejected','Approval was entered against the wrong record',
 current_setting('test.correction_version')::timestamptz,'00000000-0000-0000-0000-000000000902');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000103');
SELECT pg_temp.activity_assert((public.get_my_service_portfolio()->>'approved_hours')::numeric
 =current_setting('test.correction_total')::numeric-3.25,'revoked approval gives no credit');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000001');
SELECT set_config('test.correction_version',(SELECT updated_at::text FROM public.activity_hours WHERE id=current_setting('test.hours_id')::uuid),true);
SELECT public.correct_activity_hours(current_setting('test.hours_id')::uuid,2,'approved','Evidence confirmed the correct record',
 current_setting('test.correction_version')::timestamptz,gen_random_uuid());
-- Even an admin cannot correct their own claim.
RESET ROLE;
UPDATE public.activity_hours SET student_id='00000000-0000-0000-0000-000000000001',reviewed_by='00000000-0000-0000-0000-000000000101'
 WHERE id=current_setting('test.hours_id')::uuid;
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000001');
SELECT pg_temp.activity_denied($q$SELECT public.correct_activity_hours(current_setting('test.hours_id')::uuid,1,'approved','Own admin claim',
 current_setting('test.correction_version')::timestamptz,gen_random_uuid())$q$,'42501');
RESET ROLE;
UPDATE public.activity_hours SET student_id='00000000-0000-0000-0000-000000000103' WHERE id=current_setting('test.hours_id')::uuid;
SET LOCAL ROLE authenticated;
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
UPDATE public.applications SET status='Rejected' WHERE applicant_id='00000000-0000-0000-0000-000000000103'
 AND opportunity_id='00000000-0000-0000-0000-000000000201';
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000103');
SELECT pg_temp.activity_assert((SELECT jsonb_array_length(e->'review_history')=4
 FROM jsonb_array_elements(public.get_my_service_portfolio()->'entries') e WHERE e->>'id'=current_setting('test.hours_id')),
 'personal review history survives membership ending');
SELECT pg_temp.activity_denied($q$SELECT public.get_activity_participation('00000000-0000-0000-0000-000000000201')$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
UPDATE public.applications SET status='Accepted' WHERE applicant_id='00000000-0000-0000-0000-000000000103'
 AND opportunity_id='00000000-0000-0000-0000-000000000201';
