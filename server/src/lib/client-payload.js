// Browser payloads may describe the work, never which model or vendor produced it.
// Server run rows and in-memory ledgers keep those fields for settlement.

const VENDOR_KEYS = ["model", "fallback_from", "route"];

export function scrubVendorText(value, names = []) {
  if (typeof value !== "string" || !value) return value ?? null;
  let out = value;
  for (const name of names) {
    if (typeof name === "string" && name.length > 2) out = out.split(name).join("");
  }
  out = out.replace(/(?:vendor\/fal\/|openrouter\/|anthropic\/)[A-Za-z0-9._:/-]+/g, "");
  out = out.replace(/\b(?:fal|openrouter|anthropic|flux|recraft|nano-banana|gpt-image|claude|gemini)\b/gi, "");
  return out.replace(/[ \t]{2,}/g, " ").replace(/\s+([,:])/g, "$1").trim();
}

function hasVendorKey(record) {
  return !!record && typeof record === "object" && VENDOR_KEYS.some((key) => key in record);
}

function hasVendorText(value) {
  return typeof value === "string" && (/(?:vendor\/fal\/|openrouter\/|anthropic\/)/.test(value) || /\b(?:fal|openrouter|anthropic|flux|recraft|nano-banana|gpt-image|claude|gemini)\b/i.test(value));
}

export function imageHasVendor(image) {
  if (!image || typeof image !== "object") return false;
  if (hasVendorKey(image) || hasVendorText(image.error)) return true;
  return Array.isArray(image.attempts) && image.attempts.some((attempt) => hasVendorKey(attempt) || hasVendorText(attempt?.error));
}

export function metricsHasVendor(metrics) {
  if (!metrics || typeof metrics !== "object") return false;
  if ("models" in metrics) return true;
  return Array.isArray(metrics.ledger) && metrics.ledger.some((row) => hasVendorKey(row) || hasVendorText(row?.error));
}

export function clientAttempts(attempts = []) {
  return attempts.map((attempt) => ({
    ms: attempt?.ms,
    error: scrubVendorText(attempt?.error ?? null, [attempt?.route, attempt?.model, attempt?.fallback_from]),
    ocr_pass: attempt?.ocr_pass ?? attempt?.ocr?.pass ?? null,
  }));
}

export function clientImage(image, assetUrl) {
  if (!image) return null;
  const names = [image.model, image.fallback_from, image.route, ...(image.attempts || []).flatMap((attempt) => [attempt?.route, attempt?.model, attempt?.fallback_from])];
  return {
    rejected: !!image.rejected,
    asset_url: assetUrl,
    width: image.width,
    height: image.height,
    uses_reference: image.uses_reference,
    reference_count: image.reference_count,
    ocr: image.ocr || null,
    ms: image.ms,
    attempts: clientAttempts(image.attempts || []),
    error: scrubVendorText(image.error || null, names),
  };
}

export function clientItem(item) {
  if (!item?.image || !imageHasVendor(item.image)) return item;
  return { ...item, image: clientImage(item.image, item.image.asset_url ?? null) };
}

export function clientMetrics(metrics) {
  if (!metrics || typeof metrics !== "object") return metrics;
  const next = {};
  for (const [key, value] of Object.entries(metrics)) {
    if (key === "models") continue;
    if (key === "ledger" && Array.isArray(value)) {
      next.ledger = value.map((row) => {
        if (!row || typeof row !== "object") return row;
        const names = [row.model, row.fallback_from, row.route];
        const cleaned = {};
        for (const [field, fieldValue] of Object.entries(row)) {
          if (VENDOR_KEYS.includes(field)) continue;
          cleaned[field] = field === "error" ? scrubVendorText(fieldValue, names) : fieldValue;
        }
        return cleaned;
      });
      continue;
    }
    next[key] = value;
  }
  return next;
}

export function clientBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  let changed = false;
  const next = { ...body };
  if (Array.isArray(body.items)) {
    const items = body.items.map(clientItem);
    if (items.some((item, index) => item !== body.items[index])) { next.items = items; changed = true; }
  }
  if (body.item && typeof body.item === "object") {
    const item = clientItem(body.item);
    if (item !== body.item) { next.item = item; changed = true; }
  }
  if (metricsHasVendor(body.metrics)) { next.metrics = clientMetrics(body.metrics); changed = true; }
  if (body.snapshot && typeof body.snapshot === "object" && metricsHasVendor(body.snapshot.metrics)) {
    next.snapshot = { ...body.snapshot, metrics: clientMetrics(body.snapshot.metrics) };
    changed = true;
  }
  return changed ? next : body;
}
