import assert from "node:assert/strict";
import test from "node:test";
import { applyUrlStateUpdate } from "../lib/api/url-state-update";

test("consecutive panel writes keep an already-applied record", () => {
  const withRecord = applyUrlStateUpdate("", { record: "507f1f77bcf86cd799439011" }, { resetPage: false });
  const withPanel = applyUrlStateUpdate(withRecord.toString(), { panel: "summary" }, { resetPage: false });
  assert.equal(withPanel.get("record"), "507f1f77bcf86cd799439011");
  assert.equal(withPanel.get("panel"), "summary");
});

test("a later update can clear record, panel, and connect together", () => {
  const open = applyUrlStateUpdate("page=1", {
    record: "507f1f77bcf86cd799439011",
    panel: "message",
    connect: "1",
  }, { resetPage: false });
  const closed = applyUrlStateUpdate(open.toString(), {
    record: null,
    panel: null,
    connect: null,
  }, { resetPage: false });
  assert.equal(closed.get("record"), null);
  assert.equal(closed.get("panel"), null);
  assert.equal(closed.get("connect"), null);
  assert.equal(closed.get("page"), "1");
});
