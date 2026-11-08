# Demo mode, and switching to the real site

While ISZL reviews Google sign-in and the privacy questions, involv.me runs as a
**demo**: visitors pick a role (student, teacher or school admin) and use every
feature with sample data. Everything happens inside their own browser tab:

- nothing is sent to Supabase, Google or anywhere else;
- nothing one visitor does is seen by anyone else;
- the yellow banner shows the demo role, switches role, and **Reset** puts the
  sample data back (closing the tab does too).

Changes made as one role show up for the others in the same tab. For example,
apply as the student, switch to Teacher and accept the application, switch back
and the student has a notification.

## The switch

One line in `artifacts/involv/.env.production`:

```
VITE_DEMO_MODE=true     # demo
VITE_DEMO_MODE=false    # real site
```

## Switching to the real site (when the school approves)

1. Finish the database steps in [GO_LIVE.md](./GO_LIVE.md) (admin account,
   school-access migration, the last three migrations, the sign-up hook), and
   make sure Vercel has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. Turn the demo off, either way:
   - **Code:** change the line to `VITE_DEMO_MODE=false`, commit and push to `main`.
   - **No code:** Vercel → Project → Settings → Environment Variables → add
     `VITE_DEMO_MODE` = `false` (Production) → Deployments → ⋯ on the latest →
     **Redeploy**. A Vercel variable always beats the file.
3. Open involv.me → Sign in: it should show **Continue with Google** and no yellow banner.

To bring the demo back, do the opposite (`true`).

## Keeping a demo after launch

If you want a demo link once the real site is live (for presentations), create a
second Vercel project from the same repo, Root Directory `artifacts/involv`, with
environment variable `VITE_DEMO_MODE` = `true`. It gets its own address (for example
`involv-demo.vercel.app`), or you can add `demo.involv.me` under its Domains.

## How it works (for developers)

`src/lib/supabase.ts` creates the Supabase client with a custom `fetch` from
`src/demo/demoBackend.ts` when demo mode is on. That backend answers the same
REST, RPC and Auth requests as Supabase, using `src/demo/demoData.ts` (dates are
relative to today, so deadlines never expire) and stores changes in
`sessionStorage`. All pages and services are unchanged. The real database rules
live in `supabase/migrations` and are tested by `tests/security/*`; the demo only
imitates them for display.
