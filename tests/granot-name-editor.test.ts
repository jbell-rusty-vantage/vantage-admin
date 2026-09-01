import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GranotNameEditor } from "../components/operations-registry/granot-names/granot-name-editor";
import {
  BEST_RELOCATION_MOVE_TYPE_REVIEW,
  TBM_PRIME_EXISTING_ONLY_REVIEW,
  TEXT_OFF_ON_POLICY_LEAVE,
  buildGranotReviewSentence,
} from "../lib/operations-registry/granotReviewSentence";

const companies = [
  {
    id: "lead-best",
    _id: "lead-best",
    company_slug: "best_relocation",
    name: "Best Relocation",
    owner_label: "Best Relocation",
    aliases: [],
    active: true,
    sheet_config: { has_bad_tabs: false, projection_mode: "derived_import" as const },
    created_from: "registry",
  },
  {
    id: "lead-tbm",
    _id: "lead-tbm",
    company_slug: "tbm_leads",
    name: "TBM Prime Leads",
    owner_label: "TBM Prime Leads",
    aliases: [],
    active: true,
    sheet_config: { has_bad_tabs: false, projection_mode: "derived_import" as const },
    created_from: "registry",
  },
];

const feeds = [
  {
    id: "feed-local",
    _id: "feed-local",
    source_company: "lead-best",
    granularity_key: "best_local",
    channel: "form" as const,
    owner_label: "Web forms — local moves",
    crm_label: "Best Relocation Locals",
    aliases: [],
    source_sites: [],
    priority: 1,
    local: "local" as const,
    active: true,
    schedule_revision: 1,
    created_from: "registry",
  },
  {
    id: "feed-forms",
    _id: "feed-forms",
    source_company: "lead-tbm",
    granularity_key: "tbm_forms",
    channel: "form" as const,
    owner_label: "TBM Prime Forms",
    crm_label: "TBM Prime Forms",
    aliases: [],
    source_sites: [],
    priority: 1,
    active: true,
    schedule_revision: 1,
    created_from: "registry",
  },
];

test("Granot name editor uses the specified step order and hides move-type by default", () => {
  const markup = renderToStaticMarkup(
    createElement(GranotNameEditor, {
      mode: "create",
      companies,
      feeds,
      readOnly: false,
      isPending: false,
      onCreate() {},
    }),
  );
  const nameAt = markup.indexOf("Name received from Granot");
  const kindAt = markup.indexOf("What kind of source is this?");
  const sourceAt = markup.indexOf("Which lead source?");
  const feedAt = markup.indexOf("Which feed does it connect to?");
  const arrivalAt = markup.indexOf("When a lead arrives");
  const reviewAt = markup.indexOf("Review");
  assert.ok(nameAt >= 0 && nameAt < kindAt && kindAt < sourceAt && sourceAt < feedAt);
  assert.ok(feedAt < arrivalAt && arrivalAt < reviewAt);
  assert.match(markup, /Different Feed for local and long-distance moves/);
  assert.equal(markup.includes("Local feed"), false);
  assert.match(markup, /Our lead source/);
  assert.match(markup, /Referral booking/);
  assert.match(markup, /Watch only/);
});

test("review sentences match the specification verbatim", () => {
  assert.equal(
    buildGranotReviewSentence({
      granotName: "Best Relocation",
      leadSourceName: "Best Relocation",
      routeKind: "form_by_move_type",
      whenLeadArrives: "create_if_missing",
      textOn: true,
      leavingCreateIfMissing: false,
    }).sentence,
    BEST_RELOCATION_MOVE_TYPE_REVIEW,
  );
  assert.equal(
    buildGranotReviewSentence({
      granotName: "TBM Forms Prime",
      leadSourceName: "TBM Prime Leads",
      feedName: "TBM Prime Forms",
      routeKind: "one_feed",
      whenLeadArrives: "existing_only",
      textOn: false,
      leavingCreateIfMissing: false,
    }).sentence,
    TBM_PRIME_EXISTING_ONLY_REVIEW,
  );
});

test("leaving create-if-missing states the text-off sentence before save", () => {
  const markup = renderToStaticMarkup(
    createElement(GranotNameEditor, {
      mode: "edit",
      source: {
        id: "granot-1",
        granot_label: "Best Relocation",
        enabled: true,
        lifecycle_enabled: false,
        lifecycle_disposition: "source_scoped_lead",
        lead_created_policy: "create_if_missing",
        lead_source_company: "lead-best",
        lifecycle_routes: [],
        lifecycle_policy_version: "v1",
        default_channel: "form",
        automation_sources: [],
      },
      companies,
      feeds,
      readOnly: false,
      isPending: false,
      onSave() {},
    }),
  );
  assert.match(markup, /Text the customer/);
  const leaving = buildGranotReviewSentence({
    granotName: "Best Relocation",
    leadSourceName: "Best Relocation",
    routeKind: "one_feed",
    whenLeadArrives: "existing_only",
    textOn: false,
    leavingCreateIfMissing: true,
  });
  assert.equal(leaving.textOffWarning, TEXT_OFF_ON_POLICY_LEAVE);
});
