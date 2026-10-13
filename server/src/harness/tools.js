// Tool permissions (HARNESS §3, CREWS §0.4). Only the image step may call an
// image model. Writer, specialist and reviewer roles on an image route are a
// hard reject, so a copy agent (a12, a16...) can never fire an image run.

export const IMAGE_ROUTE_PREFIX = "vendor/fal/";
export const ROLES = Object.freeze(["planner", "writer", "specialist", "reviewer", "ocr", "image"]);

export function isImageModelRoute(route) {
  return typeof route === "string" && route.startsWith(IMAGE_ROUTE_PREFIX);
}

export class ToolPermissionError extends Error {
  constructor(message) { super(message); this.code = "TOOL_NOT_PERMITTED"; this.status = 403; }
}

/** Throws unless `role` may call `route`. */
export function assertToolAllowed(role, route) {
  if (!ROLES.includes(role)) throw new ToolPermissionError(`Unknown harness role "${role}"`);
  const image = isImageModelRoute(route);
  if (image && role !== "image") throw new ToolPermissionError(`Role "${role}" may not call image route ${route}`);
  if (!image && role === "image") throw new ToolPermissionError(`Image step may only call image routes, got ${route}`);
  return true;
}

/* Legacy specialist runs: copy-department agents must not run on an image
   route (fixes a12 Conversion Copy producing images). */
export function assertSpecRouteAllowed(spec, route) {
  const dept = String(spec?.payload?.department || "").toLowerCase();
  if (dept === "copy" && isImageModelRoute(route)) {
    throw new ToolPermissionError(`Copy agent ${spec?.payload?.code || ""} may not call image route ${route}`.trim());
  }
  return true;
}
