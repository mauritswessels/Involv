# Putting Involv online

A step-by-step runbook for the first deployment. Do the steps in order. Nothing
here invites students: that still needs the school's approval
([STUDENT_PILOT_CHECKLIST.md](./STUDENT_PILOT_CHECKLIST.md)).

Replace `involv.me` below with your real domain if it's different.

## 1. Supabase: bring the database up to date

1. Supabase → **Database → Backups**: confirm a recent backup exists (or download one).
2. **SQL Editor** → paste and run [`supabase/tests/hosted_readiness_check.sql`](../supabase/tests/hosted_readiness_check.sql).
   It is read-only. Each row says **PASS** or **MISSING** with the file to apply.
3. For every MISSING migration, open that file in `supabase/migrations/`, paste it
   into a new SQL Editor tab and run it. **Go oldest first** (file names are dates).
   Each file is one transaction: if it fails, nothing changes; read the error,
   fix the cause, run it again.
   - `20261006000001_school_access_trusted_roles.sql` refuses to run until a
     verified `@iszl.ch` admin exists. Sign in once on the site with your ISZL
     account, then run:
     `UPDATE public.profiles SET role = 'admin' WHERE email = 'you@iszl.ch';`
   - `20261011000006_messaging_controls_realtime.sql` needs Realtime enabled
     (Database → Publications → `supabase_realtime` exists).
4. The four newest files (6 November 2026) add:
   - `…000000_admin_managed_applications`: **fixes a bug** where nobody could apply to
     admin-managed listings (the imported school events).
   - `…000001_notifications`: the real notification bell and reminders.
   - `…000002_message_reports`: reporting group messages to admins.
   - `…000003_privacy_requests`: Download my data and privacy requests.
5. Run the readiness check again. Every row should say PASS.

## 2. Supabase: authentication settings

- **Authentication → Hooks → Before User Created**: enable it and choose
  `public.before_school_user_created`. This blocks non-ISZL Google accounts.
- **Authentication → Providers**: Google on; turn off email, phone and anonymous
  sign-ups if they are on.
- **Authentication → URL Configuration**:
  - Site URL: `https://involv.me`
  - Redirect URLs: `https://involv.me/login` (and `https://www.involv.me/login` if you use www).
    Remove `localhost`/preview addresses once you no longer need them.

## 3. Google Cloud: OAuth client and consent screen

In the Google Cloud project that owns the OAuth client used by Supabase:

- **APIs & Services → Credentials → your OAuth client**
  - Authorised JavaScript origins: add `https://involv.me`.
  - Authorised redirect URI stays `https://<project-ref>.supabase.co/auth/v1/callback`.
- **OAuth consent screen / Branding**
  - App name *Involv*, support email, logo.
  - Application home page `https://involv.me`, privacy policy `https://involv.me/privacy`.
  - Authorised domain: `involv.me` (verify it in Google Search Console if asked).
  - Scopes: only `openid`, `email` and `profile`. These are non-sensitive, so the
    app needs no Google verification.

ISZL IT then approves (trusts) this OAuth client ID in the Google Workspace admin
console. That is what clears the `access_not_configured` error. Send them the client
ID, the site address and the privacy page link.

## 4. Hosting the website

The site is static files plus Supabase, so any static host works. **Vercel**
is the simplest; settings are already in `artifacts/involv/vercel.json`.

1. vercel.com → *Add New Project* → import `mauritswessels/Involv` from GitHub.
2. **Root Directory**: `artifacts/involv`. Framework: Vite (auto-detected).
   Install/build/output come from `vercel.json`.
3. **Environment Variables** (Production and Preview):
   - `VITE_SUPABASE_URL` = `https://<project-ref>.supabase.co` (Project Settings → API)
   - `VITE_SUPABASE_ANON_KEY` = the **anon public** key (never the service-role key)
4. Deploy. Open the `…vercel.app` address and check the home page and Browse load.
5. **Settings → Domains** → add `involv.me` (and `www.involv.me`). Vercel shows the
   DNS records to add at your domain registrar (usually an `A` record for the apex
   and a `CNAME` for www). HTTPS is issued automatically.

Every push to `main` then redeploys automatically.

Alternatives: **Netlify** or **Cloudflare Pages** use `public/_redirects` and
`public/_headers` (already included). Set base directory `artifacts/involv`, build
`pnpm run build`, publish `dist`, and the same two environment variables.
**Replit Deployments** also work (`.replit-artifact` is configured) but cost money.

If you later use a Supabase custom domain, add it to `connect-src` in the
Content-Security-Policy in `vercel.json` and `public/_headers`.

## 5. Real content

- Close or archive outdated sample listings:
  [`supabase/imports/archive_sample_opportunities.sql`](../supabase/imports/archive_sample_opportunities.sql).
- Import the current school events (check dates first; some deadlines may have passed):
  [`supabase/imports/2026_26_27_school_opportunities.sql`](../supabase/imports/2026_26_27_school_opportunities.sql).
- Approve teacher/organiser accounts in **Admin → Users** after they sign in once.

## 6. Smoke test on the real address

With two ISZL student accounts, one teacher and the admin:

| Check | Expected |
| --- | --- |
| Personal Gmail sign-in | Refused with the school-only message |
| Browse on phone and laptop | Listings show; filters work |
| Student applies | Teacher's bell shows "New application" |
| Teacher accepts | Student's bell shows "Accepted"; activity hub opens |
| Announcement posted | Accepted students are notified |
| Hours submitted and approved | Student notified; portfolio total updates |
| Message reported | Admin → Reports shows it; "Remove message" hides it for everyone |
| Profile → Your data | Download works; a request appears in Admin → Privacy requests |
| /privacy | Loads; draft banner until the school approves the wording |

Then follow [STUDENT_PILOT_CHECKLIST.md](./STUDENT_PILOT_CHECKLIST.md) for the
school sign-offs before inviting students.

## Running the tests locally

```sh
pnpm install
pnpm --filter @workspace/involv run typecheck
node artifacts/involv/tests/security/run-full-stack.mjs     # needs PostgreSQL 15+ (initdb/pg_ctl/psql on PATH)
pnpm --filter @workspace/involv test:school-access
```
