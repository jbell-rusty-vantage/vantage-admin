import assert from "node:assert/strict";
import test from "node:test";
import {
  isSheetContainsResource,
  sheetContainsEntityModel,
} from "./sheet-contains";

test("maps operational pages onto the Master Sheet entity models", () => {
  assert.equal(sheetContainsEntityModel("form-leads"), "FormLead");
  assert.equal(sheetContainsEntityModel("duplicate-form-leads"), "FormLead");
  assert.equal(sheetContainsEntityModel("call-leads"), "CallLead");
  assert.equal(sheetContainsEntityModel("duplicate-call-leads"), "CallLead");
  assert.equal(sheetContainsEntityModel("bookings"), "BookedLead");
  assert.equal(sheetContainsEntityModel("cancellations"), "CancelledLead");
});

test("customers and agents are not sheet-contains resources", () => {
  assert.equal(isSheetContainsResource("customers"), false);
  assert.equal(isSheetContainsResource("agents"), false);
  assert.equal(isSheetContainsResource("form-leads"), true);
});
