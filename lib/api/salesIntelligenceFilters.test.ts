import test from "node:test";
import assert from "node:assert/strict";
import { readList, toggleValue } from "../../components/sales-intelligence/lib/filter-state";

test("list filters read repeated or comma-separated values, and toggling adds or removes one", () => {
  const params = new URLSearchParams("classification=customer&classification=company,unknown&classification=");
  assert.deepEqual(readList(params, "classification"), ["customer", "company", "unknown"]);
  assert.deepEqual(readList(params, "missing"), []);
  assert.deepEqual(toggleValue(["customer"], "company"), ["customer", "company"]);
  assert.deepEqual(toggleValue(["customer", "company"], "customer"), ["company"]);
});
