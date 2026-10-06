\set ON_ERROR_STOP on

CREATE FUNCTION pg_temp.assert_true(condition boolean, message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF condition IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %', message; END IF;
END;
$$;
CREATE FUNCTION pg_temp.expect_denied(statement text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN SQLSTATE '42501' THEN RETURN;
  END;
  RAISE EXCEPTION 'Expected authorization denial: %', statement;
END;
$$;
CREATE FUNCTION pg_temp.as_user(user_id text)
RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', user_id, false);
$$;

SELECT pg_temp.assert_true(
  (SELECT role = 'admin' FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000001'),
  'school administrator retained');
SELECT pg_temp.assert_true(
  (SELECT count(*) = 2 FROM public.profiles WHERE id IN (
    '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004'
  ) AND role = 'student'), 'existing publishers need fresh approval');
SELECT pg_temp.assert_true((SELECT count(*) = 2 FROM public.role_change_audit), 'role reset audited');
SELECT pg_temp.assert_true(NOT public.is_school_email('test@iszl.ch.evil.invalid'), 'suffix spoof blocked');
SELECT pg_temp.assert_true(NOT public.is_school_email('test@students.iszl.ch'), 'subdomain not accepted');
SELECT pg_temp.assert_true(NOT public.is_school_email('test@iszl.ch '), 'whitespace not accepted');
SELECT pg_temp.assert_true(NOT public.is_school_email(NULL), 'missing email denied');
SELECT pg_temp.assert_true(public.is_school_email('TEST@ISZL.CH'), 'case-insensitive exact domain accepted');

SET ROLE supabase_auth_admin;
SELECT pg_temp.assert_true(
  public.before_school_user_created('{"user":{"email":"school@iszl.ch"}}') = '{}'::jsonb,
  'signup hook allows school email');
SELECT pg_temp.assert_true(
  public.before_school_user_created('{"user":{"email":"personal@gmail.com","user_metadata":{"email":"fake@iszl.ch"}}}')
    -> 'error' ->> 'http_code' = '403', 'hook blocks outside email despite metadata spoof');
SELECT pg_temp.assert_true(
  public.before_school_user_created('{}') -> 'error' ->> 'http_code' = '403',
  'hook denies missing identity');
RESET ROLE;

SET ROLE authenticated;
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000005');
SELECT pg_temp.assert_true(NOT public.is_school_member(), 'outside account is not school member');
SELECT pg_temp.assert_true(NOT public.is_admin(auth.uid()), 'legacy outside admin has no privileges');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.profiles), 'outsider cannot read profiles');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.applications), 'outsider cannot read applications');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.opportunities), 'signed-in outsider cannot read platform opportunities');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.saved_opportunities), 'outsider cannot read saved records');
SELECT pg_temp.expect_denied($s$
  INSERT INTO public.profiles (id, name, email, role) VALUES
  ('00000000-0000-0000-0000-000000000005', 'Outside', 'fake@iszl.ch', 'student')
$s$);
SELECT pg_temp.expect_denied($s$
  SELECT public.before_school_user_created('{"user":{"email":"school@iszl.ch"}}')
$s$);

SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000007');
SELECT pg_temp.assert_true(NOT public.is_school_member(), 'unverified school email denied');
SELECT pg_temp.expect_denied($s$
  INSERT INTO public.profiles (id, name, email) VALUES
  ('00000000-0000-0000-0000-000000000007', 'Unverified', 'unverified@iszl.ch')
$s$);

SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000006');
SELECT pg_temp.assert_true(public.is_school_member(), 'verified school user accepted');
SELECT pg_temp.expect_denied($s$
  INSERT INTO public.profiles (id, name, email, role) VALUES
  ('00000000-0000-0000-0000-000000000006', 'New user', 'new@iszl.ch', 'teacher')
$s$);
SELECT pg_temp.expect_denied($s$
  INSERT INTO public.profiles (id, name, email, role) VALUES
  ('00000000-0000-0000-0000-000000000006', 'New user', 'new@iszl.ch', 'organizer')
$s$);
SELECT pg_temp.expect_denied($s$
  INSERT INTO public.profiles (id, name, email, role) VALUES
  ('00000000-0000-0000-0000-000000000006', 'New user', 'new@iszl.ch', 'admin')
$s$);
INSERT INTO public.profiles (id, name, email) VALUES
('00000000-0000-0000-0000-000000000006', 'New user', 'spoof@gmail.com');
SELECT pg_temp.assert_true(
  (SELECT role = 'student' AND email = 'new@iszl.ch' FROM public.profiles WHERE id = auth.uid()),
  'new account is student and email is derived from auth identity');
SELECT pg_temp.expect_denied($s$
  UPDATE public.profiles SET role = 'teacher' WHERE id = auth.uid()
$s$);
SELECT pg_temp.expect_denied($s$
  UPDATE public.profiles SET email = 'other@iszl.ch' WHERE id = auth.uid()
$s$);
SELECT pg_temp.expect_denied($s$
  INSERT INTO public.opportunities (organizer_id, title, category, application_deadline)
  VALUES (auth.uid(), 'Student cannot publish', 'Community service', '2099-12-31')
$s$);
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.role_change_audit), 'student cannot read audit');

SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000001');
UPDATE public.profiles SET role = 'teacher' WHERE id = '00000000-0000-0000-0000-000000000003';
UPDATE public.profiles SET role = 'organizer' WHERE id = '00000000-0000-0000-0000-000000000004';
SELECT pg_temp.assert_true(
  (SELECT role = 'teacher' FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000003'),
  'admin can approve teacher without recursive RLS');
SELECT pg_temp.expect_denied($s$
  UPDATE public.profiles SET role = 'student' WHERE id = auth.uid()
$s$);
SELECT pg_temp.assert_true((SELECT count(*) = 4 FROM public.role_change_audit), 'approvals audited');
SELECT pg_temp.expect_denied($s$
  INSERT INTO public.role_change_audit (target_user_id, old_role, new_role, reason)
  VALUES (auth.uid(), 'student', 'admin', 'forged')
$s$);

SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000003');
INSERT INTO public.opportunities (id, organizer_id, title, category, application_deadline, status)
VALUES ('00000000-0000-0000-0000-000000000020', auth.uid(), 'Approved teacher', 'Community service', '2099-12-31', 'active');
SELECT pg_temp.expect_denied($s$
  INSERT INTO public.opportunities (organizer_id, title, category, application_deadline)
  VALUES ('00000000-0000-0000-0000-000000000004', 'Forged owner', 'Community service', '2099-12-31')
$s$);

SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000004');
INSERT INTO public.opportunities (id, organizer_id, title, category, application_deadline, status)
VALUES ('00000000-0000-0000-0000-000000000021', auth.uid(), 'Approved organiser', 'Community service', '2099-12-31', 'active');

SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000002');
INSERT INTO public.applications (id, opportunity_id, applicant_id, organizer_id)
VALUES ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000021',
auth.uid(), '00000000-0000-0000-0000-000000000004');
INSERT INTO public.saved_opportunities (user_id, opportunity_id)
VALUES (auth.uid(), '00000000-0000-0000-0000-000000000021');
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM public.saved_opportunities), 'school student can save');

SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000004');
UPDATE public.applications SET status = 'Accepted' WHERE id = '00000000-0000-0000-0000-000000000030';
SELECT pg_temp.assert_true((SELECT status = 'Accepted' FROM public.applications WHERE id = '00000000-0000-0000-0000-000000000030'), 'approved organiser manages application');

SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000001');
UPDATE public.profiles SET role = 'student' WHERE id = '00000000-0000-0000-0000-000000000004';
SELECT pg_temp.as_user('00000000-0000-0000-0000-000000000004');
SELECT pg_temp.assert_true(NOT public.can_publish_opportunities(), 'revocation takes effect without new JWT');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.applications), 'revoked organiser cannot read applicant data');
DO $$ DECLARE affected integer; BEGIN
  UPDATE public.opportunities SET title = 'Revoked edit' WHERE id = '00000000-0000-0000-0000-000000000021';
  GET DIAGNOSTICS affected = ROW_COUNT;
  PERFORM pg_temp.assert_true(affected = 0, 'revoked organiser cannot edit existing opportunity');
  UPDATE public.applications SET status = 'Rejected' WHERE id = '00000000-0000-0000-0000-000000000030';
  GET DIAGNOSTICS affected = ROW_COUNT;
  PERFORM pg_temp.assert_true(affected = 0, 'revoked organiser cannot manage application');
END; $$;
RESET ROLE;

SET ROLE anon;
SELECT pg_temp.as_user('');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.profiles), 'anonymous cannot read profiles');
SELECT pg_temp.assert_true((SELECT count(*) = 2 FROM public.opportunities), 'public active browse preserved');
RESET ROLE;
