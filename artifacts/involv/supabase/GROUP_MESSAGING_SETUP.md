# Activate activity group messaging

In the **same Supabase project used by Involv**, open SQL Editor and run the complete
contents of `migrations/20261011000003_activity_group_messages.sql`.
The Activity Hub foundation must already be installed. This migration adds a new
private message table and two permission-checked functions. It does not activate
the deferred school signup hook, reset roles, or modify existing activity records.

Then run this read-only installation check:

```sql
SELECT
  to_regclass('public.activity_messages') IS NOT NULL AS messages_table_ready,
  to_regprocedure('public.send_activity_message(uuid,text,uuid)') IS NOT NULL AS send_ready,
  to_regprocedure('public.list_activity_messages(uuid,timestamp with time zone,uuid,boolean)') IS NOT NULL AS history_ready;
```

All three should be `true`. These results confirm installation, not a signed-in
permission test. Once institutional sign-in is approved, check with an accepted
participant, the approved activity owner, and an unrelated account:

1. Open an Activity Hub and choose **Group chat**.
2. Send a message. Reload: it must still be there.
3. Open chat as a second authorized member: the message should appear within
   five seconds or immediately on returning focus to the window.
4. Retry an interrupted send: the same message must not be duplicated.
5. An unrelated account must not read history or send. Revoke an accepted
   participant: the next request must fail and the UI must clear private chat data.

Install the upgrade in `MESSAGING_UPGRADE_SETUP.md` immediately after this base
migration for the current client: it supplies message-update recovery, author
controls and protected realtime. This base migration alone is not the complete
current setup.

The base migration supports permission-checked polling, not a public realtime channel. History
loads in pages of 50; missed messages are fetched forward in batches. Names, roles,
sender IDs and timestamps are derived by the server. Sends are limited to 20 per
minute per sender and 2,000 characters. Attachments, message editing/deletion,
read receipts, presence and notifications are not part of this chunk.

The later `MESSAGING_UPGRADE_SETUP.md` adds author edit/removal and RLS-protected
Realtime signals while retaining polling/recovery. Follow that guide to finish
the queued messaging scope; the original script alone does not activate it.

Local checks: `pnpm --filter @workspace/involv run test:messaging` exercises
messaging against disposable database fixtures before and after the school-access
migration. It does not connect to or change hosted Supabase.
