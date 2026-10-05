import { createHash } from "node:crypto";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

/*
 * Direct client IPs are high-entropy; hashing keeps the in-memory map
 * (and any logs derived from it) free of raw, GDPR-relevant addresses
 * while remaining perfectly stable for rate-limit bucketing.
 */
function hashKey(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 32);
}

/**
 * Derive a rate-limit key for a request.
 *
 * `x-forwarded-for` is only honoured when TRUST_PROXY=true. Without that
 * flag (the default), the header is client-controllable and would let an
 * attacker rotate fake IPs to bypass per-IP limits.
 *
 * When the real client IP is not available (unproxied deployments), the
 * key is a coarse fingerprint of the request itself — hashed user agent
 * plus accept-language — rather than a constant. This keeps limits
 * per-client-ish while staying privacy-preserving (no IP is stored).
 * A fingerprint is spoofable, so it complements — never replaces — the
 * database-backed limiter in `rateLimitDb`.
 */
export function requestKey(request: Request): string {
  if (process.env.TRUST_PROXY === "true") {
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim();
    if (ip) return hashKey(ip);
    return hashKey("unknown-client");
  }

  const ua = request.headers.get("user-agent") ?? "";
  const lang = request.headers.get("accept-language") ?? "";
  return hashKey(`${ua}::${lang}`);
}

export function rateLimit(
  key: string,
  limit = 30,
  windowMs = 60_000,
) {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;

  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    retryAfter: Math.ceil((existing.resetAt - now) / 1000),
  };
}
