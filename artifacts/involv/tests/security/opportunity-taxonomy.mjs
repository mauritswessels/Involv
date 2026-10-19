import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
function loadTypeScript(path) {
  const output = ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(
    name => { throw new Error(`Unexpected import ${name}`); },
    module,
    module.exports,
  );
  return module.exports;
}

const { matchesOpportunityTaxonomy } = loadTypeScript('src/utils/opportunityTaxonomy.ts');
const directHsp = { serviceType: 'Direct', servicePrograms: ['HSP'] };
const researchBoth = { serviceType: 'Research', servicePrograms: ['IB DP', 'HSP'] };
assert.equal(matchesOpportunityTaxonomy(directHsp, 'Direct', []), true);
assert.equal(matchesOpportunityTaxonomy(directHsp, 'Advocacy', []), false);
assert.equal(matchesOpportunityTaxonomy(directHsp, '', ['IB DP']), false);
assert.equal(matchesOpportunityTaxonomy(researchBoth, 'Research', ['IB DP']), true);
assert.equal(matchesOpportunityTaxonomy(researchBoth, '', ['IB DP', 'HSP']), true,
  'selecting multiple programmes matches either programme');

const migration = read('supabase/migrations/20261019000001_opportunity_service_programs.sql');
assert.match(migration, /ADD COLUMN IF NOT EXISTS service_programs text\[\] NOT NULL DEFAULT '\{\}'/);
assert.match(migration, /GRANT SELECT \(service_programs\)[\s\S]*TO anon, authenticated/);
assert.match(migration, /public\.can_publish_opportunities\(\)/);
assert.match(migration, /public\.is_admin\(uuid\)/);
assert.doesNotMatch(migration, /image_path|storage\.(?:buckets|objects)/i);
assert.doesNotMatch(migration, /GRANT[^;]*organizer_email/i);

const publicFields = read('src/services/opportunityFields.ts');
assert.match(publicFields, /service_programs/);
assert.doesNotMatch(publicFields, /image_path|organizer_email/);
assert.doesNotMatch(read('src/pages/CreateOpportunityPage.tsx'), /OpportunityImage|uploadOpportunityImage/);
assert.doesNotMatch(read('src/pages/EditOpportunityPage.tsx'), /OpportunityImage|uploadOpportunityImage/);
assert.doesNotMatch(read('src/components/opportunities/OpportunityCard.tsx'), /opportunity\.imageUrl/);
assert.doesNotMatch(read('src/pages/OpportunityDetailPage.tsx'), /opportunity\.imageUrl/);

const { actionError } = loadTypeScript('src/utils/actionError.ts');
assert.match(actionError({ code: 'PGRST204' }, 'load'), /opportunity programme filters migration/);
console.log('PASS: service/programme filter logic, additive programme migration, privacy allowlist, and deferred image uploads.');
