import { supabaseAdmin } from "./supabase.js";
import { FONT_UPLOAD_EXTS, IMAGE_UPLOAD_EXTS } from "./ingest-guards.js";

const roleRank = { canonical: 0, inspiration: 1, avoid: 2 };

/* S1: legacy visual-bucket image rows that predate asset roles count as
   `inspiration` (rights must still be confirmed; see backfill-visual-roles). */
export function effectiveAssetRole(row) {
  const role = row?.signals?.asset_role;
  if (role) return role;
  return row?.bucket === "visual" ? "inspiration" : null;
}

export function classifyVisualSources(rows = []) {
  const eligible = (rows || []).filter((row) => row?.signals?.rights_confirmed === true && row.raw_ref)
    .map((row) => (row.signals.asset_role ? row : { ...row, signals: { ...row.signals, asset_role: effectiveAssetRole(row) } }));
  const references = eligible
    .filter((row) => IMAGE_UPLOAD_EXTS.has(String(row.signals?.ext || "").toLowerCase()))
    .filter((row) => ["canonical", "inspiration", "avoid"].includes(row.signals?.asset_role))
    .sort((a, b) => (roleRank[a.signals.asset_role] ?? 9) - (roleRank[b.signals.asset_role] ?? 9));
  const fonts = eligible
    .filter((row) => FONT_UPLOAD_EXTS.has(String(row.signals?.ext || "").toLowerCase()))
    .filter((row) => row.signals?.asset_kind === "font" && row.signals?.font_family);
  const logos = eligible.filter(row => row.signals?.asset_role === "logo" && ["svg","png"].includes(row.signals?.ext));
  return { references, fonts, logos };
}

async function signedEvidenceUrl(rawRef, ttlSeconds) {
  if (/^https?:\/\//i.test(rawRef)) return rawRef;
  const { data, error } = await supabaseAdmin.storage.from("bio-sources").createSignedUrl(rawRef, ttlSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function loadVisualAssets(brandId, { ttlSeconds = 60 * 60, sourceIds = null } = {}) {
  const exactIds = Array.isArray(sourceIds) ? [...new Set(sourceIds.filter(Boolean))] : null;
  if (exactIds && exactIds.length === 0) return { references:[], fonts:[], logos:[] };
  let query = supabaseAdmin
    .from("bio_sources")
    .select("id, src, signals, raw_ref, bucket, created_at")
    .eq("brand_id", brandId)
    .eq("bucket", "visual")
    .eq("kind", "file_upload")
    .order("created_at", { ascending: false });
  if (exactIds) query = query.in("id", exactIds);
  const { data, error } = await query;
  if (error) throw new Error(`visual sources read failed: ${error.message}`);
  const classified = classifyVisualSources(data || []);
  const sign = async (row) => ({
    id: row.id,
    name: row.src,
    role: row.signals.asset_role,
    url: await signedEvidenceUrl(row.raw_ref, ttlSeconds),
    signals: row.signals,
  });
  const [references, fonts, logos] = await Promise.all([
    Promise.all((exactIds ? classified.references : classified.references.slice(0, 6)).map(sign)),
    Promise.all(classified.fonts.map(sign)),
    Promise.all(classified.logos.map(sign)),
  ]);
  return {
    references: references.filter((item) => item.url),
    fonts: fonts.filter((item) => item.url),
    logos: logos.filter((item) => item.url),
  };
}

export function mergeTypographyFromAssets(extracted = [], fonts = []) {
  const uploaded = (fonts || []).map((font) => ({
    kind: font.signals?.font_usage || "Brand typography",
    family: font.signals?.font_family,
    size: "Licensed asset",
    license: font.signals?.license_type || "custom",
    suggest: font.signals?.license_reference || "Use supplied font asset",
    sourceId: font.id,
  }));
  const uploadedFamilies = new Set(uploaded.map((font) => font.family?.toLowerCase()));
  return [...uploaded, ...(extracted || []).filter((font) => !uploadedFamilies.has(font.family?.toLowerCase()))];
}

/* S1: up to 3 references reach every image call, canonical first, then
   inspiration. `avoid` never conditions generation. */
export function selectGenerationReferences(references = [], max = 3) {
  const rank = { canonical: 0, inspiration: 1 };
  return (references || []).filter((r) => r && r.role in rank && r.url).sort((a, b) => rank[a.role] - rank[b.role]).slice(0, max);
}

export function selectGenerationReference(references = []) {
  // Direct model conditioning is reserved for canonical, brand-owned work.
  // Inspiration is analyzed into BIO principles but never structurally copied.
  return references.find((item) => item.role === "canonical") || null;
}

export function pinCertifiedReferences(loaded = [], certified = []) {
  const roles = new Map(
    (Array.isArray(certified) ? certified : [])
      .filter((reference) => reference?.sourceId && ["canonical", "inspiration", "avoid"].includes(reference.role))
      .map((reference) => [reference.sourceId, reference.role]),
  );
  return (Array.isArray(loaded) ? loaded : [])
    .filter((reference) => roles.has(reference.id))
    .map((reference) => ({ ...reference, role:roles.get(reference.id) }));
}

export function certifiedVisualSourceIds(visual = {}) {
  return new Set([
    visual?.logo?.sourceId,
    ...Object.values(visual?.logo?.variants || {}).map(logo => logo?.sourceId),
    ...(Array.isArray(visual?.references) ? visual.references.map((reference) => reference?.sourceId) : []),
    ...(Array.isArray(visual?.type) ? visual.type.map((font) => font?.sourceId) : []),
  ].filter(Boolean));
}

// Runtime projection only. Signed URLs must never be persisted in a BIO.
// The pipeline's Layer 1 reader expects logo.url / dark_url; source IDs remain
// the durable certification identity and stay present in this projection.
export async function resolveFoundationForUse(brandId, visual = {}) {
  const ids = [...new Set([
    visual.logo?.sourceId,
    ...Object.values(visual.logo?.variants || {}).map(item=>item?.sourceId),
    ...(visual.type || []).map(font=>font?.sourceId),
  ].filter(Boolean))];
  const assets=ids.length ? await loadVisualAssets(brandId,{sourceIds:ids}) : {logos:[],fonts:[]};
  const logoUrls=new Map(assets.logos.map(item=>[item.id,item.url]));
  const fontUrls=new Map(assets.fonts.map(item=>[item.id,item.url]));
  const fontMetadata=new Map(assets.fonts.map(item=>[item.id,item.signals]));
  const variants=Object.fromEntries(Object.entries(visual.logo?.variants || {}).map(([key,item])=>[key,{...item,url:item.sourceId?logoUrls.get(item.sourceId)||null:item.url||null}]));
  const logo=visual.logo ? {
    ...visual.logo,
    ...(Object.keys(variants).length?{variants}:{}),
    url:variants.dark?.url || variants.light?.url || (visual.logo.sourceId?logoUrls.get(visual.logo.sourceId)||null:visual.logo.url||null),
    dark_url:variants.dark?.url || null,
    light_url:variants.light?.url || null,
  } : null;
  const type=(visual.type || []).map(font=>{
    const signals=fontMetadata.get(font.sourceId);
    return {...font,...(font.sourceId?{url:fontUrls.get(font.sourceId)||null}:{}),...(signals?{license:signals.license_type||null,suggest:signals.license_reference||null,rights_confirmed:signals.rights_confirmed===true}:{})};
  });
  const unresolved=[...ids].filter(id=>!logoUrls.has(id)&&!fontUrls.has(id));
  if(unresolved.length){const error=new Error('A certified foundation upload cannot be resolved');error.code='FOUNDATION_INCOMPLETE';error.status=409;error.missing=unresolved.map(id=>`source:${id}`);throw error;}
  return {...visual,logo,type};
}
