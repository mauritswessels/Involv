# Pilot privacy and reliability activation

## What is automatic in the updated application

- Public listing, administrator listing and create-return queries use an explicit
  public field allowlist. Listing cards/details do not receive organiser contacts.
- Homepage activities and category counts come from real published records, not
  sample opportunities. Loading, failure and empty states are explicit.
- The owner's edit form reads its contact using a separate management RPC. Do not
  merge that private value into public listing caches.
- Bookmark changes are single-flight per card, idempotent on the database unique
  key and visibly rolled back on failure. Older refresh responses cannot undo a
  newer local change. Saved state is isolated by logged-in identity.
- Saved IDs, applications and active listings refresh every 30 seconds and when
  the browser returns online or gains focus. Existing foreign-key deletion cascades
  remove saved rows for deleted opportunities. Closed/unavailable listings are
  hidden, not automatically deleted from the user's saved records.
- Login callback and application submission errors use fixed safe messages, not
  raw provider/SQL descriptions. Failed application answers remain in the form.
- Application decisions show as changed only after an authorised matching row is
  returned. Partial bulk failures keep unconfirmed decisions unchanged/selected
  and show a confirmed count. Withdrawal failures are visible, not just logged.
- API error/completion logging retains server request IDs, method, status and fixed
  categories, not private body/header/URL text or raw exception messages/stacks.
  Already-written historical logs are not retroactively removed.

## Required database activation — run once

1. Confirm the intended Supabase project. This requires the installed Activity Hub.
2. Run the **entire** file
   `supabase/migrations/20261015000001_public_opportunity_privacy.sql`
   in a new SQL Editor query.
3. Run the read-only check below. All four columns should be true.

```sql
SELECT
  NOT has_column_privilege('anon','public.opportunities','organizer_email','SELECT')
    AND NOT has_column_privilege('authenticated','public.opportunities','organizer_email','SELECT')
    AS private_contact_column,
  has_column_privilege('anon','public.opportunities','title','SELECT') AS public_titles_readable,
  to_regprocedure('public.get_opportunity_contact(uuid)') IS NOT NULL
    AND NOT has_function_privilege('authenticated','public.get_activity_hub_private_snapshot(uuid)','EXECUTE')
    AS managed_contact_api_ready,
  NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime'
    AND schemaname='public' AND tablename='opportunities') AS private_row_stream_disabled;
```

This keeps stored contact data; it does not delete it or replace the database.
**Wildcard opportunity reads now intentionally fail**, including for managers.
Reload old browser tabs after activation. Only a currently verified school owner
with an approved manager role, or school administrator, can fetch the contact
through the management RPC. The authorised Activity Hub wrapper removes the contact
from group snapshots too; its raw internal snapshot cannot be called by app roles.

The unused opportunity-row Realtime stream is removed to avoid contact exposure
through replication. Chat and application streams are preserved. No app component
currently subscribes to opportunity events; listing refresh remains polling/focus.
If a custom publication configuration rejects the migration, it rolls back: report
the error rather than disabling RLS or granting wildcard access.

Before this script is installed, UI public reads omit the email but direct old
database reads may still expose it. The private edit form also needs the new RPC.
Do not call the privacy change activated until the check succeeds.

## Still required before a student pilot

School-approved sign-in and trusted-role activation; actual hosted profile privacy
verification; real student/organiser end-to-end checks; live Realtime delivery and
revocation checks; approved privacy/retention/support arrangements. This change is
not account closure, a legal approval, a production load test or full pilot sign-off.

Local checks:

```sh
pnpm --filter @workspace/involv run test:pilot-privacy
pnpm --filter @workspace/involv run test:pilot-client
pnpm --filter @workspace/api-server run test:request-privacy
```
