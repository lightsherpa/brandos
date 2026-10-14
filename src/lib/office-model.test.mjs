import { test } from "node:test";
import assert from "node:assert/strict";
import { officeModel, officeRoomFor } from "./office-model.js";

test("QA specialists sit in review rather than their production department", () => {
  assert.equal(officeRoomFor({ name: "Voice QA", dept: "Copy" }), "review");
  assert.equal(officeRoomFor({ name: "Social Captions", dept: "Copy" }), "copy");
});

test("output shelf does not duplicate a batch or expose unfinished streaming text", () => {
  const nodes = [
    { id: "spec-copy", kind: "specialist", specId: "copy", state: "done", outputText: "3 deliverables" },
    { id: "spec-copy-d0", kind: "deliverable", body: "First" },
    { id: "spec-copy-d1", kind: "deliverable", body: "Second", status: "flagged" },
    { id: "spec-other", kind: "specialist", specId: "other", state: "running", outputText: "Unfinished" },
    { id: "spec-image", kind: "specialist", specId: "image", state: "done", assetUrl: "/example.png" },
  ];
  const model = officeModel(nodes);
  assert.deepEqual(model.outputs.map(node => node.id), ["spec-copy-d0", "spec-copy-d1", "spec-image"]);
  assert.equal(model.finished, 2);
  assert.equal(model.active.length, 1);
  assert.equal(model.flagged, true);
});

test("failure remains visible alongside already completed outputs", () => {
  const model = officeModel([
    { id: "good", kind: "specialist", state: "done", outputText: "Saved output" },
    { id: "bad", kind: "specialist", state: "failed" },
  ]);
  assert.equal(model.failed, true);
  assert.equal(model.finished, 1);
  assert.equal(model.outputs.length, 1);
});

test("a specialist remains in the crew when its node becomes a mood board", () => {
  const model = officeModel([{ id: "spec-board", specId: "board", kind: "moodboard", state: "done", tiles: ["/tile.png"] }]);
  assert.equal(model.crew.length, 1);
  assert.equal(model.finished, 1);
  assert.equal(model.outputs.length, 1);
});
