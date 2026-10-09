-- Transactional fixtures, run against the disposable local PostgreSQL cluster.
BEGIN;
CREATE FUNCTION pg_temp.activity_assert(ok boolean, label text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF; END; $$;
CREATE FUNCTION pg_temp.activity_denied(statement text, expected_state text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = expected_state THEN RETURN; END IF;
    RAISE EXCEPTION 'Expected %, got %: %', expected_state, SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'Unexpected success: %', statement;
END;
$$;
CREATE FUNCTION pg_temp.activity_user(id text) RETURNS void LANGUAGE sql
AS $$ SELECT set_config('request.jwt.claim.sub', id, true)::void; $$;

-- Fixture identities are real verified school users; profile inserts follow
-- the own-profile/student contract even when the school migration is enabled.
INSERT INTO auth.users (id,email,email_confirmed_at) VALUES
 ('00000000-0000-0000-0000-000000000101','activity-owner@iszl.ch',now()),
 ('00000000-0000-0000-0000-000000000102','activity-other@iszl.ch',now()),
 ('00000000-0000-0000-0000-000000000103','activity-accepted@iszl.ch',now()),
 ('00000000-0000-0000-0000-000000000104','activity-pending@iszl.ch',now()),
 ('00000000-0000-0000-0000-000000000105','activity-rejected@iszl.ch',now()),
 ('00000000-0000-0000-0000-000000000109','activity-new@iszl.ch',now());
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
INSERT INTO public.profiles(id,email,name) VALUES(auth.uid(),'activity-owner@iszl.ch','Activity owner');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000102');
INSERT INTO public.profiles(id,email,name) VALUES(auth.uid(),'activity-other@iszl.ch','Other manager');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000103');
INSERT INTO public.profiles(id,email,name) VALUES(auth.uid(),'activity-accepted@iszl.ch','Accepted participant');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000104');
INSERT INTO public.profiles(id,email,name) VALUES(auth.uid(),'activity-pending@iszl.ch','Pending participant');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000105');
INSERT INTO public.profiles(id,email,name) VALUES(auth.uid(),'activity-rejected@iszl.ch','Rejected participant');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000001');
UPDATE public.profiles SET role='teacher' WHERE id='00000000-0000-0000-0000-000000000101';
UPDATE public.profiles SET role='organizer' WHERE id='00000000-0000-0000-0000-000000000102';
INSERT INTO public.opportunities(id,organizer_id,title,category,application_deadline) VALUES
 ('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000101','Activity fixture','School-Based Service','2030-01-01'),
 ('00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000102','Other activity','School-Based Service','2030-01-01');
INSERT INTO public.applications(id,opportunity_id,applicant_id,organizer_id,status) VALUES
 ('00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000101','Pending'),
 ('00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000104','00000000-0000-0000-0000-000000000101','Pending'),
 ('00000000-0000-0000-0000-000000000303','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000105','00000000-0000-0000-0000-000000000101','Pending');
SET LOCAL ROLE authenticated;
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000109');
SELECT pg_temp.activity_denied($q$INSERT INTO public.profiles(id,email,name,role) VALUES(auth.uid(),'activity-new@iszl.ch','New user','teacher')$q$,'42501');
INSERT INTO public.profiles(id,email,name) VALUES(auth.uid(),'activity-new@iszl.ch','New student');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
UPDATE public.applications SET status='Accepted' WHERE id='00000000-0000-0000-0000-000000000301';
UPDATE public.applications SET status='Rejected' WHERE id='00000000-0000-0000-0000-000000000303';
SELECT pg_temp.activity_assert(public.can_manage_activity('00000000-0000-0000-0000-000000000201'),'owner can manage');
INSERT INTO public.activity_announcements(id,opportunity_id,title,body,author_id,author_name,author_role,created_at)
VALUES('00000000-0000-0000-0000-000000000401','00000000-0000-0000-0000-000000000201','Fixture update','Bring notebooks',
 '00000000-0000-0000-0000-000000000001','Forged admin','admin','2000-01-01');
SELECT pg_temp.activity_assert((SELECT author_id=auth.uid() AND author_name='Activity owner' AND author_role='teacher'
 AND created_at > '2020-01-01' FROM public.activity_announcements),'server derives authorship and timestamp');
INSERT INTO public.activity_sessions(id,opportunity_id,title,session_date,start_time,end_time,location,created_by)
VALUES('00000000-0000-0000-0000-000000000501','00000000-0000-0000-0000-000000000201','Fixture session','2030-01-02','15:30','17:00','Room A',
 '00000000-0000-0000-0000-000000000001');
SELECT pg_temp.activity_assert((SELECT created_by=auth.uid() FROM public.activity_sessions),'server derives session creator');
UPDATE public.activity_announcements SET title='Edited update',pinned=true WHERE id='00000000-0000-0000-0000-000000000401';
UPDATE public.activity_sessions SET location='Room B',notes='Updated notes' WHERE id='00000000-0000-0000-0000-000000000501';
SELECT pg_temp.activity_assert((SELECT pinned AND title='Edited update' FROM public.activity_announcements),'edit/pin persists');
SELECT pg_temp.activity_assert((SELECT location='Room B' AND notes='Updated notes' FROM public.activity_sessions),'session edit persists');
SELECT pg_temp.activity_denied($q$UPDATE public.activity_announcements SET author_name='Forged' WHERE id='00000000-0000-0000-0000-000000000401'$q$,'42501');
SELECT pg_temp.activity_denied($q$UPDATE public.activity_announcements SET opportunity_id='00000000-0000-0000-0000-000000000202' WHERE id='00000000-0000-0000-0000-000000000401'$q$,'42501');
SELECT pg_temp.activity_denied($q$UPDATE public.activity_sessions SET created_by='00000000-0000-0000-0000-000000000001' WHERE id='00000000-0000-0000-0000-000000000501'$q$,'42501');
SELECT pg_temp.activity_denied($q$UPDATE public.activity_sessions SET end_time='15:00' WHERE id='00000000-0000-0000-0000-000000000501'$q$,'23514');
SELECT pg_temp.activity_denied($q$UPDATE public.activity_announcements SET title='   ' WHERE id='00000000-0000-0000-0000-000000000401'$q$,'23514');
SELECT pg_temp.activity_denied($q$UPDATE public.activity_sessions SET location=' ' WHERE id='00000000-0000-0000-0000-000000000501'$q$,'23514');

SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000103');
SELECT pg_temp.activity_assert((SELECT count(*)=1 FROM public.activity_announcements),'accepted student can read');
SELECT pg_temp.activity_assert((SELECT count(*)=1 FROM public.activity_sessions),'accepted student reads schedule');
DO $$ DECLARE hub jsonb; affected integer;
BEGIN
  hub := public.get_activity_hub('00000000-0000-0000-0000-000000000201');
  PERFORM pg_temp.activity_assert(hub->>'can_manage'='false' AND jsonb_array_length(hub->'participants')=1,'real accepted roster, read-only');
  PERFORM pg_temp.activity_assert(NOT ((hub->'participants'->0) ? 'email') AND NOT ((hub->'participants'->0) ? 'motivation'),'roster privacy');
  UPDATE public.activity_announcements SET body='Student write';
  GET DIAGNOSTICS affected=ROW_COUNT;
  PERFORM pg_temp.activity_assert(affected=0,'student cannot edit');
  DELETE FROM public.activity_sessions;
  GET DIAGNOSTICS affected=ROW_COUNT;
  PERFORM pg_temp.activity_assert(affected=0,'student cannot delete');
END; $$;
SELECT pg_temp.activity_denied($q$INSERT INTO public.activity_announcements(opportunity_id,title,body) VALUES('00000000-0000-0000-0000-000000000201','Bad','Student write')$q$,'42501');
SELECT pg_temp.activity_denied($q$UPDATE public.profiles SET role='teacher' WHERE id=auth.uid()$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000104');
SELECT pg_temp.activity_assert((SELECT count(*)=0 FROM public.activity_sessions),'pending applicant denied');
SELECT pg_temp.activity_denied($q$SELECT public.get_activity_hub('00000000-0000-0000-0000-000000000201')$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000105');
SELECT pg_temp.activity_denied($q$SELECT public.get_activity_hub('00000000-0000-0000-0000-000000000201')$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000102');
SELECT pg_temp.activity_assert((SELECT count(*)=0 FROM public.activity_announcements),'unrelated manager denied');
SELECT pg_temp.activity_denied($q$SELECT public.get_activity_hub('00000000-0000-0000-0000-000000000201')$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000005');
SELECT pg_temp.activity_assert(NOT public.can_manage_activity('00000000-0000-0000-0000-000000000201'),'outside legacy admin denied');
SELECT pg_temp.activity_denied($q$SELECT public.get_activity_hub('00000000-0000-0000-0000-000000000201')$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000007');
SELECT pg_temp.activity_denied($q$SELECT public.get_activity_hub('00000000-0000-0000-0000-000000000201')$q$,'42501');

-- Access is derived live, including for closed listings, not cached in a JWT.
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
UPDATE public.opportunities SET status='closed' WHERE id='00000000-0000-0000-0000-000000000201';
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000103');
SELECT pg_temp.activity_assert(public.get_activity_hub('00000000-0000-0000-0000-000000000201')->'opportunity'->>'status'='closed','participant can read closed activity history');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
UPDATE public.applications SET status='Rejected' WHERE id='00000000-0000-0000-0000-000000000301';
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000103');
SELECT pg_temp.activity_assert((SELECT count(*)=0 FROM public.activity_announcements),'revoked participant loses access immediately');

SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000001');
SELECT pg_temp.activity_assert(public.get_activity_hub('00000000-0000-0000-0000-000000000201')->>'can_manage'='true','school admin can manage');
UPDATE public.profiles SET role='student' WHERE id='00000000-0000-0000-0000-000000000101';
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000101');
SELECT pg_temp.activity_assert(NOT public.can_manage_activity('00000000-0000-0000-0000-000000000201'),'revoked manager loses authority');
SELECT pg_temp.activity_denied($q$INSERT INTO public.activity_sessions(opportunity_id,title,session_date,start_time,end_time,location) VALUES('00000000-0000-0000-0000-000000000201','Bad','2030-01-03','12:00','13:00','Room')$q$,'42501');
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000001');
DELETE FROM public.activity_announcements WHERE id='00000000-0000-0000-0000-000000000401';
DELETE FROM public.activity_sessions WHERE id='00000000-0000-0000-0000-000000000501';
SELECT pg_temp.activity_assert((SELECT count(*)=0 FROM public.activity_announcements),'manager delete persists');
SELECT pg_temp.activity_assert((SELECT count(*)=0 FROM public.activity_sessions),'session delete persists');
SET LOCAL ROLE anon;
SELECT pg_temp.activity_denied($q$SELECT * FROM public.activity_announcements$q$,'42501');
SELECT pg_temp.activity_denied($q$SELECT public.get_activity_hub('00000000-0000-0000-0000-000000000201')$q$,'42501');
RESET ROLE;
SELECT pg_temp.activity_user('00000000-0000-0000-0000-000000000001');
INSERT INTO public.activity_announcements(opportunity_id,title,body)
VALUES('00000000-0000-0000-0000-000000000201','Retained history','Admin-authored history');
INSERT INTO public.activity_sessions(opportunity_id,title,session_date,start_time,end_time,location)
VALUES('00000000-0000-0000-0000-000000000201','History','2030-01-02','15:30','17:00','Room');
DELETE FROM auth.users WHERE id='00000000-0000-0000-0000-000000000001';
SELECT pg_temp.activity_assert((SELECT author_id IS NULL FROM public.activity_announcements),'FK cleanup does not block account deletion');
SELECT pg_temp.activity_assert((SELECT created_by IS NULL FROM public.activity_sessions),'session FK cleanup succeeds');
ROLLBACK;
