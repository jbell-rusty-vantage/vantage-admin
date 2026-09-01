import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GranotNameEditor } from "../components/operations-registry/granot-names/granot-name-editor";
import { InboundNumberEditor } from "../components/operations-registry/inbound-numbers/inbound-number-editor";
import { LeadSourceDetailView } from "../components/operations-registry/lead-sources/lead-source-detail";
import {
  SetupStepGranotName,
  SetupStepHowLeadsArrive,
  SetupStepLeadSource,
  SetupStepReview,
} from "../components/operations-registry/lead-sources/setup/lead-source-setup-wizard";
import { CompatibilityObservationStatement } from "../components/operations-registry/compatibility-observation-statement";
import { REGISTRY_TABS } from "../components/operations-registry/registry-tabs";
import { ORS3_LEAD_SOURCE_DETAIL } from "../lib/operations-registry/ors3LeadSourceDetailFixture";
import {
  findOwnerMarkupLeaks,
  OWNER_LANGUAGE_DECK_BANNED_TERMS,
} from "../lib/operations-registry/ownerLanguageDeck";

test("admin banned-term list matches the shared six-term deck", () => {
  assert.deepEqual([...OWNER_LANGUAGE_DECK_BANNED_TERMS], [
    "granularity",
    "lifecycle",
    "disposition",
    "route_key",
    "lead_model",
    "policy_version",
  ]);
});

test("primary Owner surfaces stay inside the language deck", () => {
  const setupState = {
    name: "Paid Overflow",
    owner_label: "Paid Overflow",
    aliasesText: "",
    channel: "form" as const,
    splitMoveTypes: false,
    feed_display_name: "Web forms",
    crm_label: "Paid Overflow",
    includeGranot: true as const,
    granotName: "Paid Overflow",
    when_lead_arrives: "create_if_missing" as const,
    textConfigured: false,
    reason: "Owner created this draft lead source from the guided setup",
  };
  const surfaces = [
    renderToStaticMarkup(
      createElement(LeadSourceDetailView, {
        detail: ORS3_LEAD_SOURCE_DETAIL,
        readOnly: false,
        onReadinessAction() {},
      }),
    ),
    renderToStaticMarkup(
      createElement(GranotNameEditor, {
        mode: "create",
        companies: [],
        feeds: [],
        readOnly: false,
        isPending: false,
        onCreate() {},
      }),
    ),
    renderToStaticMarkup(createElement(SetupStepLeadSource, { state: setupState, onChange() {} })),
    renderToStaticMarkup(createElement(SetupStepHowLeadsArrive, { state: setupState, onChange() {} })),
    renderToStaticMarkup(createElement(SetupStepGranotName, { state: setupState, onChange() {} })),
    renderToStaticMarkup(
      createElement(SetupStepReview, {
        crmLabel: "Paid Overflow",
        preview: {
          valid: true,
          derived: {
            company_slug: "paid_overflow",
            granularity_key: "paid_overflow",
            owner_label: "Paid Overflow",
            feed_display_name: "Web forms",
          },
          collisions: [],
          readiness_plan: [{ gate: "Set the lead cost", command: "open_cpl" }],
        },
      }),
    ),
    renderToStaticMarkup(
      createElement(InboundNumberEditor, {
        route: {
          id: "route-1",
          provider: "ringcentral",
          phone_number: "+19545550142",
          phone_locked: true,
          display_label: "Best Relocation inbound queue",
          active: true,
          ever_activated: true,
          observed_target_names: [],
          validation_status: "invalid",
          created_from: "admin",
          current_assignment: {
            id: "assign-1",
            route_id: "route-1",
            source_company_id: "company-1",
            source_granularity_id: "feed-call",
            lead_source_name: "Best Relocation",
            feed_display_name: "Inbound calls",
            effective_from: "2026-08-03T00:00:00.000Z",
            active: true,
          },
        },
        callFeeds: [],
        readOnly: true,
        isPending: false,
        nickname: "Best Relocation inbound queue",
        selectedFeedId: "feed-call",
        onNicknameChange() {},
        onFeedChange() {},
        onSave() {},
        onValidate() {},
        onActivate() {},
        onDeactivate() {},
      }),
    ),
    renderToStaticMarkup(createElement(CompatibilityObservationStatement, { remainingReads: 2 })),
    REGISTRY_TABS.map((tab) => tab.label).join(" "),
  ];

  for (const markup of surfaces) {
    const leaks = findOwnerMarkupLeaks(markup);
    assert.deepEqual(leaks, [], leaks.join(", "));
  }
});
