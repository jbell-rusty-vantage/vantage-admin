import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildSetupCommand,
  CommitError,
  commitSetup,
  costChangesFrom,
  createdFeeds,
  EMPTY_STATE,
  arrivalChoiceOf,
  withArrivalChoice,
  granotInAtomic,
  type CommitDeps,
  type SetupWizardState,
} from "../components/setup/lead-sources/add-source-flow";
import { FeedSheetForm, slugifyKey } from "../components/setup/lead-sources/feed-sheet";
import { GranotNameEditor } from "../components/setup/lead-sources/granot-name-sheet";
import { InboundNumberEditor, orderCallFeeds } from "../components/setup/lead-sources/inbound-number-sheet";
import { dependencyLines } from "../components/setup/lead-sources/lead-sources-model";
import { ownerDependencyWords } from "../components/setup/lead-sources/lead-sources-copy";
import { resolutionSentence } from "../components/setup/lead-sources/source-sheet";
import type { LeadSourceSetupCommand, LeadSourceSetupResult, OwnerGranotNameCommand } from "../lib/api/leadSources";
import type { SourceCompanyItem, SourceGranularityCreateInput, SourceGranularityItem } from "../lib/api/registrySources";

function state(overrides: Partial<SetupWizardState> = {}): SetupWizardState {
  return {
    ...EMPTY_STATE,
    name: "Top10 Leads",
    owner_label: "Top10 Leads",
    feed_display_name: "Web forms",
    crm_label: "Top10 Forms",
    ...overrides,
  };
}

function setupResult(command: LeadSourceSetupCommand): LeadSourceSetupResult {
  return {
    lead_source: { id: "company-1", company_slug: "top10_leads", name: command.name, owner_label: command.name, active: false, aliases: [] },
    feed: {
      id: "feed-first",
      granularity_key: command.move_type ? `top10_leads_${command.move_type}` : "top10_leads",
      channel: command.channel,
      display_name: command.feed_display_name ?? "Web forms",
      crm_label: command.crm_label,
      move_type: command.move_type,
      active: false,
    },
    granot_name: command.granot
      ? {
          id: "granot-first",
          name_received_from_granot: command.granot.name_received_from_granot,
          when_lead_arrives: command.granot.when_lead_arrives,
          when_lead_arrives_copy: "",
          text_state: "off",
        }
      : null,
    readiness_plan: [],
  };
}

function feedItem(body: SourceGranularityCreateInput, id: string): SourceGranularityItem {
  return {
    id,
    _id: id,
    source_company: body.source_company,
    granularity_key: body.granularity_key,
    channel: body.channel,
    owner_label: body.owner_label,
    crm_label: body.crm_label,
    aliases: [],
    source_sites: [],
    priority: 1,
    local: body.local ?? undefined,
    active: false,
    schedule_revision: 0,
    created_from: "admin",
  };
}

function recorder(failOn?: string) {
  const calls: string[] = [];
  const feeds: SourceGranularityCreateInput[] = [];
  const granots: OwnerGranotNameCommand[] = [];
  const deps: CommitDeps = {
    createSetup: async (command) => {
      calls.push("setup");
      return setupResult(command);
    },
    createFeed: async (body) => {
      calls.push(`feed:${body.granularity_key}`);
      if (failOn === `feed:${body.granularity_key}`) throw new Error("The feed could not be saved.");
      feeds.push(body);
      return feedItem(body, `feed-${body.channel}-${body.local ?? "any"}`);
    },
    createGranot: async (body) => {
      calls.push(`granot:${body.name_received_from_granot}`);
      if (failOn === `granot:${body.name_received_from_granot}`) throw new Error("The Granot name could not be saved.");
      granots.push(body);
      return {};
    },
  };
  return { deps, calls, feeds, granots };
}

// ── The atomic command and the choices ──────────────────────────────────────────────────────────────

test("the arrival choice is Web forms, Inbound calls or Both, and nothing picked is one web form feed", () => {
  assert.equal(arrivalChoiceOf(EMPTY_STATE), "form");
  assert.equal(arrivalChoiceOf({ channel: "form", alsoCalls: true }), "both");
  assert.equal(arrivalChoiceOf({ channel: "call", alsoCalls: false }), "call");
  const callOnly = withArrivalChoice(state({ splitMoveTypes: true }), "call");
  assert.equal(callOnly.channel, "call");
  assert.equal(callOnly.splitMoveTypes, false);
  assert.equal(callOnly.feed_display_name, "Inbound calls");
  const command = buildSetupCommand(state({ feed_display_name: "" }));
  assert.equal(command.channel, "form");
  assert.equal(command.feed_display_name, "Web forms");
});

test("a split form source saves the local feed atomically and carries the Granot name afterwards", () => {
  const split = state({ splitMoveTypes: true, includeGranot: true, granotName: "Top10 Forms", landing: "both" });
  const command = buildSetupCommand(split);
  assert.equal(command.move_type, "local");
  assert.equal(command.granot, null, "the name lands in two feeds, so a follow-up command creates it");
  assert.equal(granotInAtomic(split), false);
  assert.equal(granotInAtomic({ ...split, landing: "local_only" }), true);
  assert.deepEqual(buildSetupCommand({ ...split, landing: "local_only" }).granot, {
    name_received_from_granot: "Top10 Forms",
    when_lead_arrives: "existing_only",
  });
});

// ── Orchestration ───────────────────────────────────────────────────────────────────────────────────

test("one web form feed with a Granot name is one atomic command", async () => {
  const { deps, calls } = recorder();
  const progress = await commitSetup(state({ includeGranot: true, granotName: "Top10 Forms" }), deps);
  assert.deepEqual(calls, ["setup"]);
  assert.equal(createdFeeds(progress).length, 1);
});

test("Both with a Local and Long distance split creates the second form feed, the call feed and the Granot routes", async () => {
  const { deps, calls, feeds, granots } = recorder();
  const progress = await commitSetup(
    state({
      splitMoveTypes: true,
      alsoCalls: true,
      feed_display_name: "Web forms · local",
      crm_label: "Top10 Locals",
      long_feed_display_name: "Web forms · long distance",
      long_crm_label: "Top10 Long Distance",
      call_feed_display_name: "Inbound calls",
      call_crm_label: "Top10 Inbounds",
      includeGranot: true,
      granotName: "Top10 Forms",
      when_lead_arrives: "create_if_missing",
      callGranotName: "Top10 Inbounds",
    }),
    deps,
  );
  assert.deepEqual(calls, ["setup", "feed:top10_leads_long_distance", "feed:top10_leads_calls", "granot:Top10 Forms", "granot:Top10 Inbounds"]);
  assert.equal(feeds[0]?.local, "long_distance");
  assert.equal(feeds[0]?.channel, "form");
  assert.equal(feeds[1]?.channel, "call");
  assert.deepEqual(granots[0]?.destination, { kind: "form_by_move_type", local_feed_id: "feed-first", long_distance_feed_id: "feed-form-long_distance" });
  assert.equal(granots[0]?.when_lead_arrives, "create_if_missing");
  assert.deepEqual(granots[1]?.destination, { kind: "one_feed", feed_id: "feed-call-any" });
  assert.equal(granots[1]?.when_lead_arrives, "existing_only");
  assert.deepEqual(createdFeeds(progress).map((feed) => [feed.channel, feed.move_type]), [
    ["form", "local"],
    ["form", "long_distance"],
    ["call", undefined],
  ]);
});

test("a failure part-way keeps what was saved and resuming skips the finished steps", async () => {
  const failing = recorder("feed:top10_leads_calls");
  const both = state({ alsoCalls: true, call_crm_label: "Top10 Inbounds" });
  let progress;
  try {
    await commitSetup(both, failing.deps);
    assert.fail("expected the call feed to fail");
  } catch (caught) {
    assert.ok(caught instanceof CommitError);
    assert.match(caught.message, /The feed could not be saved/);
    progress = caught.progress;
    assert.ok(progress.result, "the draft source is kept");
  }
  const resuming = recorder();
  const done = await commitSetup(both, resuming.deps, progress);
  assert.deepEqual(resuming.calls, ["feed:top10_leads_calls"], "the atomic setup is not repeated");
  assert.ok(done.callFeed);
});

test("a call-only source puts the call feed in the atomic command", async () => {
  const { deps, calls } = recorder();
  const progress = await commitSetup(withArrivalChoice(state(), "call"), deps);
  assert.deepEqual(calls, ["setup"]);
  assert.deepEqual(createdFeeds(progress).map((feed) => feed.channel), ["call"]);
});

// ── Lead costs, call feeds, words ───────────────────────────────────────────────────────────────────

test("screen 5 writes one amount per feed, skipping blanks and invalid input, never $0 for a blank", () => {
  const feeds = [
    { id: "a", schedule_revision: 3 },
    { id: "b", schedule_revision: 0 },
    { id: "c", schedule_revision: 1 },
    { id: "d", schedule_revision: 2 },
  ];
  const { changes, expected_revisions } = costChangesFrom({ a: "205", b: "", c: "abc", d: " 18.5 " }, feeds);
  assert.deepEqual(changes, [
    { source_granularity_id: "a", amount: 205 },
    { source_granularity_id: "d", amount: 18.5 },
  ]);
  assert.deepEqual(expected_revisions, { a: 3, d: 2 });
});

const companies: SourceCompanyItem[] = [
  { id: "c1", _id: "c1", company_slug: "a", name: "Alpha", owner_label: "Alpha", aliases: [], active: true, sheet_config: { has_bad_tabs: false, projection_mode: "derived_import" }, created_from: "admin" },
  { id: "c2", _id: "c2", company_slug: "b", name: "Beta", owner_label: "Beta", aliases: [], active: true, sheet_config: { has_bad_tabs: false, projection_mode: "derived_import" }, created_from: "admin" },
];

function callFeed(id: string, company: string, label: string, active = true): SourceGranularityItem {
  return {
    id,
    _id: id,
    source_company: company,
    granularity_key: id,
    channel: "call",
    owner_label: label,
    crm_label: label,
    aliases: [],
    source_sites: [],
    priority: 1,
    active,
    schedule_revision: 1,
    created_from: "admin",
  };
}

test("the call feed list puts this lead source's active call feeds first, then every other source", () => {
  const feeds = [
    callFeed("f-beta", "c2", "Beta calls"),
    callFeed("f-alpha", "c1", "Alpha calls"),
    callFeed("f-off", "c1", "Alpha old", false),
    { ...callFeed("f-form", "c1", "Alpha forms"), channel: "form" as const },
  ];
  const groups = orderCallFeeds(feeds, companies, "c1");
  assert.deepEqual(groups, [
    { label: null, options: [{ id: "f-alpha", label: "Alpha calls" }] },
    { label: "Other lead sources", options: [{ id: "f-beta", label: "Beta · Beta calls" }] },
  ]);
  assert.deepEqual(orderCallFeeds(feeds, companies, null), [
    { label: null, options: [{ id: "f-beta", label: "Beta · Beta calls" }, { id: "f-alpha", label: "Alpha · Alpha calls" }] },
  ]);
});

test("server dependency keys are said in the Owner's words", () => {
  assert.equal(ownerDependencyWords("source_granularity_ids"), "feeds ids");
  assert.deepEqual(dependencyLines({ form_leads: 12, granularities: 0, lifecycle_routes: 2 }, ownerDependencyWords), ["12 form leads", "2 live routes"]);
  assert.equal(slugifyKey("Web forms · Long Distance"), "web_forms_long_distance");
});

test("the resolution test says where a lead would land in words", () => {
  assert.equal(
    resolutionSentence({
      status: "resolved",
      attribution: {
        company_id: "c",
        company_slug: "a",
        company_label_snapshot: "Alpha",
        granularity_id: "g",
        granularity_key: "a",
        granularity_label_snapshot: "Web forms",
        crm_label_snapshot: "Alpha",
        match_kind: "default",
        registry_revision: 1,
      },
    }),
    "It would land in Alpha · Web forms (the default feed).",
  );
  assert.match(resolutionSentence({ status: "not_found", identifier_kind: "company", identifier: null }), /Nothing matches/);
  assert.match(resolutionSentence({ status: "ambiguous", identifier_kind: "exact", identifier: "x", candidate_ids: [] }), /More than one feed/);
});

// ── Feed sheet ──────────────────────────────────────────────────────────────────────────────────────

const feedForm = {
  id: "feed-1",
  _id: "feed-1",
  source_company: "c1",
  granularity_key: "alpha_forms",
  channel: "form" as const,
  owner_label: "Web forms",
  crm_label: "Alpha",
  aliases: ["alpha web"],
  source_sites: ["alpha.example"],
  priority: 1,
  active: true,
  sheet_tab_name: "Alpha",
  schedule_revision: 2,
  created_from: "admin",
};

function feedSheet(props: Partial<Parameters<typeof FeedSheetForm>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(FeedSheetForm, {
      mode: "edit",
      feed: feedForm,
      company: { ...companies[0]!, default_form_granularity: "feed-1" },
      siblings: [feedForm],
      readOnly: false,
      pending: false,
      error: null,
      saved: null,
      costHref: "/setup/lead-sources?edit=cost&feed=feed-1",
      onSave() {},
      onCreate() {},
      onMakeDefault() {},
      onTurnOn() {},
      onPreviewOff: async () => ({ entity_type: "feed", entity_id: "feed-1", active: true, dependencies: {}, total: 0 }),
      onConfirmOff() {},
      ...props,
    }),
  );
}

test("the feed sheet has the doc's fields, the default pill and the quiet immutable keys", () => {
  const markup = feedSheet();
  for (const label of ["Show it as", "What Granot calls it", "Local or long distance", "Other spellings", "Website identifiers", "Sheet tab name"]) {
    assert.match(markup, new RegExp(label));
  }
  assert.match(markup, /This is the default feed for web form/);
  assert.match(markup, /Internal key alpha_forms/);
  assert.doesNotMatch(markup, /Make default for/);
  assert.match(markup, /See what turning it off affects/);
});

test("a feed that is on but not the default offers Make default; one that is off says turning it on makes it the default", () => {
  const notDefault = feedSheet({ company: { ...companies[0]!, default_form_granularity: "other-feed" } });
  assert.match(notDefault, /Make default for web form/);
  const off = feedSheet({ feed: { ...feedForm, active: false }, company: { ...companies[0]!, default_form_granularity: "other-feed" } });
  assert.doesNotMatch(off, /Make default for/);
  assert.match(off, /Turn this feed on/);
  assert.match(off, /Turning a feed on makes it the default for its channel/);
});

test("read-only roles see the sheet with every field disabled and no Save or On / Off buttons", () => {
  const markup = feedSheet({ readOnly: true });
  assert.match(markup, /only the owner can change it/);
  assert.match(markup, /<fieldset class="su-fields" disabled=""/);
  assert.doesNotMatch(markup, />Save</);
  assert.doesNotMatch(markup, /See what turning it off affects/);
  assert.doesNotMatch(markup, /Make default for/);
});

test("add a feed asks for the kind and the key, and says the key is fixed once the feed exists", () => {
  const markup = feedSheet({ mode: "create", feed: undefined });
  assert.match(markup, /How the leads arrive/);
  assert.match(markup, /Internal key/);
  assert.match(markup, /Add feed/);
});

// ── Granot name and inbound number sheets ───────────────────────────────────────────────────────────

const lockedRoute = {
  id: "route-1",
  provider: "ringcentral" as const,
  phone_number: "+19545550142",
  phone_locked: true,
  display_label: "Queue",
  active: true,
  ever_activated: true,
  observed_target_names: [],
  validation_status: "valid" as const,
  validated_at: "2026-10-06T10:00:00.000Z",
  created_from: "admin",
  current_assignment: {
    id: "a",
    route_id: "route-1",
    source_company_id: "c1",
    source_granularity_id: "f-call",
    lead_source_name: "Alpha",
    feed_display_name: "Inbound calls",
    effective_from: "2026-08-01T00:00:00.000Z",
    active: true,
  },
};

function numberSheet(readOnly: boolean, route = lockedRoute) {
  return renderToStaticMarkup(
    createElement(InboundNumberEditor, {
      route,
      callFeeds: [],
      companies,
      readOnly,
      isPending: false,
      nickname: "Queue",
      selectedFeedId: "f-call",
      onNicknameChange() {},
      onFeedChange() {},
      onSave() {},
      onValidate() {},
      onActivate() {},
      onDeactivate() {},
      onReassign() {},
    }),
  );
}

test("the number is locked after first activation and Reassign and Stop are offered to the Owner only", () => {
  const owner = numberSheet(false);
  assert.match(owner, /locked after the first time it is turned on/);
  assert.match(owner, /Stop filing new calls/);
  assert.match(owner, /File new calls under a different feed/);
  assert.match(owner, /Check against RingCentral/);
  const admin = numberSheet(true);
  assert.doesNotMatch(admin, /Stop filing new calls/);
  assert.doesNotMatch(admin, /File new calls under a different feed/);
  assert.doesNotMatch(admin, />Check against RingCentral</);
  assert.match(admin, /only the owner can change it/);
});

test("an unactivated number is editable and says changing it clears the check", () => {
  const draft = numberSheet(false, { ...lockedRoute, active: false, ever_activated: false, phone_locked: false, validation_status: "unvalidated" as never, current_assignment: undefined as never });
  assert.match(draft, /Changing it clears the RingCentral check/);
  assert.doesNotMatch(draft, /locked after the first time/);
});

test("the Granot name sheet is read-only for Admin: disabled fields, no Save", () => {
  const markup = renderToStaticMarkup(
    createElement(GranotNameEditor, {
      mode: "edit",
      source: {
        id: "g1",
        granot_label: "Top10 Forms",
        enabled: true,
        lifecycle_enabled: true,
        lifecycle_disposition: "source_scoped_lead",
        lead_created_policy: "link_only",
        lead_source_company: "c1",
        lifecycle_routes: [{ route_key: "form_any", lead_model: "FormLead", move_type: "any", source_granularity_id: "f1" }],
        lifecycle_policy_version: "v1",
        default_channel: "form",
        automation_sources: [],
      },
      companies,
      feeds: [],
      readOnly: true,
      isPending: false,
      onActivate() {},
    }),
  );
  assert.match(markup, /Read-only view/);
  assert.doesNotMatch(markup, />Save</);
  assert.doesNotMatch(markup, /Use in live processing|Turn live processing off/);
  assert.match(markup, /Live or not live/);
});

test("a Granot name that lands nowhere starts at Where it lands", () => {
  const markup = renderToStaticMarkup(
    createElement(GranotNameEditor, {
      mode: "edit",
      source: {
        id: "g1",
        granot_label: "Top10 Forms Prime",
        enabled: true,
        lifecycle_enabled: false,
        lifecycle_disposition: "source_scoped_lead",
        lead_created_policy: "link_only",
        lifecycle_routes: [],
        lifecycle_policy_version: "v1",
        default_channel: "form",
        automation_sources: [],
      },
      companies,
      feeds: [],
      readOnly: false,
      isPending: false,
      onSave() {},
    }),
  );
  assert.match(markup, /This Granot name lands nowhere yet/);
  assert.ok(markup.indexOf("lands nowhere yet") < markup.indexOf("Which feed does it connect to?"));
});
