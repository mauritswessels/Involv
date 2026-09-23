import { performance } from 'node:perf_hooks';

const targetUrl = process.env.TARGET_URL;
if (!targetUrl) {
  console.error('TARGET_URL is required. Use a staging URL, not production.');
  process.exit(2);
}

function safeTarget(name, value) {
  if (!value) return null;
  const parsed = new URL(value);
  const isLocalOrDev =
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname.endsWith('.replit.dev');

  if (!isLocalOrDev && process.env.ALLOW_EXTERNAL_LOAD_TEST !== 'true') {
    console.error(
      `Refusing external ${name} host ${parsed.hostname}. Confirm every target is staging, then deliberately set ALLOW_EXTERNAL_LOAD_TEST=true.`,
    );
    process.exit(2);
  }
  return parsed;
}

const target = safeTarget('TARGET_URL', targetUrl);
const virtualUsers = Number(process.env.VUS ?? 50);
const durationSeconds = Number(process.env.DURATION_SECONDS ?? 30);
const p95LimitMs = Number(process.env.P95_LIMIT_MS ?? 1500);
const maxErrorRate = Number(process.env.MAX_ERROR_RATE ?? 0.01);

if (!Number.isInteger(virtualUsers) || virtualUsers < 1 || virtualUsers > 250) {
  throw new Error('VUS must be an integer between 1 and 250.');
}
if (!Number.isFinite(durationSeconds) || durationSeconds < 5 || durationSeconds > 600) {
  throw new Error('DURATION_SECONDS must be between 5 and 600.');
}

const rawSupabaseUrl =
  process.env.SKIP_SUPABASE === 'true'
    ? ''
    : (
        process.env.VITE_SUPABASE_URL ??
        process.env.SUPABASE_URL ??
        ''
      ).replace(/\/rest\/v1\/?$/, '');
const supabaseTarget = safeTarget('SUPABASE_URL', rawSupabaseUrl);
const supabaseAnonKey =
  process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';
const apiTarget = safeTarget('API_TARGET_URL', process.env.API_TARGET_URL);

const metrics = new Map();

function metricFor(label) {
  const existing = metrics.get(label);
  if (existing) return existing;
  const metric = { latencies: [], total: 0, failed: 0 };
  metrics.set(label, metric);
  return metric;
}

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

async function measuredFetch(label, url, options = {}, expectedStatuses = [200]) {
  const metric = metricFor(label);
  const started = performance.now();
  metric.total += 1;
  try {
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(10_000),
      headers: {
        accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
        'user-agent': 'Involv-Launch-Readiness-Test/1.0',
        ...options.headers,
      },
    });
    await response.arrayBuffer();
    if (!expectedStatuses.includes(response.status)) metric.failed += 1;
  } catch {
    metric.failed += 1;
  } finally {
    metric.latencies.push(performance.now() - started);
  }
}

async function virtualUser(endAt) {
  if (apiTarget) {
    await measuredFetch(
      'api-readiness',
      new URL('/api/readiness', apiTarget),
    );
  }

  while (Date.now() < endAt) {
    await Promise.all([
      measuredFetch('frontend-home', new URL('/', target)),
      measuredFetch('frontend-browse', new URL('/browse', target)),
      ...(supabaseTarget && supabaseAnonKey
        ? [
            measuredFetch(
              'supabase-opportunities',
              `${supabaseTarget.origin}/rest/v1/opportunities?select=id,title,status,created_at&status=eq.active&order=created_at.desc&limit=12`,
              {
                headers: {
                  apikey: supabaseAnonKey,
                  authorization: `Bearer ${supabaseAnonKey}`,
                },
              },
            ),
          ]
        : []),
    ]);

    await new Promise((resolve) =>
      setTimeout(resolve, 500 + Math.floor(Math.random() * 1000)),
    );
  }
}

console.log(
  `Starting read-only launch test: ${virtualUsers} users for ${durationSeconds}s against ${target.origin}`,
);

const startedAt = Date.now();
const endAt = startedAt + durationSeconds * 1000;
await Promise.all(
  Array.from({ length: virtualUsers }, () => virtualUser(endAt)),
);

const elapsedSeconds = (Date.now() - startedAt) / 1000;
let failedThreshold = false;
const rows = {};
for (const [label, metric] of metrics) {
  const errorRate = metric.total === 0 ? 1 : metric.failed / metric.total;
  const p95 = percentile(metric.latencies, 0.95);
  rows[label] = {
    requests: metric.total,
    failed: metric.failed,
    errorRate: `${(errorRate * 100).toFixed(2)}%`,
    requestsPerSecond: (metric.total / elapsedSeconds).toFixed(2),
    p50Ms: percentile(metric.latencies, 0.5).toFixed(0),
    p95Ms: p95.toFixed(0),
    p99Ms: percentile(metric.latencies, 0.99).toFixed(0),
  };
  if (errorRate > maxErrorRate || p95 > p95LimitMs) {
    failedThreshold = true;
  }
}
console.table(rows);

if (failedThreshold) {
  console.error(
    `One or more endpoint groups failed: error rate must be <= ${maxErrorRate * 100}% and p95 <= ${p95LimitMs}ms.`,
  );
  process.exit(1);
}

console.log('Launch thresholds passed.');