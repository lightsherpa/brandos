import { setCharacterTemplates } from "../vendor/pixel-agents/webview-ui/src/office/sprites/spriteData.ts";
import { setFloorSprites } from "../vendor/pixel-agents/webview-ui/src/office/floorTiles.ts";
import { setWallSprites } from "../vendor/pixel-agents/webview-ui/src/office/wallTiles.ts";
import { setCarpetSprites } from "../vendor/pixel-agents/webview-ui/src/office/sprites/carpetTiles.ts";
import { buildDynamicCatalog } from "../vendor/pixel-agents/webview-ui/src/office/layout/furnitureCatalog.ts";

let loading;
async function json(path) {
  const response = await fetch(`/pixel-office/${path}`);
  if (!response.ok) throw new Error(`Office asset unavailable: ${path}`);
  return response.json();
}
async function image(path) {
  const response = await fetch(`/pixel-office/assets/${path}`);
  if (!response.ok) throw new Error(`Office sprite unavailable: ${path}`);
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width; canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0); bitmap.close();
  return { width: canvas.width, data: ctx.getImageData(0, 0, canvas.width, canvas.height).data };
}
function sprite(png, width, height, x = 0, y = 0) {
  return Array.from({ length: height }, (_, row) => Array.from({ length: width }, (_, col) => {
    const i = ((y + row) * png.width + x + col) * 4;
    const [r, g, b, a] = png.data.slice(i, i + 4);
    if (a < 2) return "";
    return `#${[r, g, b, ...(a < 255 ? [a] : [])].map(value => value.toString(16).padStart(2, "0")).join("")}`;
  }));
}

export function loadPixelAssets() {
  if (loading) return loading;
  loading = (async () => {
    const [index, catalog] = await Promise.all([json("index.json"), json("catalog.json")]);
    const [characters, floors, walls, furniture, carpets] = await Promise.all([
      Promise.all(index.characters.map(async file => {
        const png = await image(`characters/${file}`);
        return Object.fromEntries(["down", "up", "right"].map((direction, row) => [direction,
          Array.from({length: 7}, (_, frame) => sprite(png, 16, 32, frame * 16, row * 32))]));
      })),
      Promise.all(index.floors.map(async file => sprite(await image(`floors/${file}`), 16, 16))),
      Promise.all(index.walls.map(async file => {
        const png = await image(`walls/${file}`);
        return Array.from({length: 16}, (_, mask) => sprite(png, 16, 32, mask % 4 * 16, Math.floor(mask / 4) * 32));
      })),
      Promise.all(catalog.map(async item => [item.id, sprite(await image(item.furniturePath), item.width, item.height)])),
      Promise.all(["carpet_0.png"].map(async file => {
        const png = await image(`carpets/${file}`);
        return Array.from({length: 16}, (_, mask) => sprite(png, 16, 16, mask % 4 * 16, Math.floor(mask / 4) * 16));
      })),
    ]);
    setCharacterTemplates(characters); setFloorSprites(floors); setWallSprites(walls); setCarpetSprites(carpets);
    if (!buildDynamicCatalog({catalog, sprites: Object.fromEntries(furniture)})) throw new Error("Office furniture catalog is empty");
    return { catalog, characterCount: characters.length };
  })().catch(error => { loading = null; throw error; });
  return loading;
}
