import assert from "node:assert/strict";
import test from "node:test";
import {
  isHiddenFromMasterLeadsContainsReason,
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

test("contains reason helper recognizes the No-Sync skip", () => {
  assert.equal(isHiddenFromMasterLeadsContainsReason("no_sync"), true);
  assert.equal(isHiddenFromMasterLeadsContainsReason("created_on_unmatched"), false);
  assert.equal(isHiddenFromMasterLeadsContainsReason("missing_from_mongo"), false);
  assert.equal(isHiddenFromMasterLeadsContainsReason(undefined), false);
});

test("customers and agents are not sheet-contains resources", () => {
  assert.equal(isSheetContainsResource("customers"), false);
  assert.equal(isSheetContainsResource("agents"), false);
  assert.equal(isSheetContainsResource("form-leads"), true);
});
