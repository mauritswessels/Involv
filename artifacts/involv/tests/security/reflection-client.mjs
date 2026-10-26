// Exercise the real service against a controlled RPC transport, not an app login.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source = readFileSync(new URL('../../src/services/reflectionService.ts', import.meta.url), 'utf8');
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
const { getMyReflections, saveMyReflection, deleteMyReflection, getManagedReflections, reflectionWordCount } = module.exports;
const entry = {
  id: 'entry', opportunity_id: 'activity', activity_title: 'Server title',
  content: 'Saved content', created_at: '2026-10-26T10:00:00.000001Z',
  updated_at: '2026-10-26T10:01:00.000002Z',
};
response = { data: entry, error: null };
assert.deepEqual(await saveMyReflection('entry', 'activity', '  Saved content  ', null), entry);
assert.deepEqual(calls.pop(), { name: 'save_my_activity_reflection', args: {
  target_opportunity_id: 'activity', target_reflection_id: 'entry',
  reflection_content: 'Saved content', expected_updated_at: null,
} }, 'server owns author, role, status, title and timestamps');
await saveMyReflection('entry', 'activity', 'edit', entry.updated_at);
assert.equal(calls.pop().args.expected_updated_at, entry.updated_at);
await deleteMyReflection(entry);
assert.deepEqual(calls.pop(), { name: 'delete_my_activity_reflection', args: {
  target_reflection_id: entry.id, expected_updated_at: entry.updated_at,
} });
response = { data: { entries: [entry], can_create: true }, error: null };
assert.deepEqual(await getMyReflections('activity'), { entries: [entry], canCreate: true });
await getMyReflections(undefined, entry);
assert.deepEqual(calls.pop(), { name: 'get_my_activity_reflections', args: {
  target_opportunity_id: null, before_created_at: entry.created_at, before_id: entry.id,
} });
response = { data: [{ ...entry, author_name: 'Server author' }], error: null };
assert.equal((await getManagedReflections('activity', entry))[0].author_name, 'Server author');
assert.deepEqual(calls.pop(), { name: 'get_managed_activity_reflections', args: {
  target_opportunity_id: 'activity', before_created_at: entry.created_at, before_id: entry.id,
} }, 'educator reads are activity scoped and preserve cursor precision');
for (const code of ['42501','40001','23514','PGRST202','42P01','42883','unknown']) {
  response = { data: null, error: { code, message: 'private database detail' } };
  for (const operation of [
    () => getMyReflections('activity'), () => getManagedReflections('activity'),
    () => saveMyReflection('entry','activity','content',null), () => deleteMyReflection(entry),
  ]) {
    await assert.rejects(operation(), e => e.code === code && !e.message.includes('private database detail'));
  }
}
response = { data: { entries: [entry], can_create: 'true' }, error: null };
await assert.rejects(getMyReflections(), /Invalid reflection history/);
response = { data: [{ ...entry, author_name: null }], error: null };
await assert.rejects(getManagedReflections('activity'), /Invalid reflection author/);
response = { data: { ...entry, updated_at: 42 }, error: null };
await assert.rejects(saveMyReflection('entry','activity','content',null), /Invalid reflection response/);
assert.equal(reflectionWordCount(' \nword\tword\n '), 2);
console.log('PASS: reflection RPC contracts, precise versions/cursors, server-owned identity, safe errors and response validation.');
