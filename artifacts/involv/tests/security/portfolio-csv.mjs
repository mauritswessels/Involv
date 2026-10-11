// Execute the actual TypeScript serializer, with type imports erased.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source = readFileSync(new URL('../../src/utils/portfolioCsv.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const { csvCell, portfolioCsv } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
for (const attack of ['=HYPERLINK("evil")', '+1+1', '-2+3', '@SUM(1)', '  =1+1', '\t=1+1', '\rtext', '\ntext']) {
  assert.ok(csvCell(attack).startsWith(`"'`), `Formula/control input must be neutralised: ${JSON.stringify(attack)}`);
}
assert.equal(csvCell('Helped "students", together'), '"Helped ""students"", together"');
assert.equal(csvCell('Meaningful service'), '"Meaningful service"');
assert.equal(csvCell(2.75), '"2.75"');
const base = {
  activityTitle: '=unsafe title', activityCategory: 'School-Based Service', activityStatus: 'closed',
  date: '2026-10-01', hours: 2.75, description: 'Helped "students", together',
  reviewerName: '@unsafe reviewer', reviewedAt: '2026-10-02T12:00:00Z', reviewNote: '+unsafe note',
};
const csv = portfolioCsv(['approved', 'pending', 'rejected'].map(status => ({ ...base, status })));
assert.ok(csv.startsWith('\uFEFF'));
const lines = csv.slice(1).trimEnd().split('\r\n');
assert.equal(lines.length, 4);
assert.ok(lines[1].includes('"approved","2.75"'));
assert.ok(lines[2].includes('"pending","0.00"'));
assert.ok(lines[3].includes('"rejected","0.00"'));
assert.ok(csv.includes(`"'=unsafe title"`));
assert.ok(csv.includes(`"'@unsafe reviewer"`));
assert.ok(csv.includes(`"'+unsafe note"`));
assert.equal(portfolioCsv([]).split('\r\n').length, 2);
console.log('PASS: real portfolio CSV escaping, formula/control injection safety, approved-only credit column, empty export and UTF-8 BOM.');
