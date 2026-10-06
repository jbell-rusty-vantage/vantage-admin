import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GranotNamesView } from "../components/setup/lead-sources/flat-views";
import { granotRows } from "../components/setup/lead-sources/lead-sources-model";
import { patchLeadSourcesUrl, EMPTY_LEAD_SOURCES_URL } from "../components/setup/lead-sources/lead-sources-url";
import { ReadinessBlock } from "../components/setup/lead-sources/readiness-panel";
import { FeedRowView, SourceCardView, type TreeData } from "../components/setup/lead-sources/source-tree";
import type { LeadSourceFeedProjection } from "../lib/api/leadSources";
import type { GranotCrmSourceItem } from "../lib/api/registryGranotCrmSources";
import {
  EMPTY_LEAD_SOURCE_DETAIL,
  ORS3_LEAD_SOURCE_DETAIL,
} from "../lib/operations-registry/ors3LeadSourceDetailFixture";

const hrefFor = (patch: Parameters<typeof patchLeadSourcesUrl>[1]) => patchLeadSourcesUrl(EMPTY_LEAD_SOURCES_URL, patch);

function tree(overrides: Partial<TreeData> = {}): TreeData {
  return {
    granotById: new Map(),
    routeById: new Map(),
    feedRecordById: new Map(),
    defaults: {},
    costByFeed: new Map(),
    now: Date.parse("2026-10-06T12:00:00Z"),
    ...overrides,
  };
}

function card(detail: typeof ORS3_LEAD_SOURCE_DETAIL, data: TreeData, readOnly = false) {
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(
        SourceCardView,
        { source: detail, detail, tree: data, open: true, onToggle() {}, readOnly, hrefFor },
        createElement(ReadinessBlock, { detail, readOnly, hrefFor }),
      ),
    ),
  );
}

test("the source card renders the feeds and the three leaf lines from one fixture", () => {
  const markup = card(ORS3_LEAD_SOURCE_DETAIL, tree());
  assert.match(markup, /Best Relocation/);
  assert.match(markup, /Web forms — local moves/);
  assert.match(markup, /Sheet names accepted: Best Relocation Locals/);
  assert.match(markup, /What Vantage sends to Granot: Best Relocation Locals/);
  // Changed: the old "Granot names landing here: X (create if missing; text on)" sentence is now a leaf line that
  // names the Granot name, the Owner's three words and the customer text chip (doc 19 "The tree").
  assert.match(markup, /Granot name/);
  assert.match(markup, /create the lead if missing/);
  assert.match(markup, /customer text on/);
  assert.match(markup, /Inbound calls/);
  // Changed: "Phone number: (954) 555-0142" and "Number nickname: …" are now one Inbound number leaf line.
  assert.match(markup, /Inbound number/);
  assert.match(markup, /\(954\) 555-0142/);
  assert.match(markup, /Best Relocation inbound queue/);
  assert.match(markup, /What Vantage sends to Granot: Best Relocation Inbounds/);
  assert.match(markup, /Use the local feed or the long-distance feed based on the move type/);
  assert.match(markup, /Waiting on: lead source active and lead cost valid/);
});

test("the Lead cost leaf says Missing in amber with Set lead cost, never $0", () => {
  const markup = card(ORS3_LEAD_SOURCE_DETAIL, tree());
  assert.match(markup, /su-missing[^>]*>Missing</);
  assert.match(markup, /Set lead cost/);
  assert.match(markup, /edit=cost/);
  assert.doesNotMatch(markup, /\$0/);
  // The long-distance feed's cost is Missing; the local feed's is Invalid.
  assert.match(markup, />Invalid</);
});

test("a priced feed shows the amount and the day it took effect", () => {
  const feed: LeadSourceFeedProjection = {
    ...ORS3_LEAD_SOURCE_DETAIL.feeds.items[0]!,
    readiness: { lead_source_active: true, feed_active: true, lead_cost: "ready", live: true },
  };
  const markup = renderToStaticMarkup(
    createElement(FeedRowView, {
      sourceId: "lead-source-best-relocation",
      feed,
      tree: tree({ costByFeed: new Map([[feed.id, { state: "ready", amount_cents: 20500, since: "2026-07-30" }]]) }),
      hasDetail: true,
      readOnly: false,
      hrefFor,
    }),
  );
  assert.match(markup, /\$205\.00 since Jul 30/);
});

test("the Default pill marks the company's default feed for its channel", () => {
  const feed = ORS3_LEAD_SOURCE_DETAIL.feeds.items[2]!;
  const props = { sourceId: "lead-source-best-relocation", feed, hasDetail: true, readOnly: false, hrefFor };
  const isDefault = renderToStaticMarkup(
    createElement(FeedRowView, { ...props, tree: tree({ defaults: { "lead-source-best-relocation": { call: feed.id } } }) }),
  );
  const notDefault = renderToStaticMarkup(createElement(FeedRowView, { ...props, tree: tree() }));
  assert.match(isDefault, />Default</);
  assert.doesNotMatch(notDefault, />Default</);
});

test("a wrong-channel route is a warning on the Granot name line", () => {
  const granot: GranotCrmSourceItem = {
    id: "granot-call",
    granot_label: "Best Relocation Calls",
    enabled: true,
    lifecycle_enabled: false,
    lifecycle_disposition: "source_scoped_lead",
    lead_created_policy: "link_only",
    lifecycle_routes: [
      {
        route_key: "call_any",
        lead_model: "CallLead",
        move_type: "any",
        source_granularity_id: "feed-call",
        source_granularity_status: "wrong_channel",
      },
    ],
    lifecycle_policy_version: "v1",
    default_channel: "call",
    automation_sources: [],
  };
  const markup = card(ORS3_LEAD_SOURCE_DETAIL, tree({ granotById: new Map([[granot.id, granot]]) }));
  assert.match(markup, /Lands in a feed of the wrong kind/);
});

test("read-only roles get Open instead of Edit and no Add a feed or Turn it on", () => {
  const markup = card(ORS3_LEAD_SOURCE_DETAIL, tree(), true);
  assert.doesNotMatch(markup, /Add a feed/);
  // The plan stays visible to read; only the button that runs it is hidden.
  assert.match(markup, /Turn it on/);
  assert.doesNotMatch(markup, /<button[^>]*>Turn it on</);
  assert.match(markup, />Open</);
});

test("findings render as chips with the translated deep link", () => {
  const markup = card(ORS3_LEAD_SOURCE_DETAIL, tree());
  assert.match(markup, /new leads have nowhere to land/);
  assert.match(markup, /Activate a feed as the default for this channel/);
  assert.match(markup, /href="\/setup\/lead-sources\?source=lead-source-best-relocation"/);
  assert.doesNotMatch(markup, /\/operations-registry/);
});

test("an empty lead source and empty leaf lines say so", () => {
  const empty = card(EMPTY_LEAD_SOURCE_DETAIL, tree());
  // Changed: "This lead source has no feeds yet." is now the card's "No feeds yet".
  assert.match(empty, /No feeds yet/);
  assert.match(empty, /Connect a Granot name/);

  const feed: LeadSourceFeedProjection = {
    id: "feed-empty",
    granularity_key: "empty_draft_call",
    channel: "call",
    display_name: "Inbound calls",
    crm_label: "Empty Draft Calls",
    active: false,
    readiness: { lead_source_active: false, feed_active: false, lead_cost: "missing", live: false },
    accepted_labels: { empty: true, items: [] },
    granot_names: { empty: true, items: [] },
    inbound_numbers: { empty: true, items: [] },
  };
  const props = { sourceId: "empty", hasDetail: true, readOnly: false, hrefFor, tree: tree() };
  const call = renderToStaticMarkup(createElement(FeedRowView, { ...props, feed }));
  // Changed: "This call feed has no inbound number" / "No Granot names land in this feed yet" are the leaf lines'
  // empty states, each with its link.
  assert.match(call, /No inbound number yet/);
  assert.match(call, /Add an inbound number/);
  assert.match(call, /No Granot name lands here yet/);
  assert.match(call, /Connect a Granot name/);

  const form = renderToStaticMarkup(
    createElement(FeedRowView, { ...props, feed: { ...feed, id: "feed-form", channel: "form", display_name: "Web forms" } }),
  );
  // Changed: "This feed has no accepted sheet names" is gone; the quiet fourth line shows only what is present.
  assert.doesNotMatch(form, /Sheet names accepted/);
  assert.doesNotMatch(form, /Inbound number/);
});

test("the Granot names view lists where each name lands, lands-nowhere first", () => {
  const base = {
    enabled: true,
    lifecycle_enabled: true,
    lifecycle_disposition: "source_scoped_lead" as const,
    lead_created_policy: "link_only" as const,
    lifecycle_policy_version: "v1",
    default_channel: "form" as const,
    automation_sources: [],
  };
  const rows = granotRows(
    [
      {
        ...base,
        id: "g-landed",
        granot_label: "Best Relocation",
        lifecycle_routes: [{ route_key: "form_any", lead_model: "FormLead", move_type: "any", source_granularity_id: "feed-forms" }],
      },
      { ...base, id: "g-nowhere", granot_label: "Top10 Forms Prime", lifecycle_routes: [] },
    ],
    [
      {
        id: "company-1",
        _id: "company-1",
        company_slug: "best",
        name: "Best Relocation",
        owner_label: "Best Relocation",
        aliases: [],
        active: true,
        sheet_config: { has_bad_tabs: false, projection_mode: "derived_import" },
        created_from: "admin",
      },
    ],
    [
      {
        id: "feed-forms",
        _id: "feed-forms",
        source_company: "company-1",
        granularity_key: "best",
        channel: "form",
        owner_label: "Web forms",
        crm_label: "Best",
        aliases: [],
        source_sites: [],
        priority: 1,
        active: true,
        schedule_revision: 1,
        created_from: "admin",
      },
    ],
  );
  assert.equal(rows[0]?.name, "Top10 Forms Prime");
  assert.equal(rows[0]?.landsNowhere, true);
  const markup = renderToStaticMarkup(createElement(GranotNamesView, { rows, readOnly: false, hrefFor }));
  assert.match(markup, /Lands nowhere/);
  // Changed: "lands in: Source → Feed" now belongs to this flat view, since a leaf under a feed already says where.
  assert.match(markup, /lands in: Best Relocation → Web forms/);
  assert.ok(markup.indexOf("Top10 Forms Prime") < markup.indexOf("Best Relocation"));
});
