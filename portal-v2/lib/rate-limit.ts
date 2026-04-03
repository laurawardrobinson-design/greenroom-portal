import { NextRequest, NextResponse } from "next/server";

// --- Configuration ---

interface TierConfig {
  limit: number;
  windowMs: number;
}

const TIERS: Record<string, TierConfig> = {
  general: { limit: 100, windowMs: 60_000 },
  strict: { limit: 10, windowMs: 60_000 },
  auth: { limit: 20, windowMs: 300_000 },
};

/** Routes matched against pathname — first match wins. */
const ROUTE_TIERS: { match: (path: string, method: string) => boolean; tier: string }[] = [
  { match: (p) => p === "/api/scrape-link", tier: "strict" },
  { match: (p, m) => p === "/api/invoices" && m === "POST", tier: "strict" },
  { match: (p) => p.startsWith("/api/auth/"), tier: "auth" },
];

// --- In-memory store ---

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

// Cleanup expired entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) store.delete(key);
  }
}, 60_000).unref?.();

// --- Public API ---

function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

function getTier(pathname: string, method: string): TierConfig {
  const found = ROUTE_TIERS.find((r) => r.match(pathname, method));
  return TIERS[found?.tier ?? "general"];
}

/**
 * Check rate limit for an incoming API request.
 * Returns a 429 response if the limit is exceeded, or null if the request is allowed.
 * Attaches standard rate-limit headers to `response` when provided.
 */
export function checkRateLimit(
  request: NextRequest,
  response: NextResponse
): NextResponse | null {
  const pathname = request.nextUrl.pathname;
  const method = request.method;
  const tier = getTier(pathname, method);
  const ip = getClientIp(request);
  const key = `${ip}:${pathname}`;
  const now = Date.now();

  let entry = store.get(key);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + tier.windowMs };
    store.set(key, entry);
  }

  entry.count++;

  const remaining = Math.max(0, tier.limit - entry.count);
  const resetSeconds = Math.ceil((entry.resetAt - now) / 1000);

  // Attach rate-limit headers to the passing response
  response.headers.set("X-RateLimit-Limit", String(tier.limit));
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  response.headers.set("X-RateLimit-Reset", String(resetSeconds));

  if (entry.count > tier.limit) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(resetSeconds),
          "X-RateLimit-Limit": String(tier.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(resetSeconds),
        },
      }
    );
  }

  return null;
}
