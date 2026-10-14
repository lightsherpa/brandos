export const OFFICE_PRESETS = ["classic", "studio", "headquarters"];
export const FLOOR_THEMES = {
  original: { h: 25, s: 48, b: -43, c: -88 },
  oak: { h: 32, s: 40, b: -18, c: -65 },
  sage: { h: 125, s: 24, b: -32, c: -70 },
  slate: { h: 215, s: 27, b: -36, c: -75 },
};

export function createPixelLayout(preset = "classic", crewCount = 6) {
  const seatCount = Math.max(8, Math.min(65, crewCount + 1));
  const columns = Math.max(preset === "headquarters" ? 4 : 3, Math.ceil(seatCount / 9));
  const deskRows = Math.ceil(seatCount / columns);
  const cols = Math.max(preset === "headquarters" ? 38 : 32, columns * 6 + 14);
  const rows = Math.max(preset === "headquarters" ? 25 : preset === "studio" ? 23 : 21, 7 + deskRows * 5 + (preset === "headquarters" ? 4 : 0));
  const tiles = Array(cols * rows).fill(preset === "classic" ? 7 : preset === "studio" ? 8 : 1);
  const base = FLOOR_THEMES[preset === "studio" ? "oak" : preset === "headquarters" ? "slate" : "original"];
  const tileColors = tiles.map(() => ({...base}));
  const furniture = [];
  const add = (uid, type, col, row) => furniture.push({uid, type, col, row});
  const wall = (col, row) => { tiles[row * cols + col] = 0; tileColors[row * cols + col] = {h:214,s:30,b:-100,c:-55}; };
  for (let col = 0; col < cols; col++) { wall(col, 0); wall(col, rows - 1); }
  for (let row = 0; row < rows; row++) { wall(0, row); wall(cols - 1, row); }
  // Main aisle remains open; rooms and lounge differ across presets.
  if (preset !== "studio") {
    const partition = cols - 11;
    for (let row = 1; row < rows - 1; row++) if (![8,9,10,rows - 5,rows - 4].includes(row)) wall(partition,row);
  }
  if (preset === "headquarters") {
    for (let col = 1; col < cols - 11; col++) if (![6,7,17,18].includes(col)) wall(col, 11);
  }
  for (let index = 0; index < seatCount; index++) {
    const col = 2 + (index % columns) * 6;
    let row = 4 + Math.floor(index / columns) * 5;
    if (preset === "headquarters" && row >= 9) row += 4;
    if (row + 3 >= rows - 1) continue;
    add(`desk-${index}`, "DESK_FRONT", col, row);
    add(`screen-${index}`, "PC_FRONT_OFF", col + 1, row);
    add(`staff-seat-${index}`, "CUSHIONED_BENCH", col + 1, row + 2);
  }
  const loungeX = cols - 8;
  for (let row = 2; row < rows - 4; row++) for (let col = loungeX - 1; col < cols - 2; col++) {
    tiles[row * cols + col] = 7;
    tileColors[row * cols + col] = preset === "studio" ? {h:25,s:30,b:-12,c:-80} : {h:209,s:39,b:-25,c:-80};
  }
  add("lounge-sofa-top", "SOFA_FRONT", loungeX, 4);
  add("lounge-coffee-table", "COFFEE_TABLE", loungeX, 6);
  add("lounge-coffee", "COFFEE", loungeX, 7);
  add("lounge-sofa-bottom", "SOFA_BACK", loungeX, 9);
  add("lounge-plant", "PLANT", cols - 3, 2);
  add("lounge-art", "LARGE_PAINTING", loungeX, -1);
  add("shelf-1", "DOUBLE_BOOKSHELF", 2, -1);
  add("shelf-2", "DOUBLE_BOOKSHELF", 9, -1);
  add("clock", "CLOCK", 6, -1);
  add("whiteboard", "WHITEBOARD", preset === "headquarters" ? 19 : 16, -1);
  add("plant-1", preset === "studio" ? "LARGE_PLANT" : "PLANT_2", 1, rows - 4);
  add("plant-2", "PLANT", cols - 3, rows - 4);
  if (preset === "studio") {
    add("studio-sofa", "SOFA_SIDE", 20, rows - 6);
    add("studio-table", "SMALL_TABLE_FRONT", 23, rows - 4);
    add("studio-cactus", "CACTUS", 26, rows - 4);
  }
  return {version:1, cols, rows, tiles, tileColors, furniture, pets:[], carpetTiles:[], areas:[], areaTiles:[]};
}

export function applyFloorTheme(layout, theme) {
  const color = FLOOR_THEMES[theme];
  if (!color) return layout;
  return {...layout, tileColors: layout.tiles.map((tile, index) => tile === 0 || tile === 255 ? layout.tileColors[index] : {...color})};
}

export function readOfficePreferences(storage, key) {
  try {
    const saved = JSON.parse(storage.getItem(key));
    if (!saved || saved.version !== 1 || !OFFICE_PRESETS.includes(saved.preset)) return null;
    for (const layout of [saved.layout, ...Object.values(saved.layouts || {})].filter(Boolean)) {
      if (!Number.isInteger(layout.cols) || !Number.isInteger(layout.rows) || layout.cols < 8 || layout.cols > 64 || layout.rows < 8 || layout.rows > 64 ||
        !Array.isArray(layout.tiles) || layout.tiles.length !== layout.cols * layout.rows || !layout.tiles.every(tile => Number.isInteger(tile) && (tile >= 0 && tile <= 9 || tile === 255)) ||
        !Array.isArray(layout.tileColors) || layout.tileColors.length !== layout.tiles.length || !Array.isArray(layout.furniture) || layout.furniture.length > 500 ||
        !layout.furniture.every(item => item && typeof item.uid === "string" && typeof item.type === "string" && Number.isInteger(item.col) && Number.isInteger(item.row) && item.col >= 0 && item.col < layout.cols && item.row >= -2 && item.row < layout.rows)) return null;
    }
    return saved;
  } catch { return null; }
}
