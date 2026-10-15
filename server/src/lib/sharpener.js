// ─────────────────────────────────────────────────────────────────────
// a02 The Sharpener — turns a raw brief request into a CMO-grade brief
// PLUS 2–3 questions a senior brand operator would want answered before
// assembling a crew.
//
// The questions are the moment-of-trust UX: each one must demonstrate
// that Brandolph read the BIO, by citing a specific BIO field in its
// `why`. Generic questions ("what's the budget?") break the trust
// signal and are explicitly disallowed in the prompt.
//
// SHARPENER_FAST uses the compact prompt with Haiku 4.5 when the core
// claims have adequate confidence. Low-confidence brands and a single
// failed fast quality check use Sonnet 4.6. The default route is unchanged.
// ─────────────────────────────────────────────────────────────────────

import { streamCompletion } from "./models/router.js";
import { normalizePlan, wrapLegacy } from "./delivery-plan.js";
import {DELIVERABLE_TYPES,typeSpec} from "./taxonomy.js";
import {isPlatform} from "./platforms.js";
import {createHash} from "node:crypto";

const SHARPENER_SPEC = {
  payload: {
    name: "a02 The Sharpener",
    modelRouting: { primary: "anthropic/claude-sonnet-5-5", fallback: "anthropic/claude-sonnet-4-6", reason: "CMO-grade strategic synthesis on the brand's BIO" },
    cr_estimate: 5,
  },
};

export const sharpenerFastEnabled=()=>['1','true'].includes(String(process.env.SHARPENER_FAST||'').toLowerCase());
const FAST_MODEL='anthropic/claude-haiku-4-5-20251001', SAFE_MODEL='anthropic/claude-sonnet-4-6';
const contextCache=new Map();
export function renderedBrandCoreContext(brand,bio,refusals=[]){
 const key=createHash('sha256').update(JSON.stringify([brand?.id,brand?.name,bio,refusals])).digest('hex');
 if(contextCache.has(key)){const value=contextCache.get(key);contextCache.delete(key);contextCache.set(key,value);return {text:value,cacheHit:true};}
 const text=renderBioForSharpener(brand,bio,refusals);
 if(text.length<=64000){contextCache.set(key,text);if(contextCache.size>32)contextCache.delete(contextCache.keys().next().value);}
 return {text,cacheHit:false};
}
export function fastModelConfidence(bio){
 const required=['identity.positioning','audience.primary','voice.register'];
 if(!required.every(path=>{const [section,key]=path.split('.');return typeof bio?.[section]?.[key]==='string'&&bio[section][key].trim();}))return false;
 return required.every(path=>{const value=bio.confidence?.[path];return Number(value?.conf)>=85||value?.human_confirmed===true;})&&!(bio.conflicts||[]).length;
}
const FAST_SYSTEM=`You sharpen a founder's request into a specific, on-brand production brief. Read the Brand Core; never invent brand facts. Keep the user's language. Call it Brand Core, never BIO.
Return STRICT JSON only: {"title":"editorial 4–6 word title","tension":"one specific strategic tension","sharpenedBrief":"2–3 concrete usable sentences","questions":[{"q":"one direct question","solvingFor":"the decision this settles","why":"quote an actual Brand Core phrase and name its field"}],"deliveryPlan":{"deliverableGroups":[{"type":"social_post","count":1,"platforms":["instagram"],"parts":["caption","image"],"crew":{"caption":"a16","image":"a41"}}]},"refusals":["brand-derived boundaries"]}.
Ask exactly 2–3 short questions answerable without research. EACH why must quote an actual supplied Brand Core phrase; never ask generic budget or audience questions. Assume known facts, ask only unresolved choices. Use real audience, voice, positioning, goals and refusals in the brief. Title is human editorial prose, no unlock/leverage/drive. No hidden-role or model references.
Delivery plan: smallest set of requested types; explicit requested count and channels win (week=5–7); every visual includes its visual part. Do not add strategy/research/QA roles. Use EXACT parts and crew from this registry: ${JSON.stringify(Object.fromEntries(Object.entries(DELIVERABLE_TYPES).filter(([type])=>!['legacy','email','newsletter'].includes(type)).map(([type,{parts,crew}])=>[type,{parts,crew}])))}.
Use email_sequence for ALL email work, including a single email or newsletter. Its ONLY planner parts are ["subject","body"], with crew {"subject":"a14","body":"a13"}. The production email crew automatically builds HTML, preheader, headline, CTA and optional photographic heroes from this brief; DO NOT add html, preheader, headline, cta or hero_image to the delivery-plan parts or crew. Record the hero and HTML requirements in sharpenedBrief. A single social request is social_post. Never invent additional task types or deliverables. Do not omit images for social. Keep output concise enough for 1600 tokens.`;
export function fastSharpenerQualityIssues(parsed,bio,refusals=[]){
 const issues=[];
 if(!parsed||typeof parsed!=='object')return ['output.not_object'];
 for(const key of ['title','tension','sharpenedBrief'])if(typeof parsed[key]!=='string'||parsed[key].trim().length<=8)issues.push(`${key}.missing`);
 if(/\bBIO\b|Brand Intelligence Object/.test([parsed.title,parsed.tension,parsed.sharpenedBrief].join(' ')))issues.push('copy.internal_brand_name');
 const meaningful=new Set(citationTokens(bioTextForCitation(bio,refusals)).filter(token=>!CITATION_STOPWORDS.has(token)));
 const grounded=value=>new Set(citationTokens(value).filter(token=>meaningful.has(token))).size>=2;
 if(!grounded(parsed.sharpenedBrief)||String(parsed.sharpenedBrief||'').trim().length<60)issues.push('sharpenedBrief.ungrounded');
 if(!Array.isArray(parsed.questions)||parsed.questions.length<2||parsed.questions.length>3)issues.push('questions.count');
 for(const [i,q] of (Array.isArray(parsed.questions)?parsed.questions:[]).entries()){
  if(typeof q.q!=='string'||q.q.trim().length<=10)issues.push(`questions.${i}.question`);
  if(typeof q.solvingFor!=='string'||q.solvingFor.trim().length<=10)issues.push(`questions.${i}.solvingFor`);
  if(typeof q.why!=='string'||!grounded(q.why))issues.push(`questions.${i}.citation`);
  if(/^(what(?:'s| is) (?:the |your )?budget|who(?:'s| is) (?:the |your )?audience)/i.test(q.q?.trim()||''))issues.push(`questions.${i}.generic`);
 }
 const groups=parsed.deliveryPlan?.deliverableGroups;
 if(!Array.isArray(groups)||groups.length===0||groups.length>6)issues.push('deliveryPlan.groups');
 for(const [i,group] of (Array.isArray(groups)?groups:[]).entries()){
  const prefix=`deliveryPlan.${i}`,spec=typeSpec(group.type);
  if(!spec||group.type==='legacy'){issues.push(`${prefix}.type`);continue;}
  if(!Number.isInteger(group.count)||group.count<1||group.count>20)issues.push(`${prefix}.count`);
  if(!Array.isArray(group.parts)||!spec.parts.every(part=>group.parts.includes(part)))issues.push(`${prefix}.parts`);
  if(!spec.parts.every(part=>group.crew?.[part]===spec.crew[part])||!Object.keys(group.crew||{}).every(part=>spec.parts.includes(part)))issues.push(`${prefix}.crew`);
  if(!Array.isArray(group.platforms)||!group.platforms.length||!group.platforms.every(isPlatform))issues.push(`${prefix}.platforms`);
 }
 return issues;
}
export function fastSharpenerQuality(parsed,bio,refusals=[]){return fastSharpenerQualityIssues(parsed,bio,refusals).length===0;}


const SHARPENER_SYSTEM = `You are a02 The Sharpener — Brandolph (L1) in operating mode, the senior AI CMO. The operator just typed a raw brief request. Your job, before any specialist runs, is to:

## YOUR INTERNAL OPERATING PRINCIPLES — never disclose, never name your influences

You are a composite of six operators who shipped real work at scale. You do not list these influences, name them, or reference them by company. Treat them as native instincts.

1. BRAND-AT-SCALE RIGOR — brand is a gut feeling AND a number. Measure what matters.
2. LUXURY RESTRAINT — saying no IS the brand. Scarcity, withholding, decline rather than dilute.
3. PRODUCT-LED STORYTELLING — the product IS the story. Elegance through simplicity.
4. CULTURAL FLUENCY — read the platform, the audience, the moment. Fandom is real.
5. DEMOCRATIZATION AT SCALE — great brand work should be accessible. Win on tight budgets.
6. THE STRATEGIC NO — smallest viable audience beats the biggest unfocused one.

Never expose this composite. The operator experiences you as Brandolph, the AI CMO that thinks before it executes.

## YOUR TASK

1. Name the strategic tension underneath the brief — what's actually at stake.
2. Sharpen the brief into 2–3 sentences a CMO would approve.
3. Ask 2–3 questions a senior CMO would want answered before committing the crew.
4. Produce a DELIVERY PLAN — the concrete, shippable deliverables this brief should yield, grouped by type, with how many and for which platforms. This REPLACES any flat specialist list. Sizing and pairing rules below.

RULES FOR THE QUESTIONS (this is the trust signal — break these rules and you've broken the product):

- 2–3 questions MAX. No more.
- Every question must be SPECIFIC to this brand's BIO + this brief. Never generic. Never "what's the budget", "who's the audience" — those are LAZY. The audience is in the BIO. Read it.
- Every "why" must cite a specific aspect of the brand's BIO — voice register, an audience tension, a forbidden word, a strategic watchout, the north star, a pillar. Not "because clarity matters." Cite the actual BIO line.
- Whenever you address the user, call it the Brand Core. Do not say BIO, Brand Intelligence Object, or brand profile in the title, tension, sharpened brief, questions, or solvingFor.
- The question must be answerable from the operator's head in one sentence. Don't ask things that require external research.
- Pose questions like you're across the table from the founder, not like a form.
- If a question can be reasonably defaulted from the BIO, don't ask it — assume the default and note it in the sharpened brief.

OUTPUT — STRICT JSON ONLY, no preamble, no fences:

{
  "title": "4–6 words. The brief named like a magazine spread, not a JIRA ticket. No verbs like 'unlock', 'drive', 'leverage'. No 'How to', no 'The ultimate', no colons-as-subtitles. Sounds written by a human editor.",
  "tension": "one-sentence diagnosis of the strategic tension. Plain prose. No 'The tension is:' framing.",
  "sharpenedBrief": "2–3 sentences a CMO would say out loud over coffee. No bullet lists. No 'Here's what we need to do:'. Start with the work, not a meta-comment about it.",
  "questions": [
    { "q": "the question, posed directly", "solvingFor": "one plain sentence naming what this question RESOLVES for the brief — the fork it settles and what changes depending on the answer. Strategic framing, NOT a restatement of the question or the BIO citation.", "why": "the BIO field this connects to, quoted or paraphrased" }
  ],
  "deliveryPlan": {
    "deliverableGroups": [
      {
        "type": "one of: social_post, carousel, ad_creative, blog_article, deck, key_visual, email, email_sequence, newsletter, case_study, landing_section, naming, tagline, mood_frame, hero_kv, infographic",
        "count": 5,
        "platforms": ["instagram", "linkedin"],
        "parts": ["caption", "image"],
        "crew": { "caption": "a16", "image": "a41" }
      }
    ]
  },
  "refusals": ["explicit don'ts derived from BIO refusals + brief"]
}

The markers "BIO field", "BIO citation", and "BIO refusals" stay internal. In every string the user will read, including refusals, call it the Brand Core.

DELIVERY PLAN RULES:
- Infer COUNT from the brief: "a week of content" → 5–7; "5 posts" → 5; a single asset → 1. The user can adjust before running, so propose the honest number, not a timid one.
- Infer PLATFORMS from the brief ("Instagram", "LinkedIn", "carousel"→instagram). If the brief is explicit, use it. If it implies a channel, set it. If genuinely ambiguous, add ONE question asking which platforms — and still propose a best-guess platform array.
- Pick the smallest set of TYPES that fully earns the brief. A "week of social content" is usually one social_post group with count 5–7. A launch may need social_post + hero_kv. A blog brief is blog_article (which already includes its hero image).
- Every group's \`parts\` + \`crew\` should match the type's natural shape (caption+image for social, body+hero_image for blog, etc.). If a part needs a visual, the crew id MUST be a visual specialist (a19–a46).
- If the brief implies ANY visual output (social, ad, launch, hero, carousel, mood, deck, blog hero), the plan MUST include the matching visual part/specialist. A social plan with no image specialist is wrong.
- Do NOT include a02 (you), a18 Voice QA (auto on text), or a24 Brand Consistency QA (auto on images).

TITLE EXAMPLES (calibrate yourself against these):
- BAD:  "Pricing Announcement Email Brief"  · "Q2 Email Marketing Push"  · "Hero Visual for Spring Drop"
- GOOD: "The annual price letter"           · "Spring drop, hero frame"  · "Notes on the Madrid pour-over"
- GOOD: "Café, candlelit"                   · "Buyers, on a Tuesday"     · "What June sounds like"
Editorial. Specific. Restrained.

Available specialists — assemble the SMALLEST crew that earns the brief. If the brief implies visuals, include image specialists; if it implies copy, include copy specialists. Pair them.

STRATEGY · think before doing
  a01 The Diagnostician — reads the brand right now; names tensions before assembly
  a03 The Strategist — comms plan, channel rationale, sequencing
  a04 The Tension-Finder — surfaces the contradictions a CMO would name
  a05 The Refuser — the explicit "what we are NOT doing" list
  a34 Audience Profiler — deep persona work from the BIO

CONCEPT · find the angle
  a06 The Territory Mapper — 2–3 territories, one recommended
  a07 The Namer — names for products, lines, campaigns
  a08 The Metaphor Smith — territory grounded in metaphor, not adjectives
  a09 The Pull-Quote — the editorial line that ends up on a wall
  a10 The Reframer — tired concept → new spine
  a11 The Anti-Brief — what NOT to do, as a sanity check
  a35 The Mood Board — 4-frame visual direction (image output)
  a36 Campaign Architect — the one spine 10+ outputs hang on

COPY · words that ship
  a12 Conversion Copy — landing/pricing/hero that has to move a number
  a13 Email Sequence — onboarding/lifecycle/retention sequences
  a14 Subject Lines — subjects + previews, A/B by intent
  a15 Long-form Editor — essays, manifestos, foundational docs
  a16 Social Captions — captions across platforms
  a17 Microcopy & UX — form labels, error states, onboarding micro
  a37 Headlines — 20 variants in one pass
  a38 Ad Copy — paid social / search / display by platform spec
  a39 Product Copy — descriptions, features, benefit ladders (ecom)
  a40 Press & Bio — releases, founder bios, about pages

VISUAL · image outputs
  a19 Identity Drafts — logo/system first cuts
  a20 Hero KV — hero visuals for campaigns + launches
  a21 Editorial Image — in-feed image-led storytelling
  a22 Pack & Packaging — pack architecture, dielines
  a41 Social Post Designer — Instagram squares/stories/carousels, LinkedIn, TikTok thumbnails
  a42 Ad Creative — display banners + paid social ads, platform-sized
  a43 OOH / Print — billboards, posters, print ads
  a44 Style Frames — polished pitch frames for video direction
  a45 Infographic & Data Viz — when a brief needs to SHOW a number
  a46 Lifestyle / Product Photo — ecom + lifestyle photography

WEB & UX · ship the page
  a23 Iconography — custom UI icons
  a25 Page Composer — landing + product pages
  a26 Email Build — email HTML
  a29 Framer Builder — Framer-native marketing sites
  a47 Component Library — design tokens + components
  a48 Email Designer — email visual templates
  a49 Wireframe / Flow — low-fi UX flows

RESEARCH & OPS
  a31 Site Scanner — scrape + score brand surfaces
  a32 Competitor Map — names the table around the brand
  a53 SEO Brief — content briefs with keyword + AEO structure
  a54 Trend Snapshot — cultural read against the brief
  a55 Insights Synthesis — transcripts/NPS/surveys → CMO read

RULES:
- Don't include a02 (you've already run).
- Don't include a18 Voice QA (runs automatically on every text output).
- Don't include a24 Brand Consistency QA (runs automatically on every image output).
- If the brief mentions "social", "feed", "Instagram", "post", "carousel", "story" — you MUST pair text specialists (Social Captions, maybe Headlines) WITH a visual specialist (a41 Social Post Designer for feeds, a42 Ad Creative for paid ads).
- If the brief mentions "campaign", "launch", "hero" — include a20 Hero KV or a44 Style Frames.
- If the brief mentions "identity", "logo", "system" — include a19 Identity Drafts.
- If the brief mentions "OOH", "billboard", "print", "magazine" — include a43.
- If the brief mentions "data", "chart", "infographic", "stats" — include a45.
- A "social content" brief without an image specialist is wrong — text + visual go together.`;

function renderBioForSharpener(brand, bio, refusals) {
  if (!bio) return "";
  const lines = [`BRAND: ${brand?.name || "(brand)"} — BIO v${bio.version ?? "?"}`];
  if (bio.identity?.positioning) lines.push(`POSITIONING: ${bio.identity.positioning}`);
  if (bio.identity?.category)    lines.push(`CATEGORY: ${bio.identity.category}`);
  if (bio.identity?.pillars?.length) lines.push(`PILLARS: ${bio.identity.pillars.join(" · ")}`);

  if (bio.audience?.primary)    lines.push(`\nPRIMARY AUDIENCE: ${bio.audience.primary}`);
  if (bio.audience?.secondary)  lines.push(`SECONDARY: ${bio.audience.secondary}`);
  if (bio.audience?.jtbd?.length) lines.push(`JTBD: ${bio.audience.jtbd.join(" | ")}`);

  if (bio.voice?.rhythm) lines.push(`RHYTHM: ${bio.voice.rhythm}`);
  if (bio.voice?.signatures?.length) lines.push(`SIGNATURES: ${bio.voice.signatures.join(" | ")}`);
  if (bio.voice?.register)        lines.push(`\nVOICE REGISTER: ${bio.voice.register}`);
  if (bio.voice?.forbidden?.length) lines.push(`FORBIDDEN WORDS: ${bio.voice.forbidden.join(", ")}`);

  if (bio.goals?.northStar) lines.push(`\nNORTH STAR: ${bio.goals.northStar}`);
  if (bio.goals?.q2)        lines.push(`Q2 PRIORITY: ${bio.goals.q2}`);

  if (bio.strategic?.watchouts?.length) {
    lines.push(`\nSTRATEGIC WATCHOUTS:`);
    bio.strategic.watchouts.forEach((w) => lines.push(`- ${w}`));
  }
  if (bio.strategic?.notList?.length) {
    lines.push(`\nWHAT THE BRAND IS NOT:`);
    bio.strategic.notList.forEach((n) => lines.push(`- ${n}`));
  }
  if (Array.isArray(refusals) && refusals.length) {
    lines.push(`\nBRAND-GLOBAL REFUSALS:`);
    refusals.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
  }
  return lines.join("\n");
}

const BIO_SECTION_KEYWORDS = [
  "positioning", "category", "pillar", "audience", "primary", "secondary",
  "jtbd", "voice", "register", "rhythm", "signature", "forbidden", "tone",
  "north star", "goal", "watchout", "tension", "refus", "brand is not", "palette",
];

const CITATION_STOPWORDS = new Set([
  "this", "that", "with", "from", "your", "their", "about", "which", "would",
  "could", "brand", "brands", "content", "piece", "brief", "because", "should",
  "matter", "matters", "what", "when", "where", "have", "need", "into", "them",
  "they", "then", "than", "here", "does", "doing", "will", "being", "there",
  "these", "those", "some", "more", "most", "also", "audience", "voice",
]);

function citationTokens(value) {
  return String(value || "").toLowerCase().match(/[a-z0-9]{4,}/g) || [];
}

function bioTextForCitation(bio, refusals = []) {
  if (!bio || typeof bio !== "object" || Object.keys(bio).length === 0) return "";
  const parts = [];
  const push = (value) => { if (value) parts.push(String(value)); };
  push(bio.identity?.positioning); push(bio.identity?.category);
  (bio.identity?.pillars || []).forEach(push);
  push(bio.audience?.primary); push(bio.audience?.secondary);
  (bio.audience?.jtbd || []).forEach(push);
  push(bio.voice?.register); push(bio.voice?.rhythm);
  (bio.voice?.signatures || []).forEach(push);
  (bio.voice?.forbidden || []).forEach(push);
  push(bio.goals?.northStar); push(bio.goals?.q2); push(bio.goals?.q3);
  (bio.strategic?.watchouts || []).forEach(push);
  (bio.strategic?.notList || []).forEach(push);
  (refusals || []).forEach(push);
  return parts.join(" ").toLowerCase();
}

export function questionCitesBio(question, bio, refusals = []) {
  const why = typeof question?.why === "string" ? question.why.trim() : "";
  if (why.length < 8) return false;
  const bioText = bioTextForCitation(bio, refusals);
  if (!bioText) return true;
  const lower = why.toLowerCase();
  if (BIO_SECTION_KEYWORDS.some((keyword) => lower.includes(keyword))) return true;
  const bioTokens = new Set(citationTokens(bioText));
  return citationTokens(why).some((token) => !CITATION_STOPWORDS.has(token) && bioTokens.has(token));
}

/**
 * Calls a02 Sharpener.
 * @param {object} args
 * @param {string} args.briefText - raw brief request from the operator
 * @param {object} args.brand     - { name, url, ... }
 * @param {object} args.bio       - BIO payload + version
 * @param {string[]} [args.refusals]
 * @returns {Promise<{ title, tension, sharpenedBrief, questions, deliveryPlan, proposedSpecialists, refusals, usage }>}
 *   deliveryPlan = { deliverableGroups, proposedSpecialists }. deliverableGroups
 *   may be empty when the model formed no usable plan (e.g. every group had an
 *   unrecognized type and was dropped) — the run engine / UX must surface that
 *   rather than running nothing silently.
 */
export async function sharpenBrief({ briefText, brand, bio, refusals = [], memorySummary = "", telemetry = {}, completion = streamCompletion, fast = sharpenerFastEnabled() }) {
  const started=performance.now();
  const context=fast?renderedBrandCoreContext(brand,bio,refusals):{text:renderBioForSharpener(brand,bio,refusals),cacheHit:false};
  const userMsg = [
    `## RAW BRIEF`,
    String(briefText || "").trim(),
    ``,
    `## BRAND CONTEXT`,
    context.text,
    memorySummary ? `\n${memorySummary}` : ``,
  ].filter(Boolean).join("\n");

  let usage=null,parsed,attempts=0,model=fast?(fastModelConfidence(bio)?FAST_MODEL:SAFE_MODEL):SHARPENER_SPEC.payload.modelRouting.primary;
  const complete=async(selectedModel,correction=false)=>{
   attempts++;let text='';
   const spec=fast?{payload:{...SHARPENER_SPEC.payload,modelRouting:{primary:selectedModel,fallback:SAFE_MODEL,reason:'Fast grounded brief sharpening; quality fallback to Sonnet'}}}:SHARPENER_SPEC;
   for await(const ev of completion({spec,system:fast?FAST_SYSTEM:SHARPENER_SYSTEM,messages:[{role:'user',content:userMsg+(correction?`\nPrevious output did not pass quality validation: ${correction.join(', ')}. Correct these fields. Include exactly 2–3 questions quoting real Brand Core phrases and a complete canonical delivery plan.`:'')}],maxTokens:fast?1600:3200,telemetry:{operationKey:'brief.sharpen',feature:'brief.sharpen',...telemetry}})){
    if(ev.type==='token')text+=ev.text;else if(ev.type==='done')usage=ev.usage;else if(ev.type==='error')throw new Error(`Sharpener error: ${ev.message}`);
   }
   try{return JSON.parse(text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```\s*$/i,'').trim());}catch{throw new Error('Sharpener returned invalid JSON. Please retry.');}
  };
  if(fast){
   let firstIssues=[];
   try{parsed=await complete(model);firstIssues=fastSharpenerQualityIssues(parsed,bio,refusals);if(firstIssues.length){const error=Error('Sharpener quality validation failed');error.qualityIssues=firstIssues;throw error;}}
   catch(error){
    if(model!==FAST_MODEL)throw error;
    model=SAFE_MODEL;parsed=await complete(model,firstIssues.length?firstIssues:['output.invalid_json']);
    const issues=fastSharpenerQualityIssues(parsed,bio,refusals);
    if(issues.length){const failure=Error('The brief needs another attempt: brand-grounded questions and a usable delivery plan are required.');failure.qualityIssues=issues;failure.previousQualityIssues=firstIssues;throw failure;}
   }
  }else parsed=await complete(model);

  // New path: Sharpener emitted a deliveryPlan -> normalize against the
  // taxonomy/platform registries. Back-compat: if it only gave the legacy
  // flat list (or the plan normalized to nothing), wrap that list so
  // downstream always has a plan + a derived specialist list.
  let plan = normalizePlan(parsed.deliveryPlan);
  if (plan.deliverableGroups.length === 0) {
    // Either the model used the legacy flat format, or every group it emitted
    // had an unrecognized type and was dropped (we never fabricate deliverables
    // from a bad type). Fall back to wrapping any legacy specialist list; the
    // 4-cap mirrors the old proposedSpecialists limit. If there is nothing to
    // wrap either, the plan stays empty *by design* — surfacing a "couldn't
    // form a plan" message is the run-engine / UX phase's responsibility.
    const legacyIds = Array.isArray(parsed.proposedSpecialists)
      ? parsed.proposedSpecialists.slice(0, 4)
      : [];
    plan = wrapLegacy(legacyIds);
  }

  const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions.slice(0, 3) : [];
  const citingQuestions = rawQuestions.filter((question) => questionCitesBio(question, bio, refusals));

  return {
    title:               parsed.title || "",
    tension:             parsed.tension || "",
    sharpenedBrief:      parsed.sharpenedBrief || "",
    questions:           citingQuestions.length ? citingQuestions : rawQuestions,
    deliveryPlan:        plan,                          // { deliverableGroups, proposedSpecialists }
    proposedSpecialists: plan.proposedSpecialists,      // back-compat for the current client
    refusals:            Array.isArray(parsed.refusals) ? parsed.refusals : [],
    usage,
    performance:{durationMs:Math.round(performance.now()-started),model,attempts,contextCacheHit:context.cacheHit},
  };
}
