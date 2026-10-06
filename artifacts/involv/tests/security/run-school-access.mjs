// Run the actual migrations and RLS checks in an isolated, temporary PostgreSQL
// cluster. No Supabase credentials, remote database, or workspace data are used.
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
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
  sql(migration);
  sql(readFileSync(join(root, 'tests/security/school-access.sql'), 'utf8'));
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
  console.log('PASS: admin preflight and rollback, exact verified school membership, signup hook, default student roles, identity protection, approval/revocation, ownership, audit, and public browsing.');
} finally {
  if (started) run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
  rmSync(tmp, { recursive: true, force: true });
}
