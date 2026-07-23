import "server-only";

/** Minimal in-memory sliding-window rate limiter.
 * Good enough for a single dev/demo instance; production should swap this for
 * Upstash Redis (or Postgres) so limits survive restarts and scale horizontally.
 * Keyed by IP — never trust client-provided identifiers. */
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

export function clientKey(req: Request): string {
  // Behind Vercel/Cloudflare the leftmost x-forwarded-for entry is the client.
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "local";
}
