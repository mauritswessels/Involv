import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourceRoot = path.join(packageRoot, 'src');
const loggerPath = path.join(sourceRoot, 'utils/safeConsole.ts');

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async entry => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectSourceFiles(entryPath);
      return /\.(?:ts|tsx|js|jsx)$/.test(entry.name) ? [entryPath] : [];
    }),
  );
  return nested.flat();
}

const sourceFiles = await collectSourceFiles(sourceRoot);
const directConsolePattern = /\bconsole\s*\.\s*(?:log|info|warn|error|debug|trace|table|dir)\b/g;

for (const filePath of sourceFiles) {
  const source = await readFile(filePath, 'utf8');
  const consoleCalls = [...source.matchAll(directConsolePattern)];
  if (filePath === loggerPath) {
    assert.ok(consoleCalls.length > 0, 'the shared safe logger should own console output');
  } else {
    assert.equal(
      consoleCalls.length,
      0,
      `${path.relative(sourceRoot, filePath)} must use the safe logging wrapper`,
    );
  }
}

const distAssets = path.join(packageRoot, 'dist/assets');
const jsAssets = (await readdir(distAssets)).filter(file => file.endsWith('.js'));
assert.ok(jsAssets.length > 0, 'run the production build before this check');
const bundle = (
  await Promise.all(jsAssets.map(file => readFile(path.join(distAssets, file), 'utf8')))
).join('\n');
assert.ok(bundle.includes('[Auth] profile loading failed'), 'production bundle includes auth diagnostics');
assert.ok(bundle.includes('[Involv] Unhandled interface error'), 'production bundle includes safe UI diagnostics');

const loggerSource = await readFile(loggerPath, 'utf8');
const loggerJavaScript = ts.transpileModule(loggerSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { logSafeError, logSafeInfo } = await import(
  `data:text/javascript;base64,${Buffer.from(loggerJavaScript).toString('base64')}`
);

const capturedErrors = [];
const capturedInfo = [];
const originalError = console.error;
const originalInfo = console.info;
console.error = (...args) => capturedErrors.push(args);
console.info = (...args) => capturedInfo.push(args);

const privateEmail = 'student.test@iszl.ch';
const privateRecord = 'private profile and application text for the regression test';

try {
  logSafeError(
    '[Auth] profile loading failed',
    Object.assign(new Error(`Request for ${privateEmail} failed: ${privateRecord}`), {
      name: privateEmail,
      code: '23505',
      status: 409,
      details: privateRecord,
    }),
  );
  logSafeError(
    '[Applications] save failed',
    Object.assign(new Error(privateRecord), { code: 'FlorenceHSB' }),
  );
  logSafeError(
    '[Involv] Unhandled interface error',
    new Error(privateRecord),
    { componentStack: ` at ProfilePage\n at ${privateEmail}` },
  );
  logSafeInfo('[Seed] Opportunity seed completed', 12);
} finally {
  console.error = originalError;
  console.info = originalInfo;
}

const capturedOutput = JSON.stringify({ capturedErrors, capturedInfo });
assert.ok(!capturedOutput.includes(privateEmail), 'logged browser diagnostics must not contain email addresses');
assert.ok(!capturedOutput.includes(privateRecord), 'logged browser diagnostics must not contain profile or application content');
assert.ok(capturedOutput.includes('23505'), 'safe database error codes should remain diagnosable');
assert.ok(capturedOutput.includes('409'), 'safe HTTP status codes should remain diagnosable');
assert.ok(capturedOutput.includes('[Auth] profile loading failed'), 'static operation labels should remain diagnosable');
assert.ok(capturedOutput.includes('[redacted]'), 'component diagnostics should redact email addresses');
assert.ok(capturedOutput.includes('"count":12'), 'safe numeric operational counts should remain available');

console.log('PASS: production app logs use the safe wrapper; mock errors retain operation/code/status without emails or profile/application content.');
