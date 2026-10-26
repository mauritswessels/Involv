-- Inserted into activity-hub.sql's transactional fixtures before revocations.
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
UPDATE public.activity_sessions SET session_date=(now() AT TIME ZONE 'Europe/Zurich')::date+1;
SELECT pg_temp.activity_denied($q$SELECT public.mark_activity_attendance('00000000-0000-0000-0000-000000000501','00000000-0000-0000-0000-000000000103',true)$q$,'23514');
UPDATE public.activity_sessions SET session_date=(now() AT TIME ZONE 'Europe/Zurich')::date;
SELECT public.mark_activity_attendance('00000000-0000-0000-0000-000000000501','00000000-0000-0000-0000-000000000103',true);
SELECT public.mark_activity_attendance('00000000-0000-0000-0000-000000000501','00000000-0000-0000-0000-000000000103',false);
SELECT public.mark_activity_attendance('00000000-0000-0000-0000-000000000501','00000000-0000-0000-0000-000000000103',null);
SELECT pg_temp.activity_assert((SELECT count(*)=1 AND bool_and(present IS NULL) FROM public.activity_attendance),'clear preserves one attendance record');
SELECT public.mark_activity_attendance('00000000-0000-0000-0000-000000000501','00000000-0000-0000-0000-000000000103',true);
SELECT pg_temp.activity_denied($q$SELECT public.mark_activity_attendance('00000000-0000-0000-0000-000000000501','00000000-0000-0000-0000-000000000105',true)$q$,'42501');
SELECT pg_temp.activity_denied($q$UPDATE public.activity_sessions SET session_date=session_date+1 WHERE id='00000000-0000-0000-0000-000000000501'$q$,'23514');
UPDATE public.applications SET status='Accepted' WHERE id='00000000-0000-0000-0000-000000000302';
SELECT public.mark_activity_attendance('00000000-0000-0000-0000-000000000501','00000000-0000-0000-0000-000000000104',false);

SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000103');
SELECT pg_temp.activity_assert((SELECT count(*)=1 AND bool_and(student_id=auth.uid() AND present=true) FROM public.activity_attendance),'student sees only own attendance');
SELECT pg_temp.activity_assert(jsonb_array_length(public.get_activity_participation('00000000-0000-0000-0000-000000000201')->'attendance')=1,'RPC attendance privacy');
SELECT pg_temp.activity_denied($q$SELECT public.mark_activity_attendance('00000000-0000-0000-0000-000000000501',auth.uid(),false)$q$,'42501');
SELECT set_config('test.hours_id',public.save_activity_hours('00000000-0000-0000-0000-000000000201',(now() AT TIME ZONE 'Europe/Zurich')::date,2.5,'Initial claim')::text,true);
SELECT set_config('test.hours_version',(SELECT updated_at::text FROM public.activity_hours WHERE id=current_setting('test.hours_id')::uuid),true);
SELECT pg_temp.activity_assert((SELECT student_id=auth.uid() AND status='pending' AND reviewed_at IS NULL FROM public.activity_hours),'server derives pending student submission');
SELECT public.save_activity_hours('00000000-0000-0000-0000-000000000201',(now() AT TIME ZONE 'Europe/Zurich')::date,3.25,'Edited claim',
 current_setting('test.hours_id')::uuid,current_setting('test.hours_version')::timestamptz);
SELECT pg_temp.activity_denied($q$SELECT public.save_activity_hours('00000000-0000-0000-0000-000000000201',(now() AT TIME ZONE 'Europe/Zurich')::date,4,'Stale',current_setting('test.hours_id')::uuid,current_setting('test.hours_version')::timestamptz)$q$,'40001');
SELECT set_config('test.hours_version',(SELECT updated_at::text FROM public.activity_hours WHERE id=current_setting('test.hours_id')::uuid),true);
SELECT public.withdraw_activity_hours(current_setting('test.hours_id')::uuid,current_setting('test.hours_version')::timestamptz);
SELECT pg_temp.activity_assert((SELECT count(*)=0 FROM public.activity_hours),'withdraw pending deletes only own row');
SELECT set_config('test.hours_id',public.save_activity_hours('00000000-0000-0000-0000-000000000201',(now() AT TIME ZONE 'Europe/Zurich')::date,2.5,'Claim for review')::text,true);
SELECT set_config('test.old_review_version',(SELECT updated_at::text FROM public.activity_hours WHERE id=current_setting('test.hours_id')::uuid),true);
SELECT public.save_activity_hours('00000000-0000-0000-0000-000000000201',(now() AT TIME ZONE 'Europe/Zurich')::date,3.25,'Changed before review',
 current_setting('test.hours_id')::uuid,current_setting('test.old_review_version')::timestamptz);
SELECT set_config('test.hours_version',(SELECT updated_at::text FROM public.activity_hours WHERE id=current_setting('test.hours_id')::uuid),true);
SELECT pg_temp.activity_denied($q$SELECT public.save_activity_hours('00000000-0000-0000-0000-000000000201',(now() AT TIME ZONE 'Europe/Zurich')::date+1,2,'Future')$q$,'23514');
SELECT pg_temp.activity_denied($q$SELECT public.save_activity_hours('00000000-0000-0000-0000-000000000201','-infinity'::date,2,'Non-calendar date')$q$,'23514');
SELECT pg_temp.activity_denied($q$SELECT public.save_activity_hours('00000000-0000-0000-0000-000000000201','infinity'::date,2,'Non-calendar date')$q$,'23514');
SELECT pg_temp.activity_denied($q$SELECT public.save_activity_hours('00000000-0000-0000-0000-000000000201','0001-01-01 BC'::date,2,'Unsupported calendar date')$q$,'23514');
SELECT pg_temp.activity_denied($q$SELECT public.save_activity_hours('00000000-0000-0000-0000-000000000201',(now() AT TIME ZONE 'Europe/Zurich')::date,0,'Zero')$q$,'23514');
SELECT pg_temp.activity_denied($q$SELECT public.save_activity_hours('00000000-0000-0000-0000-000000000201',(now() AT TIME ZONE 'Europe/Zurich')::date,1.234,'Precision')$q$,'23514');
SELECT pg_temp.activity_denied($q$SELECT public.save_activity_hours('00000000-0000-0000-0000-000000000201',(now() AT TIME ZONE 'Europe/Zurich')::date,1,'  ')$q$,'23514');
SELECT pg_temp.activity_denied($q$UPDATE public.activity_hours SET status='approved'$q$,'42501');
SELECT pg_temp.activity_denied($q$DELETE FROM public.activity_hours$q$,'42501');
SELECT pg_temp.activity_denied($q$INSERT INTO public.activity_hours(opportunity_id,student_id,student_name,service_date,hours,description,status) VALUES('00000000-0000-0000-0000-000000000201',auth.uid(),'Forged',current_date,1,'Fake','approved')$q$,'42501');

SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000104');
SELECT pg_temp.activity_assert((SELECT count(*)=0 FROM public.activity_hours),'second accepted participant cannot read first claim');
SELECT pg_temp.activity_assert(jsonb_array_length(public.get_activity_participation('00000000-0000-0000-0000-000000000201')->'hours')=0,'RPC hours privacy');
SELECT pg_temp.activity_denied($q$SELECT public.save_activity_hours('00000000-0000-0000-0000-000000000201',(now() AT TIME ZONE 'Europe/Zurich')::date,1,'Forged edit',current_setting('test.hours_id')::uuid,current_setting('test.hours_version')::timestamptz)$q$,'42501');
SELECT pg_temp.activity_denied($q$SELECT public.withdraw_activity_hours(current_setting('test.hours_id')::uuid,current_setting('test.hours_version')::timestamptz)$q$,'42501');
SELECT pg_temp.activity_denied($q$SELECT public.review_activity_hours(current_setting('test.hours_id')::uuid,'approved','',current_setting('test.hours_version')::timestamptz)$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000102');
SELECT pg_temp.activity_denied($q$SELECT public.get_activity_participation('00000000-0000-0000-0000-000000000201')$q$,'42501');
SELECT pg_temp.activity_denied($q$SELECT public.review_activity_hours(current_setting('test.hours_id')::uuid,'approved','',current_setting('test.hours_version')::timestamptz)$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
SELECT pg_temp.activity_assert((SELECT count(*)=2 FROM public.activity_attendance),'owner reads scoped roster attendance');
-- Session dates are directly writable by managers, but must remain displayable
-- calendar dates. Use a new session so the marked-date guard cannot mask this.
SELECT pg_temp.activity_denied($q$INSERT INTO public.activity_sessions(opportunity_id,title,session_date,start_time,end_time,location,created_by)
 VALUES('00000000-0000-0000-0000-000000000201','Invalid date','-infinity','09:00','10:00','School',auth.uid())$q$,'23514');
SELECT pg_temp.activity_denied($q$INSERT INTO public.activity_sessions(opportunity_id,title,session_date,start_time,end_time,location,created_by)
 VALUES('00000000-0000-0000-0000-000000000201','Invalid date','infinity','09:00','10:00','School',auth.uid())$q$,'23514');
SELECT pg_temp.activity_denied($q$SELECT public.review_activity_hours(current_setting('test.hours_id')::uuid,'approved','',current_setting('test.old_review_version')::timestamptz)$q$,'40001');
SELECT public.review_activity_hours(current_setting('test.hours_id')::uuid,'approved','Verified session',current_setting('test.hours_version')::timestamptz);
SELECT pg_temp.activity_assert((SELECT status='approved' AND reviewed_by=auth.uid() AND hours=3.25 FROM public.activity_hours),'approved exact reviewed amount, derived reviewer');

SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000103');
SELECT set_config('test.hours_version',(SELECT updated_at::text FROM public.activity_hours WHERE id=current_setting('test.hours_id')::uuid),true);
SELECT pg_temp.activity_denied($q$SELECT public.save_activity_hours('00000000-0000-0000-0000-000000000201',(now() AT TIME ZONE 'Europe/Zurich')::date,10,'After approval',current_setting('test.hours_id')::uuid,current_setting('test.hours_version')::timestamptz)$q$,'42501');
SELECT pg_temp.activity_denied($q$SELECT public.withdraw_activity_hours(current_setting('test.hours_id')::uuid,current_setting('test.hours_version')::timestamptz)$q$,'42501');
SELECT pg_temp.activity_denied($q$SELECT public.save_activity_hours('00000000-0000-0000-0000-000000000201',(now() AT TIME ZONE 'Europe/Zurich')::date,24,'Excess total')$q$,'23514');
SELECT public.save_activity_hours('00000000-0000-0000-0000-000000000201',(now() AT TIME ZONE 'Europe/Zurich')::date,20.75,'Daily boundary');
SELECT set_config('test.rejected_id',public.save_activity_hours('00000000-0000-0000-0000-000000000201',(now() AT TIME ZONE 'Europe/Zurich')::date-1,6,'Needs evidence')::text,true);
SELECT set_config('test.rejected_version',(SELECT updated_at::text FROM public.activity_hours WHERE id=current_setting('test.rejected_id')::uuid),true);
INSERT INTO public.applications(id,opportunity_id,applicant_id,organizer_id)
 VALUES('00000000-0000-0000-0000-000000000304','00000000-0000-0000-0000-000000000202',auth.uid(),'00000000-0000-0000-0000-000000000102');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000102');
UPDATE public.applications SET status='Accepted' WHERE id='00000000-0000-0000-0000-000000000304';
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000103');
SELECT pg_temp.activity_denied($q$SELECT public.save_activity_hours('00000000-0000-0000-0000-000000000202',(now() AT TIME ZONE 'Europe/Zurich')::date,0.25,'Cross-activity excess')$q$,'23514');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
SELECT pg_temp.activity_denied($q$SELECT public.review_activity_hours(current_setting('test.rejected_id')::uuid,'rejected','',current_setting('test.rejected_version')::timestamptz)$q$,'23514');
SELECT public.review_activity_hours(current_setting('test.rejected_id')::uuid,'rejected','Please explain the work',current_setting('test.rejected_version')::timestamptz);
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000103');
SELECT public.save_activity_hours('00000000-0000-0000-0000-000000000201',(now() AT TIME ZONE 'Europe/Zurich')::date-1,6,'New evidence, new submission');
SELECT pg_temp.activity_assert((SELECT count(*)=2 FROM public.activity_hours WHERE service_date=(now() AT TIME ZONE 'Europe/Zurich')::date-1),'resubmission retains rejection history');
SELECT pg_temp.activity_assert((SELECT sum(hours)=3.25 FROM public.activity_hours WHERE status='approved'),'only approved hours credited');

-- An accepted administrator may submit, but cannot approve their own entry.
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000001');
INSERT INTO public.applications(id,opportunity_id,applicant_id,organizer_id)
 VALUES('00000000-0000-0000-0000-000000000305','00000000-0000-0000-0000-000000000201',auth.uid(),'00000000-0000-0000-0000-000000000101');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
UPDATE public.applications SET status='Accepted' WHERE id='00000000-0000-0000-0000-000000000305';
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000001');
SELECT set_config('test.self_id',public.save_activity_hours('00000000-0000-0000-0000-000000000201',(now() AT TIME ZONE 'Europe/Zurich')::date-5,4,'Admin volunteer entry')::text,true);
SELECT set_config('test.self_version',(SELECT updated_at::text FROM public.activity_hours WHERE id=current_setting('test.self_id')::uuid),true);
SELECT pg_temp.activity_denied($q$SELECT public.review_activity_hours(current_setting('test.self_id')::uuid,'approved','Self review',current_setting('test.self_version')::timestamptz)$q$,'42501');
SELECT pg_temp.activity_denied($q$DELETE FROM public.opportunities WHERE id='00000000-0000-0000-0000-000000000201'$q$,'23503');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
UPDATE public.applications SET status='Pending' WHERE id='00000000-0000-0000-0000-000000000302';
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000104');
SELECT pg_temp.activity_denied($q$SELECT public.get_activity_participation('00000000-0000-0000-0000-000000000201')$q$,'42501');
SELECT pg_temp.activity_denied($q$SELECT public.save_activity_hours('00000000-0000-0000-0000-000000000201',(now() AT TIME ZONE 'Europe/Zurich')::date,1,'Revoked')$q$,'42501');
SELECT pg_temp.activity_assert((SELECT count(*)=0 FROM public.activity_attendance),'revoked participant loses own attendance');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000005');
SELECT pg_temp.activity_denied($q$SELECT public.get_activity_participation('00000000-0000-0000-0000-000000000201')$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000007');
SELECT pg_temp.activity_denied($q$SELECT public.get_activity_participation('00000000-0000-0000-0000-000000000201')$q$,'42501');
SET LOCAL ROLE anon;
SELECT pg_temp.activity_denied($q$SELECT * FROM public.activity_hours$q$,'42501');
SELECT pg_temp.activity_denied($q$SELECT public.get_activity_participation('00000000-0000-0000-0000-000000000201')$q$,'42501');
SET LOCAL ROLE authenticated;
