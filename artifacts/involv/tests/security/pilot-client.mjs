import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const read = path => readFileSync(new URL('../../'+path, import.meta.url), 'utf8');
function load(path,imports={}) {
  const output = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = {exports:{}};
  new Function('require','module','exports',output)(name=>{
    if (Object.hasOwn(imports,name)) return imports[name];
    throw new Error(`Unexpected test dependency: ${name}`);
  },module,module.exports);
  return module.exports;
}
const {SavedState} = load('src/services/savedState.ts');
const {actionError} = load('src/utils/actionError.ts');
let snapshot, failed, calls=0, settle, reject;
const store = new SavedState(() => { calls++; return new Promise((resolve,no)=>{settle=resolve;reject=no;}); }, value=>snapshot=value,error=>failed=error);
store.hydrate([],store.revision);
const oldVersion=store.revision;
const first=store.toggle('card');
await store.toggle('card');
assert.equal(calls,1);
assert.ok(snapshot.ids.has('card')&&snapshot.pending.has('card'));
store.hydrate([],store.revision);
assert.ok(snapshot.ids.has('card'),'mid-write hydration cannot undo optimistic state');
settle(); await first;
assert.equal(snapshot.pending.size,0);
store.hydrate([],oldVersion);
assert.ok(snapshot.ids.has('card'),'old response after write cannot erase committed save');
const unsave=store.toggle('card'); reject({code:'NETWORK',message:'private-marker'}); await unsave;
assert.ok(snapshot.ids.has('card'),'failed unsave rolls back');
assert.equal(failed.code,'NETWORK');
const refreshVersion=store.revision;
store.hydrate([],refreshVersion);
assert.equal(snapshot.ids.size,0,'new server snapshot removes cascaded/deleted saved rows');
const pending=store.toggle('other');
const beforeDispose=snapshot;
store.dispose(); reject(new Error('private-marker')); await pending;
assert.equal(snapshot,beforeDispose,'old-user callbacks do not update UI after disposal');
const other = new SavedState(async()=>{},()=>{},()=>{});
await other.toggle('before-hydration');
assert.equal(other.revision,0);
for (const code of ['23505','23503','42501','PGRST301','unknown']) {
  for (const action of ['apply','signin','save','load','review','withdraw','account']) {
    const result=actionError({code,message:'private-marker',stack:'secret-stack',details:'student data'},action);
    assert.ok(!result.includes('private-marker')&&!result.includes('secret-stack')&&!result.includes('student data'));
  }
}
assert.match(actionError({code:'23505'},'apply'),/already applied/);
assert.match(actionError({code:'23503'},'save'),/no longer available/);
assert.match(actionError({code:'42501'},'signin'),/school IT/);
const fields=read('src/services/opportunityFields.ts');
assert.ok(!fields.split("= '")[1].split("'")[0].includes('organizer_email'));
const login=read('src/pages/LoginPage.tsx');
assert.ok(!login.includes("setError(search.get('error_description')"));
assert.ok(read('src/context/AppContext.tsx').includes("key={user?.id ?? 'signed-out'}"));
let rowError={code:'PGRST116'};
let acknowledged=false;
const chain={
  update(){return this;},eq(){return this;},
  select(fields){assert.equal(fields,'id,status');return this;},
  async single(){acknowledged=true;return {error:rowError};},
};
const service=load('src/services/applicationService.ts',{'../lib/supabase':{supabase:{from(table){assert.equal(table,'applications');return chain;}}}});
await assert.rejects(service.updateApplicationStatus('application','Accepted'),error=>error.code==='PGRST116');
assert.ok(acknowledged,'a zero-row response cannot be treated as approval');
rowError=null;
await service.updateApplicationStatus('application','Accepted');
console.log('PASS: real saved-state coordinator single-flight writes, stale hydration, rollback, deletion refresh and disposal; safe action-error codes; public projection and user-scope wiring. Not a browser interaction test.');
