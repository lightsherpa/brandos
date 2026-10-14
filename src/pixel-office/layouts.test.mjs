import {test} from "node:test";
import assert from "node:assert/strict";
import {createPixelLayout, applyFloorTheme, readOfficePreferences, OFFICE_PRESETS} from "./layouts.js";

for (const preset of OFFICE_PRESETS) test(`${preset} provides unblocked working seats for a full crew`, () => {
  for (const count of [6, 20, 40, 60]) {
    const layout = createPixelLayout(preset, count);
    const seats = layout.furniture.filter(item => item.uid.startsWith("staff-seat-"));
    assert.ok(seats.length >= count + 1);
    for (const seat of seats) {
      assert.ok(seat.row < layout.rows - 1);
      assert.notEqual(layout.tiles[seat.row * layout.cols + seat.col], 0);
    }
    assert.equal(layout.tiles.length,layout.cols*layout.rows);
    assert.ok(layout.cols <= 64 && layout.rows <= 64);
  }
});

test("floor recoloring preserves walls and furniture positions", () => {
  const layout=createPixelLayout();
  const themed=applyFloorTheme(layout,"sage");
  assert.deepEqual(themed.furniture,layout.furniture);
  assert.deepEqual(themed.tileColors[0],layout.tileColors[0]);
  assert.equal(themed.tileColors[layout.cols+1].h,125);
});

test("saved offices recover safely from corrupted or oversized nested layouts", () => {
  const read=value=>readOfficePreferences({getItem:()=>value},"test");
  assert.equal(read("{invalid"),null);
  assert.equal(read(JSON.stringify({version:1,preset:"studio",layouts:{studio:{cols:1000,rows:1000}}})),null);
  const saved={version:1,preset:"classic",name:"My agency",layouts:{classic:createPixelLayout()}};
  assert.equal(read(JSON.stringify(saved)).name,"My agency");
});
