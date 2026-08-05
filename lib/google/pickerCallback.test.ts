import assert from "node:assert/strict";
import test from "node:test";
import { interpretPickerCallback } from "./pickerCallback";

const actions = { PICKED: "picked", CANCEL: "cancel" };

test("Google Picker LOADED must be ignored so a later PICKED can succeed", () => {
  const loaded = interpretPickerCallback({ action: "loaded" }, actions);
  assert.equal(
    loaded.kind,
    "ignore",
    "LOADED must not settle the picker promise (Google fires it before PICKED)",
  );

  const picked = interpretPickerCallback(
    {
      action: "picked",
      docs: [{ id: "folder-1", name: "Exports", url: "https://drive.google.com/drive/folders/folder-1" }],
    },
    actions,
  );
  assert.deepEqual(picked, {
    kind: "picked",
    doc: {
      id: "folder-1",
      name: "Exports",
      url: "https://drive.google.com/drive/folders/folder-1",
      parentId: undefined,
    },
  });
});

test("Google Picker CANCEL settles as cancel", () => {
  assert.deepEqual(interpretPickerCallback({ action: "cancel" }, actions), {
    kind: "cancel",
  });
});

test("Google Picker PICKED without docs is an error", () => {
  assert.deepEqual(interpretPickerCallback({ action: "picked", docs: [] }, actions), {
    kind: "error",
    message: "Picker did not return a file ID.",
  });
});
