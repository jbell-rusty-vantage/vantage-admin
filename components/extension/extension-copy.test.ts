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
  assert.equal(EXTENSION_COPY.roleEmployee, "Employee");
  assert.equal("employeeOption" in EXTENSION_COPY, false);
  assert.match(EXTENSION_COPY.pageHint, /Extension Users/);
  assert.match(EXTENSION_COPY.pageHint, /not Agents/);
});
