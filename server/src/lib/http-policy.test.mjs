// Perimeter tests (CAA-50). These drive a real Hono app through app.request()
// so the assertions cover the wiring — middleware order, header emission, 429
// short-circuiting, 413 rejection, CORS decisions — not just the pure helpers.

import test from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { cors } from "hono/cors";

import {
  classifyRequest,
  resolveAllowedOrigin,
  resolveAllowedOrigins,
  resolvePerimeterConfig,
  contentSecurityPolicy,
  applyPerimeter,
  enforceUserRateLimit,
  healthPayload,
  resetPerimeter,
  PERIMETER_CLASSES,
} from "./http-policy.js";

const PROD_ENV = {
  NODE_ENV: "production",
  TRUST_PROXY: "1",
  ALLOWED_ORIGINS: "https://app.getcaastor.co",
  SUPABASE_URL: "https://yemzrohzqfuxmekcgnnh.supabase.co",
};

/* Mirrors server/src/index.js wiring so the tests exercise the real order:
   perimeter (headers → rate limit → body limit) then CORS then routes. */
function buildApp(env = PROD_ENV, routes = () => {}) {
  resetPerimeter();
  const app = new Hono();
  const config = applyPerimeter(app, env);
  app.use("*", cors({
    origin: (origin) => resolveAllowedOrigin(origin, config.allowedOrigins),
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: false,
    maxAge: 600,
  }));
  app.get("/healthz", (c) => c.json(healthPayload()));
  app.all("/api/discovery/delegation/:token", (c) => c.json({ ok: true }));
  app.post("/api/billing/webhook", (c) => c.json({ received: true }));
  app.post("/api/brandolph/ask", (c) => c.json({ ok: true }));
  app.post("/api/bios/brand-1/evidence", (c) => c.json({ ok: true }));
  app.get("/api/me", (c) => c.json({ ok: true }));
  routes(app);
  return app;
}

const from = (ip, init = {}) => ({
  ...init,
  headers: { "x-forwarded-for": ip, ...(init.headers || {}) },
});

/* ── Route classification ─────────────────────────────────────────────────── */

test("classifyRequest maps every perimeter surface to its abuse class", () => {
  const cases = [
    ["GET", "/healthz", "health"],
    ["POST", "/api/inngest", "webhook"],
    ["POST", "/api/billing/webhook", "webhook"],
    ["GET", "/api/discovery/delegation/abc-123", "publicToken"],
    ["PATCH", "/api/discovery/delegation/abc-123", "publicToken"],
    ["POST", "/api/discovery/delegation", "generation"], // authenticated create
    ["POST", "/api/bios/brand-1/evidence", "upload"],
    ["POST", "/api/me/avatar", "upload"],
    ["POST", "/api/brandolph/ask", "paid"],
    ["POST", "/api/discovery/start", "paid"],
    ["POST", "/api/briefs/sharpen", "paid"],
    ["GET", "/api/briefs/brief-1/formats", "api"],
    ["POST", "/api/briefs/brief-1/formats", "api"],
    ["POST", "/api/runs/stream", "paidRun"],
    ["POST", "/api/craft", "generation"],
    ["PATCH", "/api/steward/jobs/1", "generation"],
    ["GET", "/api/runs/abc", "api"], // reads/polling are never generation
    ["GET", "/api/me", "api"],
    ["GET", "/api/credits", "api"],
    ["GET", "/assets/index.js", "asset"],
    ["GET", "/", "asset"],
  ];
  for (const [method, path, expected] of cases) {
    assert.equal(classifyRequest(method, path), expected, `${method} ${path}`);
  }
});

test("paid model routes allow fewer requests per minute than the public token surface", () => {
  const perMinute = (policy) => policy.ipMax / (policy.windowMs / 60_000);
  assert.ok(perMinute(PERIMETER_CLASSES.paid) < perMinute(PERIMETER_CLASSES.publicToken));
  assert.ok(perMinute(PERIMETER_CLASSES.paid) < perMinute(PERIMETER_CLASSES.generation));
  assert.ok(perMinute(PERIMETER_CLASSES.paidRun) < perMinute(PERIMETER_CLASSES.generation));
  assert.ok(PERIMETER_CLASSES.publicToken.ipMax < PERIMETER_CLASSES.api.ipMax);
});

/* ── 429 behaviour ────────────────────────────────────────────────────────── */

test("the public delegation route 429s past its per-IP ceiling", async () => {
  const app = buildApp();
  const max = PERIMETER_CLASSES.publicToken.ipMax;
  const path = "/api/discovery/delegation/tok-1";

  for (let i = 0; i < max; i += 1) {
    const res = await app.request(path, from("203.0.113.7"));
    assert.equal(res.status, 200, `request ${i + 1} of ${max} should pass`);
    assert.equal(res.headers.get("RateLimit-Limit"), String(max));
  }

  const blocked = await app.request(path, from("203.0.113.7"));
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("RateLimit-Remaining"), "0");
  assert.ok(Number(blocked.headers.get("Retry-After")) >= 1);
  const body = await blocked.json();
  assert.equal(body.code, "RATE_LIMITED");
  assert.equal(body.scope, "ip");
  assert.match(body.error, /this network/);
  assert.ok(body.retryAfterSeconds >= 1);
});

test("rate-limit buckets are per client IP, not global", async () => {
  const app = buildApp();
  const max = PERIMETER_CLASSES.publicToken.ipMax;
  const path = "/api/discovery/delegation/tok-2";
  for (let i = 0; i <= max; i += 1) await app.request(path, from("203.0.113.7"));

  const other = await app.request(path, from("198.51.100.4"));
  assert.equal(other.status, 200, "a different client must not inherit the throttle");
});

test("a spoofed X-Forwarded-For prefix cannot buy a fresh bucket", async () => {
  const app = buildApp();
  const max = PERIMETER_CLASSES.publicToken.ipMax;
  const path = "/api/discovery/delegation/tok-3";
  // One trusted hop: the platform appends the real peer last, so the attacker's
  // rotating left-hand entries are ignored and every request lands in one bucket.
  for (let i = 0; i <= max; i += 1) {
    await app.request(path, from(`10.0.0.${i}, 203.0.113.8`));
  }
  const blocked = await app.request(path, from("10.0.0.99, 203.0.113.8"));
  assert.equal(blocked.status, 429);
});

test("health and signed webhook callbacks are exempt from throttling", async () => {
  const app = buildApp();
  for (let i = 0; i < PERIMETER_CLASSES.publicToken.ipMax * 3; i += 1) {
    const health = await app.request("/healthz", from("203.0.113.7"));
    assert.equal(health.status, 200);
    const hook = await app.request("/api/billing/webhook", from("203.0.113.7", { method: "POST", body: "{}" }));
    assert.equal(hook.status, 200, "Stripe/Inngest retries must never be throttled");
  }
});

test("RATE_LIMIT_DISABLED turns the limiter off for local scripts", async () => {
  const app = buildApp({ ...PROD_ENV, RATE_LIMIT_DISABLED: "1" });
  const path = "/api/discovery/delegation/tok-4";
  for (let i = 0; i < PERIMETER_CLASSES.publicToken.ipMax + 5; i += 1) {
    const res = await app.request(path, from("203.0.113.7"));
    assert.equal(res.status, 200);
  }
});

test("per-user limits key on the verified user id and 429 past the ceiling", async () => {
  const app = new Hono();
  resetPerimeter();
  const config = applyPerimeter(app, { ...PROD_ENV, RATE_LIMIT_PAID_USER_MAX: "3", RATE_LIMIT_PAID_IP_MAX: "100", RATE_LIMIT_PAID_GLOBAL_MAX: "100" });
  app.post("/api/brandolph/ask", (c) => {
    const throttled = enforceUserRateLimit(c, c.req.header("x-test-user"), config);
    return throttled || c.json({ ok: true });
  });

  const call = (user) => app.request("/api/brandolph/ask", { method: "POST", headers: { "x-test-user": user } });
  assert.equal((await call("user-a")).status, 200);
  assert.equal((await call("user-a")).status, 200);
  assert.equal((await call("user-a")).status, 200);
  const blocked = await call("user-a");
  assert.equal(blocked.status, 429, "fourth call exceeds the per-user ceiling");
  assert.equal((await blocked.json()).scope, "user");
  assert.equal((await call("user-b")).status, 200, "a second user has an independent budget");
});

test("discovery, sharpen, and brandolph share a paid ceiling separate from specialist runs", async () => {
  const app = buildApp({
    ...PROD_ENV,
    RATE_LIMIT_PAID_IP_MAX: "1",
    RATE_LIMIT_PAID_GLOBAL_MAX: "100",
    RATE_LIMIT_PAID_RUN_IP_MAX: "3",
    RATE_LIMIT_PAID_RUN_GLOBAL_MAX: "100",
  }, (a) => {
    a.post("/api/discovery/start", (c) => c.json({ ok: true }));
    a.post("/api/briefs/sharpen", (c) => c.json({ ok: true }));
    a.post("/api/brandolph/ask", (c) => c.json({ ok: true }));
    a.post("/api/runs/stream", (c) => c.json({ ok: true }));
  });
  const post = (path) => app.request(path, from("203.0.113.9", { method: "POST" }));
  assert.equal((await post("/api/discovery/start")).status, 200);
  const blocked = await post("/api/briefs/sharpen");
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).scope, "ip");
  assert.equal((await post("/api/brandolph/ask")).status, 429);
  assert.equal((await post("/api/runs/stream")).status, 200, "a specialist crew must not inherit the orchestration ceiling");
});

test("the paid global ceiling stops a crowd of distinct IPs", async () => {
  const app = buildApp({
    ...PROD_ENV,
    RATE_LIMIT_PAID_IP_MAX: "10",
    RATE_LIMIT_PAID_GLOBAL_MAX: "2",
  }, (a) => {
    a.post("/api/discovery/start", (c) => c.json({ ok: true }));
  });
  const post = (ip) => app.request("/api/discovery/start", from(ip, { method: "POST" }));
  assert.equal((await post("203.0.113.10")).status, 200);
  assert.equal((await post("203.0.113.11")).status, 200);
  const blocked = await post("203.0.113.12");
  assert.equal(blocked.status, 429);
  const body = await blocked.json();
  assert.equal(body.scope, "global");
  assert.match(body.error, /shared demo limit/);
  assert.equal(body.code, "RATE_LIMITED");
});

test("per-user limits do not apply to classes without a user ceiling", async () => {
  const app = new Hono();
  resetPerimeter();
  const config = applyPerimeter(app, PROD_ENV);
  app.get("/healthz", (c) => enforceUserRateLimit(c, "user-a", config) || c.json({ status: "ok" }));
  for (let i = 0; i < 50; i += 1) assert.equal((await app.request("/healthz")).status, 200);
});

/* ── Request-size policy ──────────────────────────────────────────────────── */

test("an oversized declared body is rejected with 413 before the handler runs", async () => {
  let handlerRan = false;
  const app = buildApp(PROD_ENV, (a) => {
    a.post("/api/echo", (c) => { handlerRan = true; return c.json({ ok: true }); });
  });
  const oversized = "x".repeat(2048);
  const res = await app.request("/api/echo", from("203.0.113.7", {
    method: "POST",
    body: oversized,
    headers: { "content-type": "application/json", "content-length": String(PERIMETER_CLASSES.api.bodyBytes + 1) },
  }));
  assert.equal(res.status, 413);
  assert.equal((await res.json()).code, "PAYLOAD_TOO_LARGE");
  assert.equal(handlerRan, false, "the body ceiling must short-circuit before route work");
});

test("a body within the class ceiling is accepted", async () => {
  const app = buildApp(PROD_ENV, (a) => a.post("/api/echo", (c) => c.json({ ok: true })));
  const res = await app.request("/api/echo", from("203.0.113.7", {
    method: "POST",
    body: JSON.stringify({ hello: "world" }),
    headers: { "content-type": "application/json" },
  }));
  assert.equal(res.status, 200);
});

test("upload routes get a larger ceiling than JSON routes, and webhooks larger still", () => {
  assert.ok(PERIMETER_CLASSES.upload.bodyBytes > PERIMETER_CLASSES.api.bodyBytes);
  assert.ok(PERIMETER_CLASSES.upload.bodyBytes >= 15 * 1024 * 1024, "must clear MAX_UPLOAD_BYTES");
  assert.ok(PERIMETER_CLASSES.webhook.bodyBytes > PERIMETER_CLASSES.api.bodyBytes);
  assert.ok(PERIMETER_CLASSES.publicToken.bodyBytes < PERIMETER_CLASSES.api.bodyBytes);
});

test("an oversized chunked body is rejected even without a content-length header", async () => {
  const app = buildApp({ ...PROD_ENV, BODY_LIMIT_API_BYTES: "64" }, (a) =>
    a.post("/api/echo", (c) => c.json({ ok: true })));
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("y".repeat(256)));
      controller.close();
    },
  });
  const res = await app.request("/api/echo", {
    method: "POST",
    body: stream,
    duplex: "half",
    headers: { "x-forwarded-for": "203.0.113.7", "content-type": "application/json" },
  });
  assert.equal(res.status, 413);
});

/* ── Response headers ─────────────────────────────────────────────────────── */

test("production responses carry the full security header set", async () => {
  const app = buildApp();
  const res = await app.request("/api/me", from("203.0.113.7"));
  assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(res.headers.get("X-Frame-Options"), "DENY");
  assert.equal(res.headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.match(res.headers.get("Strict-Transport-Security") || "", /max-age=31536000/);
  assert.match(res.headers.get("Permissions-Policy") || "", /camera=\(\)/);
  assert.equal(res.headers.get("Cross-Origin-Resource-Policy"), "same-origin");
  assert.equal(res.headers.get("X-Powered-By"), null);

  const csp = res.headers.get("Content-Security-Policy") || "";
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.ok(!/script-src[^;]*unsafe-eval/.test(csp), "script-src must not allow eval");
  assert.ok(!/script-src[^;]*unsafe-inline/.test(csp), "script-src must not allow inline script");
  assert.match(csp, new RegExp(`connect-src[^;]*${PROD_ENV.SUPABASE_URL}`), "SPA must still reach Supabase");
});

test("hardened headers are still present on rejected requests", async () => {
  const app = buildApp();
  const path = "/api/discovery/delegation/tok-5";
  for (let i = 0; i <= PERIMETER_CLASSES.publicToken.ipMax; i += 1) await app.request(path, from("203.0.113.7"));
  const blocked = await app.request(path, from("203.0.113.7"));
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(blocked.headers.get("X-Frame-Options"), "DENY");
});

test("outside production HSTS and CSP stay off so local HTTP dev is unaffected", async () => {
  const app = buildApp({ ALLOWED_ORIGINS: "http://localhost:5173" });
  const res = await app.request("/api/me");
  assert.equal(res.headers.get("Strict-Transport-Security"), null);
  assert.equal(res.headers.get("Content-Security-Policy"), null);
  assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff", "the cheap headers still ship");
});

test("CSP_MODE=report-only emits the report header instead of enforcing", async () => {
  const app = buildApp({ ...PROD_ENV, CSP_MODE: "report-only" });
  const res = await app.request("/api/me", from("203.0.113.7"));
  assert.equal(res.headers.get("Content-Security-Policy"), null);
  assert.match(res.headers.get("Content-Security-Policy-Report-Only") || "", /default-src 'self'/);
});

test("the CSP keeps the SPA's real asset origins reachable", () => {
  const csp = contentSecurityPolicy({ supabaseUrl: PROD_ENV.SUPABASE_URL });
  assert.ok(csp.styleSrc.includes("'unsafe-inline'"), "index.html ships inline <style> blocks");
  assert.ok(csp.styleSrc.includes("https://fonts.googleapis.com"));
  assert.ok(csp.fontSrc.includes("https://fonts.gstatic.com"));
  assert.ok(csp.imgSrc.includes("https:"), "brand assets come from rotating signed-URL hosts");
  assert.ok(csp.connectSrc.includes("wss://yemzrohzqfuxmekcgnnh.supabase.co"), "Supabase realtime");
});

/* ── Health disclosure ────────────────────────────────────────────────────── */

test("healthz discloses nothing about provider, model, key, or origin config", async () => {
  const app = buildApp({ ...PROD_ENV, MODEL: "claude-opus-4-1", ANTHROPIC_API_KEY: "sk-ant-secret" });
  const res = await app.request("/healthz", from("203.0.113.7"));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body, { status: "ok" });
  const raw = JSON.stringify(body);
  for (const leak of ["claude", "model", "hasKey", "sk-ant", "allowedOrigins", "getcaastor"]) {
    assert.ok(!raw.includes(leak), `health output must not contain "${leak}"`);
  }
});

/* ── CORS ─────────────────────────────────────────────────────────────────── */

test("resolveAllowedOrigin fails closed instead of echoing a fallback origin", () => {
  const allowed = resolveAllowedOrigins("https://app.getcaastor.co");
  assert.equal(resolveAllowedOrigin("https://app.getcaastor.co", allowed), "https://app.getcaastor.co");
  assert.equal(resolveAllowedOrigin("https://evil.example", allowed), null);
  assert.equal(resolveAllowedOrigin("", allowed), null);
  assert.equal(resolveAllowedOrigin(null, allowed), null);
});

test("resolveAllowedOrigins mirrors localhost to 127.0.0.1 for the split dev setup", () => {
  assert.deepEqual(resolveAllowedOrigins("http://localhost:5173"), [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);
  assert.deepEqual(resolveAllowedOrigins(" , "), []);
});

test("an allowed Origin is echoed and a disallowed one gets no ACAO header", async () => {
  const app = buildApp();
  const ok = await app.request("/api/me", from("203.0.113.7", { headers: { origin: "https://app.getcaastor.co" } }));
  assert.equal(ok.headers.get("Access-Control-Allow-Origin"), "https://app.getcaastor.co");

  const denied = await app.request("/api/me", from("203.0.113.7", { headers: { origin: "https://evil.example" } }));
  assert.equal(
    denied.headers.get("Access-Control-Allow-Origin"),
    null,
    "a disallowed origin must never receive an allow header",
  );
});

test("a disallowed preflight is answered without an allow-origin header", async () => {
  const app = buildApp();
  const res = await app.request("/api/me", from("203.0.113.7", {
    method: "OPTIONS",
    headers: { origin: "https://evil.example", "access-control-request-method": "POST" },
  }));
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), null);
});

/* ── Config resolution ────────────────────────────────────────────────────── */

test("trust-proxy defaults to on in production and off everywhere else", () => {
  assert.equal(resolvePerimeterConfig({ NODE_ENV: "production" }).trustProxy, true);
  assert.equal(resolvePerimeterConfig({}).trustProxy, false);
  assert.equal(resolvePerimeterConfig({ NODE_ENV: "production", TRUST_PROXY: "0" }).trustProxy, false);
  assert.equal(resolvePerimeterConfig({ TRUST_PROXY: "1" }).trustProxy, true);
  assert.equal(resolvePerimeterConfig({ TRUSTED_PROXY_HOPS: "2" }).trustedProxyHops, 2);
  assert.equal(resolvePerimeterConfig({ TRUSTED_PROXY_HOPS: "0" }).trustedProxyHops, 1, "hops floor is 1");
});

test("every ceiling is env-overridable so ops can tighten without a deploy", () => {
  const config = resolvePerimeterConfig({
    RATE_LIMIT_PUBLIC_TOKEN_IP_MAX: "5",
    RATE_LIMIT_GENERATION_USER_MAX: "9",
    RATE_LIMIT_PAID_GLOBAL_MAX: "4",
    BODY_LIMIT_UPLOAD_BYTES: "1234",
  });
  assert.equal(config.classes.publicToken.ipMax, 5);
  assert.equal(config.classes.generation.userMax, 9);
  assert.equal(config.classes.paid.globalMax, 4);
  assert.equal(config.classes.upload.bodyBytes, 1234);
  assert.equal(config.classes.api.globalMax, null);
  assert.equal(config.classes.api.ipMax, PERIMETER_CLASSES.api.ipMax, "untouched classes keep defaults");
});
