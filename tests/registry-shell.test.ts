import assert from "node:assert/strict";
import test from "node:test";
import {
  LEGACY_REGISTRY_TAB_DROP_DATE,
  LEGACY_REGISTRY_TAB_REDIRECTS,
  parseRegistryTab,
  REGISTRY_TABS,
} from "../components/operations-registry/registry-tabs";

test("Operations Registry tabs use Owner labels and keep Moving Carriers and Legacy CPL", () => {
  const ids = REGISTRY_TABS.map((tab) => tab.id);
  assert.deepEqual(ids, [
    "overview",
    "agents",
    "merchants",
    "lead-sources",
    "granot-names",
    "inbound-numbers",
    "moving-carriers",
    "lead-costs",
    "legacy-cpl",
    "changes",
  ]);
  assert.equal(REGISTRY_TABS.find((tab) => tab.id === "lead-sources")?.label, "Lead sources");
  assert.equal(REGISTRY_TABS.find((tab) => tab.id === "granot-names")?.label, "Granot names");
  assert.equal(REGISTRY_TABS.find((tab) => tab.id === "inbound-numbers")?.label, "Inbound numbers");
  assert.equal(REGISTRY_TABS.find((tab) => tab.id === "lead-costs")?.label, "Lead costs");
  assert.equal(REGISTRY_TABS.find((tab) => tab.id === "moving-carriers")?.label, "Moving Carriers");
  assert.equal(REGISTRY_TABS.find((tab) => tab.id === "legacy-cpl")?.label, "Legacy CPL");
});

test("old ?tab= values still resolve to the renamed tabs", () => {
  assert.equal(parseRegistryTab("sources"), "lead-sources");
  assert.equal(parseRegistryTab("granot-sources"), "granot-names");
  assert.equal(parseRegistryTab("ringcentral"), "inbound-numbers");
  assert.equal(parseRegistryTab("cpl"), "lead-costs");
  assert.deepEqual(LEGACY_REGISTRY_TAB_REDIRECTS, {
    sources: "lead-sources",
    "granot-sources": "granot-names",
    ringcentral: "inbound-numbers",
    cpl: "lead-costs",
  });
  assert.equal(LEGACY_REGISTRY_TAB_DROP_DATE, "2026-12-01");
});
