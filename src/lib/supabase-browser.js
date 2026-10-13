// ─────────────────────────────────────────────────────────────────────
// Supabase client for the browser SPA.
// Anon key only — service role NEVER ships here. RLS policies on every
// workspace-scoped table are what actually protect data; this client
// just gives us session JWTs and table access shaped by policy.
// ─────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import { uiFixtureEnabled } from "./ui-fixture.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!uiFixtureEnabled && (!SUPABASE_URL || !SUPABASE_ANON_KEY)) {
  // Loud warning so a missing .env.local is obvious in dev console.
  console.error("[supabase-browser] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing — auth + DB reads will fail. Check .env.local at repo root.");
}

/* The UI fixture renders brand profile and briefs without credentials.
   Every other boot still requires a real client and fails the same way. */
function fixtureQuery() {
  const result = { data: null, error: null };
  const builder = {
    select() { return builder; },
    insert() { return builder; },
    update() { return builder; },
    delete() { return builder; },
    eq() { return builder; },
    neq() { return builder; },
    in() { return builder; },
    order() { return builder; },
    limit() { return builder; },
    maybeSingle: async () => result,
    single: async () => result,
    then(onFulfilled, onRejected) { return Promise.resolve(result).then(onFulfilled, onRejected); },
  };
  return builder;
}

function fixtureSupabase() {
  const channel = { on() { return channel; }, subscribe() { return channel; } };
  return {
    auth: {
      async getSession() { return { data: { session: null }, error: null }; },
      async getUser() { return { data: { user: null }, error: null }; },
      onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
      async signOut() { return { error: null }; },
      async signInWithPassword() { return { data: null, error: { message: "UI fixture" } }; },
      async signInWithOAuth() { return { data: null, error: { message: "UI fixture" } }; },
      async signUp() { return { data: { session: null }, error: { message: "UI fixture" } }; },
      async resetPasswordForEmail() { return { error: null }; },
      async updateUser() { return { data: { user: null }, error: null }; },
      async refreshSession() { return { data: { session: null }, error: null }; },
      mfa: {
        async listFactors() { return { data: { totp: [] }, error: null }; },
      },
    },
    from() { return fixtureQuery(); },
    channel() { return channel; },
    removeChannel() {},
  };
}

const authOptions = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,    // parse magic-link callback from URL hash
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    storageKey: "ci_sb_session",
  },
};

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, authOptions)
  : uiFixtureEnabled
    ? fixtureSupabase()
    : createClient(SUPABASE_URL ?? "", SUPABASE_ANON_KEY ?? "", authOptions);

// Prod default is "" → relative /api/... on the same origin the SPA is served
// from (Hono serves dist + API together). Dev falls back to the local API port
// (.env.local sets VITE_API_BASE explicitly for the split 5173/8787 setup).
export const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? "" : "http://localhost:8787");

/**
 * Fetch wrapper that attaches the current session's JWT as Bearer.
 * Routes that read `Authorization: Bearer <jwt>` (e.g. /api/brandolph/ask)
 * use this to resolve the calling user → workspace → brand.
 */
export async function apiFetch(path, init = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init.headers || {});
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  /* Only force JSON Content-Type for non-FormData bodies — multipart
     uploads need the browser to set the boundary automatically. */
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (init.body && !isFormData && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}
