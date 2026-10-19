import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
function loadTypeScript(path, dependencies = {}) {
  const output = ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(
    name => {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected import ${name}`);
      return dependencies[name];
    },
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

const supabase = {
  storage: {
    from(bucket) {
      assert.equal(bucket, 'opportunity-images');
      return { getPublicUrl: path => ({ data: { publicUrl: `https://images.example/${path}` } }) };
    },
  },
};
const { validateOpportunityImage, opportunityImagePublicUrl, MAX_OPPORTUNITY_IMAGE_BYTES } =
  loadTypeScript('src/services/opportunityImageService.ts', { '../lib/supabase': { supabase } });
assert.equal(validateOpportunityImage({ type: 'image/jpeg', size: 100 }), null);
assert.equal(validateOpportunityImage({ type: 'image/png', size: MAX_OPPORTUNITY_IMAGE_BYTES }), null);
assert.match(validateOpportunityImage({ type: 'image/svg+xml', size: 10 }), /JPG, PNG or WebP/);
assert.match(validateOpportunityImage({ type: 'image/jpeg', size: MAX_OPPORTUNITY_IMAGE_BYTES + 1 }), /5 MB/);
assert.match(validateOpportunityImage({ type: 'image/webp', size: 0 }), /empty/);
assert.equal(opportunityImagePublicUrl('publisher/image.webp'),
  'https://images.example/publisher/image.webp');
assert.equal(opportunityImagePublicUrl(null), null);

const { actionError } = loadTypeScript('src/utils/actionError.ts');
assert.match(actionError({ code: 'PGRST204' }, 'load'), /opportunity filters and images migration/);

const migration = read('supabase/migrations/20261019000001_opportunity_service_programs_images.sql');
assert.match(migration, /GRANT SELECT \(service_programs, image_path\)[\s\S]*TO anon, authenticated/);
assert.match(migration, /file_size_limit[\s\S]*5242880/);
assert.match(migration, /ARRAY\['image\/jpeg', 'image\/png', 'image\/webp'\]/);
assert.match(migration, /public\.can_publish_opportunities\(\)/);
assert.match(migration, /storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/);
assert.doesNotMatch(migration, /GRANT\s+SELECT\s*\([^)]*organizer_email/i);
console.log('PASS: service/programme filter logic, public image URL mapping, image type/size validation, and storage-policy migration guards.');
