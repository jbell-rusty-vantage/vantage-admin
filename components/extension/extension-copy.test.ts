import assert from "node:assert/strict";
import test from "node:test";
import { EXTENSION_COPY } from "./extension-copy";

test("Extension copy explains Owner sync/search and Employee Binding Estimate Fee plus Tariff Adjustment", () => {
  assert.match(EXTENSION_COPY.ownerRole, /Owner/);
  assert.match(EXTENSION_COPY.ownerRole, /Enrichment/);
  assert.match(EXTENSION_COPY.ownerRole, /search/i);
  assert.match(EXTENSION_COPY.employeeRole, /Employee/);
  assert.match(EXTENSION_COPY.employeeRole, /Binding Estimate Fee/);
  assert.match(EXTENSION_COPY.employeeRole, /Tariff Adjustment/);
  assert.match(EXTENSION_COPY.pageHint, /Extension Users/);
  assert.match(EXTENSION_COPY.pageHint, /not Agents/);
});
