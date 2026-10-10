// Deterministic Message Spec. No model call, no sample-brand facts.
// Colors, type, and the words themselves come from the brand's BIO,
// the saved brief, and text already produced by the brief's runs.
// Chrome lines (a generic CTA, the email footer) are labeled as such
// and never invent a price, a date, a place, or a testimonial.

const CHROME = {
  en: {
    cta: "Learn more",
    eyebrow: "Campaign",
    footer: (name) => `${name}. You are receiving this because you asked to hear from this brand.`,
    landingFooter: (name) => `${name}`,
  },
  es: {
    cta: "Saber más",
    eyebrow: "Campaña",
    footer: (name) => `${name}. Recibes esto porque pediste noticias de esta marca.`,
    landingFooter: (name) => `${name}`,
  },
};

const FALLBACK_TOKENS = {
  bg: "#f6f4f1",
  ink: "#1c1917",
  accent: "#3f3a34",
  muted: "#6f675f",
};

function clip(value, max) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, Math.max(1, max - 1)).trimEnd();
  return `${cut}…`;
}

function sentences(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8 && s.length <= 500 && !s.startsWith("{") && !s.startsWith("["));
}

export function hexColor(value) {
  const raw = String(value ?? "").trim();
  const full = raw.match(/^#?([0-9a-fA-F]{6})$/);
  if (full) return `#${full[1].toLowerCase()}`;
  const short = raw.match(/^#([0-9a-fA-F]{3})$/);
  if (short) return `#${short[1].split("").map((c) => c + c).join("").toLowerCase()}`;
  return "";
}

function luminance(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function mix(a, b, t) {
  const pa = Number.parseInt(a.slice(1), 16);
  const pb = Number.parseInt(b.slice(1), 16);
  const channels = [16, 8, 0].map((shift) => {
    const av = (pa >> shift) & 255;
    const bv = (pb >> shift) & 255;
    return Math.round(av + (bv - av) * t);
  });
  return `#${channels.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function fontStack(family, generic) {
  const name = String(family ?? "").replace(/["<>]/g, "").trim();
  if (!name) return generic;
  if (name.includes(",")) return name;
  const quoted = /\s/.test(name) ? `"${name}"` : name;
  return `${quoted}, ${generic}`;
}

function pickFont(typeList, kinds) {
  const list = Array.isArray(typeList) ? typeList : [];
  for (const kind of kinds) {
    const hit = list.find((entry) => String(entry?.kind || "").toLowerCase() === kind && entry.family);
    if (hit) return hit.family;
  }
  return list.find((entry) => entry?.family)?.family || "";
}

export function tokensFromBio(bio) {
  const palette = (Array.isArray(bio?.visual?.palette) ? bio.visual.palette : [])
    .map((entry) => ({ ...entry, hex: hexColor(entry?.hex) }))
    .filter((entry) => entry.hex);
  const ranked = [...palette].sort((a, b) => luminance(a.hex) - luminance(b.hex));
  const darkest = ranked[0]?.hex || FALLBACK_TOKENS.ink;
  const lightest = ranked[ranked.length - 1]?.hex || FALLBACK_TOKENS.bg;
  const bg = lightest && luminance(lightest) >= 0.72 ? lightest : FALLBACK_TOKENS.bg;
  const ink = darkest && luminance(darkest) <= 0.4 ? darkest : FALLBACK_TOKENS.ink;
  const accent = ranked.find((entry) => {
    const l = luminance(entry.hex);
    return l > 0.08 && l < 0.55 && entry.hex !== ink;
  })?.hex || ink;
  const display = pickFont(bio?.visual?.type, ["display", "heading", "headline"]);
  const body = pickFont(bio?.visual?.type, ["body", "text", "sans"]);
  return {
    bg,
    ink,
    accent,
    muted: mix(ink, bg, 0.45),
    font_display: fontStack(display, "Georgia, 'Times New Roman', serif"),
    font_body: fontStack(body, "Helvetica, Arial, sans-serif"),
    radius: 8,
  };
}

export function swatchDataUri({ bg, accent }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="${bg}"/><rect x="720" y="0" width="480" height="800" fill="${accent}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function languageOf({ brief, bio }) {
  const explicit = String(brief?.payload?.language || bio?.language || "").toLowerCase();
  if (explicit === "es" || explicit === "en") return explicit;
  const blob = [
    brief?.title,
    brief?.payload?.sharpenedBrief,
    brief?.payload?.request,
    bio?.identity?.positioning,
  ].join(" ");
  return /[¿¡ñáéíóú]/i.test(blob) ? "es" : "en";
}

function forbiddenOf(bio, brief) {
  const lists = [bio?.voice?.forbidden, bio?.strategic?.notList, brief?.payload?.refusals, brief?.refusals];
  const out = [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const text = String(item ?? "").trim();
      if (text) out.push(text);
    }
  }
  return out.slice(0, 12);
}

function keeps(text, forbidden) {
  const lower = String(text || "").toLowerCase();
  return text && !forbidden.some((word) => word.length > 1 && lower.includes(word.toLowerCase()));
}

function collectRunMaterial(outputs) {
  const texts = [];
  const assets = [];
  for (const output of outputs || []) {
    const body = output?.body;
    if (!body) continue;
    if (typeof body === "string") {
      texts.push(body);
      continue;
    }
    if (typeof body.text === "string") texts.push(body.text);
    if (typeof body.edited_text === "string") texts.push(body.edited_text);
    if (typeof body.asset_url === "string") assets.push(body.asset_url);
    if (Array.isArray(body.deliverables)) {
      for (const item of body.deliverables) {
        if (typeof item?.body === "string") texts.push(item.body);
        if (typeof item?.title === "string") texts.push(item.title);
        const url = item?.asset_url || item?.assetUrl;
        if (typeof url === "string") assets.push(url);
      }
    }
  }
  return {
    texts,
    asset: assets.find((url) => /^https?:\/\//i.test(url)) || "",
  };
}

function uniqueLines(candidates, forbidden, limit) {
  const seen = new Set();
  const out = [];
  for (const candidate of candidates) {
    const line = String(candidate ?? "").replace(/\s+/g, " ").trim();
    const key = line.toLowerCase();
    if (!line || seen.has(key) || !keeps(line, forbidden)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= limit) break;
  }
  return out;
}

function safeUrl(url) {
  const value = String(url ?? "").trim();
  if (/^https?:\/\//i.test(value)) return value;
  return "#";
}

/**
 * @param {object} args
 * @param {{id?: string, title?: string, payload?: object}} args.brief
 * @param {{name?: string, url?: string}} args.brand
 * @param {object} args.bio normalized BIO
 * @param {number} [args.bioVersion]
 * @param {object[]} [args.outputs]
 */
export function deriveMessageSpec({ brief = {}, brand = {}, bio = {}, bioVersion = 0, outputs = [] } = {}) {
  const lang = languageOf({ brief, bio });
  const chrome = CHROME[lang];
  const forbidden = forbiddenOf(bio, brief);
  const tokens = tokensFromBio(bio);
  const { texts, asset } = collectRunMaterial(outputs);
  const briefLines = [
    ...sentences(brief?.payload?.sharpenedBrief),
    ...sentences(brief?.payload?.request),
    ...sentences(brief?.title),
  ];
  const runLines = texts.flatMap((text) => sentences(text));
  const pillars = Array.isArray(bio?.identity?.pillars) ? bio.identity.pillars.map(String) : [];
  const positioning = String(bio?.identity?.positioning || "").trim();
  const audience = String(bio?.audience?.primary || "").trim();
  const goalText = String(brief?.payload?.tension || bio?.goals?.northStar || briefLines[0] || positioning || brand.name || "Campaign").trim();

  const messageSource = uniqueLines(
    [...runLines, ...briefLines, ...pillars, positioning].filter(Boolean),
    forbidden,
    3,
  );
  if (messageSource.length === 0) {
    messageSource.push(clip(brand.name ? `${brand.name}` : "Campaign", 180));
  }

  const proofSource = uniqueLines(
    [...pillars, positioning, ...runLines.slice(0, 3)].filter(Boolean),
    forbidden,
    3,
  );
  if (proofSource.length === 0) proofSource.push(messageSource[0]);

  const smp = clip(brief?.payload?.tension || briefLines[0] || messageSource[0], 160);
  const messages = messageSource.map((text, i) => ({ id: `m${i + 1}`, text: clip(text, 280), proof_ids: [`p${Math.min(i + 1, proofSource.length)}`] }));
  const proof = proofSource.map((claim, i) => ({
    id: `p${i + 1}`,
    claim: clip(claim, 220),
    source: pillars.includes(claim) || pillars.some((p) => claim.includes(p)) ? "bio.identity.pillars" : positioning && claim.includes(positioning.slice(0, 24)) ? "bio.identity.positioning" : "brief",
    verified: false,
  }));

  const ctaLabel = clip(
    uniqueLines(briefLines.filter((line) => line.length <= 28), forbidden, 1)[0] || chrome.cta,
    28,
  );
  const ctaUrl = safeUrl(brand.url);
  const brandName = clip(brand.name || "Brand", 80);
  const image = {
    src: asset || swatchDataUri(tokens),
    alt: clip(asset ? `${brandName} campaign image` : `${brandName} color field`, 125),
  };

  const features = [0, 1, 2].map((i) => {
    const text = messages[i]?.text || proof[i]?.claim || messages[0].text;
    return { title: clip(text, 40), text: clip(text, 160) };
  });

  const quote = proof[0];
  const spec = {
    message_spec_id: `ms_${String(brief.id || "draft").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) || "draft"}`,
    brief_id: String(brief.id || ""),
    bio_version: Number.isInteger(bioVersion) ? bioVersion : Math.max(0, Math.trunc(Number(bioVersion) || 0)),
    brand: {
      name: brandName,
      url: ctaUrl === "#" ? "" : ctaUrl,
      tokens,
    },
    language: lang,
    audience: {
      segment: clip(audience || brandName, 180),
      belief: clip(String(bio?.voice?.register || ""), 180),
      tension: clip(String(brief?.payload?.tension || ""), 180),
    },
    goal: { objective: clip(goalText, 180), metric: clip(String(bio?.goals?.q2 || bio?.goals?.northStar || ""), 120) },
    smp,
    spine: { line: clip(smp, 60) },
    messages,
    proof,
    cta: { label: ctaLabel, url: ctaUrl },
    refusals: forbidden.map((item) => clip(item, 160)),
    blocks: {
      email: {
        subject: clip(smp, 60),
        preheader: clip(goalText !== smp ? goalText : messages[0].text, 100),
        headline: clip(smp, 70),
        body: clip(messages.map((m) => m.text).join(" "), 600),
        image,
        bullets: proof.slice(0, 3).map((item) => clip(item.claim, 140)),
        footer: clip(chrome.footer(brandName), 240),
      },
      landing: {
        hero: {
          eyebrow: clip(chrome.eyebrow, 40),
          headline: clip(smp, 70),
          subhead: clip(audience ? `${audience}` : goalText, 200),
          image,
        },
        features,
        proof: {
          quote: clip(quote.claim, 220),
          attribution: clip(brandName, 80),
          proof_id: quote.id,
        },
        cta: { headline: clip(ctaLabel, 80), subhead: clip(goalText, 160) },
        footer: { text: clip(chrome.landingFooter(brandName), 160) },
      },
      deck: {
        slides: [
          { layout: "title", kicker: clip(chrome.eyebrow, 40), title: clip(smp, 80), image, notes: clip(goalText, 180) },
          {
            layout: "points",
            kicker: lang === "es" ? "Mensajes" : "Messages",
            title: clip(messages[0].text, 80),
            points: messages.map((m) => clip(m.text, 120)).slice(0, 4),
            notes: clip(String(bio?.voice?.register || ""), 180),
          },
          {
            layout: "closing",
            kicker: lang === "es" ? "Siguiente" : "Next",
            title: clip(ctaLabel, 80),
            points: [clip(goalText, 120), clip(ctaUrl === "#" ? brandName : ctaUrl, 120)].filter(Boolean),
            notes: clip(chrome.footer(brandName), 180),
          },
        ],
      },
    },
  };
  return spec;
}

/** One headline, three formats. Email, the landing hero, and the deck title slide. */
export const SHARED_HEADLINE_MAX = 70;

export function applySharedHeadline(spec, headline) {
  const line = clip(String(headline ?? ""), SHARED_HEADLINE_MAX);
  if (!line || !spec?.blocks) return spec;
  const next = structuredClone(spec);
  next.smp = line;
  next.spine = { ...(next.spine || {}), line: clip(line, 60) };
  next.blocks.email.subject = clip(line, 60);
  next.blocks.email.headline = line;
  next.blocks.landing.hero.headline = line;
  next.blocks.landing.cta = { ...(next.blocks.landing.cta || {}), headline: clip(line, 80) };
  const title = (next.blocks.deck.slides || []).find((slide) => slide.layout === "title");
  if (title) title.title = clip(line, 80);
  return next;
}
