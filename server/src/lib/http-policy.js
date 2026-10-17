// HTTP perimeter policy for the CaastorOS API (CAA-50 / S1 + S3).
//
// One place decides, for every inbound request: which abuse class it belongs to,
// how many requests per window an IP and an authenticated user may spend on it,
// how large its body may be, which security headers ship on the way out, and
// whether its Origin is allowed to read the response.
//
// Design constraints this file is answering to:
//   · Preserve product flow. Limits are abuse ceilings, not product quotas —
//     credits/opex guardrails already govern spend. A normal session (SSE runs,
//     3–10s BIO polling, multi-specialist brief batches) must never see a 429.
//   · Never break the signed callbacks. Stripe and Inngest authenticate by
//     signature, arrive from provider IP ranges we cannot bucket usefully, and
//     retry on failure — so they are exempt from throttling and get a generous
//     body ceiling instead of a tight one.
//   · Fail closed on CORS. An unrecognised Origin gets no
//     Access-Control-Allow-Origin header at all, rather than the first
//     configured origin (which told every caller "you are allowed, just not
//     as yourself").
//   · Every knob is env-overridable so ops can tighten without a code change.
//
// Route classification is method+path based and pure, so the whole table is
// testable without booting a server.

import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import { createRateLimiter, clientIpFrom, rateLimitedResponse, setRateLimitHeaders } from "./rate-limit.js";

const KB = 1024;
const MB = 1024 * 1024;
const MINUTE = 60_000;

/* Abuse classes. `ipMax`/`userMax` are requests per `windowMs`; null = unlimited.
   `bodyBytes` is the hard ceiling on the request body for that class. */
export const PERIMETER_CLASSES = {
  // Render's health probe. Static, free to serve, must never be throttled or
  // the platform will mark a healthy instance down under unrelated load.
  health: { windowMs: MINUTE, ipMax: null, userMax: null, bodyBytes: 8 * KB },

  // Stripe + Inngest. Signature-authenticated and retried by the provider.
  webhook: { windowMs: MINUTE, ipMax: null, userMax: null, bodyBytes: 4 * MB },

  // Unauthenticated, token-is-the-only-credential delegation links. The token
  // is a bearer credential in a URL, so this is the brute-force surface.
  publicToken: { windowMs: MINUTE, ipMax: 20, userMax: null, bodyBytes: 256 * KB },

  // Multipart evidence, avatar, and Brand Core foundation intake
  // (POST /api/bios/:brandId/sources/upload — references, logos, fonts).
  // 16 MB clears one 15 MB logo/font plus multipart framing. Reference
  // images are capped at 5 MB inside validateUpload. Hosted on Render;
  // this is the request ceiling, not a laptop limit.
  upload: { windowMs: MINUTE, ipMax: 60, userMax: 20, bodyBytes: 16 * MB },

  // Anything that can start model work (specialist runs, Brandolph, discovery,
  // craft, steward copilot, BIO compile/certify) and is NOT in a tighter paid class.
  generation: { windowMs: MINUTE, ipMax: 120, userMax: 60, bodyBytes: 1 * MB },

  // Discovery start, brief sharpen, Brandolph ask, and the one-shot format
  // preview compose. These call Firecrawl / Anthropic / OpenRouter directly.
  // A 10-minute window with a low per-IP, per-user, and per-process ceiling
  // keeps a fair-wifi crowd (and a crowd of distinct phones) from looping them.
  // Tuned so one presenter can still sharpen, ask, and start discovery.
  paid: { windowMs: 10 * MINUTE, ipMax: 15, userMax: 8, globalMax: 40, bodyBytes: 1 * MB },

  // POST /api/runs/stream. Same threat, separate bucket: one brief fires a
  // whole specialist crew at once, so it cannot share the orchestration ceiling.
  paidRun: { windowMs: 10 * MINUTE, ipMax: 48, userMax: 30, globalMax: 100, bodyBytes: 1 * MB },

  // Delivery exports and their reads/actions have an independent low ceiling.
  delivery: { windowMs: MINUTE, ipMax: 10, userMax: 10, bodyBytes: 1 * MB },

  // Everything else under /api — reads, polling, settings, billing UI calls.
  api: { windowMs: MINUTE, ipMax: 600, userMax: 300, bodyBytes: 1 * MB },

  // Static SPA + assets. A page load is dozens of requests, so the ceiling is
  // high; it exists only to blunt a flood.
  asset: { windowMs: MINUTE, ipMax: 1200, userMax: null, bodyBytes: 256 * KB },
};

/* Path prefixes whose write methods can start model work. */
const GENERATION_PREFIXES = [
  "/api/brandolph",
  "/api/runs",
  "/api/craft",
  "/api/discovery",
  "/api/steward",
  "/api/bios",
];
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH"]);

/**
 * Map a request to its abuse class. Pure: (method, path) → class name.
 *
 * Order matters — the most specific and most dangerous surfaces are matched
 * before the generic /api fallback.
 */
export function classifyRequest(method, path) {
  const m = String(method || "GET").toUpperCase();
  const p = String(path || "/");

  if (p === "/healthz") return "health";
  if (p === "/api/inngest" || p === "/api/billing/webhook") return "webhook";

  // /api/discovery/delegation/:token — the two open, token-only endpoints.
  // The bare /api/discovery/delegation (create) is JWT-authenticated.
  if (p.startsWith("/api/discovery/delegation/")) return "publicToken";

  if (!p.startsWith("/api/")) return "asset";

  // Foundation files (references, logos, fonts) share sources/upload.
  // Evidence and avatar are the other multipart intakes. Anything else
  // under /api/bios stays on the tighter classes below.
  if (m === "POST" && (p === "/api/me/avatar" || /^\/api\/bios\/[^/]+\/(?:evidence|sources\/upload)$/.test(p))) return "upload";

  // Cost surface. Checked before the generation prefix so these writes do not
  // inherit the loose 120/min generation ceiling. Audited 2026-10-10: every
  // route that calls a paid provider (Anthropic, OpenRouter, fal, Firecrawl)
  // requires a verified user except these triggers — there is no unauthenticated
  // model route. Delegation links do not call a provider.
  if (m === "POST" && (p === "/api/discovery/start" || p === "/api/briefs/sharpen" || p === "/api/brandolph/ask")) {
    return "paid";
  }
  if (m === "POST" && p === "/api/runs/stream") return "paidRun";

  if (WRITE_METHODS.has(m) && GENERATION_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`))) {
    return "generation";
  }

  if (p === "/api/deliveries" || p.startsWith("/api/deliveries/")) return "delivery";
  return "api";
}

/** Read an integer env override, falling back to the compiled-in default. */
function envInt(env, key, fallback) {
  const raw = env[key];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : fallback;
}

function envFlag(env, key, fallback) {
  const raw = env[key];
  if (raw == null || raw === "") return fallback;
  return raw === "1" || String(raw).toLowerCase() === "true";
}

/** https://ref.supabase.co/rest/v1 → https://ref.supabase.co (or "" if unusable). */
function originOf(url) {
  try {
    return new URL(String(url)).origin;
  } catch {
    return "";
  }
}

/**
 * Content-Security-Policy for the single-origin production deploy.
 *
 * `script-src 'self'` is the directive doing real work: the SPA ships as module
 * files with no inline script, so an injected <script> or a third-party CDN
 * cannot execute. index.html DOES carry inline <style> blocks and the portal
 * renders with React style props, so style-src needs 'unsafe-inline' — that is
 * a known, accepted relaxation, not an oversight.
 *
 * img/media/font stay broad (https:) because brand assets legitimately come
 * from Supabase signed URLs and fal.ai media hosts that rotate.
 */
export function contentSecurityPolicy({ supabaseUrl = "", extraConnectSrc = [] } = {}) {
  const supabase = originOf(supabaseUrl);
  const supabaseWs = supabase ? supabase.replace(/^https:/, "wss:").replace(/^http:/, "ws:") : "";
  return {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"],
    formAction: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "data:", "https://fonts.gstatic.com", ...(supabase ? [supabase] : [])],
    imgSrc: ["'self'", "data:", "blob:", "https:"],
    mediaSrc: ["'self'", "data:", "blob:", "https:"],
    workerSrc: ["'self'", "blob:"],
    connectSrc: ["'self'", ...(supabase ? [supabase, supabaseWs] : []), ...extraConnectSrc],
    upgradeInsecureRequests: [],
  };
}

/**
 * Allowed-origin list. localhost entries get their 127.0.0.1 twin so the split
 * 5173/8787 dev setup works from either spelling.
 */
export function resolveAllowedOrigins(raw) {
  const configured = String(raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [
    ...new Set(
      configured.flatMap((origin) =>
        origin.includes("localhost") ? [origin, origin.replace("localhost", "127.0.0.1")] : [origin],
      ),
    ),
  ];
}

/**
 * CORS decision. Fail closed: an origin that is not on the list gets `null`,
 * which makes Hono omit Access-Control-Allow-Origin entirely so the browser
 * blocks the read. A missing Origin (same-origin request, curl, server-to-
 * server) also gets null — those callers do not need the header.
 */
export function resolveAllowedOrigin(origin, allowedOrigins) {
  if (!origin) return null;
  return allowedOrigins.includes(origin) ? origin : null;
}

/** Resolve the whole perimeter config from an env bag. Pure. */
export function resolvePerimeterConfig(env = process.env) {
  const production = env.NODE_ENV === "production";
  const classes = {};
  for (const [name, base] of Object.entries(PERIMETER_CLASSES)) {
    const upper = name.replace(/[A-Z]/g, (ch) => `_${ch}`).toUpperCase();
    classes[name] = {
      windowMs: envInt(env, `RATE_LIMIT_${upper}_WINDOW_MS`, base.windowMs),
      ipMax: base.ipMax == null ? null : envInt(env, `RATE_LIMIT_${upper}_IP_MAX`, base.ipMax),
      userMax: base.userMax == null ? null : envInt(env, `RATE_LIMIT_${upper}_USER_MAX`, base.userMax),
      bodyBytes: envInt(env, `BODY_LIMIT_${upper}_BYTES`, base.bodyBytes),
      globalMax: base.globalMax == null ? null : envInt(env, `RATE_LIMIT_${upper}_GLOBAL_MAX`, base.globalMax),
    };
  }
  return {
    production,
    // Behind Render (and any CDN in front of it) X-Forwarded-For is written by
    // trusted infrastructure. Off outside production so a local server never
    // trusts a header a caller can set.
    trustProxy: envFlag(env, "TRUST_PROXY", production),
    trustedProxyHops: Math.max(1, envInt(env, "TRUSTED_PROXY_HOPS", 1)),
    rateLimitEnabled: !envFlag(env, "RATE_LIMIT_DISABLED", false),
    allowedOrigins: resolveAllowedOrigins(env.ALLOWED_ORIGINS || "http://localhost:5173,http://localhost:4173"),
    // enforce | report-only | off. Enforcing in production, off elsewhere
    // (in dev the SPA document is served by Vite on :5173, not by this app).
    cspMode: env.CSP_MODE || (production ? "enforce" : "off"),
    hsts: envFlag(env, "HSTS_ENABLED", production),
    supabaseUrl: env.SUPABASE_URL || "",
    extraConnectSrc: String(env.CSP_CONNECT_SRC || "").split(",").map((s) => s.trim()).filter(Boolean),
    classes,
  };
}

/* ── Runtime wiring ───────────────────────────────────────────────────────── */

let activeConfig = null;
const ipLimiters = new Map();
const userLimiters = new Map();
const globalLimiters = new Map();

function limiterFor(cache, className, windowMs, max) {
  const key = `${className}:${windowMs}:${max}`;
  let limiter = cache.get(key);
  if (!limiter) {
    limiter = createRateLimiter({ windowMs, max });
    cache.set(key, limiter);
  }
  return limiter;
}

/** Reset module state — for tests and for re-applying the perimeter. */
export function resetPerimeter() {
  activeConfig = null;
  ipLimiters.clear();
  userLimiters.clear();
  globalLimiters.clear();
}

export function perimeterConfig() {
  if (!activeConfig) activeConfig = resolvePerimeterConfig(process.env);
  return activeConfig;
}

/** Resolve the bucketing IP for a request under the active trust-proxy policy. */
export function requestIp(c, config = perimeterConfig()) {
  let remoteAddr = "";
  try {
    remoteAddr = c.env?.incoming?.socket?.remoteAddress || c.env?.incoming?.connection?.remoteAddress || "";
  } catch {
    remoteAddr = "";
  }
  return clientIpFrom({
    forwardedFor: c.req.header("x-forwarded-for"),
    realIp: c.req.header("x-real-ip"),
    remoteAddr,
    trustProxy: config.trustProxy,
    hops: config.trustedProxyHops,
  });
}

/**
 * Per-authenticated-user limit. Called from requireAuth once the JWT has been
 * validated — keying on a *verified* user id is the point: an unverified `sub`
 * from an unvalidated token would let an attacker drain a victim's bucket.
 *
 * Returns a 429 Response to short-circuit with, or null to continue.
 */
export function enforceUserRateLimit(c, userId, config = perimeterConfig()) {
  if (!config.rateLimitEnabled || !userId) return null;
  const className = classifyRequest(c.req.method, c.req.path);
  const policy = config.classes[className];
  if (!policy || policy.userMax == null) return null;

  const limiter = limiterFor(userLimiters, className, policy.windowMs, policy.userMax);
  const result = limiter.hit(`${className}:${userId}`);
  if (!result.allowed) return rateLimitedResponse(c, { ...result, scope: "user" });
  setRateLimitHeaders(c, result);
  return null;
}

/**
 * Spend a class budget from inside a handler. Used when the cost is decided
 * by the body (format-preview compose) rather than the path alone, so a
 * deterministic preview does not consume the paid ceiling and a compose call
 * shares it with discovery / sharpen / Brandolph.
 *
 * Returns a 429 Response, or null. Hits IP, then the process-wide ceiling,
 * then the verified user. A denied earlier bucket does not consume the later ones.
 */
export function enforceClassRateLimit(c, className, { userId } = {}, config = perimeterConfig()) {
  if (!config.rateLimitEnabled) return null;
  const policy = config.classes[className];
  if (!policy) return null;

  if (policy.ipMax != null) {
    const limiter = limiterFor(ipLimiters, className, policy.windowMs, policy.ipMax);
    const result = limiter.hit(`${className}:${requestIp(c, config)}`);
    if (!result.allowed) return rateLimitedResponse(c, { ...result, scope: "ip" });
  }
  if (policy.globalMax != null) {
    const limiter = limiterFor(globalLimiters, className, policy.windowMs, policy.globalMax);
    const result = limiter.hit(`${className}:global`);
    if (!result.allowed) return rateLimitedResponse(c, { ...result, scope: "global" });
  }
  if (userId && policy.userMax != null) {
    const limiter = limiterFor(userLimiters, className, policy.windowMs, policy.userMax);
    const result = limiter.hit(`${className}:${userId}`);
    if (!result.allowed) return rateLimitedResponse(c, { ...result, scope: "user" });
  }
  return null;
}

/** Per-IP limit for every request, keyed by abuse class. */
export function perIpRateLimit(config = perimeterConfig()) {
  return async function perimeterRateLimit(c, next) {
    if (!config.rateLimitEnabled) return next();
    const className = classifyRequest(c.req.method, c.req.path);
    const policy = config.classes[className];
    if (!policy || policy.ipMax == null) return next();

    const limiter = limiterFor(ipLimiters, className, policy.windowMs, policy.ipMax);
    const result = limiter.hit(`${className}:${requestIp(c, config)}`);
    if (!result.allowed) return rateLimitedResponse(c, { ...result, scope: "ip" });

    if (policy.globalMax != null) {
      const globalLimiter = limiterFor(globalLimiters, className, policy.windowMs, policy.globalMax);
      const globalResult = globalLimiter.hit(`${className}:global`);
      if (!globalResult.allowed) return rateLimitedResponse(c, { ...globalResult, scope: "global" });
    }

    setRateLimitHeaders(c, result);
    return next();
  };
}

/**
 * Per-class request-body ceiling. Delegates to Hono's bodyLimit, which
 * short-circuits on Content-Length without touching the stream — so the Stripe
 * webhook's raw-body signature read is unaffected.
 */
export function perClassBodyLimit(config = perimeterConfig()) {
  const byteLimiters = new Map();
  const tooLarge = (c) =>
    c.json({ error: "Request body too large", code: "PAYLOAD_TOO_LARGE" }, 413);

  return async function perimeterBodyLimit(c, next) {
    const policy = config.classes[classifyRequest(c.req.method, c.req.path)] || config.classes.api;
    let limiter = byteLimiters.get(policy.bodyBytes);
    if (!limiter) {
      limiter = bodyLimit({ maxSize: policy.bodyBytes, onError: tooLarge });
      byteLimiters.set(policy.bodyBytes, limiter);
    }
    return limiter(c, next);
  };
}

/** Production-safe response headers (S3). */
export function securityHeaders(config = perimeterConfig()) {
  const options = {
    xFrameOptions: "DENY",
    referrerPolicy: "strict-origin-when-cross-origin",
    strictTransportSecurity: config.hsts ? "max-age=31536000; includeSubDomains" : false,
    crossOriginResourcePolicy: "same-origin",
    permissionsPolicy: { camera: [], microphone: [], geolocation: [] },
    removePoweredBy: true,
  };
  if (config.cspMode !== "off") {
    const csp = contentSecurityPolicy(config);
    if (config.cspMode === "report-only") options.contentSecurityPolicyReportOnly = csp;
    else options.contentSecurityPolicy = csp;
  }
  return secureHeaders(options);
}

/** Minimal health body. Never discloses model, key presence, or origin config. */
export function healthPayload() {
  return { status: "ok" };
}

/**
 * Install the perimeter on a Hono app. Order is deliberate:
 * headers wrap everything (so 429/413 responses are hardened too), then the
 * cheapest rejection (rate limit), then the body ceiling.
 */
export function applyPerimeter(app, env = process.env) {
  const config = resolvePerimeterConfig(env);
  activeConfig = config;
  ipLimiters.clear();
  userLimiters.clear();
  app.use("*", securityHeaders(config));
  app.use("*", perIpRateLimit(config));
  app.use("*", perClassBodyLimit(config));
  return config;
}
