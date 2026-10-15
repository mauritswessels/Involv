import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const landing=read('src/pages/LandingPage.tsx');
assert.doesNotMatch(landing,/TESTIMONIALS|StarIcon|digital certificate|photo gallery|sign-up to certificate|Involv learns|Students enrolled|demo listing|for free/i);
assert.match(landing,/Accepted applications/);
assert.match(landing,/Applications on record/);
assert.match(landing,/Platform counts are unavailable/);
assert.match(landing,/Private reflections/);
const hub=read('src/pages/ActivityHubFoundation.tsx');
assert.doesNotMatch(hub,/DEFERRED|Gallery|Certificate/);
assert.match(read('src/pages/ActivityHubPage.tsx'),/export \{ default \} from '\.\/ActivityHubFoundation'/);

let configured=true;
let response;
const config={
  get isSupabaseConfigured(){return configured;},
  supabase:{
    async rpc(name){assert.equal(name,'get_site_stats');return response;},
    from(){throw new Error('Statistics must not fabricate a fallback from public listings');},
  },
};
const output=ts.transpileModule(read('src/services/statsService.ts'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
const module={exports:{}};
new Function('require','module','exports',output)(name=>{
  assert.equal(name,'../lib/supabase');return config;
},module,module.exports);
const {getSiteStats}=module.exports;
response={data:{active_opportunities:12,students_enrolled:7,applications_submitted:16},error:null};
assert.deepEqual(await getSiteStats(),{activeOpportunities:12,acceptedApplications:7,applicationsSubmitted:16});
response={data:{active_opportunities:0,students_enrolled:0,applications_submitted:0},error:null};
assert.equal((await getSiteStats()).acceptedApplications,0,'real zeroes remain zeroes');
for(const data of [null,{}, {active_opportunities:1,students_enrolled:-1,applications_submitted:2},
  {active_opportunities:1,students_enrolled:'7',applications_submitted:2}]) {
  response={data,error:null};
  await assert.rejects(getSiteStats());
}
response={data:null,error:{code:'PGRST202'}};
await assert.rejects(getSiteStats(),e=>e.code==='PGRST202');
configured=false;
await assert.rejects(getSiteStats());
console.log('PASS: live-page content guards; real aggregate values, accepted-application semantics, valid zeroes, missing/invalid counts and unavailable statistics. Not a signed-in browser test.');
