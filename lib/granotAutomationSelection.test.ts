import assert from "node:assert/strict";
import test from "node:test";
import type { GranotAutomationSource } from "./api/granotAutomation";
import {
  compatibleGranotSources,
  DEFAULT_GRANOT_OPERATIONS,
  granotSubmitLabel,
  submittedGranotSourceIds,
} from "./granotAutomationSelection";

const sources: GranotAutomationSource[] = [
  {
    id: "form",
    label: "Form Source",
    active: true,
    supported_operations: ["form_leads"],
    created_from: "seed",
  },
  {
    id: "call",
    label: "Call Source",
    active: true,
    supported_operations: ["call_leads"],
    created_from: "seed",
  },
  {
    id: "both",
    label: "Shared Source",
    active: true,
    supported_operations: ["form_leads", "call_leads"],
    created_from: "admin",
  },
];

test("both Granot workflows are the default selection", () => {
  assert.deepEqual(DEFAULT_GRANOT_OPERATIONS, ["form_leads", "call_leads"]);
});

test("select-all chooses every compatible source exactly once", () => {
  assert.deepEqual(
    submittedGranotSourceIds(sources, DEFAULT_GRANOT_OPERATIONS, null),
    ["form", "call", "both"],
  );
});

test("one workflow excludes incompatible sources", () => {
  assert.deepEqual(
    compatibleGranotSources(sources, ["form_leads"]).map((source) => source.id),
    ["form", "both"],
  );
  assert.deepEqual(
    submittedGranotSourceIds(
      sources,
      ["form_leads"],
      ["form", "call", "both"],
    ),
    ["form", "both"],
  );
});

test("a dual-compatible source renders in both groups but submits one ID", () => {
  assert.equal(
    compatibleGranotSources(sources, ["form_leads"]).some(
      (source) => source.id === "both",
    ),
    true,
  );
  assert.equal(
    compatibleGranotSources(sources, ["call_leads"]).some(
      (source) => source.id === "both",
    ),
    true,
  );
  assert.deepEqual(
    submittedGranotSourceIds(
      sources,
      DEFAULT_GRANOT_OPERATIONS,
      ["both", "both"],
    ),
    ["both"],
  );
});

test("submit labels match the selected workflows", () => {
  assert.equal(granotSubmitLabel(["form_leads"]), "Create Form Lead plan");
  assert.equal(granotSubmitLabel(["call_leads"]), "Create Call Lead plan");
  assert.equal(
    granotSubmitLabel(DEFAULT_GRANOT_OPERATIONS),
    "Create 2 durable plans",
  );
});
