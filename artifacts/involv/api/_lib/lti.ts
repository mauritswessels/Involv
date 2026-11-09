/**
 * LTI 1.3 tool for Involv, so Toddle (or any LTI 1.3 platform) can open Involv
 * from inside a course with the student already signed in.
 *
 * Flow (IMS LTI 1.3 / OIDC third-party initiated login):
 *   1. Toddle → GET|POST /api/lti/login          (iss, login_hint, target_link_uri, …)
 *      We check the platform, set a short-lived state cookie and send the browser
 *      back to Toddle's authorisation endpoint.
 *   2. Toddle → POST /api/lti/launch             (id_token, state)
 *      We verify the signed token against Toddle's public keys, the state cookie,
 *      the nonce, audience, deployment and message type, and require a verified
 *      @iszl.ch email. Then we create a one-time Supabase sign-in token.
 *   3. Browser → /lti/complete#token_hash=…       (React page)
 *      The page exchanges the one-time token for a normal Involv session.
 *
 * Nothing here grants extra rights: everyone arrives as their normal Involv user,
 * new accounts start as students, and teacher/admin roles still come only from an
 * Involv admin. The Supabase "Before User Created" hook still blocks non-ISZL emails.
 */
import { createRemoteJWKSet, exportJWK, importPKCS8, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { createHash, randomBytes } from 'node:crypto';

export type Env = Record<string, string | undefined>;

export interface LtiConfig {
  issuer: string;
  clientId: string;
  authUrl: string;
  jwksUrl: string;
  deploymentIds: string[];
  toolUrl: string | null;
}

export interface LtiDeps {
  /** Key lookup for the platform's signing keys (defaults to fetching LTI_JWKS_URL). */
  getKey?: JWTVerifyGetKey;
  /** Creates a one-time Supabase sign-in token for this verified email (defaults to the Supabase admin API). */
  createSignInToken?: (email: string, name: string) => Promise<string>;
}

const CLAIM = 'https://purl.imsglobal.org/spec/lti/claim/';
const SCHOOL_EMAIL = /^[^@\s]+@iszl\.ch$/i;
const COOKIE_PREFIX = 'involv_lti_';
const STATE_TTL_SECONDS = 600;

export function readConfig(env: Env): LtiConfig | null {
  const issuer = env.LTI_ISSUER?.trim(), clientId = env.LTI_CLIENT_ID?.trim();
  const authUrl = env.LTI_AUTH_URL?.trim(), jwksUrl = env.LTI_JWKS_URL?.trim();
  if (!issuer || !clientId || !authUrl || !jwksUrl) return null;
  return {
    issuer, clientId, authUrl, jwksUrl,
    deploymentIds: (env.LTI_DEPLOYMENT_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean),
    toolUrl: env.LTI_TOOL_URL?.trim().replace(/\/+$/, '') || null,
  };
}

const toolBase = (request: Request, config: LtiConfig | null) => config?.toolUrl ?? new URL(request.url).origin;
const random = () => randomBytes(32).toString('base64url');

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** A small, self-contained page for problems the visitor can understand and act on. */
export function problemPage(status: number, title: string, message: string, base = '/'): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} · Involv</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f8fafc;color:#0f172a;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
main{background:#fff;border:1px solid #e2e8f0;border-radius:16px;max-width:440px;padding:28px}h1{font-size:18px;margin:0 0 8px}p{font-size:14px;line-height:1.5;color:#475569;margin:0 0 16px}
a{color:#1e3a8a}</style></head><body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>
<p><a href="${escapeHtml(base)}" target="_blank" rel="noopener">Open Involv in a new tab</a></p></main></body></html>`;
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

async function readParams(request: Request): Promise<URLSearchParams> {
  const params = new URLSearchParams(new URL(request.url).search);
  if (request.method === 'POST') {
    const type = request.headers.get('content-type') ?? '';
    if (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) {
      const form = await request.formData();
      form.forEach((value, key) => { if (typeof value === 'string') params.set(key, value); });
    }
  }
  return params;
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

const cookieAttrs = `Path=/api/lti; HttpOnly; Secure; SameSite=None; Partitioned`;

/** Step 1: OIDC login initiation from the platform. */
export async function handleLogin(request: Request, env: Env): Promise<Response> {
  const config = readConfig(env);
  if (!config) return problemPage(503, 'Toddle connection not set up yet', 'Involv has not been connected to Toddle yet. Ask the site administrator to finish the setup in docs/TODDLE_LTI.md.');
  const base = toolBase(request, config);
  const p = await readParams(request);
  const iss = p.get('iss'), loginHint = p.get('login_hint'), target = p.get('target_link_uri') ?? `${base}/dashboard`;
  const clientId = p.get('client_id');
  if (iss !== config.issuer) return problemPage(400, 'Unknown platform', 'This launch did not come from the Toddle site Involv is connected to.', base);
  if (clientId && clientId !== config.clientId) return problemPage(400, 'Unknown tool registration', 'This launch is for a different tool registration.', base);
  if (!loginHint) return problemPage(400, 'Launch incomplete', 'Toddle did not send who is signing in. Please open Involv from Toddle again.', base);
  let targetUrl: URL;
  try { targetUrl = new URL(target); } catch { return problemPage(400, 'Launch incomplete', 'The launch address was not valid.', base); }
  if (targetUrl.origin !== new URL(base).origin) return problemPage(400, 'Launch blocked', 'The launch tried to send you to a site that is not Involv.', base);

  const state = random(), nonce = random();
  const auth = new URL(config.authUrl);
  const query: Record<string, string> = {
    scope: 'openid', response_type: 'id_token', response_mode: 'form_post', prompt: 'none',
    client_id: config.clientId, redirect_uri: `${base}/api/lti/launch`, login_hint: loginHint, state, nonce,
  };
  const messageHint = p.get('lti_message_hint');
  if (messageHint) query.lti_message_hint = messageHint;
  Object.entries(query).forEach(([k, v]) => auth.searchParams.set(k, v));

  return new Response(null, {
    status: 302,
    headers: {
      location: auth.toString(), 'cache-control': 'no-store',
      'set-cookie': `${COOKIE_PREFIX}${state}=${encodeURIComponent(`${nonce}|${targetUrl.pathname}${targetUrl.search}`)}; Max-Age=${STATE_TTL_SECONDS}; ${cookieAttrs}`,
    },
  });
}

function claim<T = unknown>(payload: JWTPayload, name: string): T | undefined {
  return (payload as Record<string, unknown>)[CLAIM + name] as T | undefined;
}

/** Only allow in-app paths so a launch can never redirect somewhere else. */
export function safePath(path: string | null | undefined): string {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/api/')) return '/dashboard';
  return /^\/[A-Za-z0-9/_\-?=&%.#]*$/.test(path) ? path : '/dashboard';
}

function demoRole(roles: string[]): 'student' | 'teacher' | 'admin' {
  if (roles.some(r => /Administrator/i.test(r) && /institution|system/i.test(r))) return 'admin';
  if (roles.some(r => /#(Instructor|Administrator|ContentDeveloper|Mentor)$|Instructor|Faculty|Staff/i.test(r))) return 'teacher';
  return 'student';
}

async function supabaseSignInToken(env: Env, email: string, name: string): Promise<string> {
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('missing-service-key');
  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(url.replace(/\/rest\/v1\/?$/, ''), key, { auth: { persistSession: false, autoRefreshToken: false } });
  const generate = () => admin.auth.admin.generateLink({ type: 'magiclink', email, options: { data: { full_name: name } } });
  let { data, error } = await generate();
  if (error) {
    // First visit: create the account (still subject to the ISZL-only sign-up hook), then retry.
    const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: name } });
    if (created.error && !/already/i.test(created.error.message)) throw created.error;
    ({ data, error } = await generate());
  }
  const token = data?.properties?.hashed_token;
  if (error || !token) throw error ?? new Error('no-token');
  return token;
}

/** Step 2: the platform posts the signed id_token back. */
export async function handleLaunch(request: Request, env: Env, deps: LtiDeps = {}): Promise<Response> {
  const config = readConfig(env);
  if (!config) return problemPage(503, 'Toddle connection not set up yet', 'Involv has not been connected to Toddle yet.');
  const base = toolBase(request, config);
  if (request.method !== 'POST') return problemPage(405, 'Open Involv from Toddle', 'This address is only used when Toddle opens Involv.', base);
  const p = await readParams(request);
  const idToken = p.get('id_token'), state = p.get('state');
  if (p.get('error')) {
    return problemPage(400, 'Toddle could not sign you in', `Toddle reported: ${p.get('error_description') || p.get('error')}. Please try again from Toddle.`, base);
  }
  if (!idToken || !state || !/^[A-Za-z0-9_-]{20,}$/.test(state)) return problemPage(400, 'Launch incomplete', 'Please open Involv from Toddle again.', base);

  const cookieName = `${COOKIE_PREFIX}${state}`;
  const stored = readCookie(request, cookieName);
  const clearCookie = `${cookieName}=; Max-Age=0; ${cookieAttrs}`;
  if (!stored) {
    return problemPage(400, 'Sign-in timed out', 'Your sign-in link from Toddle expired or was already used, or your browser blocked a cookie. Please open Involv from Toddle again.', base);
  }
  const [expectedNonce, storedTarget] = stored.split('|');

  let payload: JWTPayload;
  try {
    const getKey = deps.getKey ?? createRemoteJWKSet(new URL(config.jwksUrl));
    ({ payload } = await jwtVerify(idToken, getKey, {
      issuer: config.issuer, audience: config.clientId, algorithms: ['RS256', 'RS384', 'RS512', 'ES256'], clockTolerance: 60,
    }));
  } catch {
    return problemPage(401, 'Could not verify Toddle', 'Involv could not confirm this sign-in really came from Toddle. Please try again.', base);
  }

  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const problems: string[] = [];
  if (payload.nonce !== expectedNonce) problems.push('nonce');
  if (aud.length > 1 && payload.azp !== config.clientId) problems.push('azp');
  if (claim(payload, 'version') !== '1.3.0') problems.push('version');
  if (claim(payload, 'message_type') !== 'LtiResourceLinkRequest') problems.push('message_type');
  const deployment = claim<string>(payload, 'deployment_id');
  if (!deployment || (config.deploymentIds.length && !config.deploymentIds.includes(deployment))) problems.push('deployment');
  if (problems.length) {
    return new Response(problemPage(401, 'Could not verify Toddle', 'This sign-in did not pass Involv\'s checks. Please open Involv from Toddle again.', base).body,
      { status: 401, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'set-cookie': clearCookie, 'x-lti-problem': problems.join(',') } });
  }

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const name = [payload.name, [payload.given_name, payload.family_name].filter(Boolean).join(' ')]
    .find(v => typeof v === 'string' && v.trim()) as string | undefined ?? '';
  if (!email) {
    return problemPage(403, 'Toddle did not share your school email', 'Involv needs your name and school email to sign you in. Ask your Toddle admin to set the Involv app\'s privacy level to "Public".', base);
  }
  if (!SCHOOL_EMAIL.test(email)) {
    return problemPage(403, 'ISZL accounts only', 'Involv is only available to @iszl.ch accounts.', base);
  }

  const custom = claim<Record<string, string>>(payload, 'custom') ?? {};
  const targetClaim = claim<string>(payload, 'target_link_uri');
  let next = safePath(custom.page ?? storedTarget);
  if (!custom.page && targetClaim) {
    try { const t = new URL(targetClaim); if (t.origin === new URL(base).origin) next = safePath(`${t.pathname}${t.search}`); } catch { /* keep */ }
  }
  if (next === '/' || next.startsWith('/api/lti')) next = '/dashboard';

  const headers = new Headers({ 'cache-control': 'no-store', 'set-cookie': clearCookie, 'referrer-policy': 'no-referrer' });
  const hash = new URLSearchParams({ next });
  try {
    const token = await (deps.createSignInToken ?? ((e: string, n: string) => supabaseSignInToken(env, e, n)))(email, name);
    hash.set('token_hash', token);
  } catch (err) {
    if (err instanceof Error && err.message === 'missing-service-key') {
      // No database connection configured (e.g. the site is in demo mode): hand over a demo role instead.
      const roles = claim<string[]>(payload, 'roles') ?? [];
      hash.set('demo', demoRole(roles));
    } else {
      return problemPage(500, 'Could not sign you in', 'Involv could not create your session. Please try again in a moment.', base);
    }
  }
  headers.set('location', `${base}/lti/complete#${hash.toString()}`);
  return new Response(null, { status: 303, headers });
}

/** Involv's public key set (only needed if Toddle services such as roster access are enabled). */
export async function handleJwks(env: Env): Promise<Response> {
  const pem = env.LTI_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  const keys: Record<string, unknown>[] = [];
  if (pem) {
    try {
      const key = await importPKCS8(pem, 'RS256', { extractable: true });
      const jwk = await exportJWK(key);
      const publicJwk = { kty: jwk.kty, n: jwk.n, e: jwk.e };
      const kid = env.LTI_KEY_ID?.trim() || createHash('sha256').update(JSON.stringify(publicJwk)).digest('base64url').slice(0, 16);
      keys.push({ ...publicJwk, alg: 'RS256', use: 'sig', kid });
    } catch { /* misconfigured key: publish none rather than leak details */ }
  }
  return new Response(JSON.stringify({ keys }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
  });
}
