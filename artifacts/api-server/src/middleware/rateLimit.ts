import type { RequestHandler } from "express";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const windowMs = positiveInteger(process.env.API_RATE_LIMIT_WINDOW_MS, 60_000);
const maxRequests = positiveInteger(process.env.API_RATE_LIMIT_MAX, 120);

const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, windowMs);
cleanup.unref();

export const apiRateLimit: RequestHandler = (req, res, next) => {
  if (req.method === "OPTIONS" || req.path === "/healthz") {
    next();
    return;
  }

  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const existing = buckets.get(key);
  const bucket =
    !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : existing;

  bucket.count += 1;
  buckets.set(key, bucket);

  const remaining = Math.max(0, maxRequests - bucket.count);
  const resetSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

  res.setHeader("RateLimit-Limit", String(maxRequests));
  res.setHeader("RateLimit-Remaining", String(remaining));
  res.setHeader("RateLimit-Reset", String(resetSeconds));

  if (bucket.count > maxRequests) {
    res.setHeader("Retry-After", String(resetSeconds));
    res.status(429).json({
      error: "Too many requests",
      message: "Please wait before trying again.",
      retryAfterSeconds: resetSeconds,
    });
    return;
  }

  next();
};