import assert from "node:assert/strict";
import test from "node:test";
import type { GranotAutomationSource } from "./api/granotAutomation";
import {
  compatibleGranotSources,
  DEFAULT_GRANOT_OPERATIONS,
  defaultGranotSourceIds,
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
  {
    id: "best-forms",
    label: "Best Relocation Forms",
    active: true,
    supported_operations: ["form_leads"],
    created_from: "seed",
  },
  {
    id: "best-calls",
    label: "BestRelocation Inbounds",
    active: true,
    supported_operations: ["call_leads"],
    created_from: "seed",
  },
];

test("both Granot workflows are the default selection", () => {
  assert.deepEqual(DEFAULT_GRANOT_OPERATIONS, ["form_leads", "call_leads"]);
});

test("default selection chooses every compatible source except Best Relocation", () => {
  assert.deepEqual(defaultGranotSourceIds(sources, DEFAULT_GRANOT_OPERATIONS), [
    "form",
    "call",
    "both",
  ]);
  assert.deepEqual(
    submittedGranotSourceIds(sources, DEFAULT_GRANOT_OPERATIONS, null),
    ["form", "call", "both"],
  );
});

test("explicit select-all can include Best Relocation", () => {
  assert.deepEqual(
    submittedGranotSourceIds(
      sources,
      DEFAULT_GRANOT_OPERATIONS,
      sources.map((source) => source.id),
    ),
    ["form", "call", "both", "best-forms", "best-calls"],
  );
});

test("one workflow excludes incompatible sources", () => {
  assert.deepEqual(
    compatibleGranotSources(sources, ["form_leads"]).map((source) => source.id),
    ["form", "both", "best-forms"],
  );
  assert.deepEqual(
    submittedGranotSourceIds(
      sources,
      ["form_leads"],
      ["form", "call", "both", "best-forms", "best-calls"],
    ),
    ["form", "both", "best-forms"],
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

test("unavailable sources stay visible but cannot be submitted for apply", () => {
  const unavailable: GranotAutomationSource = {
    id: "missing-ref",
    label: "Unreviewed Source",
    active: true,
    supported_operations: ["form_leads"],
    created_from: "admin",
    compatibility: {
      available_for_apply: false,
      status: "missing_reference",
      issues: [
        {
          code: "granot_crm_source_reference_missing",
          message: "No reviewed Granot CRM source is linked.",
        },
      ],
    },
  };
  const withUnavailable = [...sources, unavailable];
  assert.equal(
    compatibleGranotSources(withUnavailable, ["form_leads"]).some(
      (source) => source.id === "missing-ref",
    ),
    true,
  );
  assert.deepEqual(
    submittedGranotSourceIds(
      withUnavailable,
      ["form_leads"],
      ["form", "missing-ref"],
    ),
    ["form"],
  );
  assert.equal(
    defaultGranotSourceIds(withUnavailable, ["form_leads"]).includes("missing-ref"),
    false,
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
