// Run the actual migrations and RLS checks in an isolated, temporary PostgreSQL
// cluster. No Supabase credentials, remote database, or workspace data are used.
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { checkParticipationConcurrency } from './participation-concurrency.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const tmp = mkdtempSync(join(tmpdir(), 'involv-school-access-'));
const data = join(tmp, 'data');
const socket = join(tmp, 'socket');
mkdirSync(socket);
let started = false;
function run(command, args, input) {
  const r = spawnSync(command, args, { input, encoding: 'utf8', timeout: 60_000 });
  if (r.error || r.status !== 0) throw new Error(`${command}: ${r.error?.message || r.stderr || r.stdout}`);
  return r.stdout;
}
function sql(text) {
  return run('psql', ['-X', '-q', '-h', socket, '-p', '55439', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], text);
}
try {
  run('initdb', ['-D', data, '--auth=trust', '--username=postgres', '--no-locale']);
  run('pg_ctl', ['-D', data, '-l', join(tmp, 'postgres.log'), '-o', `-k ${socket} -p 55439 -c listen_addresses=''`, '-w', 'start']);
  started = true;
  sql(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE supabase_auth_admin;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, supabase_auth_admin;
  `);
  for (const file of [
    '20240528000001_create_profiles.sql',
    '20240528000002_create_opportunities_applications.sql',
    '20240528000004_admin_policies.sql',
    '20240528000005_site_stats_fn.sql',
    '20260923000001_launch_readiness_indexes.sql',
    '20260923000002_security_hardening.sql',
  ]) sql(readFileSync(join(root, 'supabase/migrations', file), 'utf8'));
  sql(`
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
    INSERT INTO auth.users VALUES
    ('00000000-0000-0000-0000-000000000001','admin@iszl.ch',NULL),
    ('00000000-0000-0000-0000-000000000002','student@iszl.ch',now()),
    ('00000000-0000-0000-0000-000000000003','teacher@iszl.ch',now()),
    ('00000000-0000-0000-0000-000000000004','organiser@iszl.ch',now()),
    ('00000000-0000-0000-0000-000000000005','outside@gmail.com',now()),
    ('00000000-0000-0000-0000-000000000006','new@iszl.ch',now()),
    ('00000000-0000-0000-0000-000000000007','unverified@iszl.ch',NULL);
    INSERT INTO public.profiles (id,name,email,role)
    SELECT id,'Fixture user',email,
      CASE id::text
        WHEN '00000000-0000-0000-0000-000000000001' THEN 'admin'
        WHEN '00000000-0000-0000-0000-000000000003' THEN 'teacher'
        WHEN '00000000-0000-0000-0000-000000000004' THEN 'organizer'
        WHEN '00000000-0000-0000-0000-000000000005' THEN 'admin'
        ELSE 'student'
      END
    FROM auth.users WHERE id::text < '00000000-0000-0000-0000-000000000006';
  `);
  const migration = readFileSync(join(root, 'supabase/migrations/20261006000001_school_access_trusted_roles.sql'), 'utf8');
  let blocked = false;
  try { sql(migration); } catch (e) {
    if (!e.message.includes('No verified @iszl.ch administrator exists')) throw e;
    blocked = true;
  }
  if (!blocked) throw new Error('Administrator preflight did not block an unsafe rollout.');
  const untouched = sql(`SELECT count(*) FROM public.profiles WHERE role IN ('teacher','organizer');`);
  if (!/\b2\b/.test(untouched)) throw new Error('Failed rollout changed existing roles.');
  sql(`UPDATE auth.users SET email_confirmed_at = now() WHERE id = '00000000-0000-0000-0000-000000000001';`);
  const portfolioMode = process.argv.includes('--portfolio');
  const participationMode = process.argv.includes('--participation') || portfolioMode;
  const activityMode = process.argv.includes('--activity') || participationMode;
  let activitySuite = readFileSync(join(root, 'tests/security/activity-hub.sql'), 'utf8');
  if (participationMode) {
    activitySuite = activitySuite.replace('-- Access is derived live, including for closed listings, not cached in a JWT.',
      () => readFileSync(join(root, 'tests/security/participation-checks.sql'), 'utf8')
      + (portfolioMode ? '\n' + readFileSync(join(root, 'tests/security/portfolio-checks.sql'), 'utf8') : '')
      + '\n-- Access is derived live, including for closed listings, not cached in a JWT.');
  }
  if (activityMode) {
    sql(readFileSync(join(root, 'supabase/migrations/20261009000001_activity_hub_foundation.sql'), 'utf8'));
    if (participationMode) sql(readFileSync(join(root, 'supabase/migrations/20261009000002_activity_participation.sql'), 'utf8'));
    if (portfolioMode) sql(readFileSync(join(root, 'supabase/migrations/20261011000001_student_service_portfolio.sql'), 'utf8'));
    sql(activitySuite);
  }
  sql(migration);
  sql(readFileSync(join(root, 'supabase/migrations/20261011000002_profile_read_privacy.sql'), 'utf8'));
  sql(readFileSync(join(root, 'tests/security/school-access.sql'), 'utf8'));
  if (activityMode) {
    sql(activitySuite);
    console.log('PASS: Activity Hub permissions, CRUD, constraints, identity protection and revocation, both before and after school-access migration.');
    if (participationMode) console.log('PASS: private attendance, submit/edit/withdraw/review hours, stale versions, immutable reviews, no self-review, history retention and daily caps, before and after school-access migration.');
    if (portfolioMode) console.log('PASS: own service portfolio, approved-only totals, reviewer metadata, private historical access without restored membership, no other-user access or widened table RLS, before and after school-access migration.');
  }
  // Also run the existing ownership/role suite against the new restrictions.
  sql(`
    ALTER TABLE auth.users ADD COLUMN aud text, ADD COLUMN role text,
      ADD COLUMN encrypted_password text, ADD COLUMN raw_app_meta_data jsonb,
      ADD COLUMN raw_user_meta_data jsonb, ADD COLUMN created_at timestamptz,
      ADD COLUMN updated_at timestamptz;
  `);
  sql(`\\set launch_security_test_environment staging
\\set launch_security_test_project_ref abcdefghijklmnopqrst
${readFileSync(join(root, 'supabase/tests/launch_security_checks.sql'), 'utf8')}`);
  console.log('PASS: school-access and private-profile policies, role-specific profile reads, saved-opportunity privacy, ownership, approval/revocation, audit, and public browsing.');
  if (participationMode) await checkParticipationConcurrency(sql, socket);
} finally {
  if (started) run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
  rmSync(tmp, { recursive: true, force: true });
}
