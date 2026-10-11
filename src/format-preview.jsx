import React from "react";
import { useLocale } from "./lib/i18n.js";
import { apiFetch } from "./lib/supabase-browser.js";
import { uiFixtureEnabled, FIXTURE_BRIEFS, FIXTURE_BRANDS } from "./lib/ui-fixture.js";

const { Icon } = window;
const { useState, useEffect, useRef } = React;

export const formatPreviewEnabled = import.meta.env.VITE_FORMAT_PREVIEW === "1";

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
}

/* Fixture mode has no API session. Render the three formats from the
   sample brief so the preview can be reviewed without Supabase. */
function fixtureFormatData(briefId, headline) {
  const brief = FIXTURE_BRIEFS.find((item) => item.id === briefId) || FIXTURE_BRIEFS[0];
  const brand = FIXTURE_BRANDS[0]?.name || "Brand";
  const line = String(headline || brief?.title || "Formats").slice(0, 70);
  const page = (kicker) => `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;font-family:'Instrument Sans',system-ui,sans-serif;color:#1c1917;background:#fff}main{padding:48px}p{letter-spacing:.14em;text-transform:uppercase;font-size:11px;color:#78716c}h1{font-size:36px;line-height:1.15;font-weight:560;margin:12px 0}</style></head><body><main><p>${escapeHtml(brand)} · ${escapeHtml(kicker)}</p><h1>${escapeHtml(line)}</h1></main></body></html>`;
  return {
    spec: { headline: line, smp: brief?.title || line, audience: "Independent cafe buyers", goal: "Launch", messages: [], proof: [], cta: "Visit", language: "en" },
    emailHtml: page("Email"),
    landingHtml: page("Landing"),
    deckHtml: page("Slides"),
    checks: { email: { status: "pass" }, landing: { status: "pass" }, deck: { status: "pass" } },
    certification: { bio: { version: 3, selfCertified: true, certified: false }, events: [] },
  };
}

function Badge({ status, label }) {
  const flagged = status === "flag";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", height: 22, padding: "0 8px", borderRadius: 999,
      fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600,
      background: flagged ? "rgba(190, 60, 90, 0.12)" : "rgba(30, 120, 70, 0.12)",
      color: flagged ? "var(--pink-600, #9d2c4a)" : "var(--green-700, #1d6b45)",
    }}>{label}</span>
  );
}

function FormatPane({ title, check, passLabel, flagLabel, children, action }) {
  const flagged = check?.status === "flag";
  return (
    <section style={{ background: "var(--c-card)", border: "1px solid var(--c-line)", borderRadius: 14, overflow: "hidden" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: "1px solid var(--c-line)" }}>
        <strong style={{ fontSize: 14 }}>{title}</strong>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {action}
          <Badge status={check?.status} label={flagged ? flagLabel : passLabel} />
        </span>
      </header>
      {flagged && check.violations?.length > 0 && (
        <ul style={{ margin: 0, padding: "8px 16px 8px 28px", background: "rgba(190, 60, 90, 0.06)", color: "var(--c-dim)", fontSize: 12 }}>
          {check.violations.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
      {children}
    </section>
  );
}

function Frame({ html, title, frameRef }) {
  return (
    <iframe
      ref={frameRef}
      title={title}
      sandbox="allow-same-origin allow-modals"
      srcDoc={html || ""}
      style={{ width: "100%", height: 560, border: 0, background: "#fff" }}
    />
  );
}

export function FormatPreviewView({ briefId, go }) {
  const { t } = useLocale();
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [headline, setHeadline] = useState("");
  const [rendering, setRendering] = useState(false);
  const deckRef = useRef(null);
  const loaded = useRef(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!formatPreviewEnabled) return undefined;
    if (uiFixtureEnabled) {
      const data = fixtureFormatData(briefId, "");
      loaded.current = true;
      setHeadline(data.spec.headline);
      setState({ loading: false, error: null, data });
      return undefined;
    }
    let cancel = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/briefs/${briefId}/formats`);
        const data = await res.json().catch(() => ({}));
        if (cancel) return;
        if (!res.ok) {
          setState({ loading: false, error: data.error || t("briefs.formats.unavailable"), data: null });
          return;
        }
        loaded.current = true;
        setHeadline(data.spec?.headline || "");
        setState({ loading: false, error: null, data });
      } catch (err) {
        if (!cancel) setState({ loading: false, error: err?.message || t("briefs.formats.unavailable"), data: null });
      }
    })();
    return () => { cancel = true; };
  }, [briefId]);

  useEffect(() => {
    if (!loaded.current || !state.data) return undefined;
    if (headline === (state.data.spec?.headline || "")) return undefined;
    if (uiFixtureEnabled) {
      setState({ loading: false, error: null, data: fixtureFormatData(briefId, headline) });
      return undefined;
    }
    const timer = setTimeout(async () => {
      const ticket = ++seq.current;
      setRendering(true);
      try {
        const res = await apiFetch(`/api/briefs/${briefId}/formats`, {
          method: "POST",
          body: JSON.stringify({ headline }),
        });
        const data = await res.json().catch(() => ({}));
        if (ticket !== seq.current) return;
        if (!res.ok) {
          setState((current) => ({ ...current, error: data.error || t("briefs.formats.unavailable") }));
          return;
        }
        setState({ loading: false, error: null, data });
      } catch (err) {
        if (ticket === seq.current) setState((current) => ({ ...current, error: err?.message || t("briefs.formats.unavailable") }));
      } finally {
        if (ticket === seq.current) setRendering(false);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [headline, briefId]);

  if (!formatPreviewEnabled) {
    return (
      <div style={{ padding: 48, maxWidth: 640 }}>
        <p style={{ color: "var(--c-dim)" }}>{t("briefs.formats.off")}</p>
      </div>
    );
  }
  if (state.loading) {
    return <div style={{ padding: 48, color: "var(--c-faint)" }}>{t("briefs.formats.loading")}</div>;
  }
  if (state.error && !state.data) {
    return (
      <div style={{ padding: 48 }}>
        <p style={{ color: "var(--c-dim)", marginBottom: 16 }}>{state.error}</p>
        <button className="btn btn--primary" onClick={() => go("canvas")}>{t("briefs.formats.back")}</button>
      </div>
    );
  }

  const data = state.data;
  const cert = data.certification || { bio: {}, events: [] };
  const printDeck = () => {
    try { deckRef.current?.contentWindow?.focus(); deckRef.current?.contentWindow?.print(); }
    catch { /* the deck document still carries @page rules for a manual print */ }
  };

  return (
    <div style={{ padding: "22px 32px 72px", maxWidth: 1100, margin: "0 auto" }}>
      <button onClick={() => go("canvas")} className="btn btn--link" style={{ fontSize: 12, marginBottom: 14 }}>
        <Icon name="arrowLeft" size={13} /> {t("briefs.formats.back")}
      </button>
      <div className="eyebrow" style={{ marginBottom: 8 }}>{t("briefs.formats.eyebrow")}</div>
      <h1 style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 500, fontSize: 32, margin: "0 0 8px" }}>{t("briefs.formats.title")}</h1>
      <p style={{ margin: "0 0 18px", color: "var(--c-dim)", maxWidth: 640, lineHeight: 1.5 }}>{t("briefs.formats.intro")}</p>

      <label style={{ display: "block", marginBottom: 22 }}>
        <span className="eyebrow" style={{ display: "block", marginBottom: 6 }}>{t("briefs.formats.headline")}</span>
        <input
          className="input"
          value={headline}
          maxLength={70}
          onChange={(event) => setHeadline(event.target.value)}
          style={{ width: "100%", maxWidth: 640 }}
        />
        <span style={{ display: "block", marginTop: 6, fontSize: 12, color: "var(--c-faint)" }}>
          {rendering ? t("briefs.formats.updating") : t("briefs.formats.headlineHelp")}
        </span>
      </label>
      {state.error && <p style={{ color: "var(--pink-600, #9d2c4a)", fontSize: 13 }}>{state.error}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <FormatPane title={t("briefs.formats.email")} check={data.checks?.email} passLabel={t("briefs.formats.pass")} flagLabel={t("briefs.formats.flag")}>
          <Frame html={data.emailHtml} title={t("briefs.formats.email")} />
        </FormatPane>
        <FormatPane title={t("briefs.formats.landing")} check={data.checks?.landing} passLabel={t("briefs.formats.pass")} flagLabel={t("briefs.formats.flag")}>
          <Frame html={data.landingHtml} title={t("briefs.formats.landing")} />
        </FormatPane>
        <FormatPane
          title={t("briefs.formats.deck")}
          check={data.checks?.deck}
          passLabel={t("briefs.formats.pass")}
          flagLabel={t("briefs.formats.flag")}
          action={<button className="btn btn--ghost btn--sm" onClick={printDeck}>{t("briefs.formats.print")}</button>}
        >
          <Frame html={data.deckHtml} title={t("briefs.formats.deck")} frameRef={deckRef} />
        </FormatPane>

        <section style={{ background: "var(--c-card)", border: "1px solid var(--c-line)", borderRadius: 14, padding: "16px 18px 8px" }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>{t("briefs.formats.trailEyebrow")}</div>
          <h2 style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 500, fontSize: 24, margin: "0 0 8px" }}>{t("briefs.formats.trailTitle")}</h2>
          <p style={{ margin: "0 0 14px", color: "var(--c-dim)", fontSize: 13.5, lineHeight: 1.5 }}>
            {t("briefs.formats.trailBio", {
              version: cert.bio?.version ?? "—",
              state: cert.bio?.certified ? t("briefs.formats.certified") : cert.bio?.selfCertified ? t("briefs.formats.selfCertified") : t("briefs.formats.uncertified"),
            })}
          </p>
          {cert.events?.length ? (
            <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {cert.events.map((event) => (
                <li key={event.id} style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12, padding: "10px 0", borderTop: "1px solid var(--c-line)" }}>
                  <time style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--c-faint)" }}>{event.at ? String(event.at).slice(0, 10) : ""}</time>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{event.decision}{event.actorRole ? ` · ${event.actorRole}` : ""}{event.score != null ? ` · ${event.score}` : ""}</div>
                    {event.narrative && <div style={{ fontSize: 13, color: "var(--c-dim)", marginTop: 2 }}>{event.narrative}</div>}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p style={{ color: "var(--c-faint)", fontSize: 13 }}>{t("briefs.formats.trailEmpty")}</p>
          )}
          <div style={{ margin: "14px 0" }}>
            <button className="btn btn--ghost btn--sm" onClick={() => go("bio")}>{t("briefs.formats.openBio")}</button>
          </div>
        </section>
      </div>
    </div>
  );
}

Object.assign(window, { FormatPreviewView, formatPreviewEnabled });
