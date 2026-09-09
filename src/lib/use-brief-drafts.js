import { useEffect, useMemo, useSyncExternalStore } from "react";
import { apiFetch } from "./supabase-browser.js";
import { createBriefDraftStore } from "./brief-draft-store.js";

export function useBriefDrafts(brandId) {
  const userId = window.useSession()?.id;
  const store = useMemo(() => createBriefDraftStore({ userId, brandId, request: apiFetch,
    storage: { get length() { return window.localStorage.length; }, key: (i) => window.localStorage.key(i), getItem: (k) => window.localStorage.getItem(k), setItem: (k, v) => window.localStorage.setItem(k, v), removeItem: (k) => window.localStorage.removeItem(k) },
  }), [userId, brandId]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(() => {
    if (userId && brandId) void store.load();
    const flush = () => { if (document.visibilityState === "hidden") void store.flush(); };
    const retry = () => { void store.load(); };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("online", retry);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("online", retry);
      store.dispose();
    };
  }, [store, userId, brandId]);
  return { ...state, store };
}
