import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CompatibilityObservationStatement } from "../components/operations-registry/compatibility-observation-statement";
import { SETUP_SECTIONS } from "../components/setup/setup-sections";
import { type SetupWizardState } from "../components/setup/lead-sources/add-source-flow";
import {
  reviewExtras,
  SetupStepGranotName,
  SetupStepHowLeadsArrive,
  SetupStepLeadSource,
  SetupStepReview,
} from "../components/setup/lead-sources/add-source-screens";
import { FeedSheetForm } from "../components/setup/lead-sources/feed-sheet";
import { GranotNamesView, InboundNumbersView } from "../components/setup/lead-sources/flat-views";
import { GranotNameEditor } from "../components/setup/lead-sources/granot-name-sheet";
import { InboundNumberEditor, NumberCreateForm } from "../components/setup/lead-sources/inbound-number-sheet";
import { NeedsYouStrip } from "../components/setup/lead-sources/lead-sources-section";
import { EMPTY_LEAD_SOURCES_URL, patchLeadSourcesUrl } from "../components/setup/lead-sources/lead-sources-url";
import { needsYou } from "../components/setup/lead-sources/needs-you";
import { planReadiness } from "../lib/setup/readiness";
import { ReadinessBlock, ReadinessRows } from "../components/setup/lead-sources/readiness-panel";
import { SourceSheetForm } from "../components/setup/lead-sources/source-sheet";
import { SourceCardView, type TreeData } from "../components/setup/lead-sources/source-tree";
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

const hrefFor = (patch: Parameters<typeof patchLeadSourcesUrl>[1]) => patchLeadSourcesUrl(EMPTY_LEAD_SOURCES_URL, patch);

const tree: TreeData = {
  granotById: new Map(),
  routeById: new Map(),
  feedRecordById: new Map(),
  defaults: { "lead-source-best-relocation": { form: "feed-local", call: "feed-call" } },
  costByFeed: new Map(),
  now: Date.parse("2026-10-06T12:00:00Z"),
};

const company = {
  id: "company-1",
  _id: "company-1",
  company_slug: "paid_overflow",
  name: "Paid Overflow",
  owner_label: "Paid Overflow",
  aliases: ["Paid Over"],
  active: true,
  default_form_granularity: "feed-1",
  sheet_config: { spreadsheet_id: "sheet-abc", has_bad_tabs: false, projection_mode: "derived_import" as const },
  created_from: "admin",
};

const feed = {
  id: "feed-1",
  _id: "feed-1",
  source_company: "company-1",
  granularity_key: "paid_overflow",
  channel: "form" as const,
  owner_label: "Web forms",
  crm_label: "Paid Overflow",
  aliases: [],
  source_sites: ["paidoverflow.example"],
  priority: 1,
  active: true,
  sheet_tab_name: "Paid Overflow",
  schedule_revision: 2,
  created_from: "admin",
};

const noop = () => {};

const activeRoute = {
  id: "route-1",
  provider: "ringcentral" as const,
  phone_number: "+19545550142",
  phone_locked: true,
  display_label: "Best Relocation inbound queue",
  active: true,
  ever_activated: true,
  observed_target_names: [],
  validation_status: "valid" as const,
  validated_at: "2026-10-06T10:00:00.000Z",
  ringcentral_queue_name: "Best Relocation queue",
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
};

const wizardState: SetupWizardState = {
  name: "Paid Overflow",
  owner_label: "Paid Overflow",
  aliasesText: "",
  channel: "form",
  splitMoveTypes: true,
  alsoCalls: true,
  feed_display_name: "Web forms · local",
  crm_label: "Paid Overflow Locals",
  long_feed_display_name: "Web forms · long distance",
  long_crm_label: "Paid Overflow Long Distance",
  call_feed_display_name: "Inbound calls",
  call_crm_label: "Paid Overflow Inbounds",
  includeGranot: true,
  granotName: "Paid Overflow",
  when_lead_arrives: "create_if_missing",
  landing: "both",
  callGranotName: "Paid Overflow Calls",
  textConfigured: false,
  reason: "Owner created this draft lead source from the guided setup",
};

function surfaces(): ReactElement[] {
  const client = new QueryClient();
  const withClient = (child: ReactElement) => createElement(QueryClientProvider, { client }, child);
  const plan = planReadiness(ORS3_LEAD_SOURCE_DETAIL, { defaultFeedIdByChannel: { form: "feed-long" } });
  return [
    withClient(
      createElement(
        SourceCardView,
        { source: ORS3_LEAD_SOURCE_DETAIL, detail: ORS3_LEAD_SOURCE_DETAIL, tree, open: true, onToggle: noop, readOnly: false, hrefFor },
        createElement(ReadinessBlock, { detail: ORS3_LEAD_SOURCE_DETAIL, readOnly: false, hrefFor }),
      ),
    ),
    createElement(ReadinessRows, { plan, results: null, hrefFor, sourceId: "lead-source-best-relocation" }),
    createElement(NeedsYouStrip, { items: needsYou([ORS3_LEAD_SOURCE_DETAIL]) }),
    createElement(GranotNamesView, {
      rows: [
        {
          id: "g1",
          name: "Top10 Forms Prime",
          arrival: "existing_only",
          arrivalWord: "attach to a lead we have",
          live: false,
          textOn: false,
          landsNowhere: true,
          lands: [],
          warnings: [],
          sourceId: null,
        },
      ],
      readOnly: false,
      hrefFor,
    }),
    createElement(InboundNumbersView, {
      rows: [
        {
          id: "route-1",
          phone: "(954) 555-0142",
          nickname: "Best Relocation inbound queue",
          verification: "verified",
          verificationWord: "RingCentral verified",
          filing: "not_filing",
          filingWord: "Not filing",
          lastSeen: null,
          routeId: "route-1",
          active: false,
          source: null,
          feed: null,
          feedId: null,
          sourceId: null,
        },
      ],
      readOnly: false,
      hrefFor,
    }),
    createElement(FeedSheetForm, {
      mode: "edit",
      feed,
      company,
      siblings: [feed],
      readOnly: false,
      pending: false,
      error: null,
      saved: null,
      costHref: "/setup/lead-sources?edit=cost",
      onSave: noop,
      onCreate: noop,
      onMakeDefault: noop,
      onTurnOn: noop,
      onPreviewOff: async () => ({ entity_type: "feed", entity_id: "feed-1", active: true, dependencies: {}, total: 0 }),
      onConfirmOff: noop,
    }),
    createElement(SourceSheetForm, {
      company,
      readOnly: false,
      pending: false,
      error: null,
      saved: null,
      onSave: noop,
      onTurnOn: noop,
      onPreviewOff: async () => ({ entity_type: "company", entity_id: "company-1", active: true, dependencies: {}, total: 0 }),
      onConfirmOff: noop,
      onTest: async () => ({ status: "not_found" as const, identifier_kind: "company" as const, identifier: null }),
    }),
    createElement(SetupStepLeadSource, { state: wizardState, onChange: noop }),
    createElement(SetupStepHowLeadsArrive, { state: wizardState, onChange: noop }),
    createElement(SetupStepGranotName, { state: wizardState, onChange: noop }),
    createElement(SetupStepReview, {
      crmLabel: "Paid Overflow Locals",
      extras: reviewExtras(wizardState),
      preview: {
        valid: true,
        derived: {
          company_slug: "paid_overflow",
          granularity_key: "paid_overflow_local",
          owner_label: "Paid Overflow",
          feed_display_name: "Web forms · local",
        },
        collisions: [],
        readiness_plan: [{ gate: "Set the lead cost", command: "open_cpl" }],
      },
    }),
    createElement(GranotNameEditor, {
      mode: "create",
      companies: [],
      feeds: [],
      readOnly: false,
      isPending: false,
      onCreate: noop,
    }),
    createElement(InboundNumberEditor, {
      route: { ...activeRoute, validation_status: "invalid" },
      callFeeds: [],
      readOnly: true,
      isPending: false,
      nickname: "Best Relocation inbound queue",
      selectedFeedId: "feed-call",
      onNicknameChange: noop,
      onFeedChange: noop,
      onSave: noop,
      onValidate: noop,
      onActivate: noop,
      onDeactivate: noop,
    }),
    createElement(InboundNumberEditor, {
      route: activeRoute,
      callFeeds: [],
      readOnly: false,
      isPending: false,
      nickname: "Best Relocation inbound queue",
      selectedFeedId: "feed-call",
      onNicknameChange: noop,
      onFeedChange: noop,
      onSave: noop,
      onValidate: noop,
      onActivate: noop,
      onDeactivate: noop,
      onReassign: noop,
      showDeactivateConfirm: true,
    }),
    createElement(NumberCreateForm, { readOnly: false, pending: false, error: null, onCreate: noop }),
    createElement(CompatibilityObservationStatement, { remainingReads: 2 }),
  ];
}

test("primary Owner surfaces stay inside the language deck", () => {
  for (const element of surfaces()) {
    const markup = renderToStaticMarkup(element);
    const leaks = findOwnerMarkupLeaks(markup);
    assert.deepEqual(leaks, [], leaks.join(", "));
  }
  const nav = SETUP_SECTIONS.map((section) => `${section.label} ${section.purpose}`).join(" ");
  assert.deepEqual(findOwnerMarkupLeaks(nav), []);
});
