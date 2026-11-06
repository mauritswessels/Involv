# Involv

A student-first platform for discovering, applying for and managing service-learning
and CAS opportunities at ISZL. Built by Maurits Wessels and Florence Hesselbach.

**Website:** `artifacts/involv` (React + Vite + Supabase). Everything else in
`artifacts/` is supporting material (the school presentation, an older test copy,
a mockup sandbox and an unused Express API scaffold) and is not needed to run the site.

## Where to start

| I want to… | Read |
| --- | --- |
| Put the site online | [`artifacts/involv/docs/GO_LIVE.md`](artifacts/involv/docs/GO_LIVE.md) |
| Prepare the student pilot | [`artifacts/involv/docs/STUDENT_PILOT_CHECKLIST.md`](artifacts/involv/docs/STUDENT_PILOT_CHECKLIST.md) |
| Handle reports and privacy requests | [`artifacts/involv/docs/DATA_REQUESTS.md`](artifacts/involv/docs/DATA_REQUESTS.md) |
| Check the hosted database | [`artifacts/involv/supabase/tests/hosted_readiness_check.sql`](artifacts/involv/supabase/tests/hosted_readiness_check.sql) |
| Fill in the privacy page after school approval | `PRIVACY_CONFIG` in [`artifacts/involv/src/pages/PrivacyPage.tsx`](artifacts/involv/src/pages/PrivacyPage.tsx) |

## Develop

```sh
pnpm install
cp artifacts/involv/.env.example artifacts/involv/.env   # add your Supabase URL + anon key
pnpm --filter @workspace/involv run dev
```

Without a `.env`, public pages still load but nothing connects to a database.

## Test

```sh
pnpm --filter @workspace/involv run typecheck
node artifacts/involv/tests/security/run-full-stack.mjs        # every migration + new back-end checks (needs PostgreSQL)
pnpm --filter @workspace/involv test:school-access              # original role/privacy suites (see package.json for more)
```

Database migrations live in `artifacts/involv/supabase/migrations` and must be applied
to the hosted Supabase project in file-name order (see GO_LIVE.md).
