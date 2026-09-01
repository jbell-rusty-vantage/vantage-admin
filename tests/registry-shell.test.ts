import assert from "node:assert/strict";
import test from "node:test";
import { REGISTRY_TABS } from "../components/operations-registry/registry-tabs";

test("Operations Registry tabs include Moving Carriers and Legacy CPL after CPL", () => {
  const ids = REGISTRY_TABS.map((tab) => tab.id);

  assert.deepEqual(ids, [
    "overview",
    "agents",
    "merchants",
    "sources",
    "granot-sources",
    "ringcentral",
    "moving-carriers",
    "cpl",
    "legacy-cpl",
    "changes",
  ]);

  const movingCarriers = REGISTRY_TABS.find((tab) => tab.id === "moving-carriers");
  const legacyCpl = REGISTRY_TABS.find((tab) => tab.id === "legacy-cpl");
  assert.equal(movingCarriers?.label, "Moving Carriers");
  assert.equal(legacyCpl?.label, "Legacy CPL");
});
