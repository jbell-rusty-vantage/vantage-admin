import assert from "node:assert/strict";
import test from "node:test";
import { EXTENSION_COPY } from "./extension-copy";

test("Extension copy explains Owner, Sales, and Customer Service capabilities", () => {
  assert.match(EXTENSION_COPY.ownerRole, /Owner/);
  assert.match(EXTENSION_COPY.ownerRole, /Enrichment/);
  assert.match(EXTENSION_COPY.ownerRole, /search/i);
  assert.match(EXTENSION_COPY.ownerRole, /Binding Estimate Fee/);
  assert.match(EXTENSION_COPY.ownerRole, /Tariff Adjustment/);
  assert.match(EXTENSION_COPY.salesRole, /Sales/);
  assert.match(EXTENSION_COPY.salesRole, /Binding Estimate Fee/);
  assert.match(EXTENSION_COPY.customerServiceRole, /Customer Service/);
  assert.match(EXTENSION_COPY.customerServiceRole, /Tariff Adjustment/);
  assert.equal(EXTENSION_COPY.salesOption, "Sales");
  assert.equal(EXTENSION_COPY.customerServiceOption, "Customer Service");
  assert.equal(EXTENSION_COPY.ownerOption, "Owner");
  assert.equal("employeeOption" in EXTENSION_COPY, false);
  assert.equal("roleEmployee" in EXTENSION_COPY, false);
  assert.match(EXTENSION_COPY.pageHint, /create/i);
  assert.match(EXTENSION_COPY.pageHint, /edit/i);
  assert.match(EXTENSION_COPY.pageHint, /delete/i);
  assert.match(EXTENSION_COPY.pageHint, /Sales/);
  assert.match(EXTENSION_COPY.pageHint, /Customer Service/);
  assert.match(EXTENSION_COPY.pageHint, /Extension Users/);
  assert.match(EXTENSION_COPY.pageHint, /not Agents/);
});

test("Extension copy covers edit and delete", () => {
  assert.equal(EXTENSION_COPY.editButton, "Edit");
  assert.equal(EXTENSION_COPY.saveButton, "Save");
  assert.equal(EXTENSION_COPY.savingButton, "Saving…");
  assert.equal(EXTENSION_COPY.cancelButton, "Cancel");
  assert.equal(EXTENSION_COPY.updated, "Extension User updated.");
  assert.equal(EXTENSION_COPY.deleted, "Extension User deleted.");
  assert.equal(EXTENSION_COPY.rolesRequired, "Choose at least one role.");
  assert.match(EXTENSION_COPY.passwordEditHint, /Leave blank to keep the current password/);
  assert.equal(EXTENSION_COPY.deleteButton, "Delete");
  assert.equal(EXTENSION_COPY.deleteConfirmButton, "Delete");
  assert.equal(EXTENSION_COPY.cancelDeleteButton, "Cancel");
  assert.match(
    EXTENSION_COPY.deleteConfirm("rep@example.invalid"),
    /rep@example.invalid/,
  );
  assert.match(
    EXTENSION_COPY.deleteConfirm("rep@example.invalid"),
    /extension session ends immediately/,
  );
});
