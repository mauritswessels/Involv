-- Injected into the real Activity Hub/participation fixture transaction.
RESET ROLE;
INSERT INTO public.opportunities(id,organizer_id,title,category,application_deadline,status) VALUES
 ('00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000101','Portfolio closed history','School-Based Service','2030-01-01','closed'),
 ('00000000-0000-0000-0000-000000000204','00000000-0000-0000-0000-000000000101','Portfolio other contribution','School-Based Service','2030-01-01','active');
INSERT INTO public.applications(opportunity_id,applicant_id,organizer_id,status) VALUES
 ('00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000101','Rejected'),
 ('00000000-0000-0000-0000-000000000204','00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000101','Rejected');
INSERT INTO public.activity_hours(id,opportunity_id,student_id,student_name,service_date,hours,description,status,reviewed_by,reviewer_name,review_note,reviewed_at) VALUES
 ('00000000-0000-0000-0000-000000000701','00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000103','Accepted participant',current_date-10,2.75,'Own historical contribution','approved','00000000-0000-0000-0000-000000000101','Activity owner','Confirmed contribution',now()),
 ('00000000-0000-0000-0000-000000000702','00000000-0000-0000-0000-000000000204','00000000-0000-0000-0000-000000000103','Accepted participant',current_date-11,1.5,'Second activity contribution','approved','00000000-0000-0000-0000-000000000101','Activity owner','',now()),
 ('00000000-0000-0000-0000-000000000703','00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000103','Accepted participant',current_date-12,4.5,'Pending is not credit','pending',NULL,'','',NULL),
 ('00000000-0000-0000-0000-000000000704','00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000103','Accepted participant',current_date-13,8,'Rejected is not credit','rejected','00000000-0000-0000-0000-000000000101','Activity owner','Please clarify the contribution',now()),
 ('00000000-0000-0000-0000-000000000705','00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000104','Other participant',current_date-14,9.99,'Another student private contribution','approved','00000000-0000-0000-0000-000000000101','Activity owner','Private other student review',now());
SELECT set_config('test.portfolio_expected',
 jsonb_build_object(
  'approved', (SELECT sum(hours) FROM public.activity_hours WHERE student_id='00000000-0000-0000-0000-000000000103' AND status='approved'),
  'pending', (SELECT sum(hours) FROM public.activity_hours WHERE student_id='00000000-0000-0000-0000-000000000103' AND status='pending'),
  'rejected', (SELECT sum(hours) FROM public.activity_hours WHERE student_id='00000000-0000-0000-0000-000000000103' AND status='rejected'),
  'count', (SELECT count(*) FROM public.activity_hours WHERE student_id='00000000-0000-0000-0000-000000000103'),
  'activities', (SELECT count(DISTINCT opportunity_id) FROM public.activity_hours WHERE student_id='00000000-0000-0000-0000-000000000103' AND status='approved')
 )::text,true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000103');
DO $$ DECLARE portfolio jsonb; expected jsonb; entry jsonb;
BEGIN
 portfolio := public.get_my_service_portfolio();
 expected := current_setting('test.portfolio_expected')::jsonb;
 PERFORM pg_temp.activity_assert(portfolio->'approved_hours'=expected->'approved','approved-only own total');
 PERFORM pg_temp.activity_assert(portfolio->'pending_hours'=expected->'pending','pending total separate');
 PERFORM pg_temp.activity_assert(portfolio->'rejected_hours'=expected->'rejected','rejected total separate');
 PERFORM pg_temp.activity_assert(portfolio->'approved_activities'=expected->'activities','distinct approved activities only');
 PERFORM pg_temp.activity_assert(jsonb_array_length(portfolio->'entries')=(expected->>'count')::int,'only complete own ledger');
 SELECT e INTO entry FROM jsonb_array_elements(portfolio->'entries') e WHERE e->>'id'='00000000-0000-0000-0000-000000000701';
 PERFORM pg_temp.activity_assert(entry->>'activity_status'='closed' AND entry->>'activity_title'='Portfolio closed history','historical activity metadata');
 PERFORM pg_temp.activity_assert(entry->>'reviewer_name'='Activity owner' AND entry->>'review_note'='Confirmed contribution'
  AND entry->>'reviewed_at' IS NOT NULL AND entry->>'service_date'=(current_date-10)::text,'dated reviewer metadata');
 PERFORM pg_temp.activity_assert(NOT (entry ? 'student_id') AND NOT (entry ? 'reviewed_by')
  AND NOT (entry ? 'email') AND NOT (entry ? 'participants'),'narrow projected fields only');
 PERFORM pg_temp.activity_assert(position('Another student private' IN portfolio::text)=0
  AND position('00000000-0000-0000-0000-000000000705' IN portfolio::text)=0,'no other student leakage');
END; $$;
SELECT pg_temp.activity_assert(NOT public.can_read_activity('00000000-0000-0000-0000-000000000203'),'historical access does not restore membership');
SELECT pg_temp.activity_denied($q$SELECT public.get_activity_hub('00000000-0000-0000-0000-000000000203')$q$,'42501');
SELECT pg_temp.activity_denied($q$SELECT public.get_activity_participation('00000000-0000-0000-0000-000000000203')$q$,'42501');
SELECT pg_temp.activity_assert((SELECT count(*)=0 FROM public.activity_hours WHERE opportunity_id='00000000-0000-0000-0000-000000000203'),'historical table RLS is not widened');
SELECT pg_temp.activity_denied($q$SELECT public.get_my_service_portfolio('00000000-0000-0000-0000-000000000104'::uuid)$q$,'42883');
SELECT pg_temp.activity_denied($q$UPDATE public.activity_hours SET hours=20 WHERE id='00000000-0000-0000-0000-000000000701'$q$,'42501');
SELECT pg_temp.activity_denied($q$SELECT public.withdraw_activity_hours('00000000-0000-0000-0000-000000000701',now())$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000104');
SELECT pg_temp.activity_assert(public.get_my_service_portfolio()->>'approved_hours'='9.99','second student gets only own total');
SELECT pg_temp.activity_assert(jsonb_array_length(public.get_my_service_portfolio()->'entries')=1,'second student only own ledger');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000102');
SELECT pg_temp.activity_assert(jsonb_array_length(public.get_my_service_portfolio()->'entries')=0,'unrelated privileged user cannot read students ledger');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000109');
SELECT pg_temp.activity_assert(public.get_my_service_portfolio()->>'approved_hours'='0'
 AND public.get_my_service_portfolio()->>'approved_activities'='0'
 AND jsonb_array_length(public.get_my_service_portfolio()->'entries')=0,'verified new student honest empty portfolio');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000005');
SELECT pg_temp.activity_denied($q$SELECT public.get_my_service_portfolio()$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000007');
SELECT pg_temp.activity_denied($q$SELECT public.get_my_service_portfolio()$q$,'42501');
SELECT pg_temp.activity_user('');
SELECT pg_temp.activity_denied($q$SELECT public.get_my_service_portfolio()$q$,'42501');
SET LOCAL ROLE anon;
SELECT pg_temp.activity_denied($q$SELECT public.get_my_service_portfolio()$q$,'42501');
RESET ROLE;
UPDATE auth.users SET email_confirmed_at=NULL WHERE id='00000000-0000-0000-0000-000000000103';
SET LOCAL ROLE authenticated;
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000103');
SELECT pg_temp.activity_denied($q$SELECT public.get_my_service_portfolio()$q$,'42501');
RESET ROLE;
UPDATE auth.users SET email_confirmed_at=now() WHERE id='00000000-0000-0000-0000-000000000103';
SET LOCAL ROLE authenticated;
-- Leave existing fixture roles/identity unchanged for the next suite.
