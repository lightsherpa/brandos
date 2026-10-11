// Renderer specialists need the actual block schema, not a file name.
import fs from "node:fs";
const schema = JSON.parse(fs.readFileSync(new URL("./message-spec.schema.json", import.meta.url), "utf8"));
const BLOCKS = Object.freeze({ a25: "landing", a26: "email", a27: "deck" });
export function specialistFormatContract(specialistId) {
  const block = BLOCKS[specialistId];
  if (!block) return null;
  const contract = {
    type: "object", required: ["blocks"], additionalProperties: false,
    properties: { blocks: { type: "object", required: [block], additionalProperties: false,
      properties: { [block]: schema.properties.blocks.properties[block] } } },
    $defs: schema.$defs,
  };
  return `Return exactly one JSON object matching this schema. Fill only blocks.${block}; no Markdown, HTML, explanations or variants. This structured format takes precedence over the platform prose style. Use supplied facts only. Use the supplied image src and alt; if no image is supplied, src must be an empty string. Never invent asset URLs. Missing testimonial evidence means empty quote and attribution.\n${JSON.stringify(contract)}`;
}
