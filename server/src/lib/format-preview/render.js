// Fill the demo templates (MJML email, landing section kit, HTML deck).
// The templater is the draft renderer's logic-less filler, kept here so the
// templates stay the source of the layout. No sample assets are copied in:
// image src is whatever the message spec already resolved (a run asset URL
// or a BIO-colored swatch). Deck PDF is the browser print dialog — the
// template's @page size is 1280×720.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mjml2html from "mjml";
import Ajv from "ajv/dist/2020.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(fs.readFileSync(path.join(here, "message-spec.schema.json"), "utf8"));
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const templates = {
  email: fs.readFileSync(path.join(here, "templates", "email.mjml"), "utf8"),
  landing: fs.readFileSync(path.join(here, "templates", "landing.html"), "utf8"),
  deck: fs.readFileSync(path.join(here, "templates", "deck.html"), "utf8"),
};

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function get(ctx, p) {
  if (p === "@") return ctx.item;
  let o = p.startsWith("@.") ? ctx.item : ctx.root;
  const pathParts = p.replace(/^@\.|^root\./, "");
  if (!pathParts) return o;
  for (const key of pathParts.split(".")) o = o?.[key];
  return o;
}

/** Logic-less fill. Supports {{path}} {{asset path}} {{#each}} {{#eachp}} {{#if}}. */
export function fillTemplate(tpl, spec, assetBase = "") {
  const render = (source, ctx) => {
    let out = source;
    out = out.replace(/{{#each ([\w.@]+)}}([\s\S]*?){{\/each}}/g, (_, p, inner) =>
      (get(ctx, p) || []).map((item) => render(inner, { ...ctx, item })).join(""));
    out = out.replace(/{{#eachp ([\w.@]+)}}([\s\S]*?){{\/eachp}}/g, (_, p, inner) =>
      (get(ctx, p) || []).map((v) => inner.replaceAll("{{$}}", esc(v))).join(""));
    out = out.replace(/{{#if ([^}]+)}}([\s\S]*?){{\/if}}/g, (_, c, inner) => {
      const m = c.match(/^([\w.@]+)(!?=)(.+)$/);
      const ok = m
        ? (m[2] === "=" ? String(get(ctx, m[1])) === m[3] : String(get(ctx, m[1])) !== m[3])
        : (() => { const v = get(ctx, c); return Array.isArray(v) ? v.length : !!v; })();
      return ok ? inner : "";
    });
    out = out.replace(/{{asset ([\w.@]+)}}/g, (_, p) => esc(String(assetBase || "") + String(get(ctx, p) ?? "")));
    return out.replace(/{{([\w.@]+)}}/g, (_, p) => esc(get(ctx, p)));
  };
  return render(tpl, { root: spec, item: null });
}

export function validateMessageSpec(spec) {
  const ok = validate(spec);
  return ok ? { ok: true, errors: [] } : { ok: false, errors: validate.errors || [] };
}

export async function renderFormats(spec) {
  const checked = validateMessageSpec(spec);
  if (!checked.ok) {
    const error = new Error("Message spec does not match the preview schema");
    error.errors = checked.errors;
    throw error;
  }
  const mjmlSrc = fillTemplate(templates.email, spec);
  const compiled = await mjml2html(mjmlSrc, { validationLevel: "strict" });
  if (compiled.errors?.length) {
    const error = new Error("MJML failed to compile the email preview");
    error.errors = compiled.errors;
    throw error;
  }
  const landingHtml = fillTemplate(templates.landing, spec);
  const deckHtml = fillTemplate(templates.deck, spec);
  return {
    emailHtml: compiled.html,
    landingHtml,
    deckHtml,
    unresolved: {
      email: (compiled.html.match(/{{[^}]*}}/g) || []).length,
      landing: (landingHtml.match(/{{[^}]*}}/g) || []).length,
      deck: (deckHtml.match(/{{[^}]*}}/g) || []).length,
    },
  };
}
