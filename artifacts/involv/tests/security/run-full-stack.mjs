// Apply EVERY migration in filename order to a disposable local PostgreSQL
// cluster (the same order a hosted Supabase project receives them), then run
// the notification, message-report and privacy-request checks.
// No Supabase credentials or remote database are used.
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const tmp = mkdtempSync(join(tmpdir(), 'involv-full-stack-'));
const data = join(tmp, 'data');
const socket = join(tmp, 'socket');
mkdirSync(socket);
let started = false;
function run(command, args, input) {
  const r = spawnSync(command, args, { input, encoding: 'utf8', timeout: 120_000 });
  if (r.error || r.status !== 0) throw new Error(`${command}: ${r.error?.message || r.stderr || r.stdout}`);
  return r.stdout;
}
const sql = text => run('psql', ['-X', '-q', '-h', socket, '-p', '55441', '-U', 'postgres', '-d', 'postgres',
  '-v', 'ON_ERROR_STOP=1'], text);

try {
  run('initdb', ['-D', data, '--auth=trust', '--username=postgres', '--no-locale']);
  run('pg_ctl', ['-D', data, '-l', join(tmp, 'postgres.log'), '-o', `-k ${socket} -p 55441 -c listen_addresses=''`, '-w', 'start']);
  started = true;
  // Minimal stand-ins for what Supabase provides.
  sql(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE supabase_auth_admin;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, supabase_auth_admin;
    CREATE PUBLICATION supabase_realtime;
  `);
  const files = readdirSync(join(root, 'supabase/migrations')).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (file === '20261006000001_school_access_trusted_roles.sql') {
      // The school-access rollout refuses to run without a verified school admin.
      sql(`INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001','admin@iszl.ch',now());
           INSERT INTO public.profiles (id,name,email,role)
           VALUES ('00000000-0000-0000-0000-000000000001','School admin','admin@iszl.ch','admin');`);
    }
    if (file === '20240528000004_admin_policies.sql') sql('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;');
    try { sql(readFileSync(join(root, 'supabase/migrations', file), 'utf8')); }
    catch (e) { throw new Error(`Migration ${file} failed:\n${e.message}`); }
  }
  console.log(`PASS: all ${files.length} migrations apply in order to an empty database.`);
  // The hosted readiness check must run cleanly and report every migration as present.
  const readiness = run('psql', ['-X', '-q', '-A', '-t', '-F', '|', '-h', socket, '-p', '55441', '-U', 'postgres', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1', '-f', join(root, 'supabase/tests/hosted_readiness_check.sql')]);
  const missing = readiness.trim().split('\n').filter(line => line.split('|')[2] !== 'PASS');
  if (missing.length) throw new Error('Readiness check reported:\n' + missing.join('\n'));
  console.log('PASS: hosted readiness check reports every migration and safety setting as present.');
  sql(readFileSync(join(root, 'tests/security/launch-features-checks.sql'), 'utf8'));
  console.log('PASS: recipient-only notifications from applications, decisions, announcements and hour reviews; idempotent reminders; mark-read scope; no client writes.');
  console.log('PASS: message reports by current members only, no self/duplicate reports, admin-only queue, moderator removal and reporter follow-up.');
  console.log('PASS: own data export without other users\' details, privacy requests with duplicate/limit checks, admin-only handling and requester notification.');
} finally {
  if (started) run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
  rmSync(tmp, { recursive: true, force: true });
}
