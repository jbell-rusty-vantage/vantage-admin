import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildSetupCommand,
  SetupStepGranotName,
  SetupStepHowLeadsArrive,
  SetupStepLeadSource,
  SetupStepReview,
  type SetupWizardState,
} from "../components/operations-registry/lead-sources/setup/lead-source-setup-wizard";

const base: SetupWizardState = {
  name: "Paid Overflow",
  owner_label: "Paid Overflow",
  aliasesText: "",
  channel: "form",
  splitMoveTypes: false,
  feed_display_name: "Web forms",
  crm_label: "Paid Overflow",
  includeGranot: null,
  granotName: "",
  when_lead_arrives: "existing_only",
  textConfigured: false,
  reason: "Owner created this draft lead source from the guided setup",
};

test("setup steps use the specified copy and skippable Granot name", () => {
  const step1 = renderToStaticMarkup(
    createElement(SetupStepLeadSource, { state: base, onChange() {} }),
  );
  assert.match(step1, /Who sends you these leads\?/);
  assert.match(step1, /Customer texts still say Vantage Movers/);
  assert.match(step1, /Show it as/);
  assert.match(step1, /Also accept these spellings/);

  const step2 = renderToStaticMarkup(
    createElement(SetupStepHowLeadsArrive, { state: base, onChange() {} }),
  );
  assert.match(step2, /Where do these leads come from\?/);
  assert.match(step2, /Web forms/);
  assert.match(step2, /Inbound calls/);
  assert.match(step2, /Do local and long-distance moves need to be tracked separately\?/);
  assert.match(step2, /What Vantage sends to Granot/);
  assert.match(step2, /Source Company column/);

  const skipped = renderToStaticMarkup(
    createElement(SetupStepGranotName, {
      state: { ...base, includeGranot: false },
      onChange() {},
    }),
  );
  assert.match(skipped, /Does Granot send you leads under a name for this source\?/);
  assert.match(skipped, /Not yet/);
  assert.match(skipped, /connect a Granot name/);

  const withText = renderToStaticMarkup(
    createElement(SetupStepGranotName, {
      state: {
        ...base,
        includeGranot: true,
        granotName: "Paid Overflow",
        when_lead_arrives: "create_if_missing",
      },
      onChange() {},
    }),
  );
  assert.match(withText, /Texting is set up after the Granot name is saved/);
  assert.match(withText, /Vantage Movers/);
});

test("review is preview-driven and Save as draft is the first commit", () => {
  const markup = renderToStaticMarkup(
    createElement(SetupStepReview, {
      crmLabel: "Paid Overflow",
      preview: {
        valid: true,
        derived: {
          company_slug: "paid_overflow",
          granularity_key: "paid_overflow",
          owner_label: "Paid Overflow",
          feed_display_name: "Web forms",
          normalized_granot_label: "paid overflow",
        },
        collisions: [],
        readiness_plan: [
          { gate: "Set the lead cost", command: "open_cpl" },
          { gate: "Activate the lead source", command: "setSourceCompanyActivation" },
        ],
      },
    }),
  );
  assert.match(markup, /You are creating/);
  assert.match(markup, /Paid Overflow — lead source/);
  assert.match(markup, /lands in: Paid Overflow → Web forms/);
  assert.match(markup, /Nothing is live yet/);
  assert.match(markup, /Set the lead cost/);

  const command = buildSetupCommand({ ...base, includeGranot: false });
  assert.equal(command.granot, null);
  assert.equal(command.channel, "form");
  assert.equal(command.crm_label, "Paid Overflow");
});
