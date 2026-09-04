import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ReconciliationLeadContacts,
  reconciliationLeadDisplayName,
} from "../components/reconciliation/reconciliation-lead-contacts";

test("reconciliationLeadDisplayName uses Granot contact when live fields are empty", () => {
  assert.equal(
    reconciliationLeadDisplayName(
      {
        name: "",
        granot_contact_snapshot: { name: "Granot Caller" },
        ingested_contact_snapshot: { name: "Ingested Caller" },
      },
      "fallback-id",
    ),
    "Granot Caller",
  );
});

test("reconciliation cards show Called plus Granot when search hits snapshot-only contact", () => {
  const markup = renderToStaticMarkup(
    createElement(ReconciliationLeadContacts, {
      source: {
        lead_model: "CallLead",
        name: "",
        phone_number: "",
        email: "",
        ingested_contact_snapshot: {
          name: "Ingested Caller",
          phone_number: "2125550101",
        },
        granot_contact_snapshot: {
          name: "Granot Caller",
          phone_number: "555-9999",
          email: "granot@example.invalid",
          differs_from_ingested: true,
        },
      },
    }),
  );

  assert.match(markup, /Called/);
  assert.match(markup, /Ingested Caller/);
  assert.match(markup, /2125550101/);
  assert.match(markup, /Granot Caller/);
  assert.match(markup, /555-9999/);
  assert.match(markup, /Changed in Granot/);
  assert.doesNotMatch(markup, /ingested_contact_snapshot|granot_contact_snapshot/);
});
