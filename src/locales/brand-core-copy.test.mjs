import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const BANNED = [
  { name: "BIO", re: /\bBIO\b/ },
  { name: "brand profile", re: /brand profile/i },
  { name: "perfil de marca", re: /perfil de marca/i },
  { name: "brand brain", re: /brand brain/i },
];

function values(node, path, out) {
  if (typeof node === "string") {
    out.push([path, node]);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item, index) => values(item, `${path}[${index}]`, out));
    return;
  }
  if (node && typeof node === "object") {
    for (const key of Object.keys(node)) values(node[key], path ? `${path}.${key}` : key, out);
  }
}

test("locale values do not use the retired product names", () => {
  const dir = new URL("./", import.meta.url);
  const files = readdirSync(dir).filter((name) => name.endsWith(".json")).sort();
  assert.deepEqual(files, ["ar.json", "en.json", "es.json"]);
  for (const file of files) {
    const found = [];
    values(JSON.parse(readFileSync(new URL(file, dir), "utf8")), file, found);
    assert.ok(found.length > 0, file);
    for (const [path, value] of found) {
      for (const ban of BANNED) assert.doesNotMatch(value, ban.re, `${path} contains ${ban.name}`);
    }
  }
});
