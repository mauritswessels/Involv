// Contract checks for the real browser-facing service; no hosted credentials.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source = readFileSync(new URL('../../src/services/messageService.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const calls = [];
let response;
const module = { exports: {} };
new Function('require', 'module', 'exports', output)(name => {
  assert.equal(name, '../lib/supabase');
  return { supabase: { async rpc(name, args) { calls.push({ name, args }); return response; } } };
}, module, module.exports);
const { listMessages, sendMessage, messageUpdates, changeMessage } = module.exports;
const row = {
  id: 'message', opportunity_id: 'activity', sender_id: 'author',
  sender_name: 'Server name', sender_role: 'student', content: 'Hello',
  created_at: '2026-10-26T10:00:00.000001Z', updated_at: '2026-10-26T10:00:00.000001Z',
  edited_at: null, deleted_at: null,
};
response = { data: row, error: null };
assert.deepEqual(await sendMessage('activity', 'Hello', 'retry-id'), row);
assert.deepEqual(calls.pop(), { name: 'send_activity_message', args: {
  target_opportunity_id: 'activity', message_content: 'Hello', request_nonce: 'retry-id',
} }, 'no client-supplied author, role or timestamp');
response = { data: [row], error: null };
await listMessages('activity', row, true);
assert.deepEqual(calls.pop(), { name: 'list_activity_messages', args: {
  target_opportunity_id: 'activity', cursor_time: row.created_at, cursor_id: row.id, newer: true,
} }, 'preserve timestamp precision and ID tie-breaker during recovery');
await messageUpdates('activity', ['message']);
assert.deepEqual(calls.pop(), { name: 'get_activity_message_updates', args: {
  target_opportunity_id: 'activity', message_ids: ['message'],
} });
response = { data: row, error: null };
await changeMessage(row, ' Edited ');
assert.deepEqual(calls.pop(), { name: 'change_my_activity_message', args: {
  target_message_id: 'message', replacement_content: 'Edited',
  expected_updated_at: row.updated_at, remove_message: false,
} });
await changeMessage(row, null);
assert.equal(calls.at(-1).args.remove_message, true);
assert.equal(calls.at(-1).args.replacement_content, null);
await assert.rejects(changeMessage({ ...row, updated_at: undefined }, 'edit'), /upgrade/);
for (const code of ['42501', '40001', 'P0001', '23514', 'PGRST202', 'unknown']) {
  response = { data: null, error: { code, message: 'private database detail' } };
  for (const operation of [
    () => listMessages('activity'), () => sendMessage('activity', 'Hello', 'retry-id'),
    () => messageUpdates('activity', ['message']), () => changeMessage(row, null),
  ]) {
    await assert.rejects(operation(), error => error.code === code && !error.message.includes('private database detail'));
  }
}
response = { data: { ...row, updated_at: 42 }, error: null };
await assert.rejects(sendMessage('activity', 'Hello', 'retry-id'), /Invalid message version/);
response = { data: null, error: null };
await assert.rejects(listMessages('activity'), /Invalid message history/);
console.log('PASS: message RPC contracts, server-owned identity, precise cursors, versioned edits/removal, safe failures and malformed responses.');
