import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
function load(path,imports={}) {
  const output=ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  new Function('require','module','exports',output)(name=>{
    if(Object.hasOwn(imports,name)) return imports[name];
    throw new Error(`Unexpected dependency: ${name}`);
  },module,module.exports);
  return module.exports;
}
const {applicationDeadlineDays}=load('src/utils/applicationDeadline.ts');
assert.equal(applicationDeadlineDays('2026-10-15',new Date('2026-10-15T21:59:59Z')),0);
assert.equal(applicationDeadlineDays('2026-10-15',new Date('2026-10-15T22:00:00Z')),-1);
assert.equal(applicationDeadlineDays('2026-10-25',new Date('2026-10-24T22:30:00Z')),0,'DST calendar date');
assert.equal(applicationDeadlineDays('2026-10-25',new Date('2026-10-25T23:00:00Z')),-1,'winter clock midnight');
const {actionError}=load('src/utils/actionError.ts');
for(const code of ['IV001','IV002','IV003','IV004','IV005','IV006']) {
  assert.ok(!actionError({code,message:'private-marker',details:'student text'},'apply').includes('private-marker'));
}
assert.match(actionError({code:'IV004'},'review'),/acceptance was not saved/);
assert.match(actionError({code:'IV005'},'listing'),/accepted students/);
let error={code:'PGRST116'}, acknowledged=false;
const chain={
  delete(){return this;},eq(){return this;},
  select(fields){assert.equal(fields,'id');return this;},
  async single(){acknowledged=true;return {error};},
};
const service=load('src/services/applicationService.ts',{'../lib/supabase':{supabase:{from(table){assert.equal(table,'applications');return chain;}}}});
await assert.rejects(service.withdrawApplication('test'),e=>e.code==='PGRST116');
assert.ok(acknowledged,'zero-row withdrawal cannot be reported as successful');
error=null;
await service.withdrawApplication('test');
const filters=[];
chain.update=()=>chain;
chain.eq=(field,value)=>{filters.push([field,value]);return chain;};
chain.select=fields=>{assert.equal(fields,'id,status');return chain;};
await service.updateApplicationStatus('test','Accepted','Pending');
assert.deepEqual(filters,[['id','test'],['status','Pending']],'decision must match the previously loaded status');
assert.ok(!read('src/context/AppContext.tsx').includes('incrementApplicantsCount'));
assert.ok(!read('src/services/opportunityService.ts').includes('incrementApplicantsCount'));
assert.match(read('src/hooks/useOpportunities.ts'),/involv:applications-changed/);
console.log('PASS: school-time/DST deadlines, fixed safe capacity messages, acknowledged withdrawals and database-owned count wiring. Not a browser test.');
