import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";

import brandolph from "./routes/brandolph.js";
import bios from "./routes/bios.js";
import brands from "./routes/brands.js";
import briefs from "./routes/briefs.js";
import discovery from "./routes/discovery.js";
import discoverySession from "./routes/discovery-session.js";
import discoveryDelegation from "./routes/discovery-delegation.js";
import steward from "./routes/steward.js";
import runs from "./routes/foundation-run-gateway.js";
import outputs from "./routes/outputs.js";
import craft from "./routes/craft.js";
import credits from "./routes/credits.js";
import notifications from "./routes/notifications.js";
import billing from "./routes/billing.js";
import admin from "./routes/admin.js";
import languages from "./routes/languages.js";
import me from "./routes/me.js";
import access from "./routes/access.js";
import opex from "./routes/opex.js";
import teamPortal from "./routes/team-portal.js";
import tasks from "./routes/tasks.js";
import { inngestHandler } from "./routes/inngest.js";
import { applyPerimeter, healthPayload, resolveAllowedOrigin } from "./lib/http-policy.js";
import { redactingLogPrinter } from "./lib/log-redact.js";

const PORT = Number(process.env.PORT) || 8787;

const app = new Hono();
// SECURITY (CAA-51 / §S2): the discovery delegation token travels in the URL
// path, so a bare `logger()` writes a live magic link to stdout on every call.
// The printer masks token-bearing path segments before anything reaches the
// log sink; format and volume are otherwise unchanged.
app.use("*", logger(redactingLogPrinter));

// Perimeter: security headers, per-IP/per-class rate limits, body ceilings.
// Installed before CORS and before any route so a rejected request never
// reaches auth, the database, or a model provider. See lib/http-policy.js.
const perimeter = applyPerimeter(app, process.env);

app.use(
  "*",
  cors({
    // Fail closed: an origin that is not configured gets NO
    // Access-Control-Allow-Origin header, so the browser blocks the read.
    origin: (origin) => resolveAllowedOrigin(origin, perimeter.allowedOrigins),
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: false,
    maxAge: 600,
  }),
);

// Minimal by design (CAA-50 / S3): the health probe must not disclose the
// selected model, whether a provider key is present, or the origin allow-list.
app.get("/healthz", (c) => c.json(healthPayload()));

app.route("/api/brandolph", brandolph);
app.route("/api/bios", bios);
app.route("/api/brands", brands);
app.route("/api/briefs", briefs);
app.route("/api/discovery", discovery);
app.route("/api/discovery", discoverySession);      // /session/:brandId, /session/:brandId/attest
app.route("/api/discovery", discoveryDelegation);   // /delegation, /delegation/:token
app.route("/api/steward", steward);
app.route("/api/runs", runs);
app.route("/api/outputs", outputs);
app.route("/api/craft", craft);
app.route("/api/credits", credits);
app.route("/api/notifications", notifications);
app.route("/api/billing", billing);
app.route("/api/admin", admin);
app.route("/api/i18n", languages);
app.route("/api/me", me);
app.route("/api/access", access);
app.route("/api/opex", opex);
app.route("/api/team", teamPortal);
app.route("/api/tasks", tasks);
// Inngest serve — local dev server auto-discovers this endpoint
// (GET introspection + POST function invocations + PUT registration).
app.on(["GET", "POST", "PUT"], "/api/inngest", inngestHandler);

// Unmatched /api/* → JSON 404 (registered after the real API routes, before the
// static handlers) so API clients never receive the SPA's index.html.
app.all("/api/*", (c) => c.json({ error: "not_found", path: c.req.path }, 404));

// ── Serve the built SPA (production). Registered after /api routes so the API
// always wins. In dev an absent ../dist just 404s here (the SPA runs on :5173).
// ponytail: root is CWD-relative — start from server/ (npm start does `cd server`).
app.use("/*", serveStatic({ root: "../dist" }));
app.get("*", serveStatic({ path: "../dist/index.html" })); // SPA fallback (hash router)

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`caastoros-server listening on http://localhost:${info.port}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("  ⚠  ANTHROPIC_API_KEY not set — /api/brandolph/ask will 503 until you add it to .env");
  }
});
