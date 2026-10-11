# Finish the group-messaging task

This upgrade requires the existing group-messaging migration and Supabase's
`supabase_realtime` publication. It does not activate the school signup hook,
change login restrictions, or allow managers to edit someone else's messages.

1. Open `migrations/20261011000006_messaging_controls_realtime.sql`.
2. Copy the entire file into a new Supabase SQL Editor query and run it once.
3. Run this check separately; all three results should be true:

```sql
SELECT
  to_regprocedure('public.change_my_activity_message(uuid,text,timestamp with time zone,boolean)')
    IS NOT NULL AS message_controls_ready,
  to_regprocedure('public.get_activity_message_updates(uuid,uuid[])')
    IS NOT NULL AS message_updates_ready,
  EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime'
    AND schemaname='public' AND tablename='activity_messages') AS realtime_publication_ready;
```

Authors who are currently allowed in the activity can edit or remove their own
messages. Removal clears the stored body and leaves a marker for other members.
It cannot be undone through Involv; this is not a promise to purge database backups.
Managers/admins cannot rewrite or remove other authors' messages. Edits are marked,
stale edit/delete forms cannot overwrite newer versions, and uncertain same-action
retries are safe. No additional message attachments/presence/read receipts.

Realtime uses **Postgres Changes with the existing table's current-membership
RLS**. It does not broadcast private messages publicly. Event callbacks reload
through permission-checked RPCs before updating the screen. A five-second poll,
focus refresh and online recovery remain for missed events and access revocation.
Older loaded pages refresh edits/deletions as well as new-message history.
Channels are removed on route/user change or access denial. The header shows
Realtime connection status; an unavailable subscription is labelled polling,
not falsely labelled live. Realtime service availability still needs a live test.

After institutional sign-in is approved: use two accepted accounts to check
send, edit, delete, reload, older-page edits, disconnected recovery, and revoked
access. Inspect the realtime status while connected and after a connection loss.
Local database tests confirm publication/RLS and RPC behavior, not hosted
WebSocket delivery.

Local checks: `pnpm --filter @workspace/involv run test:messaging-controls`.
