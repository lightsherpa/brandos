// In-process fixed-window rate limiting for the API perimeter (CAA-50 / S1).
//
// Deliberately NOT a distributed limiter. RC1 runs a single Render web service,
// so a per-process window is the honest zero-dependency control: no new vendor,
// no new failure mode. If we ever run >1 instance the buckets become per-instance
// and the effective ceiling multiplies by the instance count — it degrades, it
// does not fail open in a surprising way. Swapping in Redis later touches only
// `createRateLimiter`.
//
// The IP resolver is the security-critical part: X-Forwarded-For is attacker-
// controlled, so we only read it when TRUST_PROXY says a known proxy rewrites it,
// and we count hops from the RIGHT (the end a proxy appends to) so spoofed
// left-hand entries cannot move a client into a fresh bucket.
//
// No I/O — the pure helpers are testable with case tables.

/** Strip an IPv6 zone/bracket wrapper, a trailing :port, and the ::ffff: v4 map. */
export function normalizeIp(raw) {
  let ip = String(raw ?? "").trim();
  if (!ip) return "";
  if (ip.startsWith("[")) ip = ip.slice(1, ip.indexOf("]") === -1 ? undefined : ip.indexOf("]"));
  // "1.2.3.4:5678" — only strip the port when there is exactly one colon (v4).
  if (ip.split(":").length === 2 && ip.includes(".")) ip = ip.slice(0, ip.indexOf(":"));
  if (ip.toLowerCase().startsWith("::ffff:") && ip.includes(".")) ip = ip.slice(7);
  return ip.toLowerCase();
}

/** "client, proxy1, proxy2" → ["client","proxy1","proxy2"] (normalized, empties dropped). */
export function parseForwardedFor(header) {
  return String(header ?? "")
    .split(",")
    .map((part) => normalizeIp(part))
    .filter(Boolean);
}

/**
 * Resolve the client IP to bucket on.
 *
 * `hops` = how many proxies sit between the public internet and this process.
 * The right-most `hops` entries of X-Forwarded-For were written by infrastructure
 * we trust, so the client is at `length - hops`. A client that pre-seeds XFF only
 * pollutes the left of the list, which we never read.
 *
 * With trustProxy off we ignore forwarding headers entirely — the socket peer is
 * the only value an attacker cannot choose.
 */
export function clientIpFrom({ forwardedFor, realIp, remoteAddr, trustProxy = false, hops = 1 } = {}) {
  if (trustProxy) {
    const chain = parseForwardedFor(forwardedFor);
    if (chain.length) return chain[Math.max(0, chain.length - Math.max(1, hops))];
    const real = normalizeIp(realIp);
    if (real) return real;
  }
  return normalizeIp(remoteAddr) || "unknown";
}

/**
 * Fixed-window counter with a bounded key space.
 *
 * The bound matters: the key is derived from client input (IP), so an unbounded
 * Map is itself a memory-exhaustion vector. We sweep expired windows first and
 * only then evict the oldest insertion, which is the least-recently-started
 * window — good enough for an abuse control, and it never grows without limit.
 */
export function createRateLimiter({ windowMs = 60_000, max = 60, maxKeys = 20_000 } = {}) {
  const windows = new Map(); // key → { count, resetAt }

  function sweep(now) {
    for (const [key, win] of windows) {
      if (win.resetAt <= now) windows.delete(key);
    }
  }

  function hit(key, now = Date.now()) {
    let win = windows.get(key);
    if (!win || win.resetAt <= now) {
      if (!windows.has(key) && windows.size >= maxKeys) {
        sweep(now);
        if (windows.size >= maxKeys) windows.delete(windows.keys().next().value);
      }
      win = { count: 0, resetAt: now + windowMs };
      windows.set(key, win);
    }
    win.count += 1;
    const allowed = win.count <= max;
    return {
      allowed,
      limit: max,
      remaining: Math.max(0, max - win.count),
      resetAt: win.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((win.resetAt - now) / 1000)),
    };
  }

  return {
    hit,
    size: () => windows.size,
    reset: () => windows.clear(),
    windowMs,
    max,
  };
}

/** Advertise the budget on every response so clients can back off before 429. */
export function setRateLimitHeaders(c, result) {
  c.header("RateLimit-Limit", String(result.limit));
  c.header("RateLimit-Remaining", String(result.remaining));
  c.header("RateLimit-Reset", String(Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000))));
}

/** Uniform 429 body. Public error code, no internal detail. */
export function rateLimitedResponse(c, result) {
  setRateLimitHeaders(c, result);
  c.header("Retry-After", String(result.retryAfterSeconds));
  return c.json(
    { error: "Too many requests", code: "RATE_LIMITED", retryAfterSeconds: result.retryAfterSeconds },
    429,
  );
}
