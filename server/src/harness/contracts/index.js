// Typed handoff contracts (HARNESS §1). Every handoff is validated before the
// next step reads it; an invalid payload never reaches a downstream step.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const load = (name) => JSON.parse(fs.readFileSync(path.join(here, name), "utf8"));
const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addSchema(load("image-brief.schema.json"));
const validators = {
  image_brief: ajv.getSchema("https://brandos.dev/schemas/image-brief.v1.json"),
  social_post: ajv.compile(load("social-spec.schema.json")),
  email_sequence: ajv.compile(load("email-spec.schema.json")),
  verdict: ajv.compile(load("verdict.schema.json")),
};

export function validateContract(name, value) {
  const v = validators[name];
  if (!v) throw new Error(`Unknown contract ${name}`);
  const ok = v(value);
  return ok ? { ok: true, errors: [] } : { ok: false, errors: (v.errors || []).map((e) => `${e.instancePath || "/"} ${e.message}`) };
}

export class ContractError extends Error {
  constructor(name, errors) { super(`${name} contract invalid: ${errors.slice(0, 4).join("; ")}`); this.code = "CONTRACT_INVALID"; this.errors = errors; }
}

export function assertContract(name, value) {
  const r = validateContract(name, value);
  if (!r.ok) throw new ContractError(name, r.errors);
  return value;
}
