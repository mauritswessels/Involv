// LTI 1.3 launch tests against a simulated Toddle platform. No network is used:
// the platform's keys are generated here and the Supabase sign-in is stubbed.
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { SignJWT, createLocalJWKSet, exportJWK, exportPKCS8, generateKeyPair } from 'jose';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'tests/lti/.build');
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, 'lti.mjs');
await build({ entryPoints: [join(root, 'api/_lib/lti.ts')], outfile: outFile, bundle: true, platform: 'node', format: 'esm',
  external: ['jose', '@supabase/supabase-js'], logLevel: 'silent' });
const lti = await import(pathToFileURL(outFile).href);

const TOOL = 'https://involv.me';
const env = {
  LTI_ISSUER: 'https://web.toddleapp.com', LTI_CLIENT_ID: 'involv-client-123',
  LTI_AUTH_URL: 'https://web.toddleapp.com/lti/authorize', LTI_JWKS_URL: 'https://web.toddleapp.com/lti/jwks',
  LTI_DEPLOYMENT_IDS: 'dep-1', LTI_TOOL_URL: TOOL,
};
const platform = await generateKeyPair('RS256');
const platformJwk = { ...(await exportJWK(platform.publicKey)), kid: 'toddle-1', alg: 'RS256' };
const getKey = createLocalJWKSet({ keys: [platformJwk] });
const attacker = await generateKeyPair('RS256');
const signedIn = [];
const deps = { getKey, createSignInToken: async (email, name) => { signedIn.push({ email, name }); return 'ONE_TIME_TOKEN'; } };
const C = 'https://purl.imsglobal.org/spec/lti/claim/';

async function login(params, method = 'GET') {
  const qs = new URLSearchParams({ iss: env.LTI_ISSUER, login_hint: 'user-42', target_link_uri: `${TOOL}/browse`, client_id: env.LTI_CLIENT_ID,
    lti_message_hint: 'ctx', ...params });
  const req = method === 'GET' ? new Request(`${TOOL}/api/lti/login?${qs}`)
    : new Request(`${TOOL}/api/lti/login`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: qs.toString() });
  return lti.handleLogin(req, env);
}
async function token(overrides = {}, key = platform.privateKey, nonce) {
  const claims = {
    nonce, email: 'mia.keller@iszl.ch', name: 'Mia Keller',
    [C + 'version']: '1.3.0', [C + 'message_type']: 'LtiResourceLinkRequest', [C + 'deployment_id']: 'dep-1',
    [C + 'roles']: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
    [C + 'target_link_uri']: `${TOOL}/browse`, [C + 'resource_link']: { id: 'rl-1' }, ...overrides,
  };
  for (const k of Object.keys(claims)) if (claims[k] === undefined) delete claims[k];
  return new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'toddle-1' }).setIssuer(overrides.iss ?? env.LTI_ISSUER)
    .setAudience(overrides.aud ?? env.LTI_CLIENT_ID).setSubject('user-42').setIssuedAt()
    .setExpirationTime(overrides.exp ?? '5m').sign(key);
}
async function startFlow() {
  const res = await login({});
  assert.equal(res.status, 302);
  const loc = new URL(res.headers.get('location'));
  const cookie = res.headers.get('set-cookie').split(';')[0];
  return { loc, cookie, state: loc.searchParams.get('state'), nonce: loc.searchParams.get('nonce') };
}
function launch(form, cookie) {
  return lti.handleLaunch(new Request(`${TOOL}/api/lti/launch`, { method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...(cookie ? { cookie } : {}) }, body: new URLSearchParams(form).toString() }), env, deps);
}
const results = [];
async function test(name, fn) { await fn(); results.push(name); }

try {
  await test('login redirects to Toddle with the right OIDC parameters and a secure state cookie', async () => {
    const { loc, cookie } = await startFlow();
    assert.equal(loc.origin + loc.pathname, env.LTI_AUTH_URL);
    for (const [k, v] of Object.entries({ scope: 'openid', response_type: 'id_token', response_mode: 'form_post', prompt: 'none',
      client_id: env.LTI_CLIENT_ID, redirect_uri: `${TOOL}/api/lti/launch`, login_hint: 'user-42', lti_message_hint: 'ctx' })) {
      assert.equal(loc.searchParams.get(k), v, k);
    }
    assert.ok(cookie.startsWith('involv_lti_'));
    const full = (await login({})).headers.get('set-cookie');
    for (const attr of ['HttpOnly', 'Secure', 'SameSite=None', 'Partitioned', 'Max-Age=600']) assert.ok(full.includes(attr), attr);
  });
  await test('login also accepts a POST form', async () => assert.equal((await login({}, 'POST')).status, 302));
  await test('login refuses another platform, another client and redirects off-site', async () => {
    assert.equal((await login({ iss: 'https://evil.example' })).status, 400);
    assert.equal((await login({ client_id: 'other' })).status, 400);
    assert.equal((await login({ target_link_uri: 'https://evil.example/steal' })).status, 400);
    assert.equal((await login({ login_hint: '' })).status, 400);
  });
  await test('a valid launch signs in the verified ISZL student and goes to the requested page', async () => {
    const f = await startFlow();
    const res = await launch({ id_token: await token({}, platform.privateKey, f.nonce), state: f.state }, f.cookie);
    assert.equal(res.status, 303);
    const to = new URL(res.headers.get('location'));
    assert.equal(to.pathname, '/lti/complete');
    const hash = new URLSearchParams(to.hash.slice(1));
    assert.equal(hash.get('token_hash'), 'ONE_TIME_TOKEN');
    assert.equal(hash.get('next'), '/browse');
    assert.deepEqual(signedIn.at(-1), { email: 'mia.keller@iszl.ch', name: 'Mia Keller' });
    assert.ok(res.headers.get('set-cookie').includes('Max-Age=0'), 'state cookie is cleared');
  });
  await test('a custom "page" parameter chooses the starting page (in-app paths only)', async () => {
    let f = await startFlow();
    let res = await launch({ id_token: await token({ [C + 'custom']: { page: '/portfolio' } }, platform.privateKey, f.nonce), state: f.state }, f.cookie);
    assert.equal(new URLSearchParams(new URL(res.headers.get('location')).hash.slice(1)).get('next'), '/portfolio');
    f = await startFlow();
    res = await launch({ id_token: await token({ [C + 'custom']: { page: '//evil.example' } }, platform.privateKey, f.nonce), state: f.state }, f.cookie);
    assert.equal(new URLSearchParams(new URL(res.headers.get('location')).hash.slice(1)).get('next'), '/dashboard');
  });
  const before = signedIn.length;
  const rejects = async (label, overrides, opts = {}) => {
    const f = await startFlow();
    const tok = await token(overrides, opts.key ?? platform.privateKey, opts.nonce ?? f.nonce);
    const res = await launch({ id_token: opts.tamper ? tok.slice(0, -4) + 'AAAA' : tok, state: opts.state ?? f.state }, opts.noCookie ? undefined : f.cookie);
    assert.ok(res.status >= 400 && res.status < 500, `${label}: expected refusal, got ${res.status}`);
    return res;
  };
  await test('refuses a token signed by anyone but Toddle', () => rejects('forged', {}, { key: attacker.privateKey }));
  await test('refuses a tampered token', () => rejects('tampered', {}, { tamper: true }));
  await test('refuses another issuer or audience', async () => { await rejects('iss', { iss: 'https://evil.example' }); await rejects('aud', { aud: 'other-client' }); });
  await test('refuses an expired token', () => rejects('expired', { exp: Math.floor(Date.now() / 1000) - 600 }));
  await test('refuses a wrong nonce (replayed token)', () => rejects('nonce', {}, { nonce: 'not-the-one' }));
  await test('refuses a launch without its state cookie (CSRF / expired)', () => rejects('cookie', {}, { noCookie: true }));
  await test('refuses an unknown deployment', () => rejects('deployment', { [C + 'deployment_id']: 'dep-999' }));
  await test('refuses other LTI message types and versions', async () => {
    await rejects('deep-link', { [C + 'message_type']: 'LtiDeepLinkingRequest' });
    await rejects('version', { [C + 'version']: '1.1' });
  });
  await test('refuses non-ISZL and missing emails', async () => {
    const r1 = await rejects('gmail', { email: 'someone@gmail.com' });
    assert.match(await r1.text(), /ISZL accounts only/);
    const r2 = await rejects('no-email', { email: undefined });
    assert.match(await r2.text(), /privacy level/);
  });
  await test('no refused launch ever created a sign-in', () => assert.equal(signedIn.length, before));
  await test('without a Supabase service key (demo mode) teachers get the teacher demo, students the student demo', async () => {
    const demoDeps = { getKey, createSignInToken: async () => { throw new Error('missing-service-key'); } };
    for (const [roles, expected] of [[['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'], 'teacher'],
      [['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'], 'student']]) {
      const f = await startFlow();
      const res = await lti.handleLaunch(new Request(`${TOOL}/api/lti/launch`, { method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: f.cookie },
        body: new URLSearchParams({ id_token: await token({ [C + 'roles']: roles }, platform.privateKey, f.nonce), state: f.state }).toString() }), env, demoDeps);
      const hash = new URLSearchParams(new URL(res.headers.get('location')).hash.slice(1));
      assert.equal(hash.get('demo'), expected); assert.equal(hash.get('token_hash'), null);
    }
  });
  await test('before Toddle is configured, both endpoints explain instead of failing', async () => {
    assert.equal((await lti.handleLogin(new Request(`${TOOL}/api/lti/login`), {})).status, 503);
    assert.equal((await lti.handleLaunch(new Request(`${TOOL}/api/lti/launch`, { method: 'POST' }), {})).status, 503);
  });
  await test('key set publishes only the public half of Involv\'s key', async () => {
    const { privateKey } = await generateKeyPair('RS256', { extractable: true });
    const body = await (await lti.handleJwks({ LTI_PRIVATE_KEY: await exportPKCS8(privateKey) })).json();
    assert.equal(body.keys.length, 1);
    for (const secret of ['d', 'p', 'q', 'dp', 'dq', 'qi']) assert.equal(body.keys[0][secret], undefined);
    assert.deepEqual(await (await lti.handleJwks({})).json(), { keys: [] });
  });
  await test('safePath keeps redirects inside Involv', () => {
    assert.equal(lti.safePath('/browse?x=1'), '/browse?x=1');
    for (const bad of ['https://evil.example', '//evil.example', '/api/lti/login', 'javascript:alert(1)', null]) assert.equal(lti.safePath(bad), '/dashboard');
  });
  for (const r of results) console.log('PASS:', r);
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
