BEGIN;
CREATE FUNCTION pg_temp.app_assert(ok boolean, label text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF; END; $$;
CREATE FUNCTION pg_temp.app_denied(statement text, expected text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE=expected THEN RETURN; END IF;
    RAISE EXCEPTION 'Expected %, got %: %', expected, SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'Unexpected success: %', statement;
END;
$$;
CREATE FUNCTION pg_temp.app_user(id text) RETURNS void LANGUAGE sql
AS $$ SELECT set_config('request.jwt.claim.sub',id,true)::void; $$;
INSERT INTO auth.users(id,email,email_confirmed_at)
SELECT ('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
  'application-'||n||'@iszl.ch',now() FROM generate_series(701,705) n;
DO $$
DECLARE u record;
BEGIN
  FOR u IN SELECT * FROM auth.users WHERE id::text BETWEEN
    '00000000-0000-0000-0000-000000000701' AND '00000000-0000-0000-0000-000000000705'
  LOOP
    PERFORM set_config('request.jwt.claim.sub',u.id::text,true);
    INSERT INTO public.profiles(id,name,email) VALUES(u.id,'Canonical student',u.email);
  END LOOP;
END;
$$;
SELECT pg_temp.app_user('00000000-0000-0000-0000-000000000001');
UPDATE public.profiles SET role='teacher' WHERE id IN
 ('00000000-0000-0000-0000-000000000701','00000000-0000-0000-0000-000000000702');
INSERT INTO public.opportunities(id,organizer_id,title,category,positions_available,application_deadline,applicants_count)
VALUES('00000000-0000-0000-0000-000000000711','00000000-0000-0000-0000-000000000701',
 'Capacity fixture','School-Based Service',1,'2035-01-01',999);
SELECT pg_temp.app_assert((SELECT applicants_count=0 FROM public.opportunities
 WHERE id='00000000-0000-0000-0000-000000000711'),'creation cannot forge the count');
CREATE FUNCTION pg_temp.app_submit() RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.applications(opportunity_id,applicant_id,organizer_id,
    applicant_name,applicant_email,opportunity_title,submitted_date,motivation,availability)
  VALUES('00000000-0000-0000-0000-000000000711',auth.uid(),'00000000-0000-0000-0000-000000000701',
    'Forged name','forged@example.com','Forged listing','2000-01-01',
    'I would like to contribute to this activity and help others.','After school');
$$;
SET LOCAL ROLE authenticated;
SELECT pg_temp.app_user('00000000-0000-0000-0000-000000000703');
SELECT pg_temp.app_submit();
SELECT pg_temp.app_assert((SELECT applicant_name='Canonical student'
 AND applicant_email='application-703@iszl.ch' AND opportunity_title='Capacity fixture'
 AND submitted_date=(clock_timestamp() AT TIME ZONE 'Europe/Zurich')::date
 FROM public.applications WHERE applicant_id=auth.uid()),'identity and school date derived on server');
SELECT pg_temp.app_denied('SELECT pg_temp.app_submit()','23505');
SELECT pg_temp.app_user('00000000-0000-0000-0000-000000000704');
SELECT pg_temp.app_denied($q$INSERT INTO public.applications(opportunity_id,applicant_id,organizer_id,status)
 VALUES('00000000-0000-0000-0000-000000000711',auth.uid(),'00000000-0000-0000-0000-000000000701','Accepted')$q$,'42501');
SELECT pg_temp.app_denied($q$INSERT INTO public.applications(opportunity_id,applicant_id,organizer_id,motivation,availability)
 VALUES('00000000-0000-0000-0000-000000000711',auth.uid(),'00000000-0000-0000-0000-000000000701','short','yes')$q$,'IV006');
SELECT pg_temp.app_denied($q$INSERT INTO public.applications(opportunity_id,applicant_id,organizer_id)
 VALUES('00000000-0000-0000-0000-000000000711','00000000-0000-0000-0000-000000000705','00000000-0000-0000-0000-000000000701')$q$,'42501');
SELECT pg_temp.app_submit();
SELECT pg_temp.app_assert((SELECT applicants_count=2 FROM public.opportunities
 WHERE id='00000000-0000-0000-0000-000000000711'),'pending applications do not consume places');
SELECT pg_temp.app_user('00000000-0000-0000-0000-000000000701');
UPDATE public.opportunities SET applicants_count=999 WHERE id='00000000-0000-0000-0000-000000000711';
SELECT pg_temp.app_assert((SELECT applicants_count=2 FROM public.opportunities
 WHERE id='00000000-0000-0000-0000-000000000711'),'owner cannot forge derived counter');
UPDATE public.applications SET status='Accepted' WHERE applicant_id='00000000-0000-0000-0000-000000000703';
UPDATE public.applications SET status='Accepted' WHERE applicant_id='00000000-0000-0000-0000-000000000703';
WITH changed AS (
 UPDATE public.applications SET status='Rejected'
 WHERE applicant_id='00000000-0000-0000-0000-000000000703' AND status='Pending' RETURNING id
) SELECT pg_temp.app_assert((SELECT count(*)=0 FROM changed),'stale decision cannot overwrite a changed status');
SELECT pg_temp.app_denied($q$UPDATE public.applications SET status='Accepted'
 WHERE applicant_id='00000000-0000-0000-0000-000000000704'$q$,'IV004');
SELECT pg_temp.app_denied($q$UPDATE public.opportunities SET positions_available=0
 WHERE id='00000000-0000-0000-0000-000000000711'$q$,'IV005');
SELECT pg_temp.app_user('00000000-0000-0000-0000-000000000705');
SELECT pg_temp.app_denied('SELECT pg_temp.app_submit()','IV003');
SELECT pg_temp.app_user('00000000-0000-0000-0000-000000000704');
DELETE FROM public.applications WHERE applicant_id=auth.uid();
SELECT pg_temp.app_assert((SELECT applicants_count=1 FROM public.opportunities
 WHERE id='00000000-0000-0000-0000-000000000711'),'withdrawal decrements count');
SELECT pg_temp.app_denied('SELECT pg_temp.app_submit()','IV003');
SELECT pg_temp.app_user('00000000-0000-0000-0000-000000000701');
UPDATE public.applications SET status='Rejected' WHERE applicant_id='00000000-0000-0000-0000-000000000703';
SELECT pg_temp.app_user('00000000-0000-0000-0000-000000000704');
SELECT pg_temp.app_submit();
SELECT pg_temp.app_assert((SELECT applicants_count=2 FROM public.opportunities
 WHERE id='00000000-0000-0000-0000-000000000711'),'withdrawn student can reapply when space exists');
SELECT pg_temp.app_user('00000000-0000-0000-0000-000000000703');
DELETE FROM public.applications WHERE applicant_id=auth.uid();
SELECT pg_temp.app_assert((SELECT count(*)=1 FROM public.applications WHERE applicant_id=auth.uid()),
 'student cannot erase a reviewed decision');
SELECT pg_temp.app_user('00000000-0000-0000-0000-000000000702');
DELETE FROM public.applications WHERE applicant_id='00000000-0000-0000-0000-000000000704';
UPDATE public.applications SET status='Accepted' WHERE applicant_id='00000000-0000-0000-0000-000000000704';
SELECT pg_temp.app_user('00000000-0000-0000-0000-000000000701');
SELECT pg_temp.app_assert((SELECT status='Pending' FROM public.applications
 WHERE applicant_id='00000000-0000-0000-0000-000000000704'),'other manager cannot delete or decide');
UPDATE public.opportunities SET status='closed' WHERE id='00000000-0000-0000-0000-000000000711';
SELECT pg_temp.app_user('00000000-0000-0000-0000-000000000705');
SELECT pg_temp.app_denied('SELECT pg_temp.app_submit()','IV001');
SELECT pg_temp.app_user('00000000-0000-0000-0000-000000000701');
UPDATE public.opportunities SET status='active',
 application_deadline=(clock_timestamp() AT TIME ZONE 'Europe/Zurich')::date-1
 WHERE id='00000000-0000-0000-0000-000000000711';
UPDATE public.applications SET status='Accepted' WHERE applicant_id='00000000-0000-0000-0000-000000000704';
UPDATE public.applications SET status='Rejected' WHERE applicant_id='00000000-0000-0000-0000-000000000704';
SELECT pg_temp.app_user('00000000-0000-0000-0000-000000000705');
SELECT pg_temp.app_denied('SELECT pg_temp.app_submit()','IV002');
SELECT pg_temp.app_user('00000000-0000-0000-0000-000000000701');
UPDATE public.opportunities SET application_deadline=(clock_timestamp() AT TIME ZONE 'Europe/Zurich')::date
 WHERE id='00000000-0000-0000-0000-000000000711';
SELECT pg_temp.app_user('00000000-0000-0000-0000-000000000705');
SELECT pg_temp.app_submit();
SELECT pg_temp.app_assert((SELECT applicants_count=3 FROM public.opportunities
 WHERE id='00000000-0000-0000-0000-000000000711'),'deadline includes today');
SELECT pg_temp.app_user('00000000-0000-0000-0000-000000000007');
SELECT pg_temp.app_denied('SELECT pg_temp.app_submit()','42501');
SELECT pg_temp.app_user('00000000-0000-0000-0000-000000000005');
SELECT pg_temp.app_denied('SELECT pg_temp.app_submit()','42501');
SELECT pg_temp.app_user('00000000-0000-0000-0000-000000000701');
UPDATE public.opportunities SET positions_available=2 WHERE id='00000000-0000-0000-0000-000000000711';
UPDATE public.applications SET status='Accepted'
 WHERE applicant_id IN ('00000000-0000-0000-0000-000000000704','00000000-0000-0000-0000-000000000705');
SELECT pg_temp.app_denied($q$UPDATE public.opportunities SET positions_available=1
 WHERE id='00000000-0000-0000-0000-000000000711'$q$,'IV005');
SELECT pg_temp.app_user('00000000-0000-0000-0000-000000000704');
DELETE FROM public.applications WHERE applicant_id=auth.uid();
SELECT pg_temp.app_assert((SELECT count(*)=1 FROM public.applications WHERE applicant_id=auth.uid()),
 'accepted application cannot be withdrawn by student');
RESET ROLE;
SELECT pg_temp.app_user('');
-- Existing parent FK cascades must still work without leaving stale totals.
DELETE FROM public.opportunities WHERE id='00000000-0000-0000-0000-000000000711';
SELECT pg_temp.app_assert((SELECT count(*)=0 FROM public.applications
 WHERE opportunity_id='00000000-0000-0000-0000-000000000711'),'parent deletion cascades');
ROLLBACK;
